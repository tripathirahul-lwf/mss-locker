import Dexie, { Table } from 'dexie';

export interface OfflineLocker {
  id: string;
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
  isActive: boolean;
  updatedAt: string;
}

export interface OfflineCustomer {
  id: string;
  customerCode: string;
  fullName: string;
  phone: string;
  photoUrl?: string;
  status: string;
  kycStatus: string;
  updatedAt: string;
}

export interface OfflineAllocation {
  id: string;
  allocationCode: string;
  customerId: string;
  lockerId: string;
  status: string;
  startDate: string;
  nextRenewalDueDate?: string;
  paidThroughDate?: string;
  annualRent: number;
  securityDeposit: number;
  updatedAt: string;
}

export interface OfflineRenewalSummary {
  id: string;
  allocationId: string;
  customerId: string;
  lockerId: string;
  invoiceNumber: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: string;
  dueStatus: string;
  updatedAt: string;
}

export interface OfflinePaymentSummary {
  id: string;
  receiptNumber: string;
  paymentNumber: string;
  customerId: string;
  lockerId: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  paymentStatus: string;
  updatedAt: string;
}

export interface OfflineDashboardCache {
  key: string;
  data: any;
  lastSyncedAt: string;
}

export interface OfflineSyncMetadata {
  key: string;
  lastSyncCursor: string;
  lastSuccessfulSyncAt: string;
  lastAttemptAt: string;
  status: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'FAILED';
  error?: string;
  ownerId?: string;
  permissionsHash?: string;
  cacheExpiresAt?: string;
}

export class VaultLedgerOfflineDatabase extends Dexie {
  lockers!: Table<OfflineLocker, string>;
  customers!: Table<OfflineCustomer, string>;
  allocations!: Table<OfflineAllocation, string>;
  renewalSummaries!: Table<OfflineRenewalSummary, string>;
  paymentSummaries!: Table<OfflinePaymentSummary, string>;
  dashboardCache!: Table<OfflineDashboardCache, string>;
  syncMetadata!: Table<OfflineSyncMetadata, string>;

  constructor() {
    super('vault-ledger-offline');

    // Schema definition for version 1
    this.version(1).stores({
      lockers: 'id, lockerNumber, lockerCode, size, rackNumber, status, operationalStatus, updatedAt',
      customers: 'id, customerCode, fullName, phone, status, kycStatus, updatedAt',
      allocations: 'id, allocationCode, customerId, lockerId, status, nextRenewalDueDate, updatedAt',
      renewalSummaries: 'id, allocationId, customerId, lockerId, invoiceNumber, dueDate, paymentStatus, dueStatus, updatedAt',
      paymentSummaries: 'id, receiptNumber, paymentNumber, customerId, lockerId, paymentDate, paymentStatus, updatedAt',
      dashboardCache: 'key, lastSyncedAt',
      syncMetadata: 'key, lastSuccessfulSyncAt',
    });

    this.version(2).stores({
      lockers: 'id, lockerNumber, lockerCode, size, rackNumber, status, operationalStatus, updatedAt',
      customers: 'id, customerCode, fullName, phone, status, kycStatus, updatedAt',
      allocations: 'id, allocationCode, customerId, lockerId, status, nextRenewalDueDate, updatedAt',
      renewalSummaries: 'id, allocationId, customerId, lockerId, invoiceNumber, dueDate, paymentStatus, dueStatus, updatedAt',
      paymentSummaries: 'id, receiptNumber, paymentNumber, customerId, lockerId, paymentDate, paymentStatus, updatedAt',
      dashboardCache: 'key, lastSyncedAt',
      syncMetadata: 'key, ownerId, lastSuccessfulSyncAt',
    });
  }
}

export const offlineDb = new VaultLedgerOfflineDatabase();
