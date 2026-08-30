import { Types } from 'mongoose';
import { LockerAllocation } from '../models/LockerAllocation';
import { LockerInvoice } from '../models/LockerInvoice';
import { AuditLog } from '../models/AuditLog';
import {
  calculateBillingPeriod,
  calculateInvoiceTotals,
  determineDueStatus,
  generateInvoiceNumber,
} from '../utils/billingCalculator';
import { BillingCycle } from '../constants/billing.constants';

export interface GenerateRenewalInput {
  allocationId: string;
  startDate?: string;
  billingCycle?: BillingCycle;
  baseRent?: number;
  discount?: number;
  lateFee?: number;
  otherCharges?: number;
  taxAmount?: number;
  notes?: string;
  userId?: string;
}

export class RenewalService {
  /**
   * Generates a new recurring renewal invoice for an active locker tenancy allocation
   */
  async generateRenewalInvoice(input: GenerateRenewalInput) {
    if (!Types.ObjectId.isValid(input.allocationId)) {
      const error: any = new Error('Invalid allocation ID');
      error.statusCode = 400;
      throw error;
    }

    const allocation = await LockerAllocation.findById(input.allocationId)
      .populate('customerId')
      .populate('lockerId');

    if (!allocation) {
      const error: any = new Error('Allocation agreement not found');
      error.statusCode = 404;
      throw error;
    }

    if (allocation.status !== 'ACTIVE') {
      const error: any = new Error(
        `Cannot generate renewal invoice for ${allocation.status} tenancy agreement. Must be ACTIVE.`
      );
      error.statusCode = 400;
      throw error;
    }

    // 1. Determine Start Date of the Renewal Period
    let renewalStartDate: Date;
    if (input.startDate) {
      renewalStartDate = new Date(input.startDate);
    } else if (allocation.paidThroughDate) {
      renewalStartDate = new Date(allocation.paidThroughDate);
      renewalStartDate.setDate(renewalStartDate.getDate() + 1);
    } else if (allocation.nextRenewalDueDate) {
      renewalStartDate = new Date(allocation.nextRenewalDueDate);
    } else if (allocation.endDate) {
      renewalStartDate = new Date(allocation.endDate);
      renewalStartDate.setDate(renewalStartDate.getDate() + 1);
    } else {
      renewalStartDate = new Date(allocation.startDate);
    }

    const cycle: BillingCycle = input.billingCycle || (allocation.billingCycle as BillingCycle) || 'ANNUAL';
    const { periodStart, periodEnd, nextDueDate } = calculateBillingPeriod(renewalStartDate, cycle);

    // 2. Check Duplicate Renewal Invoice Protection (409 Conflict)
    const existingInvoice = await LockerInvoice.findOne({
      allocationId: allocation._id,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      invoiceType: 'RENEWAL',
      status: { $ne: 'CANCELLED' },
    });

    if (existingInvoice) {
      const error: any = new Error(
        `Renewal invoice already exists for billing period ${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)} (${existingInvoice.invoiceNumber}).`
      );
      error.statusCode = 409;
      throw error;
    }

    // 3. Freeze Financial Snapshot Tariffs
    const baseRent = input.baseRent !== undefined ? Number(input.baseRent) : allocation.rentSnapshot || allocation.annualRent;
    const totals = calculateInvoiceTotals({
      baseRent,
      discount: input.discount || 0,
      lateFee: input.lateFee || 0,
      otherCharges: input.otherCharges || 0,
      taxAmount: input.taxAmount || 0,
      paidAmount: 0,
    });

    const invoiceNumber = await generateInvoiceNumber();
    const dueStatus = determineDueStatus(periodStart, totals.balanceAmount);

    // 4. Create and Save Invoice
    const invoice = await LockerInvoice.create({
      invoiceNumber,
      invoiceType: 'RENEWAL',
      allocationId: allocation._id,
      customerId: allocation.customerId._id,
      lockerId: allocation.lockerId._id,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      issueDate: new Date(),
      dueDate: periodStart,
      billingCycle: cycle,
      baseRent: totals.baseRent,
      lateFee: totals.lateFee,
      discount: totals.discount,
      otherCharges: totals.otherCharges,
      taxAmount: totals.taxAmount,
      subtotal: totals.subtotal,
      totalAmount: totals.totalAmount,
      paidAmount: 0,
      balanceAmount: totals.balanceAmount,
      status: 'ISSUED',
      paymentStatus: 'UNPAID',
      dueStatus,
      source: 'SYSTEM',
      notes: input.notes || 'Recurring Tenancy Renewal Invoice',
      createdBy: input.userId ? new Types.ObjectId(input.userId) : undefined,
    });

    // 5. Update Allocation Renewal Metadata
    allocation.paidThroughDate = periodEnd;
    allocation.nextRenewalDueDate = nextDueDate;
    allocation.lastRenewedAt = new Date();
    await allocation.save();

    // 6. Record Audit Event
    await AuditLog.create({
      action: 'RENEWAL_GENERATED',
      module: 'BILLING',
      performedBy: input.userId ? new Types.ObjectId(input.userId) : undefined,
      entityId: invoice._id,
      entityType: 'LockerInvoice',
      details: {
        invoiceNumber: invoice.invoiceNumber,
        allocationCode: allocation.allocationCode,
        totalAmount: totals.totalAmount,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
        dueDate: periodStart,
      },
    });

    return invoice;
  }
}

export const renewalService = new RenewalService();
