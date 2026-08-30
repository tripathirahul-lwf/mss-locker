export type PaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CARD' | 'CHEQUE' | 'OTHER';
export type PaymentStatus = 'COMPLETED' | 'PENDING' | 'FAILED' | 'CANCELLED';
export type PaymentSource = 'COUNTER' | 'MANUAL_ENTRY' | 'LEGACY_IMPORT' | 'SYSTEM';

export interface PaymentCustomer {
  _id: string;
  fullName: string;
  customerCode: string;
  phone: string;
  photoUrl?: string;
  address?: string;
  city?: string;
  state?: string;
}

export interface PaymentLocker {
  _id: string;
  lockerNumber: string;
  lockerCode?: string;
  size: string;
  rackNumber: string;
  section?: string;
  floor?: string;
}

export interface PaymentInvoice {
  _id: string;
  invoiceNumber: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  baseRent?: number;
  lateFee?: number;
  taxAmount?: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: string;
}

export interface Payment {
  _id: string;
  paymentNumber: string;
  receiptNumber: string;
  idempotencyKey?: string;

  customerId?: PaymentCustomer;
  allocationId?: {
    _id: string;
    allocationCode: string;
    startDate: string;
    billingCycle?: string;
  };
  lockerId?: PaymentLocker;
  invoiceId?: PaymentInvoice;

  amount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;

  transactionReference?: string;
  bankReference?: string;
  upiReference?: string;
  chequeNumber?: string;
  bankName?: string;
  chequeDate?: string;

  paymentDate: string;
  receivedAt: string;

  source: PaymentSource;
  legacyReference?: string;
  notes?: string;

  recordedBy?: {
    _id: string;
    name: string;
    username: string;
  };

  cancelledAt?: string;
  cancelledBy?: {
    _id: string;
    name: string;
    username: string;
  };
  cancellationReason?: string;

  createdAt: string;
  updatedAt: string;
}

export interface PaymentStats {
  todayCollection: { amount: number; count: number };
  monthCollection: { amount: number; count: number };
  cashToday: { amount: number; count: number };
  digitalToday: { amount: number; count: number };
  totalTransactions: number;
}

export interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate?: string;
  transactionReference?: string;
  bankReference?: string;
  upiReference?: string;
  chequeNumber?: string;
  bankName?: string;
  chequeDate?: string;
  notes?: string;
}

export interface PaymentQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  paymentMethod?: PaymentMethod | 'ALL';
  paymentStatus?: PaymentStatus | 'ALL';
  customerId?: string;
  lockerId?: string;
  invoiceId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
