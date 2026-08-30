import mongoose, { ClientSession, Types } from 'mongoose';
import { DepositTransaction, IDepositTransaction } from '../models/DepositTransaction';
import { RefundRequest } from '../models/RefundRequest';
import { LockerAllocation } from '../models/LockerAllocation';
import { LockerInvoice } from '../models/LockerInvoice';
import { Payment } from '../models/Payment';
import {
  DepositTransactionType,
  DepositStatus,
} from '../constants/deposit.constants';
import { PaymentMethod, PaymentSource } from '../constants/payment.constants';
import { generateDepositNumber } from '../utils/depositCalculator';
import { generatePaymentNumber, generateReceiptNumber } from '../utils/paymentCalculator';
import { recordAuditLog } from '../utils/auditLogger';
import { normalizeMoney } from '../utils/money';

export interface DepositSummary {
  allocationId: string;
  allocationCode: string;
  lockerNumber: string;
  customerName: string;
  requiredDeposit: number;
  totalDepositReceived: number;
  totalAddAdjustments: number;
  totalDeductAdjustments: number;
  totalRefunded: number;
  netDepositHeld: number;
  pendingRefundAmount: number;
  availableRefundableBalance: number;
  outstandingDeposit: number;
  depositStatus: DepositStatus;
}

export interface CollectDepositInput {
  allocationId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionReference?: string;
  bankReference?: string;
  upiReference?: string;
  chequeNumber?: string;
  bankName?: string;
  chequeDate?: Date;
  paymentDate?: Date;
  notes?: string;
  source?: PaymentSource;
  allowOverride?: boolean;
  overrideReason?: string;
}

export interface AdjustDepositInput {
  allocationId: string;
  transactionType: 'DEPOSIT_ADJUSTMENT_ADD' | 'DEPOSIT_ADJUSTMENT_DEDUCT';
  amount: number;
  reason: string;
  notes?: string;
  transactionReference?: string;
}

export class DepositService {
  /**
   * Central authoritative calculation of deposit summary from ledger
   */
  async getDepositSummary(allocationId: string | Types.ObjectId, session?: ClientSession): Promise<DepositSummary> {
    const allocation = await LockerAllocation.findById(allocationId)
      .populate('customerId', 'fullName customerCode')
      .populate('lockerId', 'lockerNumber').session(session || null)
      .lean();

    if (!allocation) {
      throw new Error('Locker allocation not found');
    }

    const requiredDeposit =
      allocation.depositSnapshot ?? allocation.securityDeposit ?? 0;

    // Fetch all completed deposit transactions for this allocation
    const transactions = await DepositTransaction.find({
      allocationId: allocation._id,
      status: 'COMPLETED',
    }).session(session || null).lean();

    let totalDepositReceived = 0;
    let totalAddAdjustments = 0;
    let totalDeductAdjustments = 0;
    let totalRefunded = 0;

    for (const tx of transactions) {
      switch (tx.transactionType) {
        case 'DEPOSIT_RECEIVED':
        case 'LEGACY_IMPORT':
          totalDepositReceived += tx.amount;
          break;
        case 'DEPOSIT_ADJUSTMENT_ADD':
        case 'REFUND_REVERSAL':
          totalAddAdjustments += tx.amount;
          break;
        case 'DEPOSIT_ADJUSTMENT_DEDUCT':
          totalDeductAdjustments += tx.amount;
          break;
        case 'REFUND_ISSUED':
          totalRefunded += tx.amount;
          break;
      }
    }

    // Pending refund reservation
    const pendingRefunds = await RefundRequest.find({
      allocationId: allocation._id,
      status: { $in: ['PENDING_APPROVAL', 'APPROVED'] },
    }).session(session || null).lean();

    const pendingRefundAmount = pendingRefunds.reduce(
      (sum, r) => sum + (r.approvedAmount ?? r.requestedAmount),
      0
    );

    const netDepositHeld =
      totalDepositReceived + totalAddAdjustments - totalDeductAdjustments - totalRefunded;

    const availableRefundableBalance = Math.max(0, netDepositHeld - pendingRefundAmount);
    const outstandingDeposit = Math.max(0, requiredDeposit - totalDepositReceived);

    let depositStatus: DepositStatus = 'NOT_COLLECTED';
    if (totalDepositReceived === 0) {
      depositStatus = 'NOT_COLLECTED';
    } else if (totalDepositReceived < requiredDeposit) {
      depositStatus = 'PARTIAL';
    } else if (totalDepositReceived === requiredDeposit) {
      depositStatus = 'FULLY_COLLECTED';
    } else {
      depositStatus = 'OVER_COLLECTED';
    }

    const cust = allocation.customerId as any;
    const lock = allocation.lockerId as any;

    return {
      allocationId: allocation._id.toString(),
      allocationCode: allocation.allocationCode,
      lockerNumber: lock?.lockerNumber || '',
      customerName: cust?.fullName || '',
      requiredDeposit,
      totalDepositReceived,
      totalAddAdjustments,
      totalDeductAdjustments,
      totalRefunded,
      netDepositHeld,
      pendingRefundAmount,
      availableRefundableBalance,
      outstandingDeposit,
      depositStatus,
    };
  }

