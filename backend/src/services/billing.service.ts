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
   * Generate clean printable HTML for invoice
   */
  async generateInvoiceHtml(invoiceId: string, autoPrint = false): Promise<string> {
    const invoice: any = await this.getInvoiceById(invoiceId);
    if (!invoice) throw Object.assign(new Error('Invoice not found'), { statusCode: 404 });

    const [settings, payments] = await Promise.all([
      (await import('../models/SystemSetting')).SystemSetting.findOne({ key: 'GLOBAL' }).lean(),
      (await import('../models/Payment')).Payment.find({ invoiceId: invoice._id, paymentStatus: 'COMPLETED' })
        .select('receiptNumber paymentDate paymentMethod amount transactionReference bankReference upiReference chequeNumber')
        .sort({ paymentDate: 1 })
        .lean(),
    ]);

    const customer = invoice.customerId || {};
    const locker = invoice.lockerId || {};
    const allocation = invoice.allocationId || {};

    const formatDate = (val?: any) => {
      if (!val) return '-';
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      const y = d.getFullYear();
      if (y > 100 && y < 1000) d.setFullYear(2000 + (y % 100));
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const formatPhoneStr = (phoneStr?: string) => {
      if (!phoneStr) return '-';
      const digits = phoneStr.replace(/\D/g, '');
      if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
      if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
      if (digits.length > 10) {
        const clean = digits.slice(-10);
        return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
      }
      return phoneStr;
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

    const businessName = (settings as any)?.businessName || 'MARUDHAR VAULT & LOCKER OPERATIONS';
    const subTitle = [(settings as any)?.branchName, (settings as any)?.address].filter(Boolean).join(' | ') || 'Safe Deposit Locker Services & Custody Operations';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoiceNumber} - ${businessName}</title>
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
      background: #ffffff;
      color: #0f172a;
      font-size: 11px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .invoice-wrapper {
      max-width: 800px;
      margin: 0 auto;
      padding: 6px;
    }
    .header-banner {
      background: #0f172a;
      color: #ffffff;
      padding: 16px 20px;
      border-radius: 6px 6px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #047857;
    }
    .brand-title {
      font-size: 17px;
      font-weight: 800;
      letter-spacing: -0.3px;
      color: #ffffff;
    }
    .brand-sub {
      font-size: 8.5px;
      color: #94a3b8;
      margin-top: 2px;
      max-width: 380px;
    }
    .invoice-title-block {
      text-align: right;
    }
    .invoice-title {
      font-size: 17px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #ffffff;
    }
    .invoice-number {
      font-size: 10.5px;
      font-weight: 700;
      color: #34d399;
      margin-top: 2px;
    }
    .invoice-type {
      font-size: 8px;
      color: #cbd5e1;
      margin-top: 2px;
    }
    .meta-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-top: none;
      padding: 10px 14px;
      text-align: center;
    }
    .meta-box {
      border-right: 1px solid #e2e8f0;
    }
    .meta-box:last-child {
      border-right: none;
    }
    .meta-label {
      font-size: 7.5px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta-val {
      font-size: 10.5px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 2px;
    }
    .cards-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin: 12px 0;
    }
    .info-card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      background: #ffffff;
    }
    .card-title {
      font-size: 8px;
      font-weight: 800;
      color: #047857;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      padding-bottom: 3px;
      border-bottom: 1px solid #f1f5f9;
    }
    .card-main {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
    }
    .card-line {
      font-size: 9px;
      color: #475569;
      margin-top: 2px;
    }
    .service-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
    }
    .service-table th {
      background: #0f172a;
      color: #ffffff;
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 7px 10px;
      text-align: left;
    }
    .service-table td {
      padding: 7px 10px;
      border-top: 1px solid #e2e8f0;
      font-size: 9px;
      color: #1e293b;
    }
    .service-table tr:nth-child(even) {
      background: #f8fafc;
    }
    .totals-wrapper {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 14px;
      margin-top: 10px;
      padding: 8px 0;
    }
    .words-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
    }
    .totals-table {
      width: 100%;
      border-collapse: collapse;
    }
    .totals-table td {
      padding: 3px 5px;
      font-size: 9.5px;
    }
    .totals-table .total-row td {
      border-top: 2px solid #0f172a;
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      padding-top: 5px;
    }
    .receipts-box {
      margin-top: 10px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
      background: #ffffff;
    }
    .footer-block {
      margin-top: 16px;
      padding-top: 10px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .sign-box {
      text-align: right;
    }
  </style>
  ${autoPrint ? '<script>window.addEventListener("load", () => { setTimeout(() => window.print(), 200); });</script>' : ''}
</head>
<body>
  <div class="invoice-wrapper">
    <div class="header-banner">
      <div>
        <div class="brand-title">${businessName}</div>
        <div class="brand-sub">${subTitle}</div>
        ${(settings as any)?.gstin ? `<div style="font-size:8px; color:#94a3b8; margin-top:2px; font-weight:bold;">GSTIN: ${(settings as any).gstin}</div>` : ''}
      </div>
      <div class="invoice-title-block">
        <div class="invoice-title">INVOICE</div>
        <div class="invoice-number">${invoice.invoiceNumber}</div>
        <div class="invoice-type">${invoice.invoiceType === 'LEGACY_IMPORT' ? 'Historical Ledger Document' : 'Customer Tax Invoice'}</div>
      </div>
    </div>

    <div class="meta-strip">
      <div class="meta-box">
        <div class="meta-label">Issue Date</div>
        <div class="meta-val">${formatDate(invoice.issueDate)}</div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Due Date</div>
        <div class="meta-val" style="color:#be123c;">${formatDate(invoice.dueDate)}</div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Billing Cycle</div>
        <div class="meta-val">${invoice.billingCycle}</div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Status</div>
        <div class="meta-val" style="color:#047857;">${invoice.status === 'CANCELLED' ? 'CANCELLED' : invoice.paymentStatus.replaceAll('_', ' ')}</div>
      </div>
    </div>

    <div class="cards-grid">
      <div class="info-card">
        <div class="card-title">Bill To Tenant</div>
        <div class="card-main">${customer.fullName || 'Customer'}</div>
        <div class="card-line"><strong>ID:</strong> ${customer.customerCode || '-'} &bull; <strong>Phone:</strong> ${formatPhoneStr(customer.phone)}</div>
        <div class="card-line">${[customer.address, customer.city, customer.state].filter(Boolean).join(', ') || 'Address on record'}</div>
      </div>
      <div class="info-card">
        <div class="card-title">Locker & Tenancy Details</div>
        <div class="card-main">Locker #${locker.lockerNumber || '-'} (Size ${locker.size || '-'})</div>
        <div class="card-line"><strong>Rack:</strong> ${locker.rackNumber || '-'} &bull; <strong>Section:</strong> ${locker.section || 'Main Vault'}</div>
        <div class="card-line"><strong>Tenancy Agreement:</strong> ${allocation.allocationCode || 'ALC-DIRECT'}</div>
      </div>
    </div>

    <table class="service-table">
      <thead>
        <tr>
          <th>Description of Service</th>
          <th style="text-align:center; width:90px;">Qty / Period</th>
          <th style="text-align:right; width:100px;">Rate</th>
          <th style="text-align:right; width:110px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Safe deposit locker periodic rental charge</td>
          <td style="text-align:center;">${invoice.billingCycle}</td>
          <td style="text-align:right;">${formatMoney(invoice.baseRent)}</td>
          <td style="text-align:right;">${formatMoney(invoice.baseRent)}</td>
        </tr>
        ${invoice.lateFee > 0 ? `<tr><td>Late payment penalty charge</td><td style="text-align:center;">1</td><td style="text-align:right;">${formatMoney(invoice.lateFee)}</td><td style="text-align:right; color:#be123c;">+${formatMoney(invoice.lateFee)}</td></tr>` : ''}
        ${invoice.otherCharges > 0 ? `<tr><td>Miscellaneous operational charges</td><td style="text-align:center;">1</td><td style="text-align:right;">${formatMoney(invoice.otherCharges)}</td><td style="text-align:right;">+${formatMoney(invoice.otherCharges)}</td></tr>` : ''}
        ${invoice.discount > 0 ? `<tr><td>Special tariff discount concession</td><td style="text-align:center;">1</td><td style="text-align:right;">${formatMoney(invoice.discount)}</td><td style="text-align:right; color:#047857;">-${formatMoney(invoice.discount)}</td></tr>` : ''}
        ${invoice.taxAmount > 0 ? `<tr><td>GST / Applicable Taxes</td><td style="text-align:center;">1</td><td style="text-align:right;">${formatMoney(invoice.taxAmount)}</td><td style="text-align:right;">+${formatMoney(invoice.taxAmount)}</td></tr>` : ''}
      </tbody>
    </table>

    <div class="totals-wrapper">
      <div class="words-box">
        <div style="font-size:7.5px; font-weight:700; color:#64748b; text-transform:uppercase;">Amount in Words</div>
        <div style="font-size:9.5px; font-weight:700; color:#0f172a; margin-top:2px;">${inWords(invoice.totalAmount)}</div>
        <div style="font-size:8px; color:#64748b; margin-top:6px;">Reverse Charge: No &bull; Payment Mode: In Advance</div>
      </div>
      <div>
        <table class="totals-table">
          <tr>
            <td style="color:#64748b;">Subtotal:</td>
            <td style="text-align:right; font-weight:600;">${formatMoney(invoice.subtotal)}</td>
          </tr>
          <tr class="total-row">
            <td>Total Invoiced:</td>
            <td style="text-align:right; color:#047857;">${formatMoney(invoice.totalAmount)}</td>
          </tr>
          <tr>
            <td style="color:#047857; font-weight:600;">Paid to Date:</td>
            <td style="text-align:right; color:#047857; font-weight:700;">${formatMoney(invoice.paidAmount)}</td>
          </tr>
          <tr>
            <td style="color:#be123c; font-weight:600;">Balance Due:</td>
            <td style="text-align:right; color:${invoice.balanceAmount > 0 ? '#be123c' : '#047857'}; font-weight:800; font-size:10.5px;">${formatMoney(invoice.balanceAmount)}</td>
          </tr>
        </table>
      </div>
    </div>

    ${payments && payments.length > 0 ? `
    <div class="receipts-box">
      <div style="font-size:8px; font-weight:800; color:#047857; text-transform:uppercase; margin-bottom:3px;">Recorded Payment Receipts (${payments.length})</div>
      ${payments.map((p: any) => `
        <div style="display:flex; justify-content:space-between; font-size:8.5px; padding:2px 0; border-top:1px solid #f1f5f9;">
          <span><strong>${p.receiptNumber}</strong> &bull; ${formatDate(p.paymentDate)} &bull; ${p.paymentMethod.replaceAll('_', ' ')}</span>
          <strong style="color:#047857;">${formatMoney(p.amount)}</strong>
        </div>
      `).join('')}
    </div>` : ''}

    <div class="footer-block">
      <div>
        <div style="font-size:8px; color:#64748b; max-width:360px;">
          ${invoice.notes ? `<strong>Notes:</strong> ${invoice.notes}` : 'System generated invoice based on certified locker tenancy agreement.'}
        </div>
        <div style="font-size:7px; color:#94a3b8; margin-top:3px;">Quote invoice number in all future communications.</div>
      </div>
      <div class="sign-box">
        <div style="font-size:9px; font-weight:700; color:#0f172a;">For ${businessName}</div>
        <div style="font-size:8px; color:#64748b; margin-top:22px;">Authorized Signatory</div>
      </div>
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
