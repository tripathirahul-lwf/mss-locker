import { Types } from 'mongoose';
import { LockerInvoice, ILockerInvoice } from '../models/LockerInvoice';
import { LockerAllocation } from '../models/LockerAllocation';
import { AuditLog } from '../models/AuditLog';
import {
  InvoiceType,
  InvoiceStatus,
  PaymentStatus,
  DueStatus,
  BillingCycle,
} from '../constants/billing.constants';
import { determineDueStatus } from '../utils/billingCalculator';

export interface InvoiceQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  invoiceType?: InvoiceType;
  status?: InvoiceStatus;
  paymentStatus?: PaymentStatus;
  dueStatus?: DueStatus;
  billingCycle?: BillingCycle;
  customerId?: string;
  lockerId?: string;
  allocationId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class BillingService {
  /**
   * List invoices with filtering, lean projection, search, and pagination
   */
  async getInvoices(params: InvoiceQueryParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 25));
    const skip = (page - 1) * limit;

    const query: any = {};

    if (params.invoiceType) query.invoiceType = params.invoiceType;
    if (params.status) query.status = params.status;
    if (params.paymentStatus) query.paymentStatus = params.paymentStatus;
    if (params.dueStatus) query.dueStatus = params.dueStatus;
    if (params.billingCycle) query.billingCycle = params.billingCycle;
    if (params.customerId) query.customerId = new Types.ObjectId(params.customerId);
    if (params.lockerId) query.lockerId = new Types.ObjectId(params.lockerId);
    if (params.allocationId) query.allocationId = new Types.ObjectId(params.allocationId);

    if (params.dueDateFrom || params.dueDateTo) {
      query.dueDate = {};
      if (params.dueDateFrom) query.dueDate.$gte = new Date(params.dueDateFrom);
      if (params.dueDateTo) {
        const toDate = new Date(params.dueDateTo);
        toDate.setHours(23, 59, 59, 999);
        query.dueDate.$lte = toDate;
      }
    }

    if (params.search && params.search.trim()) {
      const searchRegex = new RegExp(params.search.trim(), 'i');
      query.$or = [
        { invoiceNumber: searchRegex },
        { legacyReference: searchRegex },
        { legacyInvoiceNumber: searchRegex },
      ];
    }

    // Default sort: OVERDUE and nearest due date first
    const sortField = params.sortBy || 'dueDate';
    const sortDir = params.sortOrder === 'desc' ? -1 : 1;
    const sort: any = { [sortField]: sortDir };

    const [invoices, total] = await Promise.all([
      LockerInvoice.find(query)
        .populate('customerId', 'fullName customerCode phone photoUrl')
        .populate('lockerId', 'lockerNumber size rackNumber section')
        .populate('allocationId', 'allocationCode status startDate')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      LockerInvoice.countDocuments(query),
    ]);

    // Recalculate dynamic due status on the fly
    const enriched = invoices.map((inv: any) => ({
      ...inv,
      dueStatus: determineDueStatus(new Date(inv.dueDate), inv.balanceAmount),
    }));

    return {
      invoices: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single invoice with full populated relations
   */
  async getInvoiceById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    const invoice = await LockerInvoice.findById(id)
      .populate('customerId', 'fullName customerCode phone photoUrl address city state')
      .populate('lockerId', 'lockerNumber lockerCode size rackNumber section floor')
      .populate('allocationId', 'allocationCode status startDate billingCycle annualRent')
      .populate('createdBy', 'name username role')
      .populate('updatedBy', 'name username role')
      .populate('cancelledBy', 'name username role')
      .lean();

    if (!invoice) return null;

    return {
      ...invoice,
      dueStatus: determineDueStatus(new Date(invoice.dueDate), invoice.balanceAmount),
    };
  }

  /**
   * Get renewal statistics for top summary cards
   */
  async getRenewalStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    weekEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      totalCount,
      dueTodayInvoices,
      dueThisWeekInvoices,
      dueThisMonthInvoices,
      overdueInvoices,
      paidThisMonthInvoices,
      allUnpaid,
    ] = await Promise.all([
      LockerInvoice.countDocuments({ status: { $ne: 'CANCELLED' } }),

      // Due Today (balance > 0 and due today)
      LockerInvoice.find({
        status: { $ne: 'CANCELLED' },
        balanceAmount: { $gt: 0 },
        dueDate: { $gte: todayStart, $lte: todayEnd },
      }).select('balanceAmount'),

      // Due This Week
      LockerInvoice.find({
        status: { $ne: 'CANCELLED' },
        balanceAmount: { $gt: 0 },
        dueDate: { $gte: todayStart, $lte: weekEnd },
      }).select('balanceAmount'),

      // Due This Month
      LockerInvoice.find({
        status: { $ne: 'CANCELLED' },
        balanceAmount: { $gt: 0 },
        dueDate: { $gte: todayStart, $lte: monthEnd },
      }).select('balanceAmount'),

      // Overdue (due before today and balance > 0)
      LockerInvoice.find({
        status: { $ne: 'CANCELLED' },
        balanceAmount: { $gt: 0 },
        dueDate: { $lt: todayStart },
      }).select('balanceAmount'),

      // Paid This Month
      LockerInvoice.find({
        status: { $ne: 'CANCELLED' },
        paymentStatus: 'PAID',
        updatedAt: { $gte: monthStart, $lte: monthEnd },
      }).select('totalAmount'),

      // Total Outstanding
      LockerInvoice.find({
        status: { $ne: 'CANCELLED' },
        balanceAmount: { $gt: 0 },
      }).select('balanceAmount'),
    ]);

    const sumBalance = (list: any[]) => list.reduce((acc, curr) => acc + (curr.balanceAmount || 0), 0);
    const sumTotal = (list: any[]) => list.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

    return {
      totalInvoices: totalCount,
      dueToday: {
        count: dueTodayInvoices.length,
        amount: sumBalance(dueTodayInvoices),
      },
      dueThisWeek: {
        count: dueThisWeekInvoices.length,
        amount: sumBalance(dueThisWeekInvoices),
      },
      dueThisMonth: {
        count: dueThisMonthInvoices.length,
        amount: sumBalance(dueThisMonthInvoices),
      },
      overdue: {
        count: overdueInvoices.length,
        amount: sumBalance(overdueInvoices),
      },
      paidThisMonth: {
        count: paidThisMonthInvoices.length,
        amount: sumTotal(paidThisMonthInvoices),
      },
      totalOutstanding: {
        count: allUnpaid.length,
        amount: sumBalance(allUnpaid),
      },
    };
  }

  /**
   * Cancel an unpaid invoice (paidAmount === 0 required)
   */
  async cancelInvoice(id: string, reason: string, userId: string) {
    const invoice = await LockerInvoice.findById(id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status === 'CANCELLED') {
      throw new Error('Invoice is already cancelled');
    }

    if (invoice.paidAmount > 0) {
      throw new Error('Cannot cancel an invoice with recorded payments. Use reversal workflow.');
    }

    invoice.status = 'CANCELLED';
    invoice.cancellationReason = reason || 'Cancelled by authorized staff';
    invoice.cancelledBy = new Types.ObjectId(userId);
    invoice.cancelledAt = new Date();
    await invoice.save();

    await AuditLog.create({
      action: 'INVOICE_CANCELLED',
      module: 'BILLING',
      performedBy: new Types.ObjectId(userId),
      entityId: invoice._id,
      entityType: 'LockerInvoice',
      details: {
        invoiceNumber: invoice.invoiceNumber,
        allocationId: invoice.allocationId,
        reason,
      },
    });

    return invoice;
  }

  /**
   * Get all invoices for a customer
   */
  async getCustomerInvoices(customerId: string) {
    return LockerInvoice.find({ customerId: new Types.ObjectId(customerId) })
      .populate('lockerId', 'lockerNumber size rackNumber')
      .populate('allocationId', 'allocationCode')
      .sort({ dueDate: -1 })
      .lean();
  }

  /**
   * Get all invoices for a locker
   */
  async getLockerInvoices(lockerId: string) {
    return LockerInvoice.find({ lockerId: new Types.ObjectId(lockerId) })
      .populate('customerId', 'fullName customerCode phone')
      .populate('allocationId', 'allocationCode')
      .sort({ dueDate: -1 })
      .lean();
  }

  /**
   * Get all invoices for an allocation
   */
  async getAllocationInvoices(allocationId: string) {
    return LockerInvoice.find({ allocationId: new Types.ObjectId(allocationId) })
      .populate('customerId', 'fullName customerCode')
      .populate('lockerId', 'lockerNumber size rackNumber')
      .sort({ dueDate: -1 })
      .lean();
  }
}

export const billingService = new BillingService();