  /**
   * Collect Caution Money / Security Deposit payment
   */
  async collectDeposit(
    input: CollectDepositInput,
    userId: string,
    idempotencyKey?: string
  ) {
    const amount = normalizeMoney(input.amount, 'Deposit amount');

    const session = await mongoose.startSession();
    let result: any;
    try {
      await session.withTransaction(async () => {
    const allocation = await LockerAllocation.findOneAndUpdate(
      { _id: input.allocationId }, { $set: { updatedAt: new Date() } }, { new: true, session }
    ).populate('customerId').populate('lockerId');

    if (!allocation) {
      throw new Error('Locker allocation not found');
    }

    const summary = await this.getDepositSummary(allocation._id, session);

    // Overcollection check
    if (
      summary.totalDepositReceived + amount > summary.requiredDeposit &&
      !input.allowOverride
    ) {
      const excess = summary.totalDepositReceived + amount - summary.requiredDeposit;
      throw new Error(
        `Deposit amount exceeds required deposit by ₹${excess.toLocaleString('en-IN')}. Override permission and reason required.`
      );
    }

    // Idempotency check if header passed
    if (idempotencyKey) {
      const existingPayment = await Payment.findOne({ idempotencyKey }).session(session).lean();
      if (existingPayment) {
        const existingTx = await DepositTransaction.findOne({
          paymentId: existingPayment._id,
        }).session(session).lean();
        result = {
          payment: existingPayment,
          transaction: existingTx,
          summary,
        };
        return;
      }
    }

    // 1. Create Payment record for receipt/financial audit
    const paymentNumber = await generatePaymentNumber();
    const receiptNumber = await generateReceiptNumber();

    const payment = new Payment({
      paymentNumber,
      receiptNumber,
      idempotencyKey,
      customerId: allocation.customerId._id,
      allocationId: allocation._id,
      lockerId: allocation.lockerId._id,
      paymentPurpose: 'SECURITY_DEPOSIT',
      amount,
      paymentMethod: input.paymentMethod,
      paymentStatus: 'COMPLETED',
      transactionReference: input.transactionReference,
      bankReference: input.bankReference,
      upiReference: input.upiReference,
      chequeNumber: input.chequeNumber,
      bankName: input.bankName,
      chequeDate: input.chequeDate,
      paymentDate: input.paymentDate || new Date(),
      source: 'MANUAL_ENTRY',
      notes: input.overrideReason
        ? `[OVERRIDE: ${input.overrideReason}] ${input.notes || ''}`
        : input.notes,
      recordedBy: userId,
    });
    await payment.save({ session });

    // 2. Create Deposit Transaction in Ledger
    const depositTransactionNumber = await generateDepositNumber();
    const depositTx = new DepositTransaction({
      depositTransactionNumber,
      customerId: allocation.customerId._id,
      allocationId: allocation._id,
      lockerId: allocation.lockerId._id,
      transactionType: 'DEPOSIT_RECEIVED',
      amount,
      paymentId: payment._id,
      paymentMethod: input.paymentMethod,
      transactionReference: input.transactionReference || input.upiReference || input.bankReference,
      transactionDate: input.paymentDate || new Date(),
      status: 'COMPLETED',
      source: 'MANUAL_ENTRY',
      notes: input.notes,
      recordedBy: userId,
    });
    await depositTx.save({ session });

    // 3. Audit Event
    await recordAuditLog({
      action: 'DEPOSIT_RECEIVED',
      entityType: 'DepositTransaction',
      entityId: depositTx._id.toString(),
      actorUserId: userId,
      description: `Security deposit of ₹${input.amount} collected for agreement ${allocation.allocationCode}`,
      metadata: {
        depositTransactionNumber,
        paymentNumber,
        receiptNumber,
        allocationCode: allocation.allocationCode,
        amount,
        paymentMethod: input.paymentMethod,
        isOverride: Boolean(input.allowOverride),
      },
    }, session);

    const updatedSummary = await this.getDepositSummary(allocation._id, session);

    result = {
      payment,
      transaction: depositTx,
      summary: updatedSummary,
    };
      });
    } finally {
      await session.endSession();
    }
    return result;
  }

