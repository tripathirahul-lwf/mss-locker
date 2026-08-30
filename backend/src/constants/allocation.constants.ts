export const ALLOCATION_STATUS = {
  ACTIVE: 'ACTIVE',
  RESERVED: 'RESERVED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;

export type AllocationStatus = typeof ALLOCATION_STATUS[keyof typeof ALLOCATION_STATUS];

export const ALLOCATION_TYPE = {
  NEW: 'NEW',
  TRANSFER: 'TRANSFER',
  RENEWAL_MIGRATION: 'RENEWAL_MIGRATION',
  LEGACY_IMPORT: 'LEGACY_IMPORT',
} as const;

export type AllocationType = typeof ALLOCATION_TYPE[keyof typeof ALLOCATION_TYPE];

export const BILLING_CYCLE = {
  ANNUAL: 'ANNUAL',
  HALF_YEARLY: 'HALF_YEARLY',
  QUARTERLY: 'QUARTERLY',
  MONTHLY: 'MONTHLY',
} as const;

export type BillingCycle = typeof BILLING_CYCLE[keyof typeof BILLING_CYCLE];
