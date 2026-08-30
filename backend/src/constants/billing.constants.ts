export type InvoiceType = 'NEW_ALLOCATION' | 'RENEWAL' | 'ADJUSTMENT' | 'LEGACY_IMPORT';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
export type DueStatus = 'UPCOMING' | 'DUE_TODAY' | 'OVERDUE';
export type BillingCycle = 'ANNUAL' | 'HALF_YEARLY' | 'QUARTERLY' | 'MONTHLY' | 'CUSTOM';
export type InvoiceSource = 'SYSTEM' | 'MANUAL' | 'LEGACY_IMPORT';

export const INVOICE_TYPES: { value: InvoiceType; label: string }[] = [
  { value: 'NEW_ALLOCATION', label: 'Initial Tenancy Allocation' },
  { value: 'RENEWAL', label: 'Recurring Tenancy Renewal' },
  { value: 'ADJUSTMENT', label: 'Tariff Adjustment' },
  { value: 'LEGACY_IMPORT', label: 'Historical Ledger Import' },
];

export const PAYMENT_STATUSES: { value: PaymentStatus; label: string }[] = [
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
  { value: 'PAID', label: 'Paid in Full' },
];

export const DUE_STATUSES: { value: DueStatus; label: string }[] = [
  { value: 'UPCOMING', label: 'Upcoming' },
  { value: 'DUE_TODAY', label: 'Due Today' },
  { value: 'OVERDUE', label: 'Overdue' },
];

export const BILLING_CYCLES: { value: BillingCycle; label: string; months: number }[] = [
  { value: 'ANNUAL', label: 'Annual (12 Months)', months: 12 },
  { value: 'HALF_YEARLY', label: 'Half-Yearly (6 Months)', months: 6 },
  { value: 'QUARTERLY', label: 'Quarterly (3 Months)', months: 3 },
  { value: 'MONTHLY', label: 'Monthly (1 Month)', months: 1 },
  { value: 'CUSTOM', label: 'Custom Tenure', months: 0 },
];
