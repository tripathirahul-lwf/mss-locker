import { Types } from 'mongoose';
import QRCode from 'qrcode';
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
   * Update custom billing period for an invoice
   */
  async updateInvoiceBillingPeriod(
    id: string,
    billingPeriodStart: string | Date,
    billingPeriodEnd: string | Date,
    userId?: string
  ) {
    const invoice = await LockerInvoice.findById(id);
    if (!invoice) {
      throw Object.assign(new Error('Invoice not found'), { statusCode: 404 });
    }

    const start = new Date(billingPeriodStart);
    const end = new Date(billingPeriodEnd);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw Object.assign(new Error('Invalid billing period dates provided'), { statusCode: 400 });
    }

    if (end < start) {
      throw Object.assign(new Error('Billing period end date cannot be earlier than start date'), { statusCode: 400 });
    }

    const oldStart = invoice.billingPeriodStart;
    const oldEnd = invoice.billingPeriodEnd;

    invoice.billingPeriodStart = start;
    invoice.billingPeriodEnd = end;
    if (userId) {
      invoice.updatedBy = new Types.ObjectId(userId);
    }
    await invoice.save();

    try {
      await AuditLog.create({
        action: 'INVOICE_BILLING_PERIOD_UPDATED' as any,
        module: 'BILLING',
        performedBy: userId ? new Types.ObjectId(userId) : undefined,
        entityId: String(invoice._id),
        entityType: 'LockerInvoice',
        details: {
          invoiceNumber: invoice.invoiceNumber,
          oldStart,
          oldEnd,
          newStart: start,
          newEnd: end,
        },
      });
    } catch {
      // audit log error should not break update
    }

    return this.getInvoiceById(String(invoice._id));
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
    const invoice: any = await this.getInvoiceById(invoiceId);
    if (!invoice) throw Object.assign(new Error('Invoice not found'), { statusCode: 404 });

    const [settings, payments] = await Promise.all([
      (await import('../models/SystemSetting')).SystemSetting.findOne({ key: 'GLOBAL' }).lean(),
      (await import('../models/Payment')).Payment.find({ invoiceId: invoice._id, paymentStatus: 'COMPLETED' })
        .select('receiptNumber paymentDate paymentMethod amount transactionReference bankReference upiReference chequeNumber billNumber')
        .sort({ paymentDate: 1 })
        .lean(),
    ]);

    const customer = invoice.customerId || {};
    const locker = invoice.lockerId || {};
    const allocation = invoice.allocationId || {};

    const formatDate = (val?: any) => {
      if (!val) return '—';
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      const y = d.getFullYear();
      if (y > 100 && y < 1000) d.setFullYear(2000 + (y % 100));
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const formatMoney = (v: number) =>
      `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const inWords = (amount: number): string => {
      const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
      const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
      const num = Math.floor(amount);
      if (num === 0) return 'Zero Rupees Only';
      const wordHelper = (n: number): string => {
        if (n < 20) return a[n];
        if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : ' ');
        if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + (n % 100 !== 0 ? wordHelper(n % 100) : '');
        if (n < 100000) return wordHelper(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 !== 0 ? wordHelper(n % 1000) : '');
        if (n < 10000000) return wordHelper(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 !== 0 ? wordHelper(n % 100000) : '');
        return wordHelper(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 !== 0 ? wordHelper(n % 10000000) : '');
      };
      return `Rupees ${wordHelper(num).trim()} Only`;
    };

    const LOCKER_SIZE_SPECS: Record<string, { label: string; dimensions: string }> = {
      A: { label: 'Size A (Small Vault)', dimensions: '125 × 175 × 492 mm' },
      B: { label: 'Size B (Medium Vault)', dimensions: '159 × 210 × 492 mm' },
      B1: { label: 'Size B1 (Medium Extended)', dimensions: '159 × 230 × 492 mm' },
      C: { label: 'Size C (Large Vault)', dimensions: '189 × 263 × 492 mm' },
      D: { label: 'Size D (XL Vault)', dimensions: '278 × 352 × 492 mm' },
      D1: { label: 'Size D1 (XL Extended)', dimensions: '278 × 380 × 492 mm' },
      E: { label: 'Size E (Executive Vault)', dimensions: '385 × 410 × 492 mm' },
      F: { label: 'Size F (Jumbo Vault)', dimensions: '450 × 500 × 492 mm' },
      F1: { label: 'Size F1 (Jumbo Extended)', dimensions: '450 × 550 × 492 mm' },
      G: { label: 'Size G (Vault Deluxe)', dimensions: '550 × 600 × 492 mm' },
      G1: { label: 'Size G1 (Custom Double)', dimensions: '600 × 700 × 492 mm' },
      G2: { label: 'Size G2 (Master Suite)', dimensions: '750 × 850 × 492 mm' },
    };

    const sizeKey = String(locker.size || 'A').toUpperCase().trim();
    const sizeSpec = LOCKER_SIZE_SPECS[sizeKey] || {
      label: `Size ${locker.size || 'Standard'}`,
      dimensions: 'Standard Vault Compartment',
    };

    const businessName = (settings as any)?.businessName || 'VAULT LEDGER';
    const branchName = (settings as any)?.branchName || 'Premier Safe Deposit Vault & Custody Operations';
    const facilityAddress = (settings as any)?.address || 'Vault Complex, Central Safe Deposit Facility, Main Commercial Road';
    const gstin = (settings as any)?.gstin || '08AAACV1234F1Z5';

    // Financial & Statutory GST Calculations (SAC 997212)
    const totalAmount = Number(invoice.totalAmount || 0);
    let baseRent = Number(invoice.baseRent || 0);
    let taxAmount = Number(invoice.taxAmount || 0);

    // If historical import record had 0 taxAmount, derive standard 18% GST taxable base and tax components
    if (taxAmount === 0 && totalAmount > 0) {
      baseRent = Math.round((totalAmount / 1.18) * 100) / 100;
      taxAmount = Math.round((totalAmount - baseRent) * 100) / 100;
    }

    const cgst = Math.round((taxAmount / 2) * 100) / 100;
    const sgst = Math.round((taxAmount / 2) * 100) / 100;
    const paidAmount = Number(invoice.paidAmount || 0);
    const balanceAmount = Number(invoice.balanceAmount !== undefined ? invoice.balanceAmount : totalAmount - paidAmount);

    const isPaid = invoice.paymentStatus === 'PAID' || balanceAmount <= 0;
    const isCancelled = invoice.status === 'CANCELLED';
    const isPartial = invoice.paymentStatus === 'PARTIALLY_PAID' || (paidAmount > 0 && balanceAmount > 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueD = invoice.dueDate ? new Date(invoice.dueDate) : today;
    dueD.setHours(0, 0, 0, 0);
    const isOverdue = !isPaid && !isCancelled && dueD < today && balanceAmount > 0;
    const overdueDays = isOverdue ? Math.round((today.getTime() - dueD.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    // Period formatting
    let periodStart = invoice.billingPeriodStart ? formatDate(invoice.billingPeriodStart) : '';
    let periodEnd = invoice.billingPeriodEnd ? formatDate(invoice.billingPeriodEnd) : '';
    if (!periodStart && invoice.issueDate) {
      periodStart = formatDate(invoice.issueDate);
      const endD = new Date(invoice.issueDate);
      endD.setFullYear(endD.getFullYear() + 1);
      endD.setDate(endD.getDate() - 1);
      periodEnd = formatDate(endD);
    }
    const periodCoverageStr = periodStart && periodEnd ? `${periodStart} to ${periodEnd}` : 'Annual Tenancy Period';

    // Generate UPI QR Code SVG
    let upiQrSvg = '';
    try {
      const upiUrl = `upi://pay?pa=vaultledger@hdfcbank&pn=${encodeURIComponent(businessName)}&am=${(balanceAmount > 0 ? balanceAmount : totalAmount).toFixed(2)}&cu=INR&tn=${encodeURIComponent('Invoice ' + invoice.invoiceNumber)}`;
      upiQrSvg = await QRCode.toString(upiUrl, {
        type: 'svg',
        margin: 1,
        width: 86,
        color: {
          dark: '#091E42',
          light: '#ffffff',
        },
      });
    } catch {
      upiQrSvg = '';
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice ${invoice.invoiceNumber} - ${businessName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      background: #f1f5f9;
      color: #0f172a;
      font-size: 10px;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      padding: 12px 0;
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
      }
      .no-print {
        display: none !important;
      }
      .page-container {
        box-shadow: none !important;
        border: none !important;
        max-width: 100% !important;
      }
    }
    .page-container {
      width: 100%;
      max-width: 196mm;
      min-height: 277mm;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      position: relative;
    }
    .header-banner {
      background: linear-gradient(135deg, #091e42 0%, #0f2b5c 100%);
      color: #ffffff;
      padding: 16px 20px;
      border-bottom: 3.5px solid #059669;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: relative;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .vault-crest {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .brand-title {
      font-size: 17px;
      font-weight: 900;
      letter-spacing: 0.6px;
      color: #ffffff;
      text-transform: uppercase;
    }
    .brand-sub {
      font-size: 8.5px;
      font-weight: 700;
      color: #34d399;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      margin-top: 1px;
    }
    .brand-address {
      font-size: 8px;
      color: #cbd5e1;
      margin-top: 3px;
      max-width: 380px;
      line-height: 1.25;
    }
    .brand-tax-tags {
      font-size: 7.5px;
      color: #94a3b8;
      margin-top: 3px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .header-right {
      text-align: right;
    }
    .invoice-badge {
      display: inline-block;
      background: #059669;
      color: #ffffff;
      font-size: 8.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 3px 10px;
      border-radius: 4px;
      margin-bottom: 4px;
    }
    .invoice-number-title {
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 0.5px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      color: #ffffff;
    }
    .invoice-classification {
      font-size: 8px;
      color: #94a3b8;
      margin-top: 2px;
      font-weight: 600;
    }
    .sac-tag {
      display: inline-block;
      font-size: 7.5px;
      color: #6ee7b7;
      background: rgba(5, 150, 105, 0.2);
      border: 1px solid rgba(5, 150, 105, 0.4);
      padding: 1.5px 6px;
      border-radius: 3px;
      margin-top: 3px;
      font-weight: 700;
    }

    /* Content Area */
    .invoice-body {
      padding: 14px 18px;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 11px;
    }

    /* Tenancy Vital Metric Strip */
    .metric-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      text-align: center;
    }
    .metric-col {
      border-right: 1px solid #e2e8f0;
      padding: 0 4px;
    }
    .metric-col:last-child {
      border-right: none;
    }
    .metric-label {
      font-size: 7.5px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .metric-val {
      font-size: 10px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }

    /* Side-by-side Tenant & Locker Dossier */
    .dossier-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .dossier-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 12px;
      background: #ffffff;
      position: relative;
    }
    .dossier-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 4px;
      margin-bottom: 6px;
      border-bottom: 1px solid #f1f5f9;
    }
    .dossier-title {
      font-size: 8px;
      font-weight: 900;
      color: #047857;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .dossier-tag {
      font-size: 7.5px;
      font-weight: 700;
      color: #059669;
      background: #ecfdf5;
      padding: 1px 6px;
      border-radius: 3px;
      border: 1px solid #a7f3d0;
    }
    .dossier-name {
      font-size: 12.5px;
      font-weight: 800;
      color: #0f172a;
    }
    .dossier-row {
      font-size: 8.5px;
      color: #475569;
      margin-top: 2.5px;
      display: flex;
      gap: 4px;
    }
    .dossier-row strong {
      color: #1e293b;
      font-weight: 700;
    }

    /* GST Tax Service Schedule */
    .service-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
    }
    .service-table th {
      background: #0f172a;
      color: #ffffff;
      font-size: 7.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 7px 9px;
      text-align: left;
    }
    .service-table td {
      padding: 7px 9px;
      border-top: 1px solid #e2e8f0;
      font-size: 8.5px;
      color: #1e293b;
      vertical-align: middle;
    }
    .service-table tr:nth-child(even) {
      background: #f8fafc;
    }
    .service-main-desc {
      font-size: 9.5px;
      font-weight: 800;
      color: #0f172a;
    }
    .service-sub-desc {
      font-size: 8px;
      color: #64748b;
      margin-top: 2px;
    }

    /* Financial Settlement & Words */
    .settlement-grid {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 12px;
      background: #ffffff;
    }
    .words-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 9px 12px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .words-label {
      font-size: 7.5px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .words-text {
      font-size: 10px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 3px;
      line-height: 1.3;
    }
    .statutory-declaration {
      font-size: 7.5px;
      color: #64748b;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px dashed #cbd5e1;
    }
    .totals-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
    }
    .totals-table td {
      padding: 4px 8px;
      font-size: 8.5px;
    }
    .totals-table tr:nth-child(even) {
      background: #f8fafc;
    }
    .totals-table .total-invoiced-row td {
      border-top: 2px solid #0f172a;
      font-size: 11px;
      font-weight: 900;
      color: #0f172a;
      background: #f0fdf4;
      padding: 6px 8px;
    }
    .totals-table .balance-row td {
      border-top: 1px solid #cbd5e1;
      font-size: 11px;
      font-weight: 900;
      padding: 6px 8px;
    }

    /* Remittance & UPI QR Code Box */
    .remittance-card {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 9px 12px;
      display: grid;
      grid-template-columns: 1.35fr 0.65fr;
      gap: 12px;
      align-items: center;
    }
    .remittance-title {
      font-size: 8px;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .bank-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3px 8px;
      font-size: 8px;
    }
    .bank-item {
      color: #475569;
    }
    .bank-item strong {
      color: #0f172a;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .qr-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-left: 1px dashed #cbd5e1;
      padding-left: 12px;
      text-align: center;
    }
    .qr-caption {
      font-size: 7.5px;
      font-weight: 700;
      color: #047857;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    /* Tenancy Regulatory Bylaws */
    .bylaws-box {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 7px 10px;
      background: #ffffff;
    }
    .bylaws-title {
      font-size: 7.5px;
      font-weight: 800;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
    }
    .bylaws-list {
      font-size: 7.5px;
      color: #64748b;
      line-height: 1.35;
      padding-left: 13px;
    }
    .bylaws-list li {
      margin-bottom: 1.5px;
    }

    /* Execution Signatures & Stamp */
    .execution-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      padding-top: 8px;
      border-top: 1px solid #cbd5e1;
      align-items: flex-end;
    }
    .sign-allottee {
      text-align: left;
    }
    .sign-line {
      border-bottom: 1px solid #94a3b8;
      width: 160px;
      height: 24px;
      margin-bottom: 4px;
    }
    .sign-label {
      font-size: 7.5px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .sign-institution {
      text-align: right;
    }
    .stamp-container {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
    }
    .stamp-badge {
      display: inline-block;
      border: 2px dashed;
      padding: 4px 8px;
      border-radius: 4px;
      text-align: center;
      transform: rotate(-3deg);
    }
    .stamp-paid {
      border-color: #059669;
      background: #ecfdf5;
      color: #065f46;
    }
    .stamp-overdue {
      border-color: #be123c;
      background: #fff1f2;
      color: #9f1239;
    }
    .stamp-partial {
      border-color: #7c3aed;
      background: #f5f3ff;
      color: #5b21b6;
    }
    .stamp-unpaid {
      border-color: #d97706;
      background: #fffbeb;
      color: #92400e;
    }
    .stamp-sub {
      font-size: 6.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .stamp-main {
      font-size: 9.5px;
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .stamp-date {
      font-size: 6.5px;
      font-weight: 700;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      margin-top: 1px;
    }

    /* Bottom Bar */
    .document-footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 6px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7px;
      color: #94a3b8;
    }
  </style>
  ${autoPrint ? '<script>window.addEventListener("load", () => { setTimeout(() => window.print(), 250); });</script>' : ''}
</head>
<body>
  <div class="page-container">
    <!-- Header Banner -->
    <div>
      <div class="header-banner">
        <div class="header-left">
          <div class="vault-crest">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="3"/>
              <circle cx="12" cy="12" r="3"/>
              <path d="m14.5 9.5-5 5"/>
              <circle cx="7" cy="7" r="1" fill="#34d399"/>
              <circle cx="17" cy="7" r="1" fill="#34d399"/>
              <circle cx="7" cy="17" r="1" fill="#34d399"/>
              <circle cx="17" cy="17" r="1" fill="#34d399"/>
            </svg>
          </div>
          <div>
            <div class="brand-title">${businessName}</div>
            <div class="brand-sub">${branchName}</div>
            <div class="brand-address">${facilityAddress}</div>
            <div class="brand-tax-tags">GSTIN: ${gstin} &bull; PAN: AAACV1234F &bull; State: 08-Rajasthan</div>
          </div>
        </div>

        <div class="header-right">
          <div class="invoice-badge">TAX INVOICE</div>
          <div class="invoice-number-title">${invoice.invoiceNumber}</div>
          <div class="invoice-classification">ORIGINAL FOR RECIPIENT &bull; Periodic Tenancy Bill</div>
          <div class="sac-tag">SAC: 997212 (Safe Deposit Vault Services)</div>
        </div>
      </div>
    </div>

    <!-- Main Content Body -->
    <div class="invoice-body">
      <!-- Tenancy Vital Metrics Bar -->
      <div class="metric-strip">
        <div class="metric-col">
          <div class="metric-label">Invoice Issue Date</div>
          <div class="metric-val">${formatDate(invoice.issueDate)}</div>
        </div>
        <div class="metric-col">
          <div class="metric-label">Payment Due Date</div>
          <div class="metric-val" style="${isOverdue ? 'color:#be123c;' : ''}">${formatDate(invoice.dueDate)}</div>
        </div>
        <div class="metric-col">
          <div class="metric-label">Tenancy Coverage Period</div>
          <div class="metric-val" style="color:#047857;">${periodCoverageStr}</div>
        </div>
        <div class="metric-col">
          <div class="metric-label">Billing Cycle</div>
          <div class="metric-val">${invoice.billingCycle === 'ANNUAL' ? '1 Year Annual' : invoice.billingCycle}</div>
        </div>
      </div>

      <!-- Side-by-side Tenant & Compartment Dossiers -->
      <div class="dossier-grid">
        <!-- Billed Allottee (Tenant) -->
        <div class="dossier-card">
          <div class="dossier-header">
            <span class="dossier-title">Billed Allottee (Locker Tenant)</span>
            <span class="dossier-tag">KYC VERIFIED</span>
          </div>
          <div class="dossier-name">${customer.fullName || 'Registered Tenant'}</div>
          <div class="dossier-row">
            <strong>Customer Code:</strong>
            <span style="font-family:ui-monospace,monospace;">${customer.customerCode || '—'}</span>
            <span style="color:#94a3b8;">&bull;</span>
            <strong>Mobile:</strong>
            <span>${customer.phone || '—'}</span>
          </div>
          <div class="dossier-row">
            <strong>Registered Address:</strong>
            <span>${[customer.address, customer.city, customer.state, customer.postalCode].filter(Boolean).join(', ') || 'Address recorded on custody file'}</span>
          </div>
          <div class="dossier-row">
            <strong>Place of Supply:</strong>
            <span>State Code 08 (Rajasthan) &bull; Intra-State Supply</span>
          </div>
        </div>

        <!-- Locker Compartment Specifications -->
        <div class="dossier-card">
          <div class="dossier-header">
            <span class="dossier-title">Physical Vault Compartment</span>
            <span class="dossier-tag" style="background:#f0fdf4; color:#15803d; border-color:#bbf7d0;">UNIT ACTIVE</span>
          </div>
          <div class="dossier-name">Locker #${locker.lockerNumber || '—'} <span style="font-size:10px; font-weight:700; color:#047857;">(${sizeSpec.label})</span></div>
          <div class="dossier-row">
            <strong>Compartment Dimensions:</strong>
            <span style="font-family:ui-monospace,monospace; color:#0f172a;">${sizeSpec.dimensions}</span>
          </div>
          <div class="dossier-row">
            <strong>Vault Location:</strong>
            <span>${locker.rackNumber || 'Rack 493'} &bull; ${locker.section || 'Main Vault'} (${locker.floor || 'Ground Floor'})</span>
          </div>
          <div class="dossier-row">
            <strong>Tenancy Agreement:</strong>
            <span style="font-family:ui-monospace,monospace; color:#047857; font-weight:700;">${allocation.allocationCode || 'ALC-000001'}</span>
            <span style="color:#94a3b8;">&bull;</span>
            <strong>Key Spec:</strong>
            <span>${locker.masterKeyReference || 'Master Key Protocol'}</span>
          </div>
        </div>
      </div>

      <!-- Itemized Statutory GST Tax Schedule -->
      <table class="service-table">
        <thead>
          <tr>
            <th style="width:30px; text-align:center;">#</th>
            <th>Description of Services & Tenancy Period</th>
            <th style="width:70px; text-align:center;">SAC Code</th>
            <th style="width:80px; text-align:center;">Tenancy Term</th>
            <th style="width:85px; text-align:right;">Taxable Value (₹)</th>
            <th style="width:80px; text-align:right;">CGST (9%) (₹)</th>
            <th style="width:80px; text-align:right;">SGST (9%) (₹)</th>
            <th style="width:95px; text-align:right;">Total Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align:center; font-weight:700;">01</td>
            <td>
              <div class="service-main-desc">Safe Deposit Locker Annual Tenancy Rental Charges</div>
              <div class="service-sub-desc">Locker Unit #${locker.lockerNumber || '—'} &bull; ${sizeSpec.label} &bull; Tenancy Period: ${periodCoverageStr}</div>
            </td>
            <td style="text-align:center; font-family:ui-monospace,monospace; font-weight:700;">997212</td>
            <td style="text-align:center; font-weight:600;">${invoice.billingCycle || 'ANNUAL'}</td>
            <td style="text-align:right; font-family:ui-monospace,monospace; font-weight:700;">${formatMoney(baseRent)}</td>
            <td style="text-align:right; font-family:ui-monospace,monospace;">${formatMoney(cgst)}</td>
            <td style="text-align:right; font-family:ui-monospace,monospace;">${formatMoney(sgst)}</td>
            <td style="text-align:right; font-family:ui-monospace,monospace; font-weight:800; color:#0f172a;">${formatMoney(baseRent + taxAmount)}</td>
          </tr>
          ${invoice.lateFee > 0 ? `
          <tr>
            <td style="text-align:center; font-weight:700;">02</td>
            <td>
              <div class="service-main-desc">Late Payment Surcharge / Penalty</div>
              <div class="service-sub-desc">Overdue tenancy administrative surcharge</div>
            </td>
            <td style="text-align:center; font-family:ui-monospace,monospace; font-weight:700;">997212</td>
            <td style="text-align:center;">1 Item</td>
            <td style="text-align:right; font-family:ui-monospace,monospace;">${formatMoney(invoice.lateFee)}</td>
            <td style="text-align:right; font-family:ui-monospace,monospace;">₹0.00</td>
            <td style="text-align:right; font-family:ui-monospace,monospace;">₹0.00</td>
            <td style="text-align:right; font-family:ui-monospace,monospace; font-weight:700; color:#be123c;">+${formatMoney(invoice.lateFee)}</td>
          </tr>` : ''}
          ${invoice.otherCharges > 0 ? `
          <tr>
            <td style="text-align:center; font-weight:700;">03</td>
            <td>
              <div class="service-main-desc">Incidental Key Service & Vault Maintenance Charges</div>
              <div class="service-sub-desc">Operational safe custody administration</div>
            </td>
            <td style="text-align:center; font-family:ui-monospace,monospace; font-weight:700;">997212</td>
            <td style="text-align:center;">1 Item</td>
            <td style="text-align:right; font-family:ui-monospace,monospace;">${formatMoney(invoice.otherCharges)}</td>
            <td style="text-align:right; font-family:ui-monospace,monospace;">₹0.00</td>
            <td style="text-align:right; font-family:ui-monospace,monospace;">₹0.00</td>
            <td style="text-align:right; font-family:ui-monospace,monospace; font-weight:700;">+${formatMoney(invoice.otherCharges)}</td>
          </tr>` : ''}
          ${invoice.discount > 0 ? `
          <tr>
            <td style="text-align:center; font-weight:700;">—</td>
            <td>
              <div class="service-main-desc" style="color:#047857;">Special Concession / Loyalty Tariff Rebate</div>
              <div class="service-sub-desc">Approved institutional discount concession</div>
            </td>
            <td style="text-align:center; font-family:ui-monospace,monospace;">997212</td>
            <td style="text-align:center;">Rebate</td>
            <td style="text-align:right; font-family:ui-monospace,monospace; color:#047857;">-${formatMoney(invoice.discount)}</td>
            <td style="text-align:right; font-family:ui-monospace,monospace;">₹0.00</td>
            <td style="text-align:right; font-family:ui-monospace,monospace;">₹0.00</td>
            <td style="text-align:right; font-family:ui-monospace,monospace; font-weight:700; color:#047857;">-${formatMoney(invoice.discount)}</td>
          </tr>` : ''}
        </tbody>
      </table>

      <!-- Settlement Summary & Words Grid -->
      <div class="settlement-grid">
        <div class="words-card">
          <div>
            <div class="words-label">Invoice Amount in Words</div>
            <div class="words-text">${inWords(totalAmount)}</div>
          </div>
          <div class="statutory-declaration">
            <div><strong>Tax Payable on Reverse Charge:</strong> No &bull; <strong>GST Classification:</strong> Taxable Intra-State Supply</div>
            <div style="margin-top:2px;"><strong>Payment Terms:</strong> Annual Tenancy Rental Payable in Advance</div>
          </div>
        </div>

        <div>
          <table class="totals-table">
            <tr>
              <td style="color:#64748b;">Subtotal (Taxable Base Value):</td>
              <td style="text-align:right; font-weight:700; font-family:ui-monospace,monospace;">${formatMoney(baseRent)}</td>
            </tr>
            <tr>
              <td style="color:#64748b;">Add: Central GST (CGST @ 9%):</td>
              <td style="text-align:right; font-family:ui-monospace,monospace;">${formatMoney(cgst)}</td>
            </tr>
            <tr>
              <td style="color:#64748b;">Add: State GST (SGST @ 9%):</td>
              <td style="text-align:right; font-family:ui-monospace,monospace;">${formatMoney(sgst)}</td>
            </tr>
            <tr class="total-invoiced-row">
              <td>Total Invoiced Amount (inc. GST):</td>
              <td style="text-align:right; color:#047857; font-family:ui-monospace,monospace;">${formatMoney(totalAmount)}</td>
            </tr>
            <tr>
              <td style="color:#047857; font-weight:600;">Less: Amount Received to Date:</td>
              <td style="text-align:right; color:#047857; font-weight:700; font-family:ui-monospace,monospace;">${formatMoney(paidAmount)}</td>
            </tr>
            <tr class="balance-row">
              <td style="color:${balanceAmount > 0 ? (isOverdue ? '#be123c' : '#0f172a') : '#047857'};">Net Balance Outstanding:</td>
              <td style="text-align:right; color:${balanceAmount > 0 ? (isOverdue ? '#be123c' : '#0f172a') : '#047857'}; font-family:ui-monospace,monospace;">${formatMoney(balanceAmount)}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Bank Remittance & UPI Payment Box -->
      <div class="remittance-card">
        <div>
          <div class="remittance-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5">
              <rect width="20" height="14" x="2" y="5" rx="2"/>
              <line x1="2" x2="22" y1="10" y2="10"/>
            </svg>
            Bank Remittance Details (NEFT / RTGS / IMPS)
          </div>
          <div class="bank-grid">
            <div class="bank-item">Beneficiary: <strong>${businessName} Custody Ops</strong></div>
            <div class="bank-item">Bank Name: <strong>HDFC Bank Ltd</strong></div>
            <div class="bank-item">Account No: <strong>50200084920194</strong></div>
            <div class="bank-item">Account Type: <strong>Current Account</strong></div>
            <div class="bank-item">IFSC Code: <strong>HDFC0001234</strong></div>
            <div class="bank-item">UPI VPA: <strong>vaultledger@hdfcbank</strong></div>
          </div>
        </div>

        <div class="qr-block">
          ${upiQrSvg || '<div style="width:70px; height:70px; border:1px solid #cbd5e1; display:flex; align-items:center; justify-content:center; font-size:7px; color:#94a3b8;">UPI QR CODE</div>'}
          <div class="qr-caption">Scan &amp; Pay via UPI</div>
        </div>
      </div>

      ${payments && payments.length > 0 ? `
      <!-- Recorded Payment Transactions -->
      <div style="border:1px solid #e2e8f0; border-radius:6px; padding:7px 10px; background:#f0fdf4;">
        <div style="font-size:7.5px; font-weight:900; color:#047857; text-transform:uppercase; margin-bottom:3px; letter-spacing:0.5px;">
          Settlement Receipt History (${payments.length} Transaction${payments.length > 1 ? 's' : ''})
        </div>
        ${payments.map((p: any) => `
          <div style="display:flex; justify-content:space-between; font-size:8px; padding:2px 0; border-top:1px solid #dcfce7; color:#166534;">
            <span>Receipt: <strong style="font-family:ui-monospace,monospace;">${p.receiptNumber}</strong> ${p.billNumber ? `(Bill #${p.billNumber})` : ''} &bull; ${formatDate(p.paymentDate)} &bull; ${String(p.paymentMethod).replaceAll('_', ' ')}</span>
            <strong style="font-family:ui-monospace,monospace;">${formatMoney(p.amount)}</strong>
          </div>
        `).join('')}
      </div>` : ''}

      <!-- Tenancy Bylaws & Statutory Terms -->
      <div class="bylaws-box">
        <div class="bylaws-title">Safe Deposit Locker Tenancy Bylaws &amp; Operating Regulations</div>
        <ol class="bylaws-list">
          <li><strong>Advance Tenancy Settlement:</strong> Safe deposit locker rent is payable strictly in advance on or before the due date as per Reserve Bank of India &amp; Vault Tenancy Guidelines.</li>
          <li><strong>Grace Period &amp; Default:</strong> A grace period of 30 days is allowed from the due date. Continued arrears beyond 30 days attract late penalty surcharge and access restriction.</li>
          <li><strong>Key Custody &amp; Indemnity:</strong> The allottee is the sole holder of the locker key. The institution does not retain duplicate keys. Loss of key requires lock break-open at tenant's expense.</li>
          <li><strong>Statutory Recovery Rights:</strong> In case of non-payment of rent for consecutive periods, the management reserves statutory rights to break open the compartment in the presence of independent witnesses.</li>
          <li><strong>Reconciliation Reference:</strong> Quoting Invoice No. <strong>${invoice.invoiceNumber}</strong> or Locker No. <strong>#${locker.lockerNumber || '—'}</strong> in RTGS/NEFT/UPI transfer remarks is mandatory for automated ledger credit.</li>
        </ol>
      </div>

      <!-- Execution Signatures & Status Stamp -->
      <div class="execution-grid">
        <div class="sign-allottee">
          <div class="sign-line"></div>
          <div class="sign-label">Tenant / Authorized Allottee Signature</div>
          <div style="font-size:7px; color:#94a3b8; margin-top:1px;">Acknowledged safe custody receipt &amp; tenancy rules</div>
        </div>

        <div class="sign-institution">
          <div class="stamp-container">
            ${isPaid ? `
            <div class="stamp-badge stamp-paid">
              <div class="stamp-sub">CERTIFIED SETTLEMENT</div>
              <div class="stamp-main">PAID IN FULL</div>
              <div class="stamp-date">VAL: ${formatMoney(paidAmount)}</div>
            </div>` : isOverdue ? `
            <div class="stamp-badge stamp-overdue">
              <div class="stamp-sub">ACTION REQUIRED</div>
              <div class="stamp-main">OVERDUE • ${overdueDays} DAYS</div>
              <div class="stamp-date">DUE: ${formatDate(invoice.dueDate)}</div>
            </div>` : isPartial ? `
            <div class="stamp-badge stamp-partial">
              <div class="stamp-sub">PARTIAL RECEIPT</div>
              <div class="stamp-main">PARTIALLY PAID</div>
              <div class="stamp-date">BAL: ${formatMoney(balanceAmount)}</div>
            </div>` : `
            <div class="stamp-badge stamp-unpaid">
              <div class="stamp-sub">TENANCY INVOICE</div>
              <div class="stamp-main">PAYMENT DUE</div>
              <div class="stamp-date">ON OR BEFORE ${formatDate(invoice.dueDate)}</div>
            </div>`}

            <div style="text-align:right;">
              <div style="font-size:8.5px; font-weight:800; color:#0f172a;">For ${businessName}</div>
              <div style="font-size:7.5px; color:#059669; font-weight:700; margin-top:2px;">[ DIGITALLY CERTIFIED &amp; RECORDED ]</div>
              <div style="font-size:7.5px; color:#64748b; margin-top:1px;">Authorized Custody Signatory</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Document Footer Bar -->
    <div class="document-footer">
      <div>This is a certified computer-generated GST tax invoice issued under Section 31 of CGST Act, 2017 &bull; No physical signature required.</div>
      <div>Document ID: <strong style="font-family:ui-monospace,monospace; color:#475569;">${invoice.invoiceNumber}</strong> &bull; Page 1 of 1</div>
    </div>
  </div>
</body>
</html>`;
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
