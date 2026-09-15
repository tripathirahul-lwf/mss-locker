import mongoose, { ClientSession, Types } from 'mongoose';
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

export interface CreateClosureInput {
  allocationId: string;
  closureType?: ClosureType;
  closureReason: string;
  requestedClosureDate?: string;
  physicalChecklist?: Partial<IPhysicalChecklist>;
  notes?: string;
}

export interface ClosureQueryParams {
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
  async createClosure(input: CreateClosureInput, userId: string): Promise<ILockerClosure> {
    if (!input.allocationId || !Types.ObjectId.isValid(input.allocationId)) {
      const error: any = new Error('Valid allocation ID is required');
      error.statusCode = 400;
      throw error;
    }

    if (!input.closureReason || input.closureReason.trim().length < 3) {
      const error: any = new Error('Closure reason is required');
      error.statusCode = 400;
      throw error;
    }

    const allocation = await LockerAllocation.findById(input.allocationId);
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
    const requestedClosureDate = input.requestedClosureDate
      ? new Date(input.requestedClosureDate)
      : new Date();

    const closure = await LockerClosure.create({
      closureNumber,
      allocationId: allocation._id,
      customerId: allocation.customerId,
      lockerId: allocation.lockerId,
      closureType: input.closureType || CLOSURE_TYPES.CUSTOMER_REQUEST,
      closureReason: input.closureReason.trim(),
      status: CLOSURE_STATUSES.DRAFT,
      requestedClosureDate,
      physicalChecklist: input.physicalChecklist || {},
      notes: input.notes?.trim() || '',
      requestedBy: new Types.ObjectId(userId),
      requestedAt: new Date(),
    });

    // Audit Log
    await AuditLog.create({
      action: 'CLOSURE_CREATED',
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
    });

    return closure;
  }

  /**
   * Submits a DRAFT closure for review
   */
  async submitClosure(id: string, userId: string): Promise<ILockerClosure> {
    const closure = await LockerClosure.findById(id);
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

    await AuditLog.create({
      action: 'CLOSURE_SUBMITTED',
      module: 'CLOSURES',
      performedBy: new Types.ObjectId(userId),
      entityId: closure._id,
      entityType: 'LockerClosure',
      details: {
        closureNumber: closure.closureNumber,
      },
    });

    return closure;
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
    const closure = await LockerClosure.findById(id);
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

    if (updatedChecklist) {
      closure.physicalChecklist = {
        ...closure.physicalChecklist,
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

    await AuditLog.create({
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
    });

    return closure;
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
    userId: string
  ): Promise<ILockerClosure> {
    return mongoose.connection.transaction(async (session) => {
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

    const allocation = await LockerAllocation.findById(closure.allocationId).session(session);
    if (!allocation) {
      const error: any = new Error('Linked allocation not found');
      error.statusCode = 404;
      throw error;
    }

    if (allocation.status === 'CLOSED') {
      // Already closed
      closure.status = CLOSURE_STATUSES.COMPLETED;
      await closure.save({ session });
      return closure;
    }

    const locker = await Locker.findById(closure.lockerId).session(session);
    if (!locker) {
      const error: any = new Error('Linked locker not found');
      error.statusCode = 404;
      throw error;
    }

    const actualClosureDate = new Date();

    // 1. Build Historical Immutable Financial Snapshot
    const allInvoices = await LockerInvoice.find({
      allocationId: allocation._id,
      status: { $ne: 'CANCELLED' },
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
      snapshotCapturedAt: actualClosureDate,
    };

    // 2. Set Allocation Status to CLOSED
    allocation.status = 'CLOSED' as any;
    allocation.endDate = actualClosureDate;
    allocation.closedAt = actualClosureDate;
    allocation.closedBy = new Types.ObjectId(userId);
    await allocation.save({ session });

    // 3. Release Physical Locker Unit
    const condition = closure.physicalChecklist?.lockerCondition || LOCKER_CONDITIONS.GOOD;
    if (['MINOR_DAMAGE', 'DAMAGED', 'KEY_ISSUE'].includes(condition)) {
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
    closure.completedAt = actualClosureDate;
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
    });
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
    if (!rejectionReason || rejectionReason.trim().length < 3) {
      const error: any = new Error('Rejection reason is required');
      error.statusCode = 400;
      throw error;
    }

    const closure = await LockerClosure.findById(id);
    if (!closure) {
      const error: any = new Error('Closure record not found');
      error.statusCode = 404;
      throw error;
    }

    if (closure.status === CLOSURE_STATUSES.COMPLETED) {
      const error: any = new Error('Cannot reject an already completed closure');
      error.statusCode = 400;
      throw error;
    }

    closure.status = CLOSURE_STATUSES.REJECTED;
    closure.rejectedBy = new Types.ObjectId(userId);
    closure.rejectedAt = new Date();
    closure.rejectionReason = rejectionReason.trim();
    await closure.save();

    await AuditLog.create({
      action: 'CLOSURE_REJECTED',
      module: 'CLOSURES',
      performedBy: new Types.ObjectId(userId),
      entityId: closure._id,
      entityType: 'LockerClosure',
      details: {
        closureNumber: closure.closureNumber,
        reason: rejectionReason.trim(),
      },
    });

    return closure;
  }

  /**
   * Cancels a closure request
   */
  async cancelClosure(id: string, cancellationReason: string, userId: string): Promise<ILockerClosure> {
    if (!cancellationReason || cancellationReason.trim().length < 3) {
      const error: any = new Error('Cancellation reason is required');
      error.statusCode = 400;
      throw error;
    }

    const closure = await LockerClosure.findById(id);
    if (!closure) {
      const error: any = new Error('Closure record not found');
      error.statusCode = 404;
      throw error;
    }

    if (closure.status === CLOSURE_STATUSES.COMPLETED) {
      const error: any = new Error('Cannot cancel an already completed closure');
      error.statusCode = 400;
      throw error;
    }

    closure.status = CLOSURE_STATUSES.CANCELLED;
    closure.cancelledBy = new Types.ObjectId(userId);
    closure.cancelledAt = new Date();
    closure.cancellationReason = cancellationReason.trim();
    await closure.save();

    await AuditLog.create({
      action: 'CLOSURE_CANCELLED',
      module: 'CLOSURES',
      performedBy: new Types.ObjectId(userId),
      entityId: closure._id,
      entityType: 'LockerClosure',
      details: {
        closureNumber: closure.closureNumber,
        reason: cancellationReason.trim(),
      },
    });

    return closure;
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
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const query: any = {};

    if (params.status && params.status !== 'ALL') {
      query.status = params.status;
    }

    if (params.closureType && params.closureType !== 'ALL') {
      query.closureType = params.closureType;
    }

    if (params.customerId) query.customerId = new Types.ObjectId(params.customerId);
    if (params.lockerId) query.lockerId = new Types.ObjectId(params.lockerId);

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
      const searchRegex = new RegExp(params.search.trim(), 'i');
      query.$or = [
        { closureNumber: searchRegex },
        { closureReason: searchRegex },
        { notes: searchRegex },
      ];
    }

    const sortField = params.sortBy || 'requestedAt';
    const sortDir = params.sortOrder === 'asc' ? 1 : -1;
    const sort: any = { [sortField]: sortDir };

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
    const closure: any = await this.getClosureById(closureId);
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
