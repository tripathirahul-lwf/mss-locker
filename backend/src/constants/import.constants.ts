export const IMPORT_TYPES = {
  FULL_MIGRATION: 'FULL_MIGRATION',
  LOCKERS: 'LOCKERS',
  CUSTOMERS: 'CUSTOMERS',
  ALLOCATIONS: 'ALLOCATIONS',
  RENEWAL_HISTORY: 'RENEWAL_HISTORY',
  LEGACY_IMPORT: 'LEGACY_IMPORT',
} as const;

export type ImportType = typeof IMPORT_TYPES[keyof typeof IMPORT_TYPES];

export const IMPORT_STATUSES = {
  UPLOADED: 'UPLOADED',
  VALIDATING: 'VALIDATING',
  READY: 'READY',
  IMPORTING: 'IMPORTING',
  COMPLETED: 'COMPLETED',
  COMPLETED_WITH_ERRORS: 'COMPLETED_WITH_ERRORS',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  ROLLED_BACK: 'ROLLED_BACK',
} as const;

export type ImportStatus = typeof IMPORT_STATUSES[keyof typeof IMPORT_STATUSES];

export const IMPORT_ROW_STATUSES = {
  VALID: 'VALID',
  WARNING: 'WARNING',
  INVALID: 'INVALID',
  DUPLICATE: 'DUPLICATE',
} as const;

export type ImportRowStatus = typeof IMPORT_ROW_STATUSES[keyof typeof IMPORT_ROW_STATUSES];

export const IMPORT_MODES = {
  INSERT_ONLY: 'INSERT_ONLY',
  UPSERT_SAFE: 'UPSERT_SAFE',
} as const;

export type ImportMode = typeof IMPORT_MODES[keyof typeof IMPORT_MODES];

// Standard Sheet Name Matching Aliases
export const SHEET_ALIASES: Record<string, string[]> = {
  lockers: ['lockers', 'locker', 'lockers master', 'locker master', 'locker_master', 'units', 'sheet1'],
  renewal_history: ['renewal history', 'renewal_history', 'renewals', 'renewal', 'invoices', 'billing history', 'bills'],
  customers: ['customers', 'customer', 'customer roster', 'members', 'tenants'],
};

// Column Aliases Mapping for Lockers Sheet
export const LOCKER_COLUMN_ALIASES: Record<string, string[]> = {
  lockerNumber: ['locker number', 'locker no', 'locker no.', 'locker_no', 'lockerno', 'locker #', 'unit no', 'locker'],
  size: ['locker size', 'size', 'type', 'category', 'locker type'],
  rackNumber: ['rack number', 'rack no', 'rack no.', 'rack_no', 'rackno', 'rack', 'rack #'],
  section: ['section', 'wing', 'vault section', 'room'],
  floor: ['floor', 'level', 'floor level'],
  annualRent: ['annual rent', 'rent', 'rent per year', 'annual tariff', 'tariff', 'yearly rent'],
  securityDeposit: ['security deposit', 'deposit', 'caution money', 'caution deposit', 'sd'],
  status: ['status', 'occupancy status', 'occupancy', 'current status'],
  operationalStatus: ['operational status', 'operational', 'condition', 'op status'],
  masterKeyReference: ['master key reference', 'master key', 'key number', 'master key ref', 'key ref'],

  // Customer in Locker row (if all-in-one template)
  customerName: ['customer name', 'name', 'tenant name', 'allottee name', 'client name'],
  customerCode: ['customer code', 'customer id', 'cust code', 'cust id', 'member id', 'client code'],
  phone: ['phone', 'mobile', 'phone number', 'contact no', 'mobile number', 'cell'],
  alternatePhone: ['alternate phone', 'alt phone', 'emergency phone', 'alt mobile'],
  email: ['email', 'email address', 'mail'],
  address: ['address', 'residence address', 'contact address'],
  city: ['city', 'town'],
  idType: ['id type', 'id proof', 'identity type', 'kyc id type', 'document type'],
  idNumber: ['id number', 'id no', 'id proof number', 'kyc number', 'aadhaar', 'pan'],

  // Agreement / Tenancy in Locker row
  startDate: ['start date', 'allotment date', 'allocation date', 'agreement date', 'from date'],
  renewalDueDate: ['renewal due date', 'due date', 'expiry date', 'next due date', 'valid upto', 'paid upto'],
};

// Column Aliases Mapping for Renewal History Sheet
export const RENEWAL_COLUMN_ALIASES: Record<string, string[]> = {
  lockerNumber: ['locker number', 'locker no', 'locker no.', 'locker_no', 'lockerno', 'locker #', 'locker'],
  customerName: ['customer name', 'name', 'tenant name', 'allottee name'],
  customerCode: ['customer code', 'cust code', 'customer id'],
  allocationCode: ['allocation code', 'agreement code', 'agreement no', 'allotment code', 'allocation id'],
  legacyInvoiceNumber: ['invoice number', 'invoice no', 'invoice no.', 'bill no', 'bill number', 'receipt no'],
  periodStart: ['billing period start', 'period start', 'from date', 'period from', 'start date'],
  periodEnd: ['billing period end', 'period end', 'to date', 'period to', 'end date'],
  dueDate: ['due date', 'renewal due date', 'payment due date'],
  totalAmount: ['total amount', 'total', 'bill amount', 'invoice amount', 'rent amount', 'amount'],
  paidAmount: ['paid amount', 'amount paid', 'paid'],
  paymentStatus: ['payment status', 'status', 'pay status', 'paid/unpaid'],
  paymentDate: ['payment date', 'paid on', 'collection date'],
  paymentMethod: ['payment method', 'mode', 'payment mode', 'mode of payment'],
};

// Locker Status Normalization
export const normalizeLockerStatus = (val: string): 'VACANT' | 'OCCUPIED' | 'RESERVED' | 'BLOCKED' => {
  const clean = (val || '').trim().toUpperCase();
  if (['VACANT', 'AVAILABLE', 'FREE', 'UNOCCUPIED', 'EMPTY'].includes(clean)) return 'VACANT';
  if (['OCCUPIED', 'ALLOTTED', 'ASSIGNED', 'ACTIVE', 'RENTED', 'BOOKED'].includes(clean)) return 'OCCUPIED';
  if (['RESERVED', 'HOLD', 'BLOCKED FOR ALLOCATION'].includes(clean)) return 'RESERVED';
  if (['BLOCKED', 'MAINTENANCE', 'DAMAGED', 'UNDER MAINTENANCE', 'OUT OF SERVICE'].includes(clean)) return 'BLOCKED';
  return 'VACANT';
};

// Locker Size Normalization
export const normalizeLockerSize = (val: string): string => {
  const clean = (val || '').trim().toUpperCase().replace(/[\s-_]/g, '');
  if (['A', 'SIZEA'].includes(clean)) return 'A';
  if (['B', 'SIZEB'].includes(clean)) return 'B';
  if (['C', 'SIZEC'].includes(clean)) return 'C';
  if (['D', 'SIZED'].includes(clean)) return 'D';
  if (['E', 'SIZEE'].includes(clean)) return 'E';
  if (['F', 'SIZEF'].includes(clean)) return 'F';
  if (['G', 'SIZEG'].includes(clean)) return 'G';
  if (['G1', 'SIZEG1'].includes(clean)) return 'G1';
  if (['G2', 'SIZEG2'].includes(clean)) return 'G2';
  return clean || 'STD';
};
