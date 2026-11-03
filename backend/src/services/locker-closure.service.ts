import { escapeHtmlFields } from '../utils/html';
import mongoose,{ ClientSession,Types } from 'mongoose';
import {
LockerClosure,
ILockerClosure,
IPhysicalChecklist,
IClosureFinancialSnapshot,
} from '../models/LockerClosure';
import { LockerAllocation } from '../models/LockerAllocation';
import { Locker } from '../models/Locker';
import { Customer } from '../models/Customer';
import { LockerInvoice } from '../models/LockerInvoice';
import { AuditLog } from '../models/AuditLog';
import {
CLOSURE_TYPES,
ClosureType,
CLOSURE_STATUSES,
ClosureStatus,
OPEN_CLOSURE_STATUSES,
LOCKER_CONDITIONS,
} from '../constants/closure.constants';
import { closureReadinessService } from './closure-readiness.service';
import { depositService } from './deposit.service';
import { Sequence } from '../models/Sequence';
import { Payment } from '../models/Payment';
import { DepositTransaction } from '../models/DepositTransaction';
import { RefundRequest } from '../models/RefundRequest';
import { generateDepositNumber, generateRefundNumber } from '../utils/depositCalculator';
import { generatePaymentNumber, generateReceiptNumber } from '../utils/paymentCalculator';

export interface CreateClosureInput {
  allocationId: string;
  closureType?: ClosureType;
  closureReason: string;
  requestedClosureDate?: string;
  submitForReview?: boolean;
  physicalChecklist?: Partial<IPhysicalChecklist>;
  notes?: string;
}

