export interface SearchCustomerItem {
  _id: string;
  customerCode: string;
  fullName: string;
  phone: string;
  photoUrl?: string;
  kycStatus: string;
  status: string;
}

export interface SearchLockerItem {
  _id: string;
  lockerNumber: string;
  lockerCode: string;
  size: string;
  rackNumber: string;
  status: string;
  operationalStatus: string;
}

export interface SearchAllocationItem {
  _id: string;
  allocationCode: string;
  status: string;
  customerName: string;
  customerCode: string;
  lockerNumber: string;
}

export interface SearchInvoiceItem {
  _id: string;
  invoiceNumber: string;
  dueDate: string;
  totalAmount: number;
  balanceAmount: number;
  paymentStatus: string;
  customerName: string;
  lockerNumber: string;
}

export interface SearchPaymentItem {
  _id: string;
  paymentNumber: string;
  receiptNumber: string;
  amount: number;
  paymentDate: string;
  customerName: string;
  lockerNumber: string;
}

export interface GlobalSearchResultData {
  customers: SearchCustomerItem[];
  lockers: SearchLockerItem[];
  allocations: SearchAllocationItem[];
  invoices: SearchInvoiceItem[];
  payments: SearchPaymentItem[];
}

export interface ActiveLockerSummary {
  allocationId: string;
  allocationCode: string;
  startDate: string;
  paidThroughDate?: string;
  nextRenewalDueDate?: string;
  billingCycle: string;
  annualRent: number;
  securityDeposit: number;
  status: string;

  lockerId: string;
  lockerNumber: string;
  lockerCode: string;
  size: string;
  rackNumber: string;
  section?: string;
  floor?: string;

  outstandingAmount: number;
  openInvoicesCount: number;
  currentDueDate?: string;

  depositHeld: number;
  depositDeductions: number;
  depositRefunded: number;
  availableRefundableBalance: number;

  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  lastReceiptNumber?: string;
}

export interface CustomerQuickPreviewData {
  customer: {
    _id: string;
    customerCode: string;
    fullName: string;
    phone: string;
    alternatePhone?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    photoUrl?: string;
    kycStatus: string;
    status: string;
  };
  activeLockers: ActiveLockerSummary[];
  totalActiveLockers: number;
  totalCombinedOutstanding: number;
  recentPayments: {
    _id: string;
    paymentNumber: string;
    receiptNumber: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    lockerNumber: string;
  }[];
  hasPastAllocations: boolean;
  closureHistoryCount: number;
}

export interface CustomerRenewalHistoryInvoice {
  _id: string;
  invoiceNumber: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: string;
  lockerNumber: string;
  allocationCode: string;
}

export interface CustomerRenewalHistoryResponse {
  invoices: CustomerRenewalHistoryInvoice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LockerQuickPreviewData {
  locker: {
    _id: string;
    lockerNumber: string;
    lockerCode: string;
    size: string;
    rackNumber: string;
    section?: string;
    floor?: string;
    status: string;
    operationalStatus: string;
    annualRent: number;
    securityDeposit: number;
    masterKeyReference?: string;
    remarks?: string;
  };
  currentTenant?: {
    customerId: string;
    fullName: string;
    customerCode: string;
    phone: string;
    photoUrl?: string;
    kycStatus: string;
    customerStatus: string;
    allocationCode: string;
    startDate: string;
    paidThroughDate?: string;
    nextRenewalDueDate?: string;
  } | null;
  dues?: {
    outstandingAmount: number;
    openInvoicesCount: number;
  } | null;
  isAvailableForAllocation: boolean;
}
