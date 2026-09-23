import mongoose, { Types } from 'mongoose';
import { LockerAllocation, ILockerAllocation } from '../models/LockerAllocation';
import { Locker } from '../models/Locker';
import { Customer } from '../models/Customer';
import { AuditLog } from '../models/AuditLog';
import { Sequence } from '../models/Sequence';
import {
  ALLOCATION_STATUS,
  ALLOCATION_TYPE,
  BILLING_CYCLE,
  BillingCycle,
} from '../constants/allocation.constants';
import { calculateBillingPeriod } from '../utils/billingCalculator';
import {
  CreateAllocationInput,
  ReserveLockerInput,
  UpdateAllocationInput,
  AllocationQueryParams,
} from '../validators/allocation.validator';

export class AppHttpError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export interface AllocationActor {
  userId?: string;
  username?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class LockerAllocationService {
  /**
   * Generate next sequential human-readable allocation code (e.g. ALC-000001)
   */
  private static async generateAllocationCode(): Promise<string> {
    const sequence = await Sequence.findOneAndUpdate(
      { key: 'allocation' }, { $inc: { value: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return `ALC-${String(sequence.value).padStart(6, '0')}`;
  }

  /**
   * Create an Active Locker Allocation
   */
  static async createAllocation(
    input: CreateAllocationInput,
    actor: AllocationActor
  ): Promise<ILockerAllocation> {
    return mongoose.connection.transaction(async (session) => {
    // 1. Validate Customer
    const customer = await Customer.findOne({
      _id: input.customerId,
      isActive: true,
    }).session(session);
    if (!customer) {
      throw new AppHttpError('Customer not found or record is deactivated.', 404);
    }
    if (customer.status !== 'ACTIVE') {
      throw new AppHttpError(
        `Cannot allocate locker to customer in '${customer.status}' status.`,
        400
      );
    }

    // 2. Validate & Atomically Lock Physical Locker
    const locker = await Locker.findOneAndUpdate(
      {
        _id: input.lockerId,
        status: 'VACANT',
        operationalStatus: 'ACTIVE',
        isActive: true,
      },
      { status: 'OCCUPIED' },
      { new: true, session }
    );

    if (!locker) {
      const existingLocker = await Locker.findById(input.lockerId).session(session);
      if (!existingLocker) {
        throw new AppHttpError('Physical locker not found.', 404);
      }
      if (existingLocker.status !== 'VACANT') {
        throw new AppHttpError(
          `Locker #${existingLocker.lockerNumber} is currently ${existingLocker.status}. Please choose another vacant locker.`,
          409
        );
      }
      if (existingLocker.operationalStatus !== 'ACTIVE') {
        throw new AppHttpError(
          `Locker #${existingLocker.lockerNumber} is in operational status '${existingLocker.operationalStatus}'.`,
          400
        );
      }
      throw new AppHttpError('Locker is no longer available. Concurrency conflict.', 409);
    }

    // 3. Double-check for any active allocation on this locker
    const existingActiveAlloc = await LockerAllocation.findOne({
      lockerId: input.lockerId,
      status: { $in: [ALLOCATION_STATUS.ACTIVE, ALLOCATION_STATUS.RESERVED] },
    }).session(session);

    if (existingActiveAlloc) {
      throw new AppHttpError(
        `An active or reserved agreement (${existingActiveAlloc.allocationCode}) already exists for Locker #${locker.lockerNumber}.`,
        409
      );
    }

    // 4. Freeze Financial Snapshot
    const annualRent = input.annualRent ?? locker.annualRent;
    const securityDeposit = input.securityDeposit ?? locker.securityDeposit;
    const rentSnapshot = annualRent;
    const depositSnapshot = securityDeposit;

    // 5. Generate Code & Save Allocation
    const allocationCode = await this.generateAllocationCode();
    const startDate = input.startDate ? new Date(input.startDate) : new Date();

    const cycle = (input.billingCycle || BILLING_CYCLE.ANNUAL) as BillingCycle;
    const { periodEnd, nextDueDate } = calculateBillingPeriod(startDate, cycle);
    const calculatedEndDate = input.endDate ? new Date(input.endDate) : periodEnd;
    const nextRenewalDueDate = nextDueDate;
    const paidThroughDate = periodEnd;

    const allocation = new LockerAllocation({
      allocationCode,
      customerId: customer._id,
      lockerId: locker._id,
      startDate,
      endDate: calculatedEndDate,
      nextRenewalDueDate,
      paidThroughDate,
      billingCycle: cycle,
      annualRent,
      securityDeposit,
      rentSnapshot,
      depositSnapshot,
      status: ALLOCATION_STATUS.ACTIVE,
      allocationType: input.allocationType || ALLOCATION_TYPE.NEW,
      remarks: input.remarks || '',
      createdBy: actor.userId ? new Types.ObjectId(actor.userId) : undefined,
      activatedAt: new Date(),
      activatedBy: actor.userId ? new Types.ObjectId(actor.userId) : undefined,
    });

    await allocation.save({ session });

    // 6. Write Audit Log
    await AuditLog.create([{
      actorUserId: actor.userId ? new Types.ObjectId(actor.userId) : undefined,
      actorUsername: actor.username || 'SYSTEM',
      action: 'ALLOCATION_CREATED',
      entityType: 'LockerAllocation',
      entityId: allocation._id.toString(),
      description: `Allocated Locker #${locker.lockerNumber} (${locker.size}, ${locker.rackNumber}) to ${customer.fullName} (${customer.customerCode}). Agreement: ${allocationCode}`,
      ipAddress: actor.ipAddress || '',
      userAgent: actor.userAgent || '',
      metadata: {
        allocationCode,
        customerId: customer._id.toString(),
        lockerId: locker._id.toString(),
        lockerNumber: locker.lockerNumber,
        rentSnapshot,
        depositSnapshot,
      },
    }], { session });

    return (await LockerAllocation.findById(allocation._id)
      .populate('customerId', 'fullName customerCode phone kycStatus status photoUrl')
      .populate('lockerId', 'lockerNumber lockerCode size rackNumber section floor status operationalStatus').session(session)) as ILockerAllocation;
    });
  }

  /**
   * Reserve a Locker
   */
  static async reserveLocker(
    input: ReserveLockerInput,
    actor: AllocationActor
  ): Promise<ILockerAllocation> {
    return mongoose.connection.transaction(async (session) => {
    // 1. Validate Customer
    const customer = await Customer.findOne({
      _id: input.customerId,
      isActive: true,
    }).session(session);
    if (!customer) {
      throw new AppHttpError('Customer not found or record is deactivated.', 404);
    }

    // 2. Atomically Lock to RESERVED
    const locker = await Locker.findOneAndUpdate(
      {
        _id: input.lockerId,
        status: 'VACANT',
        operationalStatus: 'ACTIVE',
        isActive: true,
      },
      { status: 'RESERVED' },
      { new: true, session }
    );

    if (!locker) {
      throw new AppHttpError(
        'Locker is not available for reservation. It may already be occupied or reserved.',
        409
      );
    }

    const annualRent = input.annualRent ?? locker.annualRent;
    const securityDeposit = input.securityDeposit ?? locker.securityDeposit;
    const allocationCode = await this.generateAllocationCode();
    const startDate = input.startDate ? new Date(input.startDate) : new Date();
    const cycle = (input.billingCycle || BILLING_CYCLE.ANNUAL) as BillingCycle;
    const { periodEnd, nextDueDate } = calculateBillingPeriod(startDate, cycle);

    const allocation = new LockerAllocation({
      allocationCode,
      customerId: customer._id,
      lockerId: locker._id,
      startDate,
      endDate: periodEnd,
      nextRenewalDueDate: nextDueDate,
      paidThroughDate: periodEnd,
      reservationExpiresAt: input.reservationExpiresAt
        ? new Date(input.reservationExpiresAt)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days hold
      billingCycle: cycle,
      annualRent,
      securityDeposit,
      rentSnapshot: annualRent,
      depositSnapshot: securityDeposit,
      status: ALLOCATION_STATUS.RESERVED,
      allocationType: ALLOCATION_TYPE.NEW,
      remarks: input.remarks || '',
      createdBy: actor.userId ? new Types.ObjectId(actor.userId) : undefined,
    });

    await allocation.save({ session });

    await AuditLog.create([{
      actorUserId: actor.userId ? new Types.ObjectId(actor.userId) : undefined,
      actorUsername: actor.username || 'SYSTEM',
      action: 'LOCKER_RESERVED',
      entityType: 'LockerAllocation',
      entityId: allocation._id.toString(),
      description: `Reserved Locker #${locker.lockerNumber} on hold for ${customer.fullName} (${customer.customerCode}). Agreement: ${allocationCode}`,
      ipAddress: actor.ipAddress || '',
      userAgent: actor.userAgent || '',
      metadata: {
        allocationCode,
        customerId: customer._id.toString(),
        lockerId: locker._id.toString(),
      },
    }], { session });

    return (await LockerAllocation.findById(allocation._id)
      .populate('customerId', 'fullName customerCode phone kycStatus status photoUrl')
      .populate('lockerId', 'lockerNumber lockerCode size rackNumber section floor status operationalStatus').session(session)) as ILockerAllocation;
    });
  }

  /**
   * Activate a Reserved Allocation
   */
  static async activateReservation(
    id: string,
    actor: AllocationActor
  ): Promise<ILockerAllocation> {
    return mongoose.connection.transaction(async (session) => {
    const allocation = await LockerAllocation.findOneAndUpdate(
      { _id: id, status: ALLOCATION_STATUS.RESERVED },
      { $set: { updatedAt: new Date() } },
      { new: true, session }
    );
    if (!allocation) {
      throw new AppHttpError('Allocation agreement not found.', 404);
    }

    // Update physical locker to OCCUPIED
    const locker = await Locker.findByIdAndUpdate(
      allocation.lockerId,
      { status: 'OCCUPIED' },
      { new: true, session }
    );

    allocation.status = ALLOCATION_STATUS.ACTIVE;
    allocation.activatedAt = new Date();
    allocation.activatedBy = actor.userId ? new Types.ObjectId(actor.userId) : undefined;
    allocation.updatedBy = actor.userId ? new Types.ObjectId(actor.userId) : undefined;
    await allocation.save({ session });

    await AuditLog.create([{
      actorUserId: actor.userId ? new Types.ObjectId(actor.userId) : undefined,
      actorUsername: actor.username || 'SYSTEM',
      action: 'RESERVATION_ACTIVATED',
      entityType: 'LockerAllocation',
      entityId: allocation._id.toString(),
      description: `Activated reserved agreement ${allocation.allocationCode} for Locker #${locker?.lockerNumber}`,
      ipAddress: actor.ipAddress || '',
      userAgent: actor.userAgent || '',
      metadata: {
        allocationCode: allocation.allocationCode,
        lockerId: allocation.lockerId.toString(),
      },
    }], { session });

    return (await LockerAllocation.findById(allocation._id)
      .populate('customerId', 'fullName customerCode phone kycStatus status photoUrl')
      .populate('lockerId', 'lockerNumber lockerCode size rackNumber section floor status operationalStatus').session(session)) as ILockerAllocation;
    });
  }

  /**
   * Cancel a Reserved Allocation (Restores Locker to VACANT)
   */
  static async cancelReservation(
    id: string,
    actor: AllocationActor
  ): Promise<ILockerAllocation> {
    return mongoose.connection.transaction(async (session) => {
    const allocation = await LockerAllocation.findOneAndUpdate(
      { _id: id, status: ALLOCATION_STATUS.RESERVED },
      { $set: { updatedAt: new Date() } },
      { new: true, session }
    );
    if (!allocation) {
      throw new AppHttpError('Allocation agreement not found.', 404);
    }

    // Check if any other active allocation exists before making vacant
    const otherActive = await LockerAllocation.findOne({
      _id: { $ne: allocation._id },
      lockerId: allocation.lockerId,
      status: ALLOCATION_STATUS.ACTIVE,
    }).session(session);

    if (!otherActive) {
      await Locker.findByIdAndUpdate(allocation.lockerId, { status: 'VACANT' }, { session });
    }

    allocation.status = ALLOCATION_STATUS.CANCELLED;
    allocation.cancelledAt = new Date();
    allocation.cancelledBy = actor.userId ? new Types.ObjectId(actor.userId) : undefined;
    allocation.updatedBy = actor.userId ? new Types.ObjectId(actor.userId) : undefined;
    await allocation.save({ session });

    await AuditLog.create([{
      actorUserId: actor.userId ? new Types.ObjectId(actor.userId) : undefined,
      actorUsername: actor.username || 'SYSTEM',
      action: 'RESERVATION_CANCELLED',
      entityType: 'LockerAllocation',
      entityId: allocation._id.toString(),
      description: `Cancelled hold reservation ${allocation.allocationCode}. Locker restored to VACANT.`,
      ipAddress: actor.ipAddress || '',
      userAgent: actor.userAgent || '',
      metadata: {
        allocationCode: allocation.allocationCode,
        lockerId: allocation.lockerId.toString(),
      },
    }], { session });

    return (await LockerAllocation.findById(allocation._id)
      .populate('customerId', 'fullName customerCode phone kycStatus status photoUrl')
      .populate('lockerId', 'lockerNumber lockerCode size rackNumber section floor status operationalStatus').session(session)) as ILockerAllocation;
    });
  }

  /**
   * Update Allocation Notes & Details
   */
  static async updateAllocation(
    id: string,
    input: UpdateAllocationInput,
    actor: AllocationActor
  ): Promise<ILockerAllocation> {
    const allocation = await LockerAllocation.findById(id);
    if (!allocation) {
      throw new AppHttpError('Allocation agreement not found.', 404);
    }

    if (allocation.status === ALLOCATION_STATUS.CLOSED || allocation.status === ALLOCATION_STATUS.CANCELLED) {
      throw new AppHttpError(
        `Cannot modify an allocation in '${allocation.status}' state.`,
        400
      );
    }

    if (input.expectedUpdatedAt) {
      const currentUpdated = new Date(allocation.updatedAt).getTime();
      const expectedUpdated = new Date(input.expectedUpdatedAt).getTime();
      if (currentUpdated !== expectedUpdated) {
        throw new AppHttpError(
          'Allocation record was modified by another operator. Please refresh and try again.',
          409
        );
      }
    }

    if (input.remarks !== undefined) allocation.remarks = input.remarks;
    if (input.billingCycle !== undefined) {
      allocation.billingCycle = input.billingCycle;
      if (!input.endDate && allocation.startDate) {
        const { periodEnd, nextDueDate } = calculateBillingPeriod(new Date(allocation.startDate), input.billingCycle as BillingCycle);
        allocation.endDate = periodEnd;
        allocation.nextRenewalDueDate = nextDueDate;
        allocation.paidThroughDate = periodEnd;
      }
    }
    if (input.endDate !== undefined) {
      allocation.endDate = input.endDate ? new Date(input.endDate) : undefined;
      if (input.endDate) {
        const nextDueDate = new Date(input.endDate);
        nextDueDate.setDate(nextDueDate.getDate() + 1);
        allocation.nextRenewalDueDate = nextDueDate;
      }
    }
    allocation.updatedBy = actor.userId ? new Types.ObjectId(actor.userId) : undefined;

    await allocation.save();

    await AuditLog.create({
      actorUserId: actor.userId ? new Types.ObjectId(actor.userId) : undefined,
      actorUsername: actor.username || 'SYSTEM',
      action: 'ALLOCATION_UPDATED',
      entityType: 'LockerAllocation',
      entityId: allocation._id.toString(),
      description: `Updated agreement terms for ${allocation.allocationCode}`,
      ipAddress: actor.ipAddress || '',
      userAgent: actor.userAgent || '',
    });

    return (await LockerAllocation.findById(allocation._id)
      .populate('customerId', 'fullName customerCode phone kycStatus status photoUrl')
      .populate('lockerId', 'lockerNumber lockerCode size rackNumber section floor status operationalStatus')) as ILockerAllocation;
  }

  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Query & Filter Allocations with Server Pagination
   */
  static async getAllocations(params: AllocationQueryParams) {
    const query: any = {};

    if (params.status && params.status !== 'ALL') {
      query.status = params.status;
    }

    if (params.customerId) {
      query.customerId = new Types.ObjectId(params.customerId);
    }

    if (params.lockerId) {
      query.lockerId = new Types.ObjectId(params.lockerId);
    }

    if (params.startDateFrom || params.startDateTo) {
      query.startDate = {};
      if (params.startDateFrom) {
        query.startDate.$gte = new Date(params.startDateFrom);
      }
      if (params.startDateTo) {
        query.startDate.$lte = new Date(params.startDateTo);
      }
    }

    // Size filter support
    let sizeLockerIds: Types.ObjectId[] | null = null;
    if (params.size && params.size.trim()) {
      const lockersWithSize = await Locker.find({ size: params.size.trim() }).select('_id');
      sizeLockerIds = lockersWithSize.map((l) => l._id);
      if (!params.lockerId) {
        query.lockerId = { $in: sizeLockerIds };
      }
    }

    // Text search matching customer, locker, or allocation code
    if (params.search && params.search.trim()) {
      const cleanSearch = params.search.trim();
      const escaped = this.escapeRegex(cleanSearch);
      const searchRegex = new RegExp(escaped, 'i');

      const cleanDigits = cleanSearch.replace(/\D/g, '');
      const numberWithoutHash = cleanSearch.replace(/^#+/, '').trim();
      const numberRegex = new RegExp(`^${this.escapeRegex(numberWithoutHash)}$`, 'i');

      const customerConditions: any[] = [
        { fullName: searchRegex },
        { customerCode: searchRegex },
        { phone: searchRegex },
        { alternatePhone: searchRegex },
        { email: searchRegex },
      ];
      if (cleanDigits.length >= 3) {
        customerConditions.push({ phone: { $regex: cleanDigits, $options: 'i' } });
        customerConditions.push({ alternatePhone: { $regex: cleanDigits, $options: 'i' } });
      }

      const lockerConditions: any[] = [
        { lockerNumber: searchRegex },
        { lockerCode: searchRegex },
        { rackNumber: searchRegex },
        { section: searchRegex },
      ];
      if (numberWithoutHash) {
        lockerConditions.push({ lockerNumber: numberRegex });
      }

      const [matchingCustomers, matchingLockers] = await Promise.all([
        Customer.find({ $or: customerConditions }).select('_id'),
        Locker.find({
          $or: lockerConditions,
          ...(sizeLockerIds ? { _id: { $in: sizeLockerIds } } : {}),
        }).select('_id'),
      ]);

      const customerIds = matchingCustomers.map((c) => c._id);
      const lockerIds = matchingLockers.map((l) => l._id);

      const searchOrConditions: any[] = [
        { allocationCode: searchRegex },
        { customerId: { $in: customerIds } },
        { lockerId: { $in: lockerIds } },
      ];

      if (cleanDigits) {
        searchOrConditions.push({ allocationCode: new RegExp(cleanDigits, 'i') });
      }

      query.$or = searchOrConditions;
    }

    const sortOption: any = {};
    sortOption[params.sortBy || 'createdAt'] = params.sortOrder === 'asc' ? 1 : -1;

    const page = Math.max(1, params.page || 1);
    const limit = Math.min(200, Math.max(1, params.limit || 25));
    const skip = (page - 1) * limit;

    const [allocations, total] = await Promise.all([
      LockerAllocation.find(query)
        .populate('customerId', 'fullName customerCode phone kycStatus status photoUrl')
        .populate('lockerId', 'lockerNumber lockerCode size rackNumber section floor status operationalStatus')
        .populate('createdBy', 'name username')
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean(),
      LockerAllocation.countDocuments(query),
    ]);

    // Ensure all allocations return nextRenewalDueDate, endDate, and paidThroughDate
    const enrichedAllocations = allocations.map((alloc) => {
      if ((!alloc.nextRenewalDueDate || !alloc.endDate) && alloc.startDate) {
        const { periodEnd, nextDueDate } = calculateBillingPeriod(
          new Date(alloc.startDate),
          (alloc.billingCycle as BillingCycle) || 'ANNUAL'
        );
        return {
          ...alloc,
          nextRenewalDueDate: alloc.nextRenewalDueDate || nextDueDate,
          endDate: alloc.endDate || periodEnd,
          paidThroughDate: alloc.paidThroughDate || periodEnd,
        };
      }
      return alloc;
    });

    return {
      allocations: enrichedAllocations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get Single Allocation by ID
   */
  static async getAllocationById(id: string): Promise<ILockerAllocation> {
    const allocation = await LockerAllocation.findById(id)
      .populate('customerId', 'fullName customerCode phone email address city state postalCode kycStatus status photoUrl')
      .populate('lockerId', 'lockerNumber lockerCode size rackNumber section floor position annualRent securityDeposit status operationalStatus')
      .populate('createdBy', 'name username')
      .populate('updatedBy', 'name username')
      .populate('activatedBy', 'name username')
      .populate('cancelledBy', 'name username')
      .populate('closedBy', 'name username');

    if (!allocation) {
      throw new AppHttpError('Allocation agreement not found.', 404);
    }

    if ((!allocation.nextRenewalDueDate || !allocation.endDate) && allocation.startDate) {
      const { periodEnd, nextDueDate } = calculateBillingPeriod(
        new Date(allocation.startDate),
        (allocation.billingCycle as BillingCycle) || 'ANNUAL'
      );
      if (!allocation.nextRenewalDueDate) allocation.nextRenewalDueDate = nextDueDate;
      if (!allocation.endDate) allocation.endDate = periodEnd;
      if (!allocation.paidThroughDate) allocation.paidThroughDate = periodEnd;

      void LockerAllocation.updateOne(
        { _id: allocation._id },
        { $set: { nextRenewalDueDate: nextDueDate, endDate: periodEnd, paidThroughDate: periodEnd } }
      ).exec();
    }

    return allocation as ILockerAllocation;
  }

  /**
   * Get Customer Allotments (Active + Historical)
   */
  static async getCustomerAllocations(customerId: string) {
    const allocations = await LockerAllocation.find({
      customerId: new Types.ObjectId(customerId),
    })
      .populate('lockerId', 'lockerNumber lockerCode size rackNumber section floor status operationalStatus')
      .sort({ createdAt: -1 })
      .lean();

    for (const alloc of allocations) {
      if ((!alloc.nextRenewalDueDate || !alloc.endDate) && alloc.startDate) {
        const { periodEnd, nextDueDate } = calculateBillingPeriod(
          new Date(alloc.startDate),
          (alloc.billingCycle as BillingCycle) || 'ANNUAL'
        );
        if (!alloc.nextRenewalDueDate) alloc.nextRenewalDueDate = nextDueDate;
        if (!alloc.endDate) alloc.endDate = periodEnd;
        if (!alloc.paidThroughDate) alloc.paidThroughDate = periodEnd;

        void LockerAllocation.updateOne(
          { _id: alloc._id },
          { $set: { nextRenewalDueDate: nextDueDate, endDate: periodEnd, paidThroughDate: periodEnd } }
        ).exec();
      }
    }

    const active = allocations.find(
      (a) => a.status === ALLOCATION_STATUS.ACTIVE || a.status === ALLOCATION_STATUS.RESERVED
    );
    const history = allocations.filter(
      (a) => a.status === ALLOCATION_STATUS.CLOSED || a.status === ALLOCATION_STATUS.CANCELLED
    );

    return {
      activeAllocation: active || null,
      history,
      totalAllocations: allocations.length,
    };
  }

  /**
   * Get Locker Tenancy History
   */
  static async getLockerAllocations(lockerId: string) {
    const allocations = await LockerAllocation.find({
      lockerId: new Types.ObjectId(lockerId),
    })
      .populate('customerId', 'fullName customerCode phone email kycStatus status photoUrl')
      .populate('lockerId', 'lockerNumber lockerCode size rackNumber section floor status operationalStatus annualRent securityDeposit')
      .populate('createdBy', 'name username')
      .sort({ createdAt: -1 })
      .lean();

    for (const alloc of allocations) {
      if ((!alloc.nextRenewalDueDate || !alloc.endDate) && alloc.startDate) {
        const { periodEnd, nextDueDate } = calculateBillingPeriod(
          new Date(alloc.startDate),
          (alloc.billingCycle as BillingCycle) || 'ANNUAL'
        );
        if (!alloc.nextRenewalDueDate) alloc.nextRenewalDueDate = nextDueDate;
        if (!alloc.endDate) alloc.endDate = periodEnd;
        if (!alloc.paidThroughDate) alloc.paidThroughDate = periodEnd;

        void LockerAllocation.updateOne(
          { _id: alloc._id },
          { $set: { nextRenewalDueDate: nextDueDate, endDate: periodEnd, paidThroughDate: periodEnd } }
        ).exec();
      }
    }

    const current = allocations.find(
      (a) => a.status === ALLOCATION_STATUS.ACTIVE || a.status === ALLOCATION_STATUS.RESERVED
    );

    return {
      currentAllocation: current || null,
      history: allocations,
      totalTenancies: allocations.length,
    };
  }

  /**
   * Allocation Summary Metrics
   */
  static async getAllocationStats() {
    const [total, active, reserved, closed, cancelled] = await Promise.all([
      LockerAllocation.countDocuments(),
      LockerAllocation.countDocuments({ status: ALLOCATION_STATUS.ACTIVE }),
      LockerAllocation.countDocuments({ status: ALLOCATION_STATUS.RESERVED }),
      LockerAllocation.countDocuments({ status: ALLOCATION_STATUS.CLOSED }),
      LockerAllocation.countDocuments({ status: ALLOCATION_STATUS.CANCELLED }),
    ]);

    return {
      total,
      active,
      reserved,
      closed,
      cancelled,
    };
  }
}
