import mongoose, { Types } from 'mongoose';
import { RefundRequest, IRefundRequest } from '../models/RefundRequest';
import { DepositTransaction } from '../models/DepositTransaction';
import { LockerAllocation } from '../models/LockerAllocation';
import { Payment } from '../models/Payment';
import { depositService } from './deposit.service';
import { generateRefundNumber, generateDepositNumber } from '../utils/depositCalculator';
import { generatePaymentNumber, generateReceiptNumber } from '../utils/paymentCalculator';
import { PaymentMethod } from '../constants/payment.constants';
import { RefundStatus } from '../constants/deposit.constants';
import { recordAuditLog } from '../utils/auditLogger';
import { normalizeMoney } from '../utils/money';

export interface CreateRefundInput {
  allocationId: string;
  requestedAmount: number;
  reason: string;
  notes?: string;
  isDraft?: boolean;
}

export interface PayRefundInput {
  refundPaymentMethod: PaymentMethod;
  transactionReference?: string;
  notes?: string;
  paymentDate?: Date;
}

export class RefundService {
  private preventSelfApproval = true;

  /**
   * Create a new refund request
   */
  async createRefundRequest(input: CreateRefundInput, userId: string) {
    if (!input.requestedAmount || input.requestedAmount <= 0) {
      throw new Error('Requested refund amount must be greater than 0');
    }

    if (!input.reason || input.reason.trim().length < 3) {
      throw new Error('Detailed reason is required for requesting a refund');
    }

    const allocation = await LockerAllocation.findById(input.allocationId);
    if (!allocation) {
      throw new Error('Locker allocation not found');
    }

    // Authoritative live balance check
    const summary = await depositService.getDepositSummary(allocation._id);

    if (input.requestedAmount > summary.availableRefundableBalance) {
      throw new Error(
        `Requested refund (₹${input.requestedAmount.toLocaleString('en-IN')}) exceeds available refundable balance (₹${summary.availableRefundableBalance.toLocaleString('en-IN')}). Note that other pending refunds may be reserving funds.`
      );
    }

    const refundNumber = await generateRefundNumber();
    const refund = new RefundRequest({
      refundNumber,
      customerId: allocation.customerId,
      allocationId: allocation._id,
      lockerId: allocation.lockerId,
      requestedAmount: input.requestedAmount,
      approvedAmount: input.requestedAmount, // prefill approved amount equal to requested
      reason: input.reason.trim(),
      status: input.isDraft ? 'DRAFT' : 'PENDING_APPROVAL',
      notes: input.notes,
      requestedBy: new Types.ObjectId(userId),
      requestedAt: new Date(),
    });

    await refund.save();

    await recordAuditLog({
      action: 'REFUND_REQUEST_CREATED',
      entityType: 'RefundRequest',
      entityId: refund._id.toString(),
      actorUserId: userId,
      description: `Refund request ${refundNumber} for ₹${input.requestedAmount} created. Reason: ${input.reason}`,
      metadata: {
        refundNumber,
        allocationCode: allocation.allocationCode,
        requestedAmount: input.requestedAmount,
        reason: input.reason,
        status: refund.status,
      },
    });

    return refund;
  }

  /**
   * Submit draft refund request for manager approval
   */
  async submitRefundRequest(id: string, userId: string) {
    const refund = await RefundRequest.findById(id);
    if (!refund) {
      throw new Error('Refund request not found');
    }

    if (refund.status !== 'DRAFT') {
      throw new Error(`Cannot submit refund with status ${refund.status}`);
    }

    // Recheck live available balance
    const summary = await depositService.getDepositSummary(refund.allocationId);
    if (refund.requestedAmount > summary.availableRefundableBalance) {
      throw new Error(
        `Available refundable balance is now ₹${summary.availableRefundableBalance}, which is less than requested ₹${refund.requestedAmount}.`
      );
    }

    refund.status = 'PENDING_APPROVAL';
    refund.requestedAt = new Date();
    await refund.save();

    await recordAuditLog({
      action: 'REFUND_SUBMITTED',
      entityType: 'RefundRequest',
      entityId: refund._id.toString(),
      actorUserId: userId,
      description: `Submitted refund request ${refund.refundNumber} for approval`,
      metadata: { refundNumber: refund.refundNumber },
    });

    return refund;
  }

