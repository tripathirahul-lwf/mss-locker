export type ClosureType =
  | 'NORMAL'
  | 'CUSTOMER_REQUEST'
  | 'NON_RENEWAL'
  | 'TRANSFER'
  | 'ADMINISTRATIVE'
  | 'LEGACY_IMPORT';

export type ClosureStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'PENDING_SETTLEMENT'
  | 'READY_FOR_CLOSURE'
  | 'APPROVED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export type LockerCondition =
  | 'GOOD'
  | 'MINOR_DAMAGE'
  | 'DAMAGED'
  | 'KEY_ISSUE'
  | 'OTHER';

export interface PhysicalChecklist {
  lockerEmptied: boolean;
  lockerInspected: boolean;
  lockerCondition: LockerCondition;
  customerKeyReturned: boolean;
  masterKeyCheckCompleted: boolean;
  documentsReturned: boolean;
  physicalAccessRevoked: boolean;
  damageNotes?: string;
  keyReplacementRequired?: boolean;
}

export interface ClosureFinancialSnapshot {
  totalInvoices: number;
  totalBilled: number;
  totalPaid: number;
  outstandingAtClosure: number;
  depositRequired: number;
  depositCollected: number;
  depositDeductions: number;
  depositRefunded: number;
  depositBalanceAtClosure: number;
  snapshotCapturedAt: string;
}

export interface LockerClosure {
  _id: string;
  closureNumber: string;
  allocationId: {
    _id: string;
    allocationCode: string;
    startDate: string;
    endDate?: string;
    annualRent: number;
    securityDeposit: number;
    billingCycle: string;
    status: string;
  };
  customerId: {
    _id: string;
    fullName: string;
    customerCode: string;
    phone: string;
    address?: string;
    city?: string;
    state?: string;
    photoUrl?: string;
    status: string;
  };
  lockerId: {
    _id: string;
    lockerNumber: string;
    size: string;
    rackNumber: string;
    section?: string;
    floor?: string;
    status: string;
    operationalStatus: string;
  };
  closureType: ClosureType;
  closureReason: string;
  status: ClosureStatus;
  requestedClosureDate: string;
  actualClosureDate?: string;
  financialSnapshot?: ClosureFinancialSnapshot;
  physicalChecklist: PhysicalChecklist;
  settlementNotes?: string;
  notes?: string;

  requestedBy: {
    _id: string;
    name: string;
    username: string;
  };
  requestedAt: string;

  reviewedBy?: {
    _id: string;
    name: string;
    username: string;
  };
  reviewedAt?: string;
  reviewNotes?: string;

  approvedBy?: {
    _id: string;
    name: string;
    username: string;
  };
  approvedAt?: string;
  approvalNotes?: string;

  completedBy?: {
    _id: string;
    name: string;
    username: string;
  };
  completedAt?: string;
  completionNotes?: string;

  rejectedBy?: {
    _id: string;
    name: string;
    username: string;
  };
  rejectedAt?: string;
  rejectionReason?: string;

  cancelledBy?: {
    _id: string;
    name: string;
    username: string;
  };
  cancelledAt?: string;
  cancellationReason?: string;

  overrideFinancial?: boolean;
  overrideReason?: string;

  createdAt: string;
  updatedAt: string;
}

export interface ClosureReadinessSummary {
  allocationId: string;
  allocationCode: string;
  startDate: string;
  paidThroughDate?: string;

  totalInvoicesCount: number;
  totalBilledAmount: number;
  totalPaidAmount: number;
  outstandingInvoicesCount: number;
  outstandingInvoiceAmount: number;
  openInvoices: {
    _id: string;
    invoiceNumber: string;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    dueDate: string;
  }[];

  depositRequired: number;
  netDepositHeld: number;
  totalDeductions: number;
  totalRefunded: number;
  pendingRefundsCount: number;
  pendingRefundAmount: number;
  availableRefundableBalance: number;

  checklistComplete: boolean;
  missingChecklistItems: string[];

  isFinanciallyCleared: boolean;
  isReadyForApproval: boolean;
  blockers: string[];
}

export interface ClosureStats {
  pendingReview: number;
  pendingSettlement: number;
  readyForClosure: number;
  approved: number;
  completedToday: number;
  completedThisMonth: number;
  rejected: number;
  totalCount: number;
}

export interface ClosureQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ClosureStatus | 'ALL';
  closureType?: ClosureType | 'ALL';
  customerId?: string;
  lockerId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
