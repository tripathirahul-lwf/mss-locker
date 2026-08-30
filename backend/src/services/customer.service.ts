import { Types } from 'mongoose';
import { Customer, ICustomer } from '../models/Customer';
import {
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerQueryParams,
  CheckDuplicateCustomerInput,
} from '../validators/customer.validator';
import { normalizePhone } from '../utils/phone';
import { recordAuditLog } from '../utils/auditLogger';

export interface PaginatedCustomersResult {
  customers: Partial<ICustomer>[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CustomerStatsResult {
  total: number;
  active: number;
  inactive: number;
  blocked: number;
  archived: number;
  kycPending: number;
  kycPartial: number;
  kycVerified: number;
  kycRejected: number;
  kycExpired: number;
}

export class CustomerService {
  /**
   * Generates a unique customer code (e.g. CUS-000001).
   */
  private static async generateCustomerCode(): Promise<string> {
    const count = await Customer.countDocuments();
    let nextNum = count + 1;
    let code = `CUS-${String(nextNum).padStart(6, '0')}`;

    while (await Customer.exists({ customerCode: code })) {
      nextNum += 1;
      code = `CUS-${String(nextNum).padStart(6, '0')}`;
    }

    return code;
  }

  /**
   * Check for potential duplicate customers by phone or email.
   */
  static async checkDuplicate(
    input: CheckDuplicateCustomerInput
  ): Promise<{ hasDuplicate: boolean; duplicates: Partial<ICustomer>[] }> {
    const normalizedPhone = normalizePhone(input.phone);
    const filter: Record<string, unknown> = {
      isActive: true,
      $or: [{ phone: normalizedPhone }, { phone: input.phone.trim() }],
    };

    if (input.email && input.email.trim()) {
      (filter.$or as any[]).push({ email: input.email.trim().toLowerCase() });
    }

    if (input.excludeCustomerId && Types.ObjectId.isValid(input.excludeCustomerId)) {
      filter._id = { $ne: new Types.ObjectId(input.excludeCustomerId) };
    }

    const duplicates = await Customer.find(filter)
      .select('customerCode fullName phone email status kycStatus')
      .limit(5);

    return {
      hasDuplicate: duplicates.length > 0,
      duplicates,
    };
  }

  /**
   * List customers with server-side pagination, search, and filtering.
   */
  static async getCustomers(
    params: CustomerQueryParams,
    canViewSensitive: boolean
  ): Promise<PaginatedCustomersResult> {
    const {
      page = 1,
      limit = 25,
      search,
      status,
      kycStatus,
      city,
      state,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const filter: Record<string, unknown> = {};

    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (kycStatus && kycStatus !== 'ALL') {
      const values = kycStatus.split(',');
      filter.kycStatus = values.length > 1 ? { $in: values } : values[0];
    }

    if (city) {
      filter.city = { $regex: city, $options: 'i' };
    }

    if (state) {
      filter.state = { $regex: state, $options: 'i' };
    }

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      filter.$or = [
        { customerCode: searchRegex },
        { fullName: searchRegex },
        { phone: searchRegex },
        { alternatePhone: searchRegex },
        { email: searchRegex },
      ];
    }

    const sortOptions: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === 'desc' ? -1 : 1,
    };

    const skip = (page - 1) * limit;

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .select('customerCode fullName phone email city state photoUrl kycStatus status isActive createdAt updatedAt')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments(filter),
    ]);