  /**
   * Maker-Checker Refund Approval
   */
  async approveRefund(
    id: string,
    approvedAmount: number,
    notes: string | undefined,
    userId: string
  ) {
    const refund = await RefundRequest.findById(id);
    if (!refund) {
      throw new Error('Refund request not found');
    }

    if (refund.status !== 'PENDING_APPROVAL') {
      throw new Error(`Cannot approve refund with status ${refund.status}`);
    }

    // Maker-checker validation: Requester cannot approve their own refund
    if (this.preventSelfApproval && String(refund.requestedBy) === String(userId)) {
      throw new Error(
        'Maker-Checker Violation: You cannot approve a refund request that you created. A manager or administrator must review and approve.'
      );
    }

    if (!approvedAmount || approvedAmount <= 0) {
      throw new Error('Approved amount must be greater than 0');
    }

    if (approvedAmount > refund.requestedAmount) {
      throw new Error(
        `Approved amount (₹${approvedAmount}) cannot exceed requested amount (₹${refund.requestedAmount})`
      );
    }

    // Recheck live refundable balance
    const summary = await depositService.getDepositSummary(refund.allocationId);

    // Note: since this refund was PENDING_APPROVAL, its requestedAmount was included in pendingRefundAmount.
    // The available headroom for THIS refund is (availableRefundableBalance + refund.requestedAmount)
    const maxAllowableForThis = summary.availableRefundableBalance + refund.requestedAmount;

    if (approvedAmount > maxAllowableForThis) {
      throw new Error(
        `Approved amount exceeds maximum allowable refundable balance (₹${maxAllowableForThis}).`
      );
    }

    refund.status = 'APPROVED';
    refund.approvedAmount = approvedAmount;
    refund.approvedBy = new Types.ObjectId(userId);
    refund.approvedAt = new Date();
    if (notes) {
      refund.notes = refund.notes ? `${refund.notes} | Approval: ${notes}` : notes;
    }
    await refund.save();

    await recordAuditLog({
      action: 'REFUND_APPROVED',
      entityType: 'RefundRequest',
      entityId: refund._id.toString(),
      actorUserId: userId,
      description: `Approved refund request ${refund.refundNumber} for ₹${approvedAmount}`,
      metadata: {
        refundNumber: refund.refundNumber,
        approvedAmount,
        approvedBy: userId,
      },
    });

    return refund;
  }

  /**
   * Reject refund request
   */
  async rejectRefund(id: string, rejectionReason: string, userId: string) {
    if (!rejectionReason || rejectionReason.trim().length < 3) {
      throw new Error('Rejection reason is required');
    }

    const refund = await RefundRequest.findById(id);
    if (!refund) {
      throw new Error('Refund request not found');
    }

    if (refund.status !== 'PENDING_APPROVAL') {
      throw new Error(`Cannot reject refund with status ${refund.status}`);
    }

    refund.status = 'REJECTED';
    refund.rejectedBy = new Types.ObjectId(userId);
    refund.rejectedAt = new Date();
    refund.rejectionReason = rejectionReason.trim();
    await refund.save();

    await recordAuditLog({
      action: 'REFUND_REJECTED',
      entityType: 'RefundRequest',
      entityId: refund._id.toString(),
      actorUserId: userId,
      description: `Rejected refund request ${refund.refundNumber}. Reason: ${rejectionReason}`,
      metadata: {
        refundNumber: refund.refundNumber,
        rejectionReason,
      },
    });

    return refund;
  }