export interface ClosureQueryParams {
  allocationId?: string;
  size?: string;
  page?: number;
  limit?: number;
  search?: string;
  status?: ClosureStatus | 'ALL';
  closureType?: ClosureType | 'ALL';
  customerId?: string;
  lockerId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

const validatePhysicalChecklist = (value: unknown) => {
  const fail = (message: string) => Object.assign(new Error(message), { statusCode: 400 });
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail('Invalid physical checklist.');
  for (const [key, entry] of Object.entries(value)) {
    if (['lockerEmptied', 'lockerInspected', 'customerKeyReturned', 'masterKeyCheckCompleted', 'documentsReturned', 'physicalAccessRevoked', 'keyReplacementRequired'].includes(key) && typeof entry !== 'boolean') throw fail('Checklist confirmations must be boolean values.');
    if (key === 'lockerCondition' && !Object.values(LOCKER_CONDITIONS).includes(entry as any)) throw fail('Choose a valid locker condition.');
    if (key === 'damageNotes' && (typeof entry !== 'string' || entry.length > 2000)) throw fail('Damage notes must be at most 2000 characters.');
  }
};

export class LockerClosureService {
  /**
   * Generates a sequential human-readable closure number: CLS-YYYY-XXXXXX
   */
  async generateClosureNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const sequence = await Sequence.findOneAndUpdate(
      { key: `closure:${year}` }, { $inc: { value: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return `CLS-${year}-${String(sequence.value).padStart(6, '0')}`;
  }

  /**
   * Initiates a new Locker Closure workflow with validation
   */
  async createClosure(input: CreateClosureInput, userId: string, transactionSession?: ClientSession): Promise<ILockerClosure> {
    if (!input.allocationId || !Types.ObjectId.isValid(input.allocationId)) {
      const error: any = new Error('Valid allocation ID is required');
      error.statusCode = 400;
      throw error;
    }

    if (typeof input.closureReason !== 'string' || input.closureReason.trim().length < 3 || input.closureReason.length > 2000) {
      const error: any = new Error('Closure reason is required');
      error.statusCode = 400;
      throw error;
    }

    const fail = (message: string, statusCode = 400) => Object.assign(new Error(message), { statusCode });
    if (input.notes !== undefined && (typeof input.notes !== 'string' || input.notes.length > 2000)) throw fail('Notes must be at most 2000 characters.');
    if (input.submitForReview !== undefined && typeof input.submitForReview !== 'boolean') throw fail('Invalid submission option.');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const closingDay = input.requestedClosureDate ?? today;
    const closingDate = typeof closingDay === 'string' ? new Date(closingDay + 'T00:00:00Z') : new Date(NaN);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(closingDay) || !Number.isFinite(closingDate.getTime()) || closingDate.toISOString().slice(0, 10) !== closingDay || closingDay > today) throw fail('Closing date must be a valid calendar date on or before today.');
    if (input.closureType && !Object.values(CLOSURE_TYPES).includes(input.closureType)) throw fail('Invalid closure type.');
    if (input.physicalChecklist !== undefined) validatePhysicalChecklist(input.physicalChecklist);
    const execute = async (session: ClientSession) => {
    const allocation = await LockerAllocation.findOneAndUpdate({ _id: input.allocationId }, { $inc: { __v: 1 } }, { new: true, timestamps: false });
    if (!allocation) {
      const error: any = new Error('Allocation not found');
      error.statusCode = 404;
      throw error;
    }

    if (allocation.status !== 'ACTIVE') {
      const error: any = new Error(
        `Cannot initiate closure for allocation with status ${allocation.status}. Only ACTIVE allocations can be closed.`
      );
      error.statusCode = 400;
      throw error;
    }

    if (closingDay < allocation.startDate.toISOString().slice(0, 10)) throw fail('Closing date cannot be before the opening date.');
    // 1. Enforce One Open Closure Rule
    const existingOpenClosure = await LockerClosure.findOne({
      allocationId: allocation._id,
      status: { $in: OPEN_CLOSURE_STATUSES },
    });

    if (existingOpenClosure) {
      const error: any = new Error(
        `An open closure workflow (${existingOpenClosure.closureNumber}) is already in progress for this locker allocation. Resolve or cancel it before starting a new one.`
      );
      error.statusCode = 409;
      throw error;
    }

    const closureNumber = await this.generateClosureNumber();
    const requestedClosureDate = closingDate;

    const [closure] = await LockerClosure.create([{
      closureNumber,
      allocationId: allocation._id,
      customerId: allocation.customerId,
      lockerId: allocation.lockerId,
      closureType: input.closureType || CLOSURE_TYPES.CUSTOMER_REQUEST,
      closureReason: input.closureReason.trim(),
      status: input.submitForReview ? CLOSURE_STATUSES.PENDING_REVIEW : CLOSURE_STATUSES.DRAFT,
      requestedClosureDate,
      physicalChecklist: input.physicalChecklist || {},
      notes: input.notes?.trim() || '',
      requestedBy: new Types.ObjectId(userId),
      requestedAt: new Date(),
    }], { session });

    // Audit Log
    await AuditLog.create([{
      action: 'CLOSURE_CREATED',
      actorUserId: new Types.ObjectId(userId),
      description: `Created closure ${closure.closureNumber} for ${allocation.allocationCode}`,
      module: 'CLOSURES',
      performedBy: new Types.ObjectId(userId),
      entityId: closure._id,
      entityType: 'LockerClosure',
      details: {
        closureNumber: closure.closureNumber,
        allocationCode: allocation.allocationCode,
        closureType: closure.closureType,
        reason: closure.closureReason,
      },
    }], { session });

    return closure;
    };
    return transactionSession ? execute(transactionSession) : mongoose.connection.transaction(execute);
  }

  // Direct counter closure: financial settlement and release commit together.
  async closeDirect(input: CreateClosureInput & { refundedDate?: string; refundAmount: number }, userId: string, canRefund: boolean): Promise<ILockerClosure> {
    const fail = (message: string, statusCode = 400) => Object.assign(new Error(message), { statusCode });
    if (!input.allocationId || !Types.ObjectId.isValid(input.allocationId)) throw fail('Valid allocation ID is required.');
    if (typeof input.closureReason !== 'string' || input.closureReason.trim().length < 3 || input.closureReason.length > 2000) throw fail('Closure reason is required.');
    if (input.notes !== undefined && (typeof input.notes !== 'string' || input.notes.length > 2000)) throw fail('Notes must be at most 2000 characters.');
    if (typeof input.refundAmount !== 'number' || !Number.isFinite(input.refundAmount) || input.refundAmount < 0 || Math.abs(input.refundAmount * 100 - Math.round(input.refundAmount * 100)) > .00001) throw fail('Invalid refund amount.');
    if (input.physicalChecklist !== undefined) validatePhysicalChecklist(input.physicalChecklist);
    return mongoose.connection.transaction(async session => {
      const allocation = await LockerAllocation.findOneAndUpdate({ _id: input.allocationId }, { $inc: { __v: 1 } }, { new: true, session, timestamps: false });
      if (!allocation) throw fail('Allocation not found.', 404);
      const completed = await LockerClosure.findOne({ allocationId: allocation._id, status: 'COMPLETED' }).session(session);
      if (completed && allocation.status === 'CLOSED') return completed;
      if (allocation.status !== 'ACTIVE') throw fail('This agreement is no longer active.', 409);
      const readiness = await closureReadinessService.getReadiness(allocation._id, input.physicalChecklist, session);
      if (!readiness.checklistComplete) throw fail('Confirm the physical handover checklist.');
      if (readiness.outstandingInvoiceAmount > 0 || readiness.pendingRefundAmount > 0) throw fail('Settle outstanding rent and existing refund requests before closing.', 409);
      if (Math.abs(input.refundAmount - readiness.availableRefundableBalance) > .001) throw fail('Refund balance changed. Reload the closure details.', 409);
      const closingDay = input.requestedClosureDate || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const validDay = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
      if (!validDay(closingDay) || closingDay > today || closingDay < allocation.startDate.toISOString().slice(0, 10)) throw fail('Invalid closing date.');
      if (input.refundedDate && (!validDay(input.refundedDate) || input.refundedDate > closingDay || input.refundedDate < allocation.startDate.toISOString().slice(0, 10))) throw fail('Refunded date must be between opening and closing dates.');
      if (input.refundAmount > 0) {
        if (!canRefund) throw fail('Refund payment permission is required.', 403);
        if (!input.refundedDate) throw fail('Refunded date is required for a deposit refund.');
        const paymentDate = new Date(input.refundedDate + 'T00:00:00Z');
        const refundNumber = await generateRefundNumber();
        const [payment] = await Payment.create([{ paymentNumber: await generatePaymentNumber(), receiptNumber: await generateReceiptNumber(), customerId: allocation.customerId, allocationId: allocation._id, lockerId: allocation.lockerId, paymentPurpose: 'REFUND', amount: input.refundAmount, paymentMethod: 'CASH', paymentStatus: 'COMPLETED', paymentDate, source: 'MANUAL_ENTRY', notes: `Direct closure refund ${refundNumber}`, recordedBy: userId }], { session });
        await DepositTransaction.create([{ depositTransactionNumber: await generateDepositNumber(), customerId: allocation.customerId, allocationId: allocation._id, lockerId: allocation.lockerId, transactionType: 'REFUND_ISSUED', amount: input.refundAmount, paymentId: payment._id, paymentMethod: 'CASH', transactionDate: paymentDate, status: 'COMPLETED', source: 'MANUAL_ENTRY', notes: `Direct closure refund ${refundNumber}`, recordedBy: userId }], { session });
        await RefundRequest.create([{ refundNumber, customerId: allocation.customerId, allocationId: allocation._id, lockerId: allocation.lockerId, requestedAmount: input.refundAmount, approvedAmount: input.refundAmount, reason: 'Locker closure cash refund', status: 'PAID', requestedBy: userId, requestedAt: new Date(), paidBy: userId, paidAt: paymentDate, refundPaymentMethod: 'CASH', notes: 'Settled through direct counter closure' }], { session });
      }
      let closure: ILockerClosure | null = await LockerClosure.findOne({ allocationId: allocation._id, status: { $in: OPEN_CLOSURE_STATUSES } }).session(session);
      if (!closure) closure = await this.createClosure(input, userId, session);
      closure.physicalChecklist = input.physicalChecklist as IPhysicalChecklist;
      closure.requestedClosureDate = new Date(closingDay + 'T00:00:00Z');
      closure.refundedDate = input.refundAmount > 0 ? new Date(input.refundedDate! + 'T00:00:00Z') : undefined;
      closure.notes = input.notes?.trim() || '';
      closure.status = CLOSURE_STATUSES.APPROVED;
      closure.overrideFinancial = false;
      await closure.save({ session });
      // Completion rechecks the ledger; inconsistent records roll back the payout too.
      return this.completeClosure(String(closure._id), 'Direct counter closure', userId, session);
    });
  }

  /**
   * Submits a DRAFT closure for review
   */
  async submitClosure(id: string, userId: string): Promise<ILockerClosure> {
    return mongoose.connection.transaction(async (session) => {
    const closure = await LockerClosure.findOneAndUpdate({ _id: id }, { $inc: { __v: 1 } }, { new: true, timestamps: false, session });
    if (!closure) {
      const error: any = new Error('Closure record not found');
      error.statusCode = 404;
      throw error;
    }

    if (closure.status !== CLOSURE_STATUSES.DRAFT) {
      const error: any = new Error(`Only DRAFT closures can be submitted. Current status: ${closure.status}`);
      error.statusCode = 400;
      throw error;
    }

    closure.status = CLOSURE_STATUSES.PENDING_REVIEW;
    await closure.save();

    await AuditLog.create([{
      action: 'CLOSURE_SUBMITTED',
      module: 'CLOSURES',
      performedBy: new Types.ObjectId(userId),
      entityId: closure._id,
      entityType: 'LockerClosure',
      details: {
        closureNumber: closure.closureNumber,
      },
    }], { session });

    return closure;
    });
  }

  /**
   * Reviews closure and sets appropriate status based on live financial readiness
   */
  async reviewClosure(
    id: string,
    notes: string | undefined,
    userId: string,
    updatedChecklist?: Partial<IPhysicalChecklist>
  ): Promise<ILockerClosure> {
    return mongoose.connection.transaction(async (session) => {
    const closure = await LockerClosure.findOneAndUpdate({ _id: id }, { $inc: { __v: 1 } }, { new: true, timestamps: false, session });
    if (!closure) {
      const error: any = new Error('Closure record not found');
      error.statusCode = 404;
      throw error;
    }

    if (
      ![CLOSURE_STATUSES.DRAFT, CLOSURE_STATUSES.PENDING_REVIEW, CLOSURE_STATUSES.PENDING_SETTLEMENT].includes(
        closure.status as any
      )
    ) {
      const error: any = new Error(`Cannot review closure in status ${closure.status}`);
      error.statusCode = 400;
      throw error;
    }

    if (updatedChecklist !== undefined) {
      validatePhysicalChecklist(updatedChecklist);
      const previous = (closure.physicalChecklist as any)?.toObject?.() || closure.physicalChecklist;
      closure.physicalChecklist = {
        ...previous,
        ...updatedChecklist,
      };
    }

    // Evaluate live readiness
    const readiness = await closureReadinessService.getReadiness(
      closure.allocationId,
      closure.physicalChecklist
    );

    let nextStatus: ClosureStatus = CLOSURE_STATUSES.PENDING_SETTLEMENT;
    if (readiness.isReadyForApproval) {
      nextStatus = CLOSURE_STATUSES.READY_FOR_CLOSURE;
    }

    closure.status = nextStatus;
    closure.reviewedBy = new Types.ObjectId(userId);
    closure.reviewedAt = new Date();
    if (notes) closure.reviewNotes = notes.trim();

    await closure.save();

    await AuditLog.create([{
      action: 'CLOSURE_REVIEWED',
      module: 'CLOSURES',
      performedBy: new Types.ObjectId(userId),
      entityId: closure._id,
      entityType: 'LockerClosure',
      details: {
        closureNumber: closure.closureNumber,
        newStatus: closure.status,
        isFinanciallyCleared: readiness.isFinanciallyCleared,
        checklistComplete: readiness.checklistComplete,
        blockers: readiness.blockers,
      },
    }], { session });

    return closure;
    });
  }

  /**
   * Approves a closure for final completion (Maker-Checker enforced)
   */
  async approveClosure(
    id: string,
    approvalNotes: string | undefined,
    userId: string,
    overrideFinancial = false,
    overrideReason?: string
  ): Promise<ILockerClosure> {
    return mongoose.connection.transaction(async (session) => {
    const closure = await LockerClosure.findOneAndUpdate(
      {
        _id: id,
        status: { $in: [CLOSURE_STATUSES.PENDING_REVIEW, CLOSURE_STATUSES.PENDING_SETTLEMENT, CLOSURE_STATUSES.READY_FOR_CLOSURE] },
      },
      { $set: { updatedAt: new Date() } },
      { new: true, session }
    );
    if (!closure) {
      const error: any = new Error('Closure record not found');
      error.statusCode = 404;
      throw error;
    }

    // Maker-Checker Check: prevent requester from approving their own closure
    if (String(closure.requestedBy) === String(userId)) {
      const error: any = new Error(
        'Maker-Checker Policy: The user who initiated the closure request cannot approve it. Another authorized reviewer/approver must review.'
      );
      error.statusCode = 403;
      throw error;
    }

    // Re-verify real-time readiness immediately before approval
    const readiness = await closureReadinessService.getReadiness(
      closure.allocationId,
      closure.physicalChecklist
    );

    if (!readiness.checklistComplete) {
      const error: any = new Error(
        `Physical checklist is incomplete: ${readiness.missingChecklistItems.join(', ')}`
      );
      error.statusCode = 400;
      throw error;
    }

    if (!readiness.isFinanciallyCleared && !overrideFinancial) {
      const error: any = new Error(
        `Financial settlement required before approval: ${readiness.blockers.join(' ')}`
      );
      error.statusCode = 400;
      throw error;
    }

    closure.status = CLOSURE_STATUSES.APPROVED;
    closure.approvedBy = new Types.ObjectId(userId);
    closure.approvedAt = new Date();
    if (approvalNotes) closure.approvalNotes = approvalNotes.trim();

    if (overrideFinancial) {
      if (!overrideReason || overrideReason.trim().length < 5) {
        const error: any = new Error('Financial override justification reason is mandatory');
        error.statusCode = 400;
        throw error;
      }
      closure.overrideFinancial = true;
      closure.overrideReason = overrideReason.trim();
      closure.overriddenBy = new Types.ObjectId(userId);
    }

    await closure.save({ session });

    await AuditLog.create([{
      action: 'CLOSURE_APPROVED',
      module: 'CLOSURES',
      performedBy: new Types.ObjectId(userId),
      entityId: closure._id,
      entityType: 'LockerClosure',
      details: {
        closureNumber: closure.closureNumber,
        overrideFinancial: closure.overrideFinancial,
        overrideReason: closure.overrideReason,
      },
    }], { session });

    return closure;
    });
  }

  /**
   * Final Execution: Closes Allocation, Releases Locker, Evaluates Customer Archive, and captures immutable snapshot
   */
  async completeClosure(
    id: string,
    completionNotes: string | undefined,
    userId: string,
    transactionSession?: ClientSession
  ): Promise<ILockerClosure> {
    const execute = async (session: ClientSession) => {
    const closure = await LockerClosure.findOneAndUpdate(
      { _id: id, status: { $in: [CLOSURE_STATUSES.APPROVED, CLOSURE_STATUSES.COMPLETED] } },
      { $set: { updatedAt: new Date() } },
      { new: true, session }
    );
    if (!closure) {
      const error: any = new Error('Closure record not found');
      error.statusCode = 404;
      throw error;
    }

    // Idempotency: If already completed, safely return
    if (closure.status === CLOSURE_STATUSES.COMPLETED) {
      return closure;
    }

    const allocation = await LockerAllocation.findOneAndUpdate({ _id: closure.allocationId }, { $set: { updatedAt: new Date() } }, { new: true, session });
    if (!allocation) {
      const error: any = new Error('Linked allocation not found');
      error.statusCode = 404;
      throw error;
    }

    if (allocation.status === 'CLOSED') throw Object.assign(new Error('This agreement is already closed. Review its existing closure record.'), { statusCode: 409 });

    if (allocation.status !== 'ACTIVE' || String(allocation.lockerId) !== String(closure.lockerId) || String(allocation.customerId) !== String(closure.customerId)) throw Object.assign(new Error('Closure agreement is no longer active or its linked records changed.'), { statusCode: 409 });
    if (await LockerAllocation.exists({ lockerId: allocation.lockerId, _id: { $ne: allocation._id }, status: { $in: ['ACTIVE', 'RESERVED'] } })) throw Object.assign(new Error('Another active tenancy exists for this locker. Review before release.'), { statusCode: 409 });
    const locker = await Locker.findById(closure.lockerId).session(session);
    if (!locker) {
      const error: any = new Error('Linked locker not found');
      error.statusCode = 404;
      throw error;
    }

    const readiness = await closureReadinessService.getReadiness(allocation._id, closure.physicalChecklist, session);
    if (!readiness.checklistComplete || (!readiness.isFinanciallyCleared && !closure.overrideFinancial)) {
      throw Object.assign(new Error(`Closure readiness changed after approval: ${readiness.blockers.join(' ')}`), { statusCode: 409 });
    }

    const actualClosureDate = closure.requestedClosureDate || new Date();
    const completionDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    if (actualClosureDate.toISOString().slice(0, 10) > completionDay || actualClosureDate.toISOString().slice(0, 10) < allocation.startDate.toISOString().slice(0, 10)) throw Object.assign(new Error('Closing date is outside the valid agreement dates.'), { statusCode: 409 });

    // 1. Build Historical Immutable Financial Snapshot
    const allInvoices = await LockerInvoice.find({
      allocationId: allocation._id,
      status: { $nin: ['CANCELLED', 'DRAFT'] },
    }).session(session).lean();

    const depositSummary = await depositService.getDepositSummary(allocation._id, session);

    const totalBilled = allInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const totalPaid = allInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const outstandingAtClosure = Math.max(0, totalBilled - totalPaid);

    const financialSnapshot: IClosureFinancialSnapshot = {
      totalInvoices: allInvoices.length,
      totalBilled,
      totalPaid,
      outstandingAtClosure,
      depositRequired: allocation.securityDeposit,
      depositCollected: depositSummary.totalDepositReceived,
      depositDeductions: depositSummary.totalDeductAdjustments,
      depositRefunded: depositSummary.totalRefunded,
      depositBalanceAtClosure: depositSummary.netDepositHeld,
      snapshotCapturedAt: new Date(),
    };

    // 2. Set Allocation Status to CLOSED
    allocation.status = 'CLOSED' as any;
    allocation.endDate = actualClosureDate;
    allocation.closedAt = new Date();
    allocation.closedBy = new Types.ObjectId(userId);
    await allocation.save({ session });

    // 3. Release Physical Locker Unit
    const condition = closure.physicalChecklist?.lockerCondition || LOCKER_CONDITIONS.GOOD;
    if (['MINOR_DAMAGE', 'DAMAGED', 'KEY_ISSUE', 'OTHER'].includes(condition)) {
      locker.status = 'BLOCKED';
      locker.operationalStatus = condition === 'DAMAGED' ? 'DAMAGED' : 'MAINTENANCE';
      if (closure.physicalChecklist?.damageNotes) {
        locker.remarks = `[Closure Maintenance]: ${closure.physicalChecklist.damageNotes}`;
      }
    } else {
      locker.status = 'VACANT';
      locker.operationalStatus = 'ACTIVE';
    }
    await locker.save({ session });

    // 4. Evaluate Customer Archive Status
    await this.evaluateCustomerArchiveStatus(closure.customerId, session);

    // 5. Finalize Closure Record
    closure.status = CLOSURE_STATUSES.COMPLETED;
    closure.actualClosureDate = actualClosureDate;
    closure.completedBy = new Types.ObjectId(userId);
    closure.completedAt = new Date();
    closure.financialSnapshot = financialSnapshot;
    if (completionNotes) closure.completionNotes = completionNotes.trim();

    await closure.save({ session });

    // 6. Comprehensive Audit Logs
    await AuditLog.create([{
      action: 'CLOSURE_COMPLETED',
      module: 'CLOSURES',
      performedBy: new Types.ObjectId(userId),
      entityId: closure._id,
      entityType: 'LockerClosure',
      details: {
        closureNumber: closure.closureNumber,
        allocationCode: allocation.allocationCode,
        lockerNumber: locker.lockerNumber,
        releasedLockerStatus: locker.status,
        financialSnapshot,
      },
    }], { session });

    await AuditLog.create([{
      action: 'ALLOCATION_CLOSED',
      module: 'ALLOCATIONS',
      performedBy: new Types.ObjectId(userId),
      entityId: allocation._id,
      entityType: 'LockerAllocation',
      details: {
        allocationCode: allocation.allocationCode,
        closedAt: actualClosureDate,
        closureNumber: closure.closureNumber,
      },
    }], { session });

    return closure;
    };
    return transactionSession ? execute(transactionSession) : mongoose.connection.transaction(execute);
  }

  /**
   * Evaluates if a customer should be transitioned to ARCHIVED status
   * Rule: If customer has 0 active or reserved allocations remaining, mark as ARCHIVED.
   */
  async evaluateCustomerArchiveStatus(customerId: Types.ObjectId | string, session?: ClientSession): Promise<boolean> {
    const custId = new Types.ObjectId(customerId);
    const activeAllocationsCount = await LockerAllocation.countDocuments({
      customerId: custId,
      status: { $in: ['ACTIVE', 'RESERVED'] },
    }).session(session || null);

    if (activeAllocationsCount === 0) {
      await Customer.findByIdAndUpdate(custId, {
        status: 'ARCHIVED',
      }, { session });
      return true;
    }

    return false;
  }

  /**
   * Rejects a closure request with operational remarks
   */
  async rejectClosure(id: string, rejectionReason: string, userId: string): Promise<ILockerClosure> {
    if (typeof rejectionReason !== 'string' || rejectionReason.trim().length < 3 || rejectionReason.length > 2000) {
      const error: any = new Error('Rejection reason is required');
      error.statusCode = 400;
      throw error;
    }

    return mongoose.connection.transaction(async (session) => {
    const closure = await LockerClosure.findOneAndUpdate({ _id: id }, { $inc: { __v: 1 } }, { new: true, timestamps: false, session });
    if (!closure) {
      const error: any = new Error('Closure record not found');
      error.statusCode = 404;
      throw error;
    }

    if ([CLOSURE_STATUSES.COMPLETED, CLOSURE_STATUSES.CANCELLED, CLOSURE_STATUSES.REJECTED].includes(closure.status as any)) {
      const error: any = new Error('Cannot reject an already completed closure');
      error.statusCode = 400;
      throw error;
    }

    closure.status = CLOSURE_STATUSES.REJECTED;
    closure.rejectedBy = new Types.ObjectId(userId);
    closure.rejectedAt = new Date();
    closure.rejectionReason = rejectionReason.trim();
    await closure.save();

    await AuditLog.create([{
      action: 'CLOSURE_REJECTED',
      module: 'CLOSURES',
      performedBy: new Types.ObjectId(userId),
      entityId: closure._id,
      entityType: 'LockerClosure',
      details: {
        closureNumber: closure.closureNumber,
        reason: rejectionReason.trim(),
      },
    }], { session });

    return closure;
    });
  }

  /**
   * Cancels a closure request
   */
  async cancelClosure(id: string, cancellationReason: string, userId: string): Promise<ILockerClosure> {
    if (typeof cancellationReason !== 'string' || cancellationReason.trim().length < 3 || cancellationReason.length > 2000) {
      const error: any = new Error('Cancellation reason is required');
      error.statusCode = 400;
      throw error;
    }

    return mongoose.connection.transaction(async (session) => {
    const closure = await LockerClosure.findOneAndUpdate({ _id: id }, { $inc: { __v: 1 } }, { new: true, timestamps: false, session });
    if (!closure) {
      const error: any = new Error('Closure record not found');
      error.statusCode = 404;
      throw error;
    }

    if ([CLOSURE_STATUSES.COMPLETED, CLOSURE_STATUSES.CANCELLED, CLOSURE_STATUSES.REJECTED].includes(closure.status as any)) {
      const error: any = new Error('Cannot cancel an already completed closure');
      error.statusCode = 400;
      throw error;
    }

    closure.status = CLOSURE_STATUSES.CANCELLED;
    closure.cancelledBy = new Types.ObjectId(userId);
    closure.cancelledAt = new Date();
    closure.cancellationReason = cancellationReason.trim();
    await closure.save();

    await AuditLog.create([{
      action: 'CLOSURE_CANCELLED',
      module: 'CLOSURES',
      performedBy: new Types.ObjectId(userId),
      entityId: closure._id,
      entityType: 'LockerClosure',
      details: {
        closureNumber: closure.closureNumber,
        reason: cancellationReason.trim(),
      },
    }], { session });

    return closure;
    });
  }

  /**
   * Retrieves single populated closure dossier
   */
  async getClosureById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;

    return LockerClosure.findById(id)
      .populate('customerId', 'fullName customerCode phone address city state photoUrl status')
      .populate('lockerId', 'lockerNumber size rackNumber section floor status operationalStatus')
      .populate('allocationId', 'allocationCode startDate endDate annualRent securityDeposit billingCycle status')
      .populate('requestedBy', 'name username role')
      .populate('reviewedBy', 'name username role')
      .populate('approvedBy', 'name username role')
      .populate('completedBy', 'name username role')
      .populate('rejectedBy', 'name username role')
      .populate('cancelledBy', 'name username role')
      .lean();
  }