    return {
      customers: customers.map((customer) => {
        if (canViewSensitive) return customer as unknown as Partial<ICustomer>;
        const digits = String(customer.phone || '').replace(/\D/g, '');
        const email = customer.email || '';
        const [name, domain] = email.split('@');
        return {
          ...customer,
          phone: digits.length >= 4 ? `••••••${digits.slice(-4)}` : 'Restricted',
          email: name && domain ? `${name.slice(0, 2)}•••@${domain}` : undefined,
        } as unknown as Partial<ICustomer>;
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single customer by ID.
   */
  static async getCustomerById(
    id: string,
    _canViewSensitive: boolean
  ): Promise<ICustomer> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('Invalid customer ID');
    }

    const customer = await Customer.findById(id)
      .populate('createdBy', 'name username')
      .populate('updatedBy', 'name username')
      .populate('kycVerifiedBy', 'name username');

    if (!customer) {
      throw new Error('Customer not found');
    }

    return customer;
  }

  /**
   * Get aggregated customer & KYC statistics.
   */
  static async getCustomerStats(): Promise<CustomerStatsResult> {
    const [total, statusCounts, kycCounts] = await Promise.all([
      Customer.countDocuments({ isActive: true }),
      Customer.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Customer.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$kycStatus', count: { $sum: 1 } } },
      ]),
    ]);

    const getCount = (arr: any[], id: string) => {
      const match = arr.find((item) => item._id === id);
      return match ? match.count : 0;
    };

