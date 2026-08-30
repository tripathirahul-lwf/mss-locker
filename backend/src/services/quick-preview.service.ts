import { Types } from 'mongoose';
import { Customer } from '../models/Customer';
import { Locker } from '../models/Locker';
import { LockerAllocation } from '../models/LockerAllocation';
import { LockerInvoice } from '../models/LockerInvoice';
import { Payment } from '../models/Payment';
import { LockerClosure } from '../models/LockerClosure';
import { depositService } from './deposit.service';
import { PERMISSIONS } from '../constants/permissions';

export interface ActiveLockerSummary {
  allocationId: string;
  allocationCode: string;
  startDate: Date;
  paidThroughDate?: Date;
  nextRenewalDueDate?: Date;
  billingCycle: string;
  annualRent: number;
  securityDeposit: number;
  status: string;

  lockerId: string;
  lockerNumber: string;
  lockerCode: string;
  size: string;
  rackNumber: string;
  section?: string;
  floor?: string;

  // Real-time financial dues
  outstandingAmount: number;
  openInvoicesCount: number;
  currentDueDate?: Date;

  // Real-time caution deposit
  depositHeld: number;
  depositDeductions: number;
  depositRefunded: number;
  availableRefundableBalance: number;

  // Last payment
  lastPaymentDate?: Date;
  lastPaymentAmount?: number;
  lastReceiptNumber?: string;
}

export interface CustomerQuickPreviewData {
  customer: {
    _id: string;
    customerCode: string;
    fullName: string;
    phone: string;
    alternatePhone?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    photoUrl?: string;
    kycStatus: string;
    status: string;
  };
  activeLockers: ActiveLockerSummary[];
  totalActiveLockers: number;
  totalCombinedOutstanding: number;
  recentPayments: {
    _id: string;
    paymentNumber: string;
    receiptNumber: string;
    amount: number;
    paymentMethod: string;
    paymentDate: Date;
    lockerNumber: string;
  }[];
  hasPastAllocations: boolean;
  closureHistoryCount: number;
}

export class QuickPreviewService {
  /**
   * Generates a lightweight, high-speed Walk-in Customer Quick Preview dossier
   */
  async getCustomerQuickPreview(customerId: string): Promise<CustomerQuickPreviewData | null> {
    if (!Types.ObjectId.isValid(customerId)) return null;

    const custId = new Types.ObjectId(customerId);
    const customer = await Customer.findById(custId).lean();
    if (!customer) return null;

    // 1. Fetch all allocations for this customer
    const allocations = await LockerAllocation.find({ customerId: custId })
      .populate('lockerId')
      .sort({ createdAt: -1 })
      .lean();

    const activeAllocations = allocations.filter((a) => ['ACTIVE', 'RESERVED'].includes(a.status));
    const hasPastAllocations = allocations.some((a) => ['CLOSED', 'CANCELLED'].includes(a.status));

    // 2. Fetch closure count
    const closureCount = await LockerClosure.countDocuments({ customerId: custId });

    // 3. Process each active locker
    const activeLockers: ActiveLockerSummary[] = [];
    let totalCombinedOutstanding = 0;

    for (const alloc of activeAllocations) {
      const lock: any = alloc.lockerId || {};

      // Invoices & Dues
      const openInvoices = await LockerInvoice.find({
        allocationId: alloc._id,
        balanceAmount: { $gt: 0 },
        paymentStatus: { $in: ['UNPAID', 'PARTIALLY_PAID'] },
        status: { $ne: 'CANCELLED' },
      })
        .sort({ dueDate: 1 })
        .lean();

      const outstandingAmount = openInvoices.reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0);
      totalCombinedOutstanding += outstandingAmount;
      const currentDueDate = openInvoices[0]?.dueDate || alloc.nextRenewalDueDate || alloc.paidThroughDate;

      // Deposit Summary
      const depositSummary = await depositService.getDepositSummary(alloc._id);

      // Last payment for this allocation
      const lastPayment = await Payment.findOne({
        allocationId: alloc._id,
        paymentStatus: 'COMPLETED',
      })
        .sort({ paymentDate: -1, createdAt: -1 })
        .lean();

      activeLockers.push({
        allocationId: alloc._id.toString(),
        allocationCode: alloc.allocationCode,
        startDate: alloc.startDate,
        paidThroughDate: alloc.paidThroughDate,
        nextRenewalDueDate: alloc.nextRenewalDueDate,
        billingCycle: alloc.billingCycle,
        annualRent: alloc.annualRent,
        securityDeposit: alloc.securityDeposit,
        status: alloc.status,

        lockerId: lock._id ? lock._id.toString() : '',
        lockerNumber: lock.lockerNumber || 'N/A',
        lockerCode: lock.lockerCode || '',
        size: lock.size || 'STD',
        rackNumber: lock.rackNumber || '',
        section: lock.section,
        floor: lock.floor,

        outstandingAmount,
        openInvoicesCount: openInvoices.length,
        currentDueDate,

        depositHeld: depositSummary.netDepositHeld,
        depositDeductions: depositSummary.totalDeductAdjustments,
        depositRefunded: depositSummary.totalRefunded,
        availableRefundableBalance: depositSummary.availableRefundableBalance,

        lastPaymentDate: lastPayment?.paymentDate,
        lastPaymentAmount: lastPayment?.amount,
        lastReceiptNumber: lastPayment?.receiptNumber,
      });
    }