  /**
   * Retrieves paginated closures with search & filtering
   */
  async getClosures(params: ClosureQueryParams) {
    for (const key of ['search', 'size', 'status', 'closureType', 'customerId', 'lockerId', 'allocationId', 'sortBy', 'sortOrder'] as const) if (params[key] !== undefined && typeof params[key] !== 'string') throw Object.assign(new Error(`Invalid ${key}.`), { statusCode: 400 });
    if (params.status && params.status !== 'ALL' && !Object.values(CLOSURE_STATUSES).includes(params.status)) throw Object.assign(new Error('Invalid closure status.'), { statusCode: 400 });
    const page = Number.isFinite(Number(params.page)) ? Math.max(1, Math.floor(Number(params.page))) : 1;
    const limit = Number.isFinite(Number(params.limit)) ? Math.min(100, Math.max(1, Math.floor(Number(params.limit)))) : 20;
    const skip = (page - 1) * limit;

    const query: any = {};

    if (params.status && params.status !== 'ALL') {
      query.status = params.status;
    }

    if (params.closureType && params.closureType !== 'ALL') {
      query.closureType = params.closureType;
    }

    for (const key of ['customerId', 'lockerId', 'allocationId'] as const) {
      if (params[key]) {
        if (!Types.ObjectId.isValid(params[key]!)) throw Object.assign(new Error(`Invalid ${key}.`), { statusCode: 400 });
        query[key] = new Types.ObjectId(params[key]);
      }
    }
    if (params.size) {
      const ids = await Locker.find({ size: params.size }).distinct('_id');
      query.lockerId = query.lockerId ? { $in: ids.filter(id => String(id) === String(query.lockerId)) } : { $in: ids };
    }

    if (params.dateFrom || params.dateTo) {
      query.requestedClosureDate = {};
      if (params.dateFrom) query.requestedClosureDate.$gte = new Date(params.dateFrom);
      if (params.dateTo) {
        const toDate = new Date(params.dateTo);
        toDate.setHours(23, 59, 59, 999);
        query.requestedClosureDate.$lte = toDate;
      }
    }

    if (params.search && params.search.trim()) {
      const escaped = params.search.trim().slice(0, 200).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      const [customers, lockers] = await Promise.all([Customer.find({ $or: [{ fullName: searchRegex }, { customerCode: searchRegex }, { phone: searchRegex }] }).distinct('_id'), Locker.find({ $or: [{ lockerNumber: searchRegex }, { lockerCode: searchRegex }, { rackNumber: searchRegex }] }).distinct('_id')]);
      query.$or = [
        { customerId: { $in: customers } },
        { lockerId: { $in: lockers } },
        { closureNumber: searchRegex },
        { closureReason: searchRegex },
        { notes: searchRegex },
      ];
    }

    const sortField = ['requestedAt', 'actualClosureDate', 'closureNumber', 'createdAt'].includes(params.sortBy || '') ? params.sortBy! : 'requestedAt';
    const sortDir = params.sortOrder === 'asc' ? 1 : -1;
    const sort: any = { [sortField]: sortDir, _id: sortDir };

    const [closures, total] = await Promise.all([
      LockerClosure.find(query)
        .populate('customerId', 'fullName customerCode phone')
        .populate('lockerId', 'lockerNumber size rackNumber')
        .populate('allocationId', 'allocationCode startDate')
        .populate('requestedBy', 'name username')
        .populate('approvedBy', 'name username')
        .populate('completedBy', 'name username')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      LockerClosure.countDocuments(query),
    ]);

    return {
      closures,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Summary stats for Top Dashboard Cards
   */
  async getClosureStats() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      pendingReview,
      pendingSettlement,
      readyForClosure,
      approved,
      completedToday,
      completedThisMonth,
      rejected,
      totalCount,
    ] = await Promise.all([
      LockerClosure.countDocuments({ status: CLOSURE_STATUSES.PENDING_REVIEW }),
      LockerClosure.countDocuments({ status: CLOSURE_STATUSES.PENDING_SETTLEMENT }),
      LockerClosure.countDocuments({ status: CLOSURE_STATUSES.READY_FOR_CLOSURE }),
      LockerClosure.countDocuments({ status: CLOSURE_STATUSES.APPROVED }),
      LockerClosure.countDocuments({
        status: CLOSURE_STATUSES.COMPLETED,
        completedAt: { $gte: startOfToday },
      }),
      LockerClosure.countDocuments({
        status: CLOSURE_STATUSES.COMPLETED,
        completedAt: { $gte: startOfMonth },
      }),
      LockerClosure.countDocuments({ status: CLOSURE_STATUSES.REJECTED }),
      LockerClosure.countDocuments({}),
    ]);

    return {
      pendingReview,
      pendingSettlement,
      readyForClosure,
      approved,
      completedToday,
      completedThisMonth,
      rejected,
      totalCount,
    };
  }

