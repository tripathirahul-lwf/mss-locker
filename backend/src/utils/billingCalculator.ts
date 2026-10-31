import { BillingCycle, DueStatus, PaymentStatus } from '../constants/billing.constants';
import { LockerInvoice } from '../models/LockerInvoice';

export interface InvoiceTotalsInput {
  baseRent: number;
  lateFee?: number;
  otherCharges?: number;
  discount?: number;
  taxAmount?: number;
  paidAmount?: number;
}

export interface InvoiceTotalsOutput {
  baseRent: number;
  lateFee: number;
  otherCharges: number;
  discount: number;
  taxAmount: number;
  subtotal: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: PaymentStatus;
}

export function calculateInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotalsOutput {
  const baseRent = Math.max(0, Number(input.baseRent) || 0);
  const lateFee = Math.max(0, Number(input.lateFee) || 0);
  const otherCharges = Math.max(0, Number(input.otherCharges) || 0);
  const discount = Math.max(0, Number(input.discount) || 0);
  const taxAmount = Math.max(0, Number(input.taxAmount) || 0);

  const subtotal = Math.max(0, baseRent + lateFee + otherCharges - discount);
  const totalAmount = Math.max(0, subtotal + taxAmount);
  const paidAmount = Math.max(0, Math.min(totalAmount, Number(input.paidAmount) || 0));
  const balanceAmount = Math.max(0, totalAmount - paidAmount);

  let paymentStatus: PaymentStatus = 'UNPAID';
  if (paidAmount >= totalAmount && totalAmount > 0) {
    paymentStatus = 'PAID';
  } else if (paidAmount > 0) {
    paymentStatus = 'PARTIALLY_PAID';
  }

  return {
    baseRent,
    lateFee,
    otherCharges,
    discount,
    taxAmount,
    subtotal,
    totalAmount,
    paidAmount,
    balanceAmount,
    paymentStatus,
  };
}

export function calculateBillingPeriod(
  startDate: Date,
  billingCycle: BillingCycle
): { periodStart: Date; periodEnd: Date; nextDueDate: Date } {
  const periodStart = new Date(startDate);
  const periodEnd = new Date(periodStart);

  let monthsToAdd = 12;
  switch (billingCycle) {
    case 'TRIENNIAL':
      monthsToAdd = 36;
      break;
    case 'ANNUAL':
      monthsToAdd = 12;
      break;
    case 'HALF_YEARLY':
      monthsToAdd = 6;
      break;
    case 'QUARTERLY':
      monthsToAdd = 3;
      break;
    case 'MONTHLY':
      monthsToAdd = 1;
      break;
    case 'CUSTOM':
      monthsToAdd = 12;
      break;
  }

  // Clamp month/year boundaries (e.g. 29 Feb + one year => 28 Feb).
  const day = periodStart.getUTCDate();
  const nextDueDate = new Date(periodStart);
  nextDueDate.setUTCDate(1);
  nextDueDate.setUTCMonth(nextDueDate.getUTCMonth() + monthsToAdd);
  const lastDay = new Date(Date.UTC(nextDueDate.getUTCFullYear(), nextDueDate.getUTCMonth() + 1, 0)).getUTCDate();
  nextDueDate.setUTCDate(Math.min(day, lastDay));
  periodEnd.setTime(nextDueDate.getTime());
  periodEnd.setUTCDate(periodEnd.getUTCDate() - 1);

  return { periodStart, periodEnd, nextDueDate };
}

export function determineDueStatus(dueDate: Date, balanceAmount: number): DueStatus {
  if (balanceAmount <= 0) {
    return 'UPCOMING';
  }

  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  if (!Number.isFinite(dueDate.getTime())) return 'UPCOMING';
  const today = formatter.format(new Date()), dueDay = formatter.format(dueDate);
  return dueDay < today ? 'OVERDUE' : dueDay === today ? 'DUE_TODAY' : 'UPCOMING';
}

import { Sequence } from '../models/Sequence';

export async function generateInvoiceNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const key = `invoice:${currentYear}`;
  const prefix = `INV-${currentYear}-`;

  const sequence = await Sequence.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  let nextSeq = sequence.value;
  let candidate = `${prefix}${String(nextSeq).padStart(6, '0')}`;

  while (await LockerInvoice.exists({ invoiceNumber: candidate })) {
    const bumped = await Sequence.findOneAndUpdate(
      { key },
      { $inc: { value: 1 } },
      { new: true }
    );
    nextSeq = bumped ? bumped.value : nextSeq + 1;
    candidate = `${prefix}${String(nextSeq).padStart(6, '0')}`;
  }

  return candidate;
}
