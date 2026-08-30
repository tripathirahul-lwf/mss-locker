export const ALLOCATION_STATUS_CONFIG = {
  ACTIVE: {
    label: 'Active Tenancy',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    dot: 'bg-emerald-500',
  },
  RESERVED: {
    label: 'On Hold (Reserved)',
    bg: 'bg-amber-50 text-amber-700 border-amber-200/80',
    dot: 'bg-amber-500',
  },
  CLOSED: {
    label: 'Normal Closed',
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
  },
  CANCELLED: {
    label: 'Cancelled Hold',
    bg: 'bg-rose-50 text-rose-700 border-rose-200/80',
    dot: 'bg-rose-500',
  },
} as const;

export const BILLING_CYCLES = [
  { value: 'ANNUAL', label: 'Annual (12 Months)' },
  { value: 'HALF_YEARLY', label: 'Half-Yearly (6 Months)' },
  { value: 'QUARTERLY', label: 'Quarterly (3 Months)' },
  { value: 'MONTHLY', label: 'Monthly (1 Month)' },
] as const;

export const ALLOCATION_TYPES = [
  { value: 'NEW', label: 'New Tenancy Agreement' },
  { value: 'TRANSFER', label: 'Internal Unit Transfer' },
  { value: 'RENEWAL_MIGRATION', label: 'Renewal Migration' },
  { value: 'LEGACY_IMPORT', label: 'Legacy Physical Register Migration' },
] as const;
