import { Types } from 'mongoose';
import { LockerAllocation } from '../models/LockerAllocation';
import { LockerInvoice } from '../models/LockerInvoice';
import { depositService } from './deposit.service';
import { IPhysicalChecklist } from '../models/LockerClosure';
import { closureChecklistConfig } from '../constants/closure.constants';

export interface ClosureReadinessSummary {
  allocationId: string;
  allocationCode: string;
  startDate: Date;
  paidThroughDate?: Date;

  // Billing dues
  totalInvoicesCount: number;
  totalBilledAmount: number;
  totalPaidAmount: number;
  outstandingInvoicesCount: number;
  outstandingInvoiceAmount: number;
  openInvoices: {
    _id: string;
    invoiceNumber: string;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    dueDate: Date;
  }[];

  // Deposit ledger
  depositRequired: number;
  netDepositHeld: number;
  totalDeductions: number;
  totalRefunded: number;
  pendingRefundsCount: number;
  pendingRefundAmount: number;
  availableRefundableBalance: number;

  // Checklist validation
  checklistComplete: boolean;
  missingChecklistItems: string[];

  // Global readiness
  isFinanciallyCleared: boolean;
  isReadyForApproval: boolean;
  blockers: string[];
}

export class ClosureReadinessService {
  /**
   * Calculates live authoritative readiness across billing, deposit ledger, and physical inspection
   */
  async getReadiness(
    allocationId: string | Types.ObjectId,
    checklist?: Partial<IPhysicalChecklist>
  ): Promise<ClosureReadinessSummary> {
    const allocId = new Types.ObjectId(allocationId);
    const allocation = await LockerAllocation.findById(allocId).lean();

    if (!allocation) {
      throw new Error(`Allocation ${allocationId} not found`);
    }

    // 1. Live Billing & Invoices Check
    const allInvoices = await LockerInvoice.find({
      allocationId: allocId,
      status: { $ne: 'CANCELLED' },
    }).lean();

    const totalInvoicesCount = allInvoices.length;
    const totalBilledAmount = allInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const totalPaidAmount = allInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);

    const openInvoices = allInvoices.filter(
      (inv) => inv.balanceAmount > 0 && ['UNPAID', 'PARTIALLY_PAID'].includes(inv.paymentStatus)
    );
    const outstandingInvoicesCount = openInvoices.length;
    const outstandingInvoiceAmount = openInvoices.reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0);

    // 2. Deposit Ledger & Refund Checks
    const depositSummary = await depositService.getDepositSummary(allocId);

    // 3. Physical Checklist Evaluation
    const missingChecklistItems: string[] = [];
    if (checklist) {
      if (!checklist.lockerEmptied) missingChecklistItems.push('Locker must be completely emptied');
      if (!checklist.lockerInspected) missingChecklistItems.push('Locker physical inspection must be confirmed');
      if (!checklist.customerKeyReturned) missingChecklistItems.push('Customer key must be returned to vault custody');
      if (!checklist.documentsReturned) missingChecklistItems.push('Original allocation and surrender documents returned');
      if (!checklist.physicalAccessRevoked) missingChecklistItems.push('Physical biometric & vault access must be revoked');
    } else {
      missingChecklistItems.push('Physical inspection checklist has not been completed');
    }

    const checklistComplete = missingChecklistItems.length === 0;

    // 4. Financial Clearance Evaluation
    // Financially cleared means no outstanding invoices, no pending unapproved refunds, and deposit balance is 0 (either refunded or deducted)
    const blockers: string[] = [];

    if (outstandingInvoiceAmount > 0) {
      blockers.push(
        `₹${outstandingInvoiceAmount.toLocaleString('en-IN')} is still outstanding on ${outstandingInvoicesCount} invoice(s).`
      );
    }

    if (depositSummary.pendingRefundAmount > 0) {
      blockers.push(
        `A ₹${depositSummary.pendingRefundAmount.toLocaleString('en-IN')} security deposit refund request is pending maker-checker approval/disbursement.`
      );
    }

    if (depositSummary.availableRefundableBalance > 0) {
      blockers.push(
        `Unsettled security deposit of ₹${depositSummary.availableRefundableBalance.toLocaleString('en-IN')} is still held. Process refund or record damage deduction.`
      );
    }

    if (!checklistComplete) {
      blockers.push(...missingChecklistItems);
    }

    const isFinanciallyCleared =
      outstandingInvoiceAmount === 0 &&
      depositSummary.pendingRefundAmount === 0 &&
      depositSummary.availableRefundableBalance === 0;

    const isReadyForApproval = isFinanciallyCleared && checklistComplete;

    return {
      allocationId: allocation._id.toString(),
      allocationCode: allocation.allocationCode,
      startDate: allocation.startDate,
      paidThroughDate: allocation.paidThroughDate,

      totalInvoicesCount,
      totalBilledAmount,
      totalPaidAmount,
      outstandingInvoicesCount,
      outstandingInvoiceAmount,
      openInvoices: openInvoices.map((inv) => ({
        _id: inv._id.toString(),
        invoiceNumber: inv.invoiceNumber,
        totalAmount: inv.totalAmount,
        paidAmount: inv.paidAmount,
        balanceAmount: inv.balanceAmount,
        dueDate: inv.dueDate,
      })),

      depositRequired: allocation.securityDeposit,
      netDepositHeld: depositSummary.netDepositHeld,
      totalDeductions: depositSummary.totalDeductAdjustments,
      totalRefunded: depositSummary.totalRefunded,
      pendingRefundsCount: depositSummary.pendingRefundAmount > 0 ? 1 : 0,
      pendingRefundAmount: depositSummary.pendingRefundAmount,
      availableRefundableBalance: depositSummary.availableRefundableBalance,

      checklistComplete,
      missingChecklistItems,

      isFinanciallyCleared,
      isReadyForApproval,
      blockers,
    };
  }
}

export const closureReadinessService = new ClosureReadinessService();