    return {
      total,
      active: getCount(statusCounts, 'ACTIVE'),
      inactive: getCount(statusCounts, 'INACTIVE'),
      blocked: getCount(statusCounts, 'BLOCKED'),
      archived: getCount(statusCounts, 'ARCHIVED'),
      kycPending: getCount(kycCounts, 'PENDING'),
      kycPartial: getCount(kycCounts, 'PARTIAL'),
      kycVerified: getCount(kycCounts, 'VERIFIED'),
      kycRejected: getCount(kycCounts, 'REJECTED'),
      kycExpired: getCount(kycCounts, 'EXPIRED'),
    };
  }

  /**
   * Register a new customer.
   */
  static async createCustomer(
    input: CreateCustomerInput,
    actorUserId?: string,
    actorUsername?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ICustomer> {
    const normalizedPhone = normalizePhone(input.phone);
    const customerCode = await this.generateCustomerCode();

    // Auto-split names if not given
    const nameParts = input.fullName.trim().split(/\s+/);
    const firstName = input.firstName || nameParts[0] || '';
    const lastName =
      input.lastName ||
      (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');

    const customer = new Customer({
      ...input,
      customerCode,
      fullName: input.fullName.trim(),
      firstName,
      lastName,
      phone: normalizedPhone,
      alternatePhone: input.alternatePhone ? normalizePhone(input.alternatePhone) : '',
      email: input.email ? input.email.trim().toLowerCase() : '',
      kycStatus: 'PENDING',
      status: input.status || 'ACTIVE',
      isActive: true,
      createdBy: actorUserId ? new Types.ObjectId(actorUserId) : undefined,
      updatedBy: actorUserId ? new Types.ObjectId(actorUserId) : undefined,
    });

    await customer.save();

    await recordAuditLog({
      actorUserId,
      actorUsername,
      action: 'CUSTOMER_CREATED',
      entityType: 'CUSTOMER',
      entityId: customer._id.toString(),
      description: `Created customer profile ${customer.fullName} (${customer.customerCode})`,
      ipAddress,
      userAgent,
      metadata: {
        customerCode: customer.customerCode,
        fullName: customer.fullName,
        phone: customer.phone,
        status: customer.status,
      },
    });

    return customer;
  }

  /**
   * Update an existing customer profile.
   */
  static async updateCustomer(
    id: string,
    input: UpdateCustomerInput,
    actorUserId?: string,
    actorUsername?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ICustomer> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('Invalid customer ID');
    }

    const customer = await Customer.findById(id);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Concurrency Check
    if (input.expectedUpdatedAt) {
      const currentUpdated = new Date(customer.updatedAt).toISOString();
      const expectedUpdated = new Date(input.expectedUpdatedAt).toISOString();
      if (currentUpdated !== expectedUpdated) {
        throw new Error(
          'Conflict: Customer record has been modified by another operator. Please refresh and try again.'
        );
      }
    }

    const changedFields: string[] = [];
    const previousStatus = customer.status;

    if (input.fullName !== undefined && input.fullName.trim() !== customer.fullName) {
      customer.fullName = input.fullName.trim();
      changedFields.push('fullName');
    }
    if (input.phone !== undefined) {
      const norm = normalizePhone(input.phone);
      if (norm !== customer.phone) {
        customer.phone = norm;
        changedFields.push('phone');
      }
    }
    if (input.alternatePhone !== undefined) {
      customer.alternatePhone = input.alternatePhone ? normalizePhone(input.alternatePhone) : '';
      changedFields.push('alternatePhone');
    }
    if (input.email !== undefined) {
      customer.email = input.email.trim().toLowerCase();
      changedFields.push('email');
    }
    if (input.dateOfBirth !== undefined) {
      customer.dateOfBirth = input.dateOfBirth;
      changedFields.push('dateOfBirth');
    }
    if (input.gender !== undefined) {
      customer.gender = input.gender;
      changedFields.push('gender');
    }
    if (input.address !== undefined) {
      customer.address = input.address.trim();
      changedFields.push('address');
    }
    if (input.city !== undefined) {
      customer.city = input.city.trim();
      changedFields.push('city');
    }
    if (input.state !== undefined) {
      customer.state = input.state.trim();
      changedFields.push('state');
    }
    if (input.postalCode !== undefined) {
      customer.postalCode = input.postalCode.trim();
      changedFields.push('postalCode');
    }
    if (input.country !== undefined) {
      customer.country = input.country.trim();
      changedFields.push('country');
    }
    if (input.photoUrl !== undefined) {
      customer.photoUrl = input.photoUrl.trim();
      changedFields.push('photoUrl');
    }
    if (input.notes !== undefined) {
      customer.notes = input.notes.trim();
      changedFields.push('notes');
    }
    if (input.isActive !== undefined) {
      customer.isActive = input.isActive;
      changedFields.push('isActive');
    }

    let statusAction: 'CUSTOMER_UPDATED' | 'CUSTOMER_STATUS_CHANGED' = 'CUSTOMER_UPDATED';
    if (input.status !== undefined && input.status !== customer.status) {
      customer.status = input.status;
      changedFields.push('status');
      statusAction = 'CUSTOMER_STATUS_CHANGED';
    }

    if (actorUserId) {
      customer.updatedBy = new Types.ObjectId(actorUserId);
    }

    await customer.save();

    await recordAuditLog({
      actorUserId,
      actorUsername,
      action: statusAction,
      entityType: 'CUSTOMER',
      entityId: customer._id.toString(),
      description: `Updated customer ${customer.fullName} (${customer.customerCode}): ${changedFields.join(', ')}`,
      ipAddress,
      userAgent,
      metadata: {
        customerCode: customer.customerCode,
        changedFields,
        previousStatus,
        newStatus: customer.status,
      },
    });

    return customer;
  }

  /**
   * Soft deactivation for customer accounts.
   */
  static async deactivateCustomer(
    id: string,
    actorUserId?: string,
    actorUsername?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('Invalid customer ID');
    }

    const customer = await Customer.findById(id);
    if (!customer) {
      throw new Error('Customer not found');
    }

    customer.isActive = false;
    customer.status = 'ARCHIVED';
    if (actorUserId) {
      customer.updatedBy = new Types.ObjectId(actorUserId);
    }

    await customer.save();

    await recordAuditLog({
      actorUserId,
      actorUsername,
      action: 'CUSTOMER_DEACTIVATED',
      entityType: 'CUSTOMER',
      entityId: customer._id.toString(),
      description: `Archived customer account ${customer.fullName} (${customer.customerCode})`,
      ipAddress,
      userAgent,
      metadata: {
        customerCode: customer.customerCode,
        previousStatus: customer.status,
      },
    });
  }
}