    // 4. Fetch last 5 payments across all tenancies for this customer
    const recentPaymentsRaw = await Payment.find({
      customerId: custId,
      paymentStatus: 'COMPLETED',
    })
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(5)
      .populate('lockerId', 'lockerNumber')
      .lean();

    const recentPayments = recentPaymentsRaw.map((p: any) => ({
      _id: p._id.toString(),
      paymentNumber: p.paymentNumber,
      receiptNumber: p.receiptNumber,
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      paymentDate: p.paymentDate,
      lockerNumber: p.lockerId?.lockerNumber || 'N/A',
    }));

    return {
      customer: {
        _id: customer._id.toString(),
        customerCode: customer.customerCode,
        fullName: customer.fullName,
        phone: customer.phone,
        alternatePhone: customer.alternatePhone,
        email: customer.email,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        photoUrl: customer.photoUrl,
        kycStatus: customer.kycStatus,
        status: customer.status,
      },
      activeLockers,
      totalActiveLockers: activeLockers.length,
      totalCombinedOutstanding,
      recentPayments,
      hasPastAllocations,
      closureHistoryCount: closureCount,
    };
  }

  /**
   * Lazy-loads paginated full renewal history for a customer
   */
  async getCustomerRenewalHistory(customerId: string, page = 1, limit = 10) {
    const custId = new Types.ObjectId(customerId);
    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      LockerInvoice.find({ customerId: custId })
        .sort({ dueDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('lockerId', 'lockerNumber size')
        .populate('allocationId', 'allocationCode')
        .lean(),
      LockerInvoice.countDocuments({ customerId: custId }),
    ]);

    return {
      invoices: invoices.map((inv: any) => ({
        _id: inv._id.toString(),
        invoiceNumber: inv.invoiceNumber,
        billingPeriodStart: inv.periodStart || inv.billingPeriodStart,
        billingPeriodEnd: inv.periodEnd || inv.billingPeriodEnd,
        dueDate: inv.dueDate,
        totalAmount: inv.totalAmount,
        paidAmount: inv.paidAmount,
        balanceAmount: inv.balanceAmount,
        paymentStatus: inv.paymentStatus,
        lockerNumber: inv.lockerId?.lockerNumber || 'N/A',
        allocationCode: inv.allocationId?.allocationCode || 'N/A',
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Generates a lightweight Locker Quick Preview dossier
   */
  async getLockerQuickPreview(lockerId: string, userPermissions: string[]) {
    if (!Types.ObjectId.isValid(lockerId)) return null;

    const lockId = new Types.ObjectId(lockerId);
    const locker = await Locker.findById(lockId).lean();
    if (!locker) return null;

    const canViewSensitive = userPermissions.includes(PERMISSIONS.LOCKERS_VIEW_SENSITIVE);

    // Check active allocation
    const currentAllocation = await LockerAllocation.findOne({
      lockerId: lockId,
      status: { $in: ['ACTIVE', 'RESERVED'] },
    })
      .populate('customerId', 'fullName customerCode phone photoUrl kycStatus status')
      .lean();

    let tenantSummary: any = null;
    let duesSummary: any = null;

    if (currentAllocation) {
      const cust: any = currentAllocation.customerId || {};
      tenantSummary = {
        customerId: cust._id ? cust._id.toString() : '',
        fullName: cust.fullName || 'N/A',
        customerCode: cust.customerCode || 'N/A',
        phone: cust.phone || 'N/A',
        photoUrl: cust.photoUrl,
        kycStatus: cust.kycStatus,
        customerStatus: cust.status,
        allocationCode: currentAllocation.allocationCode,
        startDate: currentAllocation.startDate,
        paidThroughDate: currentAllocation.paidThroughDate,
        nextRenewalDueDate: currentAllocation.nextRenewalDueDate,
      };

      const openInvoices = await LockerInvoice.find({
        allocationId: currentAllocation._id,
        balanceAmount: { $gt: 0 },
        paymentStatus: { $in: ['UNPAID', 'PARTIALLY_PAID'] },
        status: { $ne: 'CANCELLED' },
      }).lean();

      const outstandingAmount = openInvoices.reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0);

      duesSummary = {
        outstandingAmount,
        openInvoicesCount: openInvoices.length,
      };
    }

    return {
      locker: {
        _id: locker._id.toString(),
        lockerNumber: locker.lockerNumber,
        lockerCode: locker.lockerCode,
        size: locker.size,
        rackNumber: locker.rackNumber,
        section: locker.section,
        floor: locker.floor,
        status: locker.status,
        operationalStatus: locker.operationalStatus,
        annualRent: locker.annualRent,
        securityDeposit: locker.securityDeposit,
        masterKeyReference: canViewSensitive ? locker.masterKeyReference : undefined,
        remarks: locker.remarks,
      },
      currentTenant: tenantSummary,
      dues: duesSummary,
      isAvailableForAllocation:
        locker.status === 'VACANT' &&
        locker.operationalStatus === 'ACTIVE' &&
        locker.isActive === true,
    };
  }
}

export const quickPreviewService = new QuickPreviewService();