  /**
   * Adjust Deposit (Addition or Damage Deduction)
   */
  async adjustDeposit(input: AdjustDepositInput, userId: string) {
    const amount = normalizeMoney(input.amount, 'Adjustment amount');

    if (!input.reason || input.reason.trim().length < 3) {
      throw new Error('Valid justification reason is required for deposit adjustments');
    }

    const session = await mongoose.startSession();
    let result: any;
    try {
      await session.withTransaction(async () => {
    const allocation = await LockerAllocation.findOneAndUpdate(
      { _id: input.allocationId }, { $set: { updatedAt: new Date() } }, { new: true, session }
    );
    if (!allocation) {
      throw new Error('Locker allocation not found');
    }

    const currentSummary = await this.getDepositSummary(allocation._id, session);

    // If deducting, check that deduction does not exceed net deposit held
    if (
      input.transactionType === 'DEPOSIT_ADJUSTMENT_DEDUCT' &&
      amount > currentSummary.availableRefundableBalance
    ) {
      throw new Error(
        `Deduction amount (₹${input.amount}) cannot exceed available refundable balance (₹${currentSummary.availableRefundableBalance})`
      );
    }

    const depositTransactionNumber = await generateDepositNumber();
    const depositTx = new DepositTransaction({
      depositTransactionNumber,
      customerId: allocation.customerId,
      allocationId: allocation._id,
      lockerId: allocation.lockerId,
      transactionType: input.transactionType,
      amount,
      transactionReference: input.transactionReference,
      transactionDate: new Date(),
      status: 'COMPLETED',
      source: 'MANUAL_ENTRY',
      notes: `[Reason: ${input.reason}] ${input.notes || ''}`,
      recordedBy: userId,
    });
    await depositTx.save({ session });

    // Audit
    await recordAuditLog({
      action: 'DEPOSIT_ADJUSTED',
      entityType: 'DepositTransaction',
      entityId: depositTx._id.toString(),
      actorUserId: userId,
      description: `Deposit adjustment of ₹${input.amount} (${input.transactionType}) for agreement ${allocation.allocationCode}. Reason: ${input.reason}`,
      metadata: {
        depositTransactionNumber,
        allocationCode: allocation.allocationCode,
        transactionType: input.transactionType,
        amount,
        reason: input.reason,
      },
    }, session);

    const updatedSummary = await this.getDepositSummary(allocation._id, session);

    result = {
      transaction: depositTx,
      summary: updatedSummary,
    };
      });
    } finally {
      await session.endSession();
    }
    return result;
  }

  /**
   * Non-destructive soft cancellation of deposit transaction
   */
  async cancelDepositTransaction(
    id: string,
    cancellationReason: string,
    userId: string
  ) {
    if (!cancellationReason || cancellationReason.trim().length < 3) {
      throw new Error('Cancellation reason is required');
    }

    const session = await mongoose.startSession();
    let result: any;
    try {
      await session.withTransaction(async () => {
    const tx = await DepositTransaction.findOneAndUpdate(
      { _id: id, status: { $ne: 'CANCELLED' } }, { $set: { updatedAt: new Date() } }, { new: true, session }
    );
    if (!tx) {
      throw new Error('Deposit transaction not found');
    }

    // Balance check: if cancelling a deposit/credit, ensure net held won't fall below already refunded/pending amount
    if (['DEPOSIT_RECEIVED', 'DEPOSIT_ADJUSTMENT_ADD', 'LEGACY_IMPORT'].includes(tx.transactionType)) {
      const summary = await this.getDepositSummary(tx.allocationId, session);
      if (summary.netDepositHeld - tx.amount < 0) {
        throw new Error(
          'Cannot cancel this deposit transaction because subsequent refunds or deductions depend on this balance. Reversal workflow is required.'
        );
      }
    }

    tx.status = 'CANCELLED';
    tx.cancelledAt = new Date();
    tx.cancelledBy = new Types.ObjectId(userId);
    tx.cancellationReason = cancellationReason;
    await tx.save({ session });

    // If linked to a payment, cancel that payment too
    if (tx.paymentId) {
      await Payment.findByIdAndUpdate(tx.paymentId, {
        paymentStatus: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: new Types.ObjectId(userId),
        cancellationReason,
      }, { session });
    }

    await recordAuditLog({
      action: 'DEPOSIT_TRANSACTION_CANCELLED',
      entityType: 'DepositTransaction',
      entityId: tx._id.toString(),
      actorUserId: userId,
      description: `Cancelled deposit transaction ${tx.depositTransactionNumber}. Reason: ${cancellationReason}`,
      metadata: {
        depositTransactionNumber: tx.depositTransactionNumber,
        cancellationReason,
      },
    }, session);

    const updatedSummary = await this.getDepositSummary(tx.allocationId, session);

    result = {
      transaction: tx,
      summary: updatedSummary,
    };
      });
    } finally {
      await session.endSession();
    }
    return result;
  }

