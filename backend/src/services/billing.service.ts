import { escapeHtmlFields } from '../utils/html';
import mongoose,{ Types } from 'mongoose';
import { LockerInvoice } from '../models/LockerInvoice';
import { Customer } from '../models/Customer';
import { Locker } from '../models/Locker';
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
  dueStatus?: DueStatus | 'DUE_THIS_MONTH' | 'DUE_THIS_WEEK';
  billingCycle?: BillingCycle;
  customerId?: string;
  lockerId?: string;
  allocationId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onlyOutstanding?: boolean | string;
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

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    weekEnd.setHours(23, 59, 59, 999);

    if (params.invoiceType) query.invoiceType = params.invoiceType;
    if (params.status) query.status = params.status;
    if (params.paymentStatus) query.paymentStatus = params.paymentStatus;
    if (params.billingCycle) query.billingCycle = params.billingCycle;
    if (params.customerId) query.customerId = new Types.ObjectId(params.customerId);
    if (params.lockerId) query.lockerId = new Types.ObjectId(params.lockerId);
    if (params.allocationId) query.allocationId = new Types.ObjectId(params.allocationId);

    // Outstanding invoices filter (balance > 0 and not cancelled)
    if (params.onlyOutstanding === true || params.onlyOutstanding === 'true') {
      query.balanceAmount = { $gt: 0 };
      if (!query.status) query.status = { $ne: 'CANCELLED' };
    }

    // Dynamic Due Status filters matching stats logic
    if (params.dueStatus === ('ACTIONABLE' as any)) {
      query.balanceAmount = { $gt: 0 };
      if (!query.status) query.status = { $ne: 'CANCELLED' };
      query.dueDate = { $lte: monthEnd };
    } else if (params.dueStatus === 'OVERDUE') {
      query.balanceAmount = { $gt: 0 };
      if (!query.status) query.status = { $ne: 'CANCELLED' };
      query.dueDate = { $lt: todayStart };
    } else if (params.dueStatus === 'DUE_THIS_MONTH' as any) {
      query.balanceAmount = { $gt: 0 };
      if (!query.status) query.status = { $ne: 'CANCELLED' };
      query.dueDate = { $gte: todayStart, $lte: monthEnd };
    } else if (params.dueStatus === 'DUE_THIS_WEEK' as any) {
      query.balanceAmount = { $gt: 0 };
      if (!query.status) query.status = { $ne: 'CANCELLED' };
      query.dueDate = { $gte: todayStart, $lte: weekEnd };
    } else if (params.dueStatus && params.dueStatus !== ('ALL' as any)) {
      query.dueStatus = params.dueStatus;
    }

    if (params.dueDateFrom || params.dueDateTo) {
      query.dueDate = query.dueDate || {};
      if (params.dueDateFrom) query.dueDate.$gte = new Date(params.dueDateFrom);
      if (params.dueDateTo) {
        const toDate = new Date(params.dueDateTo);
        toDate.setHours(23, 59, 59, 999);
        query.dueDate.$lte = toDate;
      }
    }

    // Comprehensive text search matching invoice number, legacy bill ref, customer, or locker number
    if (params.search && params.search.trim()) {
      const cleanSearch = params.search.trim();
      const escaped = cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      const cleanDigits = cleanSearch.replace(/\D/g, '');
      const numberWithoutHash = cleanSearch.replace(/^#+/, '').trim();

      const customerConditions: any[] = [
        { fullName: searchRegex },
        { customerCode: searchRegex },
        { phone: searchRegex },
      ];
      if (cleanDigits.length >= 3) {
        customerConditions.push({ phone: { $regex: cleanDigits, $options: 'i' } });
      }

      const lockerConditions: any[] = [
        { lockerNumber: searchRegex },
        { lockerCode: searchRegex },
        { rackNumber: searchRegex },
      ];
      if (numberWithoutHash) {
        lockerConditions.push({ lockerNumber: new RegExp(`^${numberWithoutHash}$`, 'i') });
      }

      const [matchingCustomers, matchingLockers] = await Promise.all([
        Customer.find({ $or: customerConditions }).select('_id').lean(),
        Locker.find({ $or: lockerConditions }).select('_id').lean(),
      ]);

      const customerIds = matchingCustomers.map((c) => c._id);
      const lockerIds = matchingLockers.map((l) => l._id);

      const orConditions: any[] = [
        { invoiceNumber: searchRegex },
        { legacyReference: searchRegex },
        { legacyInvoiceNumber: searchRegex },
      ];

      if (customerIds.length > 0) {
        orConditions.push({ customerId: { $in: customerIds } });
      }
      if (lockerIds.length > 0) {
        orConditions.push({ lockerId: { $in: lockerIds } });
      }

      query.$or = orConditions;
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

    // Recalculate dynamic due status on the fly and sanitize corrupted legacy years
    const enriched = invoices.map((inv: any) => {
      let d = new Date(inv.dueDate);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        if (y > 100 && y < 1000) {
          d.setFullYear(2000 + (y % 100));
        }
      }
      return {
        ...inv,
        dueDate: isNaN(d.getTime()) ? inv.dueDate : d.toISOString(),
        dueStatus: determineDueStatus(d, inv.balanceAmount),
      };
    });

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
    const fail = (message: string, statusCode = 409) => Object.assign(new Error(message), { statusCode });
    if (!Types.ObjectId.isValid(id)) throw fail('Invalid invoice ID', 400);
    if (typeof reason !== 'string' || reason.trim().length < 3 || reason.trim().length > 500) throw fail('Provide a cancellation reason between 3 and 500 characters.', 400);
    return mongoose.connection.transaction(async session => {
      const invoice = await LockerInvoice.findById(id);
      if (!invoice) throw fail('Invoice not found', 404);
      if (invoice.status === 'CANCELLED') throw fail('Invoice is already cancelled');
      const { Payment } = await import('../models/Payment');
      if (invoice.paidAmount > 0 || invoice.paymentStatus === 'PAID' || await Payment.exists({ invoiceId: invoice._id, paymentStatus: 'COMPLETED' })) throw fail('Cannot cancel an invoice with recorded payments. Use reversal workflow.');
      invoice.status = 'CANCELLED'; invoice.cancellationReason = reason.trim(); invoice.cancelledBy = new Types.ObjectId(userId); invoice.cancelledAt = new Date();
      await invoice.save();
      await AuditLog.create([{ action: 'INVOICE_CANCELLED', module: 'BILLING', performedBy: new Types.ObjectId(userId), entityId: invoice._id, entityType: 'LockerInvoice', description: `Cancelled invoice ${invoice.invoiceNumber}`, details: { invoiceNumber: invoice.invoiceNumber, allocationId: invoice.allocationId, reason: reason.trim() } }], { session });
      return invoice;
    });
  }

  /**
   * Update custom billing period for an invoice
   */
  async updateInvoiceBillingPeriod(id: string, billingPeriodStart: string | Date, billingPeriodEnd: string | Date, userId?: string, expectedUpdatedAt?: string) {
    const fail = (message: string, statusCode = 400) => Object.assign(new Error(message), { statusCode });
    if (!Types.ObjectId.isValid(id)) throw fail('Invalid invoice ID');
    const parseDate = (value: string | Date) => {
      const date = value instanceof Date ? new Date(value) : new Date(value + 'T00:00:00Z');
      if (!Number.isFinite(date.getTime()) || typeof value === 'string' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || date.toISOString().slice(0, 10) !== value)) throw fail('Enter valid billing period dates');
      return date;
    };
    const start = parseDate(billingPeriodStart), end = parseDate(billingPeriodEnd);
    if (end < start) throw fail('Billing period end date cannot be earlier than start date');
    return mongoose.connection.transaction(async session => {
      const invoice = await LockerInvoice.findById(id);
      if (!invoice) throw fail('Invoice not found', 404);
      if (invoice.status === 'CANCELLED') throw fail('Cancelled invoice periods cannot be edited', 409);
      if (expectedUpdatedAt && (!Number.isFinite(Date.parse(expectedUpdatedAt)) || new Date(expectedUpdatedAt).getTime() !== invoice.updatedAt.getTime())) throw fail('Invoice changed. Reload it before editing the period.', 409);
      const oldStart = invoice.billingPeriodStart, oldEnd = invoice.billingPeriodEnd;
      const { LockerAllocation } = await import('../models/LockerAllocation');
      // Lock the agreement shared by period edits and settlement operations.
      const allocation = invoice.allocationId ? await LockerAllocation.findOneAndUpdate({ _id: invoice.allocationId }, { $inc: { __v: 1 } }, { new: true, timestamps: false }) : null;
      const unchanged = start.getTime() === oldStart.getTime() && end.getTime() === oldEnd.getTime();
      if (!unchanged && invoice.invoiceType !== 'ADJUSTMENT' && invoice.allocationId && await LockerInvoice.exists({ _id: { $ne: invoice._id }, allocationId: invoice.allocationId, invoiceType: { $ne: 'ADJUSTMENT' }, status: { $nin: ['CANCELLED', 'DRAFT'] }, billingPeriodStart: { $lte: end }, billingPeriodEnd: { $gte: start } })) throw fail('Billing period overlaps another bill for this agreement.', 409);
      invoice.billingPeriodStart = start; invoice.billingPeriodEnd = end;
      if (userId) invoice.updatedBy = new Types.ObjectId(userId);
      await invoice.save();
      // Historical edits never replace the current agreement schedule.
      if (allocation && allocation.status === 'ACTIVE' && invoice.invoiceType !== 'ADJUSTMENT' && invoice.status !== 'DRAFT' && invoice.paymentStatus === 'PAID' && invoice.balanceAmount === 0 && invoice.paidAmount >= invoice.totalAmount && allocation.endDate?.getTime() === oldEnd.getTime()) {
        const latest = await LockerInvoice.findOne({ allocationId: allocation._id, invoiceType: { $ne: 'ADJUSTMENT' }, status: { $nin: ['CANCELLED', 'DRAFT'] }, paymentStatus: 'PAID', balanceAmount: 0 }).sort({ billingPeriodEnd: -1 });
        allocation.paidThroughDate = latest?.billingPeriodEnd;
        allocation.endDate = end;
        const nextDue = new Date(end); nextDue.setUTCDate(nextDue.getUTCDate() + 1);
        allocation.nextRenewalDueDate = nextDue;
        await allocation.save();
      }
      await AuditLog.create([{ action: 'INVOICE_BILLING_PERIOD_UPDATED', module: 'BILLING', performedBy: userId ? new Types.ObjectId(userId) : undefined, entityId: String(invoice._id), entityType: 'LockerInvoice', description: `Updated billing period for ${invoice.invoiceNumber}`, details: { invoiceNumber: invoice.invoiceNumber, oldStart, oldEnd, newStart: start, newEnd: end } }], { session });
      return this.getInvoiceById(String(invoice._id));
    });
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
      .populate('lockerId', 'lockerNumber size rackNumber section floor')
      .populate('allocationId', 'allocationCode')
      .sort({ dueDate: -1 })
      .lean();
  }

  /**
   * Generate clean printable HTML for invoice
   */
  async generateInvoiceHtml(invoiceId: string, autoPrint = false): Promise<string> {
    const raw = await this.getInvoiceById(invoiceId);
    if (!raw) throw Object.assign(new Error('Invoice not found'), { statusCode: 404 });
    const [setting, rows] = await Promise.all([
      (await import('../models/SystemSetting')).SystemSetting.findOne({ key: 'GLOBAL' }).lean(),
      (await import('../models/Payment')).Payment.find({ invoiceId, paymentStatus: 'COMPLETED' }).sort({ paymentDate: 1 }).lean(),
    ]);
    const invoice: any = escapeHtmlFields(raw), business: any = escapeHtmlFields(setting || {}), payments: any[] = escapeHtmlFields(rows);
    const customer = invoice.customerId || {}, locker = invoice.lockerId || {}, allocation = invoice.allocationId || {};
    const money = (value: number) => Number.isFinite(Number(value)) ? `&#8377;${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Not recorded';
    const date = (value: any) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : 'Not recorded';
    const valid = ['UNPAID', 'PARTIALLY_PAID', 'PAID'].includes(raw.paymentStatus) && ['DRAFT', 'ISSUED', 'PAID', 'CANCELLED'].includes(raw.status) && [raw.baseRent, raw.taxAmount, raw.lateFee, raw.otherCharges, raw.discount, raw.totalAmount, raw.paidAmount, raw.balanceAmount].every(v => Number.isFinite(v) && v >= 0) && Math.abs(raw.baseRent + raw.taxAmount + raw.lateFee + raw.otherCharges - raw.discount - raw.totalAmount) <= .011 && Math.abs(raw.totalAmount - raw.paidAmount - raw.balanceAmount) <= .011;
    const status = ['CANCELLED', 'DRAFT'].includes(raw.status) ? raw.status : !valid ? 'BILLING NEEDS REVIEW' : raw.paymentStatus === 'PAID' && raw.balanceAmount === 0 ? 'PAID' : invoice.paymentStatus;
    const line = (label: string, value: number) => `<tr><td>${label}</td><td class="amount">${money(value)}</td></tr>`;
    return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${invoice.invoiceNumber}</title><style>
      @page{size:A4;margin:14mm}*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#172033;margin:0}header{border-bottom:2px solid #172033;padding-bottom:14px;margin-bottom:18px}h1{font-size:23px;margin:6px 0}h2{font-size:14px;margin:20px 0 8px}p{margin:6px 0;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{padding:9px;border-bottom:1px solid #d9dfe5;text-align:left;overflow-wrap:anywhere}.amount{text-align:right;white-space:nowrap}tr{break-inside:avoid}thead{display:table-header-group}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.status{display:inline-block;border:1px solid #172033;padding:5px 9px;font-weight:bold}.warning{border:1px solid #a65c00;padding:10px}footer{border-top:1px solid #bbb;margin-top:25px;padding-top:10px;color:#596273}
      </style></head><body><header><p><strong>${business.businessName || 'Vault Ledger'}</strong></p>${business.address ? `<p>${business.address}</p>` : ''}${business.gstin ? `<p>GSTIN: ${business.gstin}</p>` : ''}<h1>Invoice ${invoice.invoiceNumber}</h1><span class="status">${status}</span></header>
      ${!valid ? '<p class="warning">Stored amounts do not reconcile. Review this ledger before collection.</p>' : ''}
      <div class="grid"><section><h2>Billed customer</h2><p>${customer.fullName || 'Not recorded'}</p><p>${customer.customerCode || ''}</p><p>${customer.phone || ''}</p></section><section><h2>Locker and agreement</h2><p>Locker ${locker.lockerNumber || 'Not recorded'} &bull; Size ${locker.size || 'Not recorded'}</p><p>${locker.rackNumber || ''}</p><p>${allocation.allocationCode || 'Agreement not recorded'}</p></section></div>
      <p>Issue date: ${date(invoice.issueDate)} &bull; Due date: ${date(invoice.dueDate)}</p><p>Billing period: ${date(invoice.billingPeriodStart)} to ${date(invoice.billingPeriodEnd)}</p><p>Billing cycle: ${invoice.billingCycle || 'Not recorded'}</p>
      <h2>Recorded invoice breakdown</h2><table><thead><tr><th>Description</th><th class="amount">Amount</th></tr></thead><tbody>${line('Base rent', raw.baseRent)}${line('GST (recorded)', raw.taxAmount)}${line('Late fee', raw.lateFee)}${line('Other charges', raw.otherCharges)}${line('Discount (deducted)', raw.discount)}${line('Total invoiced amount', raw.totalAmount)}${line('Invoice paid amount', raw.paidAmount)}${line('Balance outstanding', raw.balanceAmount)}</tbody></table>
      <h2>Completed payment receipts (${payments.length})</h2>${payments.length ? `<table><thead><tr><th>Receipt</th><th>Date</th><th>Method</th><th class="amount">Collected</th></tr></thead><tbody>${payments.map(payment => `<tr><td>${payment.receiptNumber || payment.paymentNumber}</td><td>${date(payment.paymentDate)}</td><td>${payment.paymentMethod}</td><td class="amount">${money(payment.amount)}</td></tr>`).join('')}</tbody></table>` : '<p>No payment receipts are recorded for this invoice. Historical paid status is shown from the ledger.</p>'}
      ${invoice.notes ? `<h2>Notes and legacy reference</h2><p>${invoice.notes}</p>` : ''}<footer>Computer-generated statement of recorded ledger values. Payment instructions are not supplied by this statement.</footer>${autoPrint ? '<script>window.addEventListener("load",()=>window.print())</script>' : ''}</body></html>`;
  }

  async getAllocationInvoices(allocationId: string) {

    return LockerInvoice.find({ allocationId: new Types.ObjectId(allocationId) })
      .populate('customerId', 'fullName customerCode')
      .populate('lockerId', 'lockerNumber size rackNumber')
      .sort({ dueDate: -1 })
      .lean();
  }
}

export const billingService = new BillingService();