  /**
   * Pay / Disburse Approved Refund
   */
  async payRefund(
    id: string,
    paymentInput: PayRefundInput,
    userId: string,
    idempotencyKey?: string
  ) {
    if (idempotencyKey) {
      const existingPayment = await Payment.findOne({ idempotencyKey }).lean();
      if (existingPayment) {
        const [refund, transaction] = await Promise.all([
          RefundRequest.findById(id).lean(),
          DepositTransaction.findOne({ paymentId: existingPayment._id }).lean(),
        ]);
        return { refund, payment: existingPayment, transaction, summary: refund ? await depositService.getDepositSummary(refund.allocationId as any) : null };
      }
    }

    const session = await mongoose.startSession();
    let result: any;
    try {
      await session.withTransaction(async () => {
    const refund = await RefundRequest.findOneAndUpdate(
      { _id: id, status: 'APPROVED' }, { $set: { updatedAt: new Date() } }, { new: true, session }
    );
    if (!refund) {
      throw new Error('Refund request not found');
    }

    const payoutAmount = normalizeMoney(refund.approvedAmount || refund.requestedAmount, 'Refund amount');

    // Concurrency / balance check
    const summary = await depositService.getDepositSummary(refund.allocationId, session);
    const allowableHeadroom = summary.availableRefundableBalance + payoutAmount;

    if (payoutAmount > allowableHeadroom) {
      throw new Error(
        `Refundable balance changed while processing. Current maximum refundable balance is ₹${allowableHeadroom}.`
      );
    }

    // 1. Create Payment record for accounting
    const paymentNumber = await generatePaymentNumber();
    const receiptNumber = await generateReceiptNumber();

    const payment = new Payment({
      paymentNumber,
      receiptNumber,
      idempotencyKey,
      customerId: refund.customerId,
      allocationId: refund.allocationId,
      lockerId: refund.lockerId,
      paymentPurpose: 'REFUND',
      amount: payoutAmount,
      paymentMethod: paymentInput.refundPaymentMethod,
      paymentStatus: 'COMPLETED',
      transactionReference: paymentInput.transactionReference,
      paymentDate: paymentInput.paymentDate || new Date(),
      source: 'MANUAL_ENTRY',
      notes: `[Refund Payout: ${refund.refundNumber}] ${paymentInput.notes || ''}`,
      recordedBy: new Types.ObjectId(userId),
    });
    await payment.save({ session });

    // 2. Create REFUND_ISSUED ledger transaction
    const depositTransactionNumber = await generateDepositNumber();
    const depositTx = new DepositTransaction({
      depositTransactionNumber,
      customerId: refund.customerId,
      allocationId: refund.allocationId,
      lockerId: refund.lockerId,
      transactionType: 'REFUND_ISSUED',
      amount: payoutAmount,
      paymentId: payment._id,
      paymentMethod: paymentInput.refundPaymentMethod,
      transactionReference: paymentInput.transactionReference,
      transactionDate: paymentInput.paymentDate || new Date(),
      status: 'COMPLETED',
      source: 'MANUAL_ENTRY',
      notes: `[Refund Payout: ${refund.refundNumber}] ${paymentInput.notes || ''}`,
      recordedBy: new Types.ObjectId(userId),
    });
    await depositTx.save({ session });

    // 3. Mark RefundRequest as PAID
    refund.status = 'PAID';
    refund.paidAt = new Date();
    refund.paidBy = new Types.ObjectId(userId);
    refund.refundPaymentMethod = paymentInput.refundPaymentMethod;
    refund.transactionReference = paymentInput.transactionReference;
    if (paymentInput.notes) {
      refund.notes = refund.notes ? `${refund.notes} | Payout: ${paymentInput.notes}` : paymentInput.notes;
    }
    await refund.save({ session });

    // 4. Audit
    await recordAuditLog({
      action: 'REFUND_PAID',
      entityType: 'RefundRequest',
      entityId: refund._id.toString(),
      actorUserId: userId,
      description: `Disbursed refund ${refund.refundNumber} of ₹${payoutAmount} via ${paymentInput.refundPaymentMethod}`,
      metadata: {
        refundNumber: refund.refundNumber,
        depositTransactionNumber,
        paymentNumber,
        receiptNumber,
        payoutAmount,
        refundPaymentMethod: paymentInput.refundPaymentMethod,
      },
    }, session);

    const updatedSummary = await depositService.getDepositSummary(refund.allocationId, session);

    result = {
      refund,
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
   * Cancel Refund Request
   */
  async cancelRefund(id: string, cancellationReason: string, userId: string) {
    if (!cancellationReason || cancellationReason.trim().length < 3) {
      throw new Error('Cancellation reason is required');
    }

    const refund = await RefundRequest.findById(id);
    if (!refund) {
      throw new Error('Refund request not found');
    }

    if (refund.status === 'PAID') {
      throw new Error('Cannot cancel a refund that has already been paid/disbursed.');
    }

    if (refund.status === 'CANCELLED') {
      throw new Error('Refund request is already cancelled.');
    }

    refund.status = 'CANCELLED';
    refund.cancelledAt = new Date();
    refund.cancelledBy = new Types.ObjectId(userId);
    refund.cancellationReason = cancellationReason.trim();
    await refund.save();

    await recordAuditLog({
      action: 'REFUND_CANCELLED',
      entityType: 'RefundRequest',
      entityId: refund._id.toString(),
      actorUserId: userId,
      description: `Cancelled refund request ${refund.refundNumber}. Reason: ${cancellationReason}`,
      metadata: {
        refundNumber: refund.refundNumber,
        cancellationReason,
      },
    });

    return refund;
  }

  /**
   * Query refunds with filters and pagination
   */
  async getRefunds(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: RefundStatus;
    allocationId?: string;
    customerId?: string;
    lockerId?: string;
    requestedBy?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};

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

    if (query.requestedBy) {
      filter.requestedBy = new Types.ObjectId(query.requestedBy);
    }

    if (query.dateFrom || query.dateTo) {
      filter.requestedAt = {};
      if (query.dateFrom) filter.requestedAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) filter.requestedAt.$lte = new Date(query.dateTo);
    }

    if (query.search && query.search.trim()) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { refundNumber: searchRegex },
        { reason: searchRegex },
        { transactionReference: searchRegex },
        { notes: searchRegex },
      ];
    }

    const [refunds, total] = await Promise.all([
      RefundRequest.find(filter)
        .sort({ requestedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('customerId', 'fullName customerCode phone')
        .populate('lockerId', 'lockerNumber size')
        .populate('allocationId', 'allocationCode')
        .populate('requestedBy', 'name email')
        .populate('approvedBy', 'name email')
        .populate('rejectedBy', 'name email')
        .populate('paidBy', 'name email')
        .lean(),
      RefundRequest.countDocuments(filter),
    ]);

    return {
      refunds,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single refund request by ID with full details
   */
  async getRefundById(id: string) {
    const refund = await RefundRequest.findById(id)
      .populate('customerId', 'fullName customerCode phone email address')
      .populate('lockerId', 'lockerNumber size rackNumber')
      .populate('allocationId', 'allocationCode startDate billingCycle depositSnapshot securityDeposit')
      .populate('requestedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .populate('paidBy', 'name email')
      .lean();

    if (!refund) {
      throw new Error('Refund request not found');
    }

    const summary = await depositService.getDepositSummary(refund.allocationId as any);

    return {
      refund,
      summary,
    };
  }
}

export const refundService = new RefundService();