  /**
   * Query deposit transactions with pagination & filters
   */
  async getDepositTransactions(query: {
    page?: number;
    limit?: number;
    search?: string;
    transactionType?: DepositTransactionType;
    status?: string;
    allocationId?: string;
    customerId?: string;
    lockerId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (query.transactionType) {
      filter.transactionType = query.transactionType;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.allocationId) {
      filter.allocationId = new Types.ObjectId(query.allocationId);
    }

    if (query.customerId) {
      filter.customerId = new Types.ObjectId(query.customerId);
    }

    if (query.lockerId) {
      filter.lockerId = new Types.ObjectId(query.lockerId);
    }

    if (query.dateFrom || query.dateTo) {
      filter.transactionDate = {};
      if (query.dateFrom) filter.transactionDate.$gte = new Date(query.dateFrom);
      if (query.dateTo) filter.transactionDate.$lte = new Date(query.dateTo);
    }

    if (query.search && query.search.trim()) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { depositTransactionNumber: searchRegex },
        { transactionReference: searchRegex },
        { notes: searchRegex },
      ];
    }

    const [transactions, total] = await Promise.all([
      DepositTransaction.find(filter)
        .sort({ transactionDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('customerId', 'fullName customerCode phone')
        .populate('lockerId', 'lockerNumber size')
        .populate('allocationId', 'allocationCode')
        .populate('paymentId', 'receiptNumber paymentNumber')
        .populate('recordedBy', 'name email')
        .lean(),
      DepositTransaction.countDocuments(filter),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Deposit stats for top dashboard cards
   */
  async getDepositStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(
      startOfToday.getFullYear(),
      startOfToday.getMonth(),
      1
    );

    const completedTx = await DepositTransaction.find({
      status: 'COMPLETED',
    }).lean();

    let totalDepositsHeld = 0;
    let collectedToday = 0;
    let collectedThisMonth = 0;
    let refundedToday = 0;
    let refundedThisMonth = 0;

    for (const tx of completedTx) {
      const txDate = new Date(tx.transactionDate);
      const isCredit = ['DEPOSIT_RECEIVED', 'DEPOSIT_ADJUSTMENT_ADD', 'LEGACY_IMPORT', 'REFUND_REVERSAL'].includes(tx.transactionType);
      const isDebit = ['DEPOSIT_ADJUSTMENT_DEDUCT', 'REFUND_ISSUED'].includes(tx.transactionType);

      if (isCredit) totalDepositsHeld += tx.amount;
      if (isDebit) totalDepositsHeld -= tx.amount;

      if (tx.transactionType === 'DEPOSIT_RECEIVED') {
        if (txDate >= startOfToday) collectedToday += tx.amount;
        if (txDate >= startOfMonth) collectedThisMonth += tx.amount;
      }

      if (tx.transactionType === 'REFUND_ISSUED') {
        if (txDate >= startOfToday) refundedToday += tx.amount;
        if (txDate >= startOfMonth) refundedThisMonth += tx.amount;
      }
    }

    const pendingRefunds = await RefundRequest.find({
      status: 'PENDING_APPROVAL',
    }).lean();

    const pendingRefundAmount = pendingRefunds.reduce(
      (sum, r) => sum + r.requestedAmount,
      0
    );

    return {
      totalDepositsHeld: Math.max(0, totalDepositsHeld),
      collectedToday,
      collectedThisMonth,
      refundedToday,
      refundedThisMonth,
      pendingRefundCount: pendingRefunds.length,
      pendingRefundAmount,
    };
  }

  /**
   * Helper for Locker Closure module in next phase
   */
  async getClosureFinancialReadiness(allocationId: string | Types.ObjectId) {
    const summary = await this.getDepositSummary(allocationId);

    const outstandingInvoices = await LockerInvoice.find({
      allocationId,
      balanceAmount: { $gt: 0 },
      paymentStatus: { $in: ['UNPAID', 'PARTIALLY_PAID'] },
    }).lean();

    const outstandingInvoiceAmount = outstandingInvoices.reduce(
      (sum, inv) => sum + inv.balanceAmount,
      0
    );

    return {
      allocationId: summary.allocationId,
      depositHeld: summary.netDepositHeld,
      availableRefundableBalance: summary.availableRefundableBalance,
      pendingRefunds: summary.pendingRefundAmount,
      outstandingInvoicesCount: outstandingInvoices.length,
      outstandingInvoiceAmount,
      isFinanciallyCleared: outstandingInvoiceAmount === 0 && summary.pendingRefundAmount === 0,
    };
  }
}

export const depositService = new DepositService();
