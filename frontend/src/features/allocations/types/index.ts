export type AllocationStatus = 'ACTIVE' | 'RESERVED' | 'CLOSED' | 'CANCELLED';
export type AllocationType = 'NEW' | 'TRANSFER' | 'RENEWAL_MIGRATION' | 'LEGACY_IMPORT';
export type BillingCycle = 'ANNUAL' | 'HALF_YEARLY' | 'QUARTERLY' | 'MONTHLY';

export interface AllocationCustomer {
  _id: string;
  fullName: string;
  customerCode: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  kycStatus: 'PENDING' | 'PARTIAL' | 'VERIFIED' | 'REJECTED';
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  photoUrl?: string;
}

export interface AllocationLocker {
  _id: string;
  lockerNumber: string;
  lockerCode: string;
  size: string;
  rackNumber: string;
  section?: string;
  floor?: string;
  position?: string;
  annualRent: number;
  securityDeposit: number;
  status: 'VACANT' | 'OCCUPIED' | 'RESERVED' | 'BLOCKED';
  operationalStatus: 'ACTIVE' | 'MAINTENANCE' | 'DAMAGED' | 'DECOMMISSIONED';
}

export interface LockerAllocation {
  _id: string;
  allocationCode: string;
  customerId: AllocationCustomer;
  lockerId: AllocationLocker;
  startDate: string;
  endDate?: string;
  billingCycle: BillingCycle;
  annualRent: number;
  securityDeposit: number;
  rentSnapshot: number;
  depositSnapshot: number;
  status: AllocationStatus;
  allocationType: AllocationType;
  reservationExpiresAt?: string;
  paidThroughDate?: string;
  nextRenewalDueDate?: string;
  lastRenewedAt?: string;
  remarks?: string;
  createdBy?: { _id: string; name: string; username: string };
  updatedBy?: { _id: string; name: string; username: string };
  activatedAt?: string;
  activatedBy?: { _id: string; name: string; username: string };
  cancelledAt?: string;
  cancelledBy?: { _id: string; name: string; username: string };
  closedAt?: string;
  closedBy?: { _id: string; name: string; username: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreateAllocationInput {
  customerId: string;
  lockerId: string;
  startDate?: string;
  endDate?: string;
  billingCycle?: BillingCycle;
  annualRent?: number;
  securityDeposit?: number;
  allocationType?: AllocationType;
  remarks?: string;
}

export interface ReserveLockerInput {
  customerId: string;
  lockerId: string;
  startDate?: string;
  reservationExpiresAt?: string;
  billingCycle?: BillingCycle;
  annualRent?: number;
  securityDeposit?: number;
  remarks?: string;
}

export interface UpdateAllocationInput {
  remarks?: string;
  billingCycle?: BillingCycle;
  endDate?: string;
  expectedUpdatedAt?: string;
}

export interface AllocationQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: AllocationStatus | 'ALL';
  customerId?: string;
  lockerId?: string;
  size?: string;
  rackNumber?: string;
  startDateFrom?: string;
  startDateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AllocationStats {
  total: number;
  active: number;
  reserved: number;
  closed: number;
  cancelled: number;
}
