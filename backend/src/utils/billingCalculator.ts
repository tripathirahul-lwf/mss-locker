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

  periodEnd.setMonth(periodEnd.getMonth() + monthsToAdd);
  // Subtract 1 day so if start is 01-09-2026, end is 31-08-2027
  periodEnd.setDate(periodEnd.getDate() - 1);

  // Next renewal invoice due date is typically the start of the next cycle
  const nextDueDate = new Date(periodEnd);
  nextDueDate.setDate(nextDueDate.getDate() + 1);

  return { periodStart, periodEnd, nextDueDate };
}

export function determineDueStatus(dueDate: Date, balanceAmount: number): DueStatus {
  if (balanceAmount <= 0) {
    return 'UPCOMING';
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

  if (dueDay.getTime() < todayStart.getTime()) {
    return 'OVERDUE';
  } else if (dueDay.getTime() === todayStart.getTime()) {
    return 'DUE_TODAY';
  } else {
    return 'UPCOMING';
  }
}

export async function generateInvoiceNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `INV-${currentYear}-`;

  const lastInvoice = await LockerInvoice.findOne({
    invoiceNumber: { $regex: `^${prefix}` },
  })
    .sort({ invoiceNumber: -1 })
    .select('invoiceNumber')
    .lean();

  let nextSeq = 1;
  if (lastInvoice && lastInvoice.invoiceNumber) {
    const parts = lastInvoice.invoiceNumber.split('-');
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(6, '0')}`;
}
