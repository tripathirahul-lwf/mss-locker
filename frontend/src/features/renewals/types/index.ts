export type InvoiceType = 'NEW_ALLOCATION' | 'RENEWAL' | 'ADJUSTMENT' | 'LEGACY_IMPORT';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
export type DueStatus = 'UPCOMING' | 'DUE_TODAY' | 'OVERDUE';
export type BillingCycle = 'ANNUAL' | 'HALF_YEARLY' | 'QUARTERLY' | 'MONTHLY' | 'CUSTOM';
export type InvoiceSource = 'SYSTEM' | 'MANUAL' | 'LEGACY_IMPORT';

export interface LockerInvoice {
  _id: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  allocationId?: {
    _id: string;
    allocationCode: string;
    startDate: string;
    status: string;
  };
  customerId?: {
    _id: string;
    customerCode: string;
    fullName: string;
    phone: string;
    photoUrl?: string;
  };
  lockerId?: {
    _id: string;
    lockerNumber: string;
    lockerCode?: string;
    size: string;
    rackNumber: string;
    section?: string;
  };

  billingPeriodStart: string;
  billingPeriodEnd: string;
  issueDate: string;
  dueDate: string;
  billingCycle: BillingCycle;

  baseRent: number;
  lateFee: number;
  discount: number;
  otherCharges: number;
  taxAmount: number;
  subtotal: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;

  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
  dueStatus: DueStatus;
  source: InvoiceSource;

  legacyReference?: string;
  legacyInvoiceNumber?: string;
  notes?: string;
  cancellationReason?: string;
  cancelledBy?: {
    _id: string;
    name: string;
  };
  cancelledAt?: string;

  createdBy?: {
    _id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface RenewalStats {
  totalInvoices: number;
  dueToday: { count: number; amount: number };
  dueThisWeek: { count: number; amount: number };
  dueThisMonth: { count: number; amount: number };
  overdue: { count: number; amount: number };
  paidThisMonth: { count: number; amount: number };
  totalOutstanding: { count: number; amount: number };
}

export interface InvoiceQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  invoiceType?: InvoiceType;
  status?: InvoiceStatus;
  paymentStatus?: PaymentStatus;
  dueStatus?: DueStatus | 'DUE_THIS_MONTH' | 'DUE_THIS_WEEK';
  billingCycle?: BillingCycle;
  customerId?: string;
  lockerId?: string;
  allocationId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onlyOutstanding?: boolean | string;
}

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
}
