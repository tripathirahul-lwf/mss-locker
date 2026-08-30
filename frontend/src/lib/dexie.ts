import Dexie, { type Table } from 'dexie';

export interface OfflineSyncQueueItem {
  id?: number;
  entityType: 'locker' | 'customer' | 'allocation' | 'payment';
  action: 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
  createdAt: string;
  synced: boolean;
}

export interface CachedMetadataItem {
  key: string;
  value: unknown;
  updatedAt: string;
}

export class VaultLedgerDatabase extends Dexie {
  syncQueue!: Table<OfflineSyncQueueItem, number>;
  metadataCache!: Table<CachedMetadataItem, string>;

  constructor() {
    super('VaultLedgerDB');
    this.version(1).stores({
      syncQueue: '++id, entityType, action, synced, createdAt',
      metadataCache: '&key, updatedAt',
    });
  }
}

export const offlineDb = new VaultLedgerDatabase();