  /**
   * Generates a clean black-and-white print-ready A4 Tenancy Closure Certificate & Statement
   */
  async generateClosureStatementHtml(closureId: string, autoPrint = false): Promise<string> {
    const closure: any = escapeHtmlFields(await this.getClosureById(closureId));
    if (!closure) {
      throw new Error('Closure not found');
    }

    const customer = closure.customerId || {};
    const locker = closure.lockerId || {};
    const allocation = closure.allocationId || {};
    const snapshot = closure.financialSnapshot || {};
    const checklist = closure.physicalChecklist || {};

    const closureDateStr = (closure.actualClosureDate || closure.requestedClosureDate)
      ? new Date(closure.actualClosureDate || closure.requestedClosureDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '';

    const startDateStr = allocation.startDate
      ? new Date(allocation.startDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'N/A';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Closure Statement - ${closure.closureNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #111;
      background: #fff;
      font-size: 10.5pt;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .cert-container { max-width: 800px; margin: 0 auto; padding: 10px; }
    .header-table { width: 100%; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 12px; }
    .brand-title { font-size: 18pt; font-weight: 900; letter-spacing: -0.5px; }
    .brand-sub { font-size: 8.5pt; font-weight: 700; text-transform: uppercase; color: #444; }
    .meta-text { font-size: 8pt; color: #666; }
    .cert-badge { display: inline-block; border: 1.5px solid #000; padding: 3px 8px; font-size: 8.5pt; font-weight: 800; text-transform: uppercase; }
    .cert-num { font-family: monospace; font-size: 12.5pt; font-weight: 800; margin-top: 4px; }
    .info-grid { width: 100%; border: 1px solid #000; border-collapse: collapse; margin-bottom: 12px; }
    .info-grid td { border: 1px solid #000; padding: 8px 10px; vertical-align: top; width: 50%; }
    .sec-label { font-size: 7.5pt; font-weight: 800; text-transform: uppercase; color: #666; margin-bottom: 3px; }
    .entity-name { font-size: 11pt; font-weight: 800; }
    .statement-table { width: 100%; border: 1px solid #000; border-collapse: collapse; margin-bottom: 12px; }
    .statement-table th { background: #f0f0f0; border: 1px solid #000; padding: 6px 8px; font-size: 8pt; font-weight: 800; text-transform: uppercase; text-align: left; }
    .statement-table td { border: 1px solid #000; padding: 6px 8px; font-size: 9pt; }
    .checklist-box { border: 1px solid #000; padding: 8px 10px; margin-bottom: 12px; font-size: 8.5pt; background: #fafafa; }
    .checklist-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; margin-top: 4px; }
    .sig-table { width: 100%; margin-top: 25px; margin-bottom: 8px; }
    .sig-table td { width: 50%; text-align: center; vertical-align: bottom; padding: 0 15px; }
    .sig-line { border-top: 1px solid #000; margin-top: 35px; padding-top: 4px; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; }
    .stamp-box { border: 1px dashed #000; padding: 3px 8px; display: inline-block; font-size: 7.5pt; font-weight: 800; text-transform: uppercase; margin-bottom: 4px; }
    .footer-note { text-align: center; font-size: 7.5pt; color: #666; border-top: 1px solid #ddd; padding-top: 6px; margin-top: 8px; }
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="cert-container">
    <!-- Header -->
    <table class="header-table">
      <tr>
        <td style="vertical-align: top;">
          <div class="brand-title">MSS LOCKER</div>
          <div class="brand-sub">Safe-Deposit Locker Vault & Trust Services</div>
          <div class="meta-text">Main Branch Vault &bull; 24x7 High-Security Armed Custody</div>
          <div class="meta-text">Branch Code: VL-MUM-01 &bull; GSTIN: 27AAAAA0000A1Z5</div>
        </td>
        <td style="text-align: right; vertical-align: top;">
          <div class="cert-badge">Locker Surrender & Closure Certificate</div>
          <div class="cert-num">${closure.closureNumber}</div>
          <div class="meta-text" style="font-weight: 700; color: #000; margin-top: 3px;">
            Effective Date: ${closureDateStr}
          </div>
        </td>
      </tr>
    </table>

    <!-- Tenant & Locker Coordinates -->
    <table class="info-grid">
      <tr>
        <td>
          <div class="sec-label">Surrendering Tenant Details</div>
          <div class="entity-name">${customer.fullName || 'N/A'}</div>
          <div style="font-size: 9pt; margin-top: 2px;">
            <strong>Customer Code:</strong> ${customer.customerCode || 'N/A'}
          </div>
          <div style="font-size: 9pt;">
            <strong>Phone:</strong> ${customer.phone || 'N/A'}
          </div>
          ${customer.address ? `<div style="font-size: 8pt; color: #555; margin-top: 2px;">${customer.address}, ${customer.city || ''}</div>` : ''}
        </td>
        <td>
          <div class="sec-label">Surrendered Locker Coordinates</div>
          <div class="entity-name">Locker #${locker.lockerNumber || 'N/A'} (Size ${locker.size || 'STD'})</div>
          <div style="font-size: 9pt; margin-top: 2px;">
            <strong>Rack / Vault:</strong> ${locker.rackNumber || 'N/A'}${locker.section ? ' • ' + locker.section : ''}
          </div>
          <div style="font-size: 9pt;">
            <strong>Agreement Code:</strong> ${allocation.allocationCode || 'N/A'}
          </div>
          <div style="font-size: 9pt;">
            <strong>Tenure:</strong> ${startDateStr} to ${closureDateStr}
          </div>
        </td>
      </tr>
    </table>

    <!-- Financial Settlement Breakdown Table -->
    <table class="statement-table">
      <thead>
        <tr>
          <th>Financial Account Ledger</th>
          <th style="text-align: right;">Total Incurred</th>
          <th style="text-align: right;">Total Settled</th>
          <th style="text-align: right;">Final Balance</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Locker Rental & Renewal Invoices</strong></td>
          <td style="text-align: right; font-family: monospace;">₹${Number(snapshot.totalBilled || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-family: monospace;">₹${Number(snapshot.totalPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-family: monospace; font-weight: 800;">₹${Number(snapshot.outstandingAtClosure || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td><strong>Security Caution Deposit Ledger</strong></td>
          <td style="text-align: right; font-family: monospace;">Collected: ₹${Number(snapshot.depositCollected || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-family: monospace;">Refunded: ₹${Number(snapshot.depositRefunded || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-family: monospace; font-weight: 800;">Deductions: ₹${Number(snapshot.depositDeductions || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr style="background: #fafafa;">
          <td colspan="3" style="text-align: right; font-weight: 800;">Net Final Outstanding at Closure:</td>
          <td style="text-align: right; font-weight: 900; font-family: monospace; font-size: 10.5pt;">₹0.00</td>
        </tr>
      </tbody>
    </table>

    <!-- Physical Inspection & Custody Handover Checklist -->
    <div class="checklist-box">
      <div class="sec-label" style="margin-bottom: 2px;">Physical Handover & Verification Checklist</div>
      <div class="checklist-grid">
        <div>[ ${checklist.lockerEmptied ? '✔' : ' '} ] Locker Articles Fully Emptied</div>
        <div>[ ${checklist.customerKeyReturned ? '✔' : ' '} ] Customer Key(s) Returned to Vault</div>
        <div>[ ${checklist.lockerInspected ? '✔' : ' '} ] Physical Locker Lock & Hinge Inspected</div>
        <div>[ ${checklist.physicalAccessRevoked ? '✔' : ' '} ] Biometric / Vault Access Revoked</div>
        <div>[ ${checklist.documentsReturned ? '✔' : ' '} ] Surrender Documentation Executed</div>
        <div><strong>Locker Condition:</strong> ${checklist.lockerCondition || 'GOOD'}</div>
      </div>
      ${checklist.damageNotes ? `<div style="margin-top: 4px; font-size: 8pt; color: #555;"><strong>Condition Remarks:</strong> ${checklist.damageNotes}</div>` : ''}
    </div>

    <!-- Closure Reason -->
    <div style="font-size: 8.5pt; margin-bottom: 8px;">
      <strong>Reason for Surrender / Closure:</strong> ${closure.closureReason} (${closure.closureType})
    </div>

    <!-- Signatures -->
    <table class="sig-table">
      <tr>
        <td>
          <div class="sig-line">Tenant Signature & Handover Confirmation</div>
        </td>
        <td>
          <div class="stamp-box">[ VAULT CLEARANCE CONFIRMED & RELEASED ]</div>
          <div class="sig-line">Authorized Vault Custody Officer (${closure.completedBy?.name || closure.approvedBy?.name || 'Vault Staff'})</div>
        </td>
      </tr>
    </table>

    <!-- Footer -->
    <div class="footer-note">
      This is a computer-generated permanent record of tenancy termination and locker surrender issued by MSS Locker safe deposit locker system.<br>
      Security Hash: <strong>${closure._id ? String(closure._id).slice(-12).toUpperCase() : 'VAULT-CLS'}</strong> &bull; Completed At: ${closure.completedAt ? new Date(closure.completedAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN')} &bull; Page 1 of 1
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

export const lockerClosureService = new LockerClosureService();
