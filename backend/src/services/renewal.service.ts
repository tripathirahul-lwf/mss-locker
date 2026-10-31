import mongoose, { Types } from 'mongoose';
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
  nextRenewalDueDate?: string;
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

    const fail = (message: string, statusCode = 400) => Object.assign(new Error(message), { statusCode });
    const parseDay = (value: string) => {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw fail('Use a valid calendar date (YYYY-MM-DD).');
      const date = new Date(value + 'T00:00:00.000Z');
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw fail('Use a valid calendar date (YYYY-MM-DD).');
      return date;
    };
    if (input.startDate !== undefined) parseDay(input.startDate);
    if (input.nextRenewalDueDate !== undefined) parseDay(input.nextRenewalDueDate);
    if (input.billingCycle !== undefined && !['ANNUAL', 'TRIENNIAL', 'HALF_YEARLY', 'QUARTERLY', 'MONTHLY', 'CUSTOM'].includes(input.billingCycle)) throw fail('Invalid billing cycle.');
    for (const key of ['baseRent', 'discount', 'lateFee', 'otherCharges', 'taxAmount'] as const) {
      const value = input[key];
      if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100000000 || Math.abs(value * 100 - Math.round(value * 100)) > .00001)) throw fail(`${key} must be a non-negative amount with at most two decimal places.`);
    }
    if (input.notes !== undefined && (typeof input.notes !== 'string' || input.notes.length > 2000)) throw fail('Notes must be at most 2000 characters.');
    return mongoose.connection.transaction(async (session) => {
    const allocation = await LockerAllocation.findOneAndUpdate({ _id: input.allocationId }, { $inc: { __v: 1 } }, { new: true, timestamps: false })
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

    if (await LockerInvoice.exists({ allocationId: allocation._id, invoiceType: 'NEW_ALLOCATION', status: { $ne: 'CANCELLED' }, balanceAmount: { $gt: 0 } })) throw Object.assign(new Error('Settle the opening invoice before generating a renewal.'), { statusCode: 409 });

    if (!allocation.customerId || !allocation.lockerId) throw fail('Customer or locker record is missing. Review this agreement.', 409);
    // 1. Determine Start Date of the Renewal Period
    let renewalStartDate: Date;
    if (input.startDate) {
      renewalStartDate = new Date(input.startDate);
    } else if (allocation.paidThroughDate) {
      renewalStartDate = new Date(allocation.paidThroughDate);
      renewalStartDate.setUTCDate(renewalStartDate.getUTCDate() + 1);
    } else if (allocation.nextRenewalDueDate) {
      renewalStartDate = new Date(allocation.nextRenewalDueDate);
    } else if (allocation.endDate) {
      renewalStartDate = new Date(allocation.endDate);
      renewalStartDate.setUTCDate(renewalStartDate.getUTCDate() + 1);
    } else {
      renewalStartDate = new Date(allocation.startDate);
    }

    const cycle: BillingCycle = input.billingCycle || (allocation.billingCycle as BillingCycle) || 'ANNUAL';
    if (!Number.isFinite(renewalStartDate.getTime())) throw fail('Renewal date is missing or invalid. Review this agreement.', 409);
    renewalStartDate = new Date(renewalStartDate.toISOString().slice(0, 10) + 'T00:00:00.000Z');
    if (renewalStartDate < allocation.startDate) throw fail('Renewal cannot start before the agreement opening date.');
    if (allocation.paidThroughDate && renewalStartDate.toISOString().slice(0, 10) <= allocation.paidThroughDate.toISOString().slice(0, 10)) throw fail('Renewal overlaps the recorded paid coverage.', 409);
    const { periodStart, periodEnd, nextDueDate } = calculateBillingPeriod(renewalStartDate, cycle);
    const invoiceCycle = input.nextRenewalDueDate && input.nextRenewalDueDate !== nextDueDate.toISOString().slice(0, 10) ? 'CUSTOM' : cycle;
    if (cycle === 'CUSTOM' && !input.nextRenewalDueDate) throw fail('Choose the next renewal date for a custom period.');
    if (input.nextRenewalDueDate) {
      const next = parseDay(input.nextRenewalDueDate);
      if (next <= periodStart) throw fail('Next renewal date must be after the renewal start date.');
      periodEnd.setTime(next.getTime() - 86400000);
    }

    // 2. Check Duplicate Renewal Invoice Protection (409 Conflict)
    const existingInvoice = await LockerInvoice.findOne({
      allocationId: allocation._id,
      billingPeriodStart: { $lte: periodEnd },
      billingPeriodEnd: { $gte: periodStart },
      invoiceType: { $ne: 'ADJUSTMENT' },
      status: { $nin: ['CANCELLED', 'DRAFT'] },
    });

    if (existingInvoice) {
      const error: any = new Error(
        `An overlapping invoice already exists for billing period ${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)} (${existingInvoice.invoiceNumber}).`
      );
      error.statusCode = 409;
      throw error;
    }

    // 3. Freeze Financial Snapshot Tariffs
    if (await LockerInvoice.exists({ allocationId: allocation._id, invoiceType: { $ne: 'ADJUSTMENT' }, status: { $nin: ['CANCELLED', 'DRAFT'] }, balanceAmount: { $gt: 0 } })) throw fail('Settle the outstanding rent invoice before generating another renewal.', 409);
    const months = { ANNUAL: 12, TRIENNIAL: 36, HALF_YEARLY: 6, QUARTERLY: 3, MONTHLY: 1, CUSTOM: 12 }[cycle];
    const annual = allocation.rentSnapshot ?? allocation.annualRent;
    if (input.baseRent === undefined && (!Number.isFinite(annual) || annual < 0)) throw fail('Agreement tariff is missing or invalid. Enter the renewal rent.', 409);
    const baseRent = input.baseRent ?? Math.round(Math.round(annual / 1.18 * 100) / 100 * months / 12 * 100) / 100;
    if ((input.discount ?? 0) > baseRent + (input.lateFee ?? 0) + (input.otherCharges ?? 0)) throw fail('Discount cannot exceed the charges.');
    const totals = calculateInvoiceTotals({
      baseRent,
      discount: input.discount || 0,
      lateFee: input.lateFee || 0,
      otherCharges: input.otherCharges || 0,
      taxAmount: input.taxAmount ?? Math.round((baseRent + (input.lateFee ?? 0) + (input.otherCharges ?? 0) - (input.discount ?? 0)) * 18) / 100,
      paidAmount: 0,
    });

    totals.subtotal = Math.round(totals.subtotal * 100) / 100;
    totals.totalAmount = Math.round(totals.totalAmount * 100) / 100;
    totals.balanceAmount = totals.totalAmount;
    if (totals.totalAmount <= 0) throw fail('Renewal bill total must be greater than zero.');
    const invoiceNumber = await generateInvoiceNumber();
    const dueStatus = determineDueStatus(periodStart, totals.balanceAmount);

    // 4. Create and Save Invoice
    const [invoice] = await LockerInvoice.create([{
      invoiceNumber,
      invoiceType: 'RENEWAL',
      allocationId: allocation._id,
      customerId: allocation.customerId._id,
      lockerId: allocation.lockerId._id,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      issueDate: new Date(),
      dueDate: periodStart,
      billingCycle: invoiceCycle,
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
    }], { session });

    // Paid coverage and lastRenewedAt change only when payment is recorded.

    // 6. Record Audit Event
    await AuditLog.create([{
      action: 'RENEWAL_GENERATED',
      actorUserId: input.userId ? new Types.ObjectId(input.userId) : undefined,
      description: `Issued renewal bill ${invoice.invoiceNumber} for ${allocation.allocationCode}`,
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
    }], { session });

    return invoice;
    });
  }
}

export const renewalService = new RenewalService();
