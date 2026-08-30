export type LockerStatus = 'VACANT' | 'RESERVED' | 'OCCUPIED' | 'BLOCKED';
export type OperationalStatus = 'ACTIVE' | 'MAINTENANCE' | 'DAMAGED' | 'DECOMMISSIONED';

export interface LockerSizeItem {
  code: string;
  label: string;
  dimensions: string;
  defaultRent: number;
  defaultDeposit: number;
  sortOrder: number;
}

export interface Locker {
  _id: string;
  lockerNumber: string;
  lockerCode: string;
  size: string;
  rackNumber: string;
  section?: string;
  floor?: string;
  position?: string;
  masterKeyReference?: string;
  annualRent: number;
  securityDeposit: number;
  status: LockerStatus;
  operationalStatus: OperationalStatus;
  remarks?: string;
  isActive: boolean;
  createdBy?: {
    _id: string;
    name: string;
    username: string;
  };
  updatedBy?: {
    _id: string;
    name: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LockerStats {
  total: number;
  vacant: number;
  reserved: number;
  occupied: number;
  blocked: number;
  active: number;
  maintenance: number;
  damaged: number;
  decommissioned: number;
  availableForAllocation: number;
  sizeBreakdown: Record<
    string,
    {
      total: number;
      vacant: number;
      occupied: number;
      reserved: number;
      blocked: number;
    }
  >;
}

export interface LockerQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  size?: string;
  status?: string;
  operationalStatus?: string;
  rackNumber?: string;
  section?: string;
  isActive?: boolean;
  compact?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateLockerInput {
  lockerNumber: string;
  lockerCode?: string;
  size: string;
  rackNumber: string;
  section?: string;
  floor?: string;
  position?: string;
  masterKeyReference?: string;
  annualRent: number;
  securityDeposit: number;
  status?: LockerStatus;
  operationalStatus?: OperationalStatus;
  remarks?: string;
}

export interface UpdateLockerInput {
  lockerNumber?: string;
  lockerCode?: string;
  size?: string;
  rackNumber?: string;
  section?: string;
  floor?: string;
  position?: string;
  masterKeyReference?: string;
  annualRent?: number;
  securityDeposit?: number;
  status?: LockerStatus;
  operationalStatus?: OperationalStatus;
  remarks?: string;
  isActive?: boolean;
  expectedUpdatedAt?: string;
}

export interface PaginatedLockersResponse {
  lockers: Locker[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
