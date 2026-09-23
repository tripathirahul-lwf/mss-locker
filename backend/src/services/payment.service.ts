import mongoose, { ClientSession, Types } from 'mongoose';
import { Payment, IPayment } from '../models/Payment';
import { LockerInvoice } from '../models/LockerInvoice';
import { LockerAllocation } from '../models/LockerAllocation';
import { AuditLog } from '../models/AuditLog';
import {
  PaymentMethod,
  PaymentStatus,
  PaymentSource,
  DIGITAL_PAYMENT_METHODS,
} from '../constants/payment.constants';
import { generatePaymentNumber, generateReceiptNumber } from '../utils/paymentCalculator';
import { determineDueStatus } from '../utils/billingCalculator';
import { normalizeMoney } from '../utils/money';

export interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate?: string;
  billNumber?: string;
  transactionReference?: string;
  bankReference?: string;
  upiReference?: string;
  chequeNumber?: string;
  bankName?: string;
  chequeDate?: string;
  proofUrl?: string;
  proofDocumentName?: string;
  notes?: string;
  source?: PaymentSource;
}

export interface PaymentQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  customerId?: string;
  lockerId?: string;
  invoiceId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class PaymentService {
  /**
   * Recalculates authoritative invoice paid and balance amounts from live completed payments
   */
  async recalculateInvoicePaymentSummary(invoiceId: Types.ObjectId | string, session?: ClientSession) {
    const invId = new Types.ObjectId(invoiceId);
    const invoice = await LockerInvoice.findById(invId).session(session || null);
    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found for reconciliation`);
    }

    const completedPayments = await Payment.find({
      invoiceId: invId,
      paymentStatus: 'COMPLETED',
    }).select('amount').session(session || null);

    const totalPaid = completedPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const balanceAmount = Math.max(0, invoice.totalAmount - totalPaid);

    let paymentStatus: any = 'UNPAID';
    if (balanceAmount <= 0 && invoice.totalAmount > 0) {
      paymentStatus = 'PAID';
    } else if (totalPaid > 0) {
      paymentStatus = 'PARTIALLY_PAID';
    }

    invoice.paidAmount = totalPaid;
    invoice.balanceAmount = balanceAmount;
    invoice.paymentStatus = paymentStatus;
    invoice.dueStatus = determineDueStatus(new Date(invoice.dueDate), balanceAmount);

    await invoice.save({ session });

    // If fully paid, synchronize allocation paidThroughDate
    if (paymentStatus === 'PAID') {
      const allocation = await LockerAllocation.findById(invoice.allocationId).session(session || null);
      if (allocation) {
        if (!allocation.paidThroughDate || new Date(allocation.paidThroughDate) < new Date(invoice.billingPeriodEnd)) {
          allocation.paidThroughDate = invoice.billingPeriodEnd;
          await allocation.save({ session });
        }
      }
    }

    return invoice;
  }

  /**
   * Records a new customer payment with idempotency & overpayment protection
   */
  async recordPayment(input: RecordPaymentInput, userId?: string, idempotencyKey?: string) {
    if (!input.invoiceId || !Types.ObjectId.isValid(input.invoiceId)) {
      const error: any = new Error('Valid invoice ID is required');
      error.statusCode = 400;
      throw error;
    }

    const amount = normalizeMoney(input.amount, 'Payment amount');
    const referenceByMethod: Partial<Record<PaymentMethod, string | undefined>> = {
      UPI: input.upiReference,
      BANK_TRANSFER: input.bankReference,
      CARD: input.transactionReference,
      OTHER: input.transactionReference,
    };
    if (input.paymentMethod !== 'CASH' && input.paymentMethod !== 'CHEQUE' && !referenceByMethod[input.paymentMethod]?.trim()) {
      throw Object.assign(new Error('A transaction/reference number is required for this manual payment method.'), { statusCode: 400 });
    }
    if (input.paymentMethod === 'CHEQUE' && (!input.chequeNumber?.trim() || !input.bankName?.trim() || !input.chequeDate)) {
      throw Object.assign(new Error('Cheque number, bank name and cheque date are required.'), { statusCode: 400 });
    }

    // Idempotency Check
    if (idempotencyKey && idempotencyKey.trim()) {
      const existing = await Payment.findOne({ idempotencyKey: idempotencyKey.trim() })
        .populate('customerId', 'fullName customerCode phone')
        .populate('lockerId', 'lockerNumber size rackNumber')
        .populate('invoiceId', 'invoiceNumber totalAmount balanceAmount');

      if (existing) {
        return existing;
      }
    }

    const session = await mongoose.startSession();
    let paymentId: Types.ObjectId | undefined;
    try {
    await session.withTransaction(async () => {
    // Authoritative live invoice check. The no-op update acquires a write lock so
    // concurrent payments cannot both approve against the same stale balance.
    const invoice = await LockerInvoice.findOneAndUpdate(
      { _id: input.invoiceId, status: { $ne: 'CANCELLED' } },
      { $set: { updatedAt: new Date() } },
      { new: true, session }
    );
    if (!invoice) {
      const error: any = new Error('Invoice not found');
      error.statusCode = 404;
      throw error;
    }

    if (invoice.status === 'CANCELLED') {
      const error: any = new Error('Cannot record payment against a cancelled invoice');
      error.statusCode = 400;
      throw error;
    }

    // Calculate live outstanding balance from completed payments
    const completedPayments = await Payment.find({
      invoiceId: invoice._id,
      paymentStatus: 'COMPLETED',
    }).select('amount').session(session);

    const currentPaidTotal = completedPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const liveOutstanding = Math.max(0, invoice.totalAmount - currentPaidTotal);

    if (liveOutstanding <= 0) {
      const error: any = new Error('Invoice is already fully paid');
      error.statusCode = 400;
      throw error;
    }

    if (amount > liveOutstanding) {
      const error: any = new Error(
        `Payment amount (₹${amount.toLocaleString('en-IN')}) exceeds current outstanding balance (₹${liveOutstanding.toLocaleString('en-IN')}).`
      );
      error.statusCode = 409;
      throw error;
    }

    const paymentNumber = await generatePaymentNumber();
    const receiptNumber = await generateReceiptNumber();

    const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date();

    const [payment] = await Payment.create([{
      paymentNumber,
      receiptNumber,
      idempotencyKey: idempotencyKey?.trim() || undefined,
      customerId: invoice.customerId,
      allocationId: invoice.allocationId,
      lockerId: invoice.lockerId,
      invoiceId: invoice._id,
      amount,
      paymentMethod: input.paymentMethod,
      paymentStatus: 'COMPLETED',
      billNumber: input.billNumber?.trim() || undefined,
      transactionReference: input.transactionReference?.trim() || undefined,
      bankReference: input.bankReference?.trim() || undefined,
      upiReference: input.upiReference?.trim() || undefined,
      chequeNumber: input.chequeNumber?.trim() || undefined,
      bankName: input.bankName?.trim() || undefined,
      chequeDate: input.chequeDate ? new Date(input.chequeDate) : undefined,
      proofUrl: input.proofUrl?.trim() || undefined,
      proofDocumentName: input.proofDocumentName?.trim() || undefined,
      paymentDate,
      receivedAt: new Date(),
      source: 'MANUAL_ENTRY',
      notes: input.notes?.trim() || undefined,
      recordedBy: userId ? new Types.ObjectId(userId) : undefined,
    }], { session });
    paymentId = payment._id;

    // Reconcile Invoice Balances and State
    const updatedInvoice = await this.recalculateInvoicePaymentSummary(invoice._id, session);

    // Audit Event
    await AuditLog.create([{
      action: 'PAYMENT_RECORDED',
      module: 'PAYMENTS',
      performedBy: userId ? new Types.ObjectId(userId) : undefined,
      entityId: payment._id,
      entityType: 'Payment',
      details: {
        paymentNumber: payment.paymentNumber,
        receiptNumber: payment.receiptNumber,
        billNumber: payment.billNumber,
        invoiceNumber: invoice.invoiceNumber,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        hasProof: Boolean(payment.proofUrl),
        proofDocumentName: payment.proofDocumentName,
        remainingBalance: updatedInvoice.balanceAmount,
      },
    }], { session });
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    } finally {
      await session.endSession();
    }

    if (!paymentId) throw new Error('Payment transaction did not complete');

    const populatedPayment = await Payment.findById(paymentId)
      .populate('customerId', 'fullName customerCode phone photoUrl')
      .populate('lockerId', 'lockerNumber size rackNumber')
      .populate('invoiceId', 'invoiceNumber totalAmount balanceAmount paymentStatus')
      .lean();

    return populatedPayment;
  }

  /**
   * Cancel a payment transaction and reconcile invoice
   */
  async cancelPayment(paymentId: string, reason: string, userId: string) {
    if (!Types.ObjectId.isValid(paymentId)) {
      const error: any = new Error('Invalid payment ID');
      error.statusCode = 400;
      throw error;
    }

    if (!reason || !reason.trim()) {
      const error: any = new Error('Cancellation reason is required');
      error.statusCode = 400;
      throw error;
    }

    const session = await mongoose.startSession();
    let result: IPayment | undefined;
    try {
      await session.withTransaction(async () => {
    const payment = await Payment.findOneAndUpdate(
      { _id: paymentId, paymentStatus: { $ne: 'CANCELLED' } },
      { $set: { updatedAt: new Date() } },
      { new: true, session }
    );
    if (!payment) {
      const error: any = new Error('Payment transaction not found');
      error.statusCode = 404;
      throw error;
    }

    payment.paymentStatus = 'CANCELLED';
    payment.cancelledAt = new Date();
    payment.cancelledBy = new Types.ObjectId(userId);
    payment.cancellationReason = reason.trim();
    await payment.save({ session });

    // Reconcile Invoice if linked
    let balanceAmount = 0;
    if (payment.invoiceId) {
      const updatedInvoice = await this.recalculateInvoicePaymentSummary(payment.invoiceId, session);
      balanceAmount = updatedInvoice.balanceAmount;
    }

    // Audit Log
    await AuditLog.create([{
      action: 'PAYMENT_CANCELLED',
      module: 'PAYMENTS',
      performedBy: new Types.ObjectId(userId),
      entityId: payment._id,
      entityType: 'Payment',
      details: {
        paymentNumber: payment.paymentNumber,
        receiptNumber: payment.receiptNumber,
        amount: payment.amount,
        reason: reason.trim(),
        reopenedInvoiceBalance: balanceAmount,
      },
    }], { session });

    result = payment;
      });
    } finally {
      await session.endSession();
    }
    if (!result) throw new Error('Payment cancellation did not complete');
    return result;
  }

  /**
   * Get paginated payment transactions with search and filters
   */
  async getPayments(params: PaymentQueryParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 25));
    const skip = (page - 1) * limit;

    const query: any = {};

    if (params.paymentMethod) query.paymentMethod = params.paymentMethod;
    if (params.paymentStatus) query.paymentStatus = params.paymentStatus;
    if (params.customerId) query.customerId = new Types.ObjectId(params.customerId);
    if (params.lockerId) query.lockerId = new Types.ObjectId(params.lockerId);
    if (params.invoiceId) query.invoiceId = new Types.ObjectId(params.invoiceId);

    if (params.dateFrom || params.dateTo) {
      query.paymentDate = {};
      if (params.dateFrom) query.paymentDate.$gte = new Date(params.dateFrom);
      if (params.dateTo) {
        const toDate = new Date(params.dateTo);
        toDate.setHours(23, 59, 59, 999);
        query.paymentDate.$lte = toDate;
      }
    }

    if (params.search && params.search.trim()) {
      const searchRegex = new RegExp(params.search.trim(), 'i');
      query.$or = [
        { paymentNumber: searchRegex },
        { receiptNumber: searchRegex },
        { billNumber: searchRegex },
        { transactionReference: searchRegex },
        { bankReference: searchRegex },
        { upiReference: searchRegex },
        { chequeNumber: searchRegex },
        { legacyReference: searchRegex },
      ];
    }

    const sortField = params.sortBy || 'paymentDate';
    const sortDir = params.sortOrder === 'asc' ? 1 : -1;
    const sort: any = { [sortField]: sortDir };

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate('customerId', 'fullName customerCode phone photoUrl')
        .populate('lockerId', 'lockerNumber size rackNumber section')
        .populate('invoiceId', 'invoiceNumber totalAmount balanceAmount paymentStatus')
        .populate('recordedBy', 'name username role')
        .populate('cancelledBy', 'name username role')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments(query),
    ]);

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single payment dossier
   */
  async getPaymentById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;

    return Payment.findById(id)
      .populate('customerId', 'fullName customerCode phone photoUrl address city state')
      .populate('lockerId', 'lockerNumber lockerCode size rackNumber section floor')
      .populate('invoiceId', 'invoiceNumber billingPeriodStart billingPeriodEnd baseRent lateFee taxAmount totalAmount paidAmount balanceAmount paymentStatus')
      .populate('allocationId', 'allocationCode startDate billingCycle')
      .populate('recordedBy', 'name username role')
      .populate('cancelledBy', 'name username role')
      .lean();
  }

  /**
   * Get live payment statistics for dashboard & summary cards
   */
  async getPaymentStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      todayCompleted,
      monthCompleted,
      cashToday,
      digitalToday,
      totalTransactions,
    ] = await Promise.all([
      // Today completed
      Payment.find({
        paymentStatus: 'COMPLETED',
        paymentDate: { $gte: todayStart, $lte: todayEnd },
      }).select('amount paymentMethod'),

      // Month completed
      Payment.find({
        paymentStatus: 'COMPLETED',
        paymentDate: { $gte: monthStart, $lte: monthEnd },
      }).select('amount'),

      // Cash today
      Payment.find({
        paymentStatus: 'COMPLETED',
        paymentMethod: 'CASH',
        paymentDate: { $gte: todayStart, $lte: todayEnd },
      }).select('amount'),

      // Digital today
      Payment.find({
        paymentStatus: 'COMPLETED',
        paymentMethod: { $in: DIGITAL_PAYMENT_METHODS },
        paymentDate: { $gte: todayStart, $lte: todayEnd },
      }).select('amount'),

      // Total count
      Payment.countDocuments({ paymentStatus: 'COMPLETED' }),
    ]);

    const sumAmount = (list: any[]) => list.reduce((sum, item) => sum + (item.amount || 0), 0);

    return {
      todayCollection: {
        amount: sumAmount(todayCompleted),
        count: todayCompleted.length,
      },
      monthCollection: {
        amount: sumAmount(monthCompleted),
        count: monthCompleted.length,
      },
      cashToday: {
        amount: sumAmount(cashToday),
        count: cashToday.length,
      },
      digitalToday: {
        amount: sumAmount(digitalToday),
        count: digitalToday.length,
      },
      totalTransactions,
    };
  }

  /**
   * Sub-resource queries
   */
  async getCustomerPayments(customerId: string) {
    return Payment.find({ customerId: new Types.ObjectId(customerId) })
      .populate('lockerId', 'lockerNumber size rackNumber')
      .populate('invoiceId', 'invoiceNumber')
      .sort({ paymentDate: -1 })
      .lean();
  }

  async getLockerPayments(lockerId: string) {
    return Payment.find({ lockerId: new Types.ObjectId(lockerId) })
      .populate('customerId', 'fullName customerCode phone')
      .populate('invoiceId', 'invoiceNumber')
      .sort({ paymentDate: -1 })
      .lean();
  }

  async getInvoicePayments(invoiceId: string) {
    return Payment.find({ invoiceId: new Types.ObjectId(invoiceId) })
      .populate('recordedBy', 'name username')
      .sort({ paymentDate: -1 })
      .lean();
  }
  /**
   * Generates a clean, professional, black-and-white print-ready HTML receipt voucher
   */
  async generatePaymentReceiptHtml(paymentId: string, autoPrint: boolean = false): Promise<string> {
    const payment: any = await this.getPaymentById(paymentId);
    if (!payment) {
      const error: any = new Error('Payment not found');
      error.statusCode = 404;
      throw error;
    }

    const customer: any = payment.customerId || {};
    const locker: any = payment.lockerId || {};
    const invoice: any = payment.invoiceId || {};
    const allocation: any = payment.allocationId || {};
    const isCancelled = payment.paymentStatus === 'CANCELLED';

    // Helper: Number to INR words
    const a = [
      '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ',
      'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ',
      'Seventeen ', 'Eighteen ', 'Nineteen '
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const inWords = (n: number): string => {
      if (n < 20) return a[n];
      if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : ' ');
      if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + (n % 100 !== 0 ? inWords(n % 100) : '');
      if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 !== 0 ? inWords(n % 1000) : '');
      if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 !== 0 ? inWords(n % 100000) : '');
      return inWords(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 !== 0 ? inWords(n % 10000000) : '');
    };
    const amountInWords = `Rupees ${inWords(Math.floor(payment.amount)).trim()} Only`;

    const paymentDateStr = new Date(payment.paymentDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const paymentTimeStr = payment.receivedAt ? new Date(payment.receivedAt).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt ${payment.receiptNumber} - MSS Locker</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #111827;
      background: #fff;
      font-size: 11pt;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 10px;
      position: relative;
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #000;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .brand-title {
      font-size: 18pt;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #000;
    }
    .brand-sub {
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #333;
      margin-top: 1px;
    }
    .meta-text {
      font-size: 8pt;
      color: #555;
      margin-top: 2px;
    }
    .receipt-badge {
      display: inline-block;
      border: 1.5px solid #000;
      padding: 3px 8px;
      font-size: 8.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .receipt-num {
      font-family: "Courier New", Courier, monospace;
      font-size: 13pt;
      font-weight: 800;
      margin-top: 4px;
    }
    .info-grid {
      width: 100%;
      border: 1px solid #000;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    .info-grid td {
      border: 1px solid #000;
      padding: 8px 10px;
      vertical-align: top;
      width: 50%;
    }
    .section-label {
      font-size: 7.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #555;
      margin-bottom: 3px;
    }
    .entity-name {
      font-size: 11pt;
      font-weight: 800;
      color: #000;
    }
    .line-table {
      width: 100%;
      border: 1px solid #000;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    .line-table th {
      background: #f0f0f0;
      border: 1px solid #000;
      padding: 6px 10px;
      font-size: 8.5pt;
      font-weight: 800;
      text-transform: uppercase;
      text-align: left;
    }
    .line-table td {
      border: 1px solid #000;
      padding: 8px 10px;
      font-size: 9.5pt;
    }
    .total-box {
      border: 1.5px solid #000;
      padding: 10px 12px;
      margin-bottom: 14px;
      background: #fafafa;
    }
    .words-label {
      font-size: 7.5pt;
      font-weight: 800;
      text-transform: uppercase;
      color: #555;
    }
    .words-value {
      font-size: 10pt;
      font-weight: 800;
      font-style: italic;
      color: #000;
      margin-top: 2px;
    }
    .amount-value {
      font-size: 18pt;
      font-weight: 900;
      font-family: "Courier New", Courier, monospace;
      text-align: right;
    }
    .recon-row {
      border-top: 1px dashed #666;
      margin-top: 8px;
      padding-top: 6px;
      font-size: 8.5pt;
      display: flex;
      justify-content: space-between;
      color: #333;
    }
    .terms-box {
      border: 1px solid #ccc;
      padding: 8px 10px;
      font-size: 7.5pt;
      color: #444;
      margin-bottom: 18px;
      background: #fff;
    }
    .terms-box ol {
      margin-left: 14px;
      margin-top: 3px;
    }
    .terms-box li {
      margin-bottom: 2px;
    }
    .sig-table {
      width: 100%;
      margin-top: 20px;
      margin-bottom: 10px;
    }
    .sig-table td {
      width: 50%;
      text-align: center;
      vertical-align: bottom;
      padding: 0 20px;
    }
    .sig-line {
      border-top: 1px solid #000;
      margin-top: 40px;
      padding-top: 4px;
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
    }
    .stamp-box {
      border: 1px dashed #000;
      padding: 3px 8px;
      display: inline-block;
      font-size: 7.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .footer-note {
      text-align: center;
      font-size: 7.5pt;
      color: #666;
      border-top: 1px solid #ddd;
      padding-top: 6px;
      margin-top: 10px;
    }
    .watermark {
      position: absolute;
      top: 35%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 50pt;
      font-weight: 900;
      color: rgba(220, 38, 38, 0.15);
      border: 8px solid rgba(220, 38, 38, 0.15);
      padding: 10px 30px;
      text-transform: uppercase;
      letter-spacing: 5px;
      pointer-events: none;
      z-index: 100;
    }
    .cancelled-alert {
      border: 1.5px solid #dc2626;
      background: #fef2f2;
      color: #991b1b;
      padding: 6px 10px;
      font-size: 8.5pt;
      font-weight: 700;
      margin-bottom: 12px;
    }
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    ${isCancelled ? '<div class="watermark">CANCELLED / VOID</div>' : ''}

    <!-- Header -->
    <table class="header-table">
      <tr>
        <td style="vertical-align: top;">
          <div class="brand-title">MSS LOCKER</div>
          <div class="brand-sub">Safe-Deposit Locker Vault & Custody Services</div>
          <div class="meta-text">Main Branch Vault &bull; 24x7 Armed Security Custody</div>
          <div class="meta-text">Branch Code: VL-MUM-01 &bull; GSTIN: 27AAAAA0000A1Z5</div>
        </td>
        <td style="text-align: right; vertical-align: top;">
          <div class="receipt-badge">${isCancelled ? 'CANCELLED RECEIPT' : 'OFFICIAL PAYMENT RECEIPT'}</div>
          <div class="receipt-num">${payment.receiptNumber}</div>
          ${payment.billNumber ? `<div style="font-size: 9pt; font-weight: 700; color: #065f46; margin-top: 2px;">Manual Bill No: #${payment.billNumber}</div>` : ''}
          <div class="meta-text" style="font-weight: 700; color: #000; margin-top: 3px;">
            Date: ${paymentDateStr} ${paymentTimeStr ? '• ' + paymentTimeStr : ''}
          </div>
        </td>
      </tr>
    </table>

    ${isCancelled ? `
    <div class="cancelled-alert">
      <strong>TRANSACTION CANCELLED:</strong> This receipt was voided on ${payment.cancelledAt ? new Date(payment.cancelledAt).toLocaleString('en-IN') : 'N/A'} by ${payment.cancelledBy?.name || 'Administrator'}. Reason: ${payment.cancellationReason || 'Administrative cancellation'}.
    </div>` : ''}

    <!-- Tenant & Locker Coordinates -->
    <table class="info-grid">
      <tr>
        <td>
          <div class="section-label">Verified Tenant Information</div>
          <div class="entity-name">${customer.fullName || 'Customer Record'}</div>
          <div style="font-size: 9pt; margin-top: 2px;">
            <strong>Customer Code:</strong> ${customer.customerCode || 'N/A'}
          </div>
          <div style="font-size: 9pt;">
            <strong>Phone:</strong> ${customer.phone || 'N/A'}
          </div>
          ${customer.address ? `<div style="font-size: 8.5pt; color: #444; margin-top: 2px;">${customer.address}, ${customer.city || ''}</div>` : ''}
        </td>
        <td>
          <div class="section-label">Allocated Locker Coordinates</div>
          <div class="entity-name">Locker #${locker.lockerNumber || 'N/A'} (Size ${locker.size || 'STD'})</div>
          <div style="font-size: 9pt; margin-top: 2px;">
            <strong>Rack / Vault:</strong> ${locker.rackNumber || 'Rack N/A'}${locker.section ? ' • ' + locker.section : ''}${locker.floor ? ' (' + locker.floor + ')' : ''}
          </div>
          <div style="font-size: 9pt;">
            <strong>Agreement Code:</strong> ${allocation.allocationCode || 'N/A'}
          </div>
          <div style="font-size: 9pt;">
            <strong>Invoice Reference:</strong> ${invoice.invoiceNumber || 'INV-DIRECT'}
          </div>
        </td>
      </tr>
    </table>

    <!-- Line Items Table -->
    <table class="line-table">
      <thead>
        <tr>
          <th style="width: 55%;">Particulars / Description</th>
          <th style="width: 25%;">Reference / Mode</th>
          <th style="width: 20%; text-align: right;">Amount Paid</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>Safe-Deposit Locker Periodic Tenancy / Renewal Rent</strong>
            <div style="font-size: 8pt; color: #555; margin-top: 3px;">
              Covering Tenancy Dues for Locker #${locker.lockerNumber || ''} &bull; Inv #${invoice.invoiceNumber || ''}
            </div>
          </td>
          <td>
            <strong>${payment.paymentMethod}</strong>
            <div style="font-size: 8pt; font-family: monospace; color: #444; margin-top: 2px;">
              ${payment.upiReference ? 'UPI Ref: ' + payment.upiReference : ''}
              ${payment.bankReference ? 'UTR: ' + payment.bankReference : ''}
              ${payment.transactionReference ? 'Txn: ' + payment.transactionReference : ''}
              ${payment.chequeNumber ? 'Cheque: #' + payment.chequeNumber : ''}
              ${payment.proofUrl ? '<div style="font-size: 7.5pt; color: #047857; font-weight: 700; margin-top: 3px;">&#10003; Transaction Proof Attached (' + (payment.proofDocumentName || 'Verified Receipt') + ')</div>' : ''}
            </div>
          </td>
          <td style="text-align: right; font-weight: 800; font-family: monospace; font-size: 11pt;">
            ₹${payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Total Box -->
    <div class="total-box">
      <table style="width: 100%;">
        <tr>
          <td style="vertical-align: middle;">
            <div class="words-label">Amount in Words:</div>
            <div class="words-value">${amountInWords}</div>
          </td>
          <td style="text-align: right; vertical-align: middle; width: 40%;">
            <div class="words-label">Net Amount Received:</div>
            <div class="amount-value">₹${payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </td>
        </tr>
      </table>

      <div class="recon-row">
        <span>Payment Ref: <strong>${payment.paymentNumber}</strong></span>
        ${invoice.balanceAmount !== undefined ? `<span>Remaining Invoice Balance: <strong>₹${Number(invoice.balanceAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>` : ''}
        <span>Cashier / Staff: <strong>${payment.recordedBy?.name || 'Vault Cashier'}</strong></span>
      </div>
    </div>

    <!-- Official Terms & Notes -->
    <div class="terms-box">
      <strong>Terms & Conditions of Vault Custody:</strong>
      <ol>
        <li>This official computer-generated receipt acknowledges payment received towards safe deposit locker rental and custodial maintenance.</li>
        <li>Access to locker is subject to active identity verification, dual key authorization, and adherence to operating hours.</li>
        <li>Annual rentals are payable in advance. Overdue accounts are subject to incidental late charges and vault access restrictions.</li>
        <li>Please quote Receipt Number and Customer Code in all future communications.</li>
      </ol>
    </div>

    <!-- Signatures -->
    <table class="sig-table">
      <tr>
        <td>
          <div class="sig-line">Customer Signature / Acknowledgment</div>
        </td>
        <td>
          <div class="stamp-box">[ DIGITALLY VERIFIED & RECORDED ]</div>
          <div class="sig-line">Authorized Vault Officer</div>
        </td>
      </tr>
    </table>

    <!-- Footer -->
    <div class="footer-note">
      This is a computer-generated official receipt issued by MSS Locker safe deposit locker system.<br>
      Receipt Hash: <strong>${payment._id ? String(payment._id).slice(-12).toUpperCase() : 'VAULT-SEC'}</strong> &bull; Generated: ${new Date().toLocaleString('en-IN')} &bull; Page 1 of 1
    </div>
  </div>

  ${autoPrint ? `
  <script>
    window.onload = function() {
      window.print();
    };
  </script>` : ''}
</body>
</html>`;
  }
}

export const paymentService = new PaymentService();
