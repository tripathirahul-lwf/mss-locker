import { apiClient } from '../../services/apiClient';
import { offlineDb } from '../db/database';

export interface OfflineSearchMatch {
  customers: {
    _id: string;
    customerCode: string;
    fullName: string;
    phone: string;
    photoUrl?: string;
    kycStatus: string;
    status: string;
  }[];
  lockers: {
    _id: string;
    lockerNumber: string;
    lockerCode: string;
    size: string;
    rackNumber: string;
    status: string;
    operationalStatus: string;
  }[];
  allocations: {
    _id: string;
    allocationCode: string;
    status: string;
    customerName: string;
    customerCode: string;
    lockerNumber: string;
  }[];
}

export class OfflineSyncService {
  private isSyncing = false;

  async bindUser(userId: string, permissions: string[]): Promise<void> {
    const current = await offlineDb.syncMetadata.get('global_sync');
    const permissionsHash = [...permissions].sort().join('|');
    const expired = current?.cacheExpiresAt
      ? new Date(current.cacheExpiresAt).getTime() <= Date.now()
      : false;
    if ((current?.ownerId && current.ownerId !== userId) || current?.permissionsHash !== permissionsHash || expired) {
      await this.clearUserCache();
    }
    const fresh = await offlineDb.syncMetadata.get('global_sync');
    await offlineDb.syncMetadata.put({
      key: 'global_sync',
      lastSyncCursor: fresh?.lastSyncCursor || '',
      lastSuccessfulSyncAt: fresh?.lastSuccessfulSyncAt || '',
      lastAttemptAt: new Date().toISOString(),
      status: 'IDLE',
      ownerId: userId,
      permissionsHash,
      cacheExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  /**
   * Executes incremental sync with backend
   */
  async syncIncremental(): Promise<boolean> {
    if (this.isSyncing) return false;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;

    this.isSyncing = true;

    try {
      // 1. Get last cursor
      const meta = await offlineDb.syncMetadata.get('global_sync');
      const cursor = meta?.lastSyncCursor;

      await offlineDb.syncMetadata.put({
        key: 'global_sync',
        lastSyncCursor: cursor || '',
        lastSuccessfulSyncAt: meta?.lastSuccessfulSyncAt || '',
        lastAttemptAt: new Date().toISOString(),
        status: 'SYNCING',
        ownerId: meta?.ownerId,
        permissionsHash: meta?.permissionsHash,
        cacheExpiresAt: meta?.cacheExpiresAt,
      });

      // 2. Fetch every deterministic cursor page. A hard ceiling prevents a
      // malformed server response from creating an infinite client loop.
      let pageCursor = cursor;
      for (let page = 0; page < 100; page += 1) {
      const response = await apiClient.get('/sync', {
        params: { cursor: pageCursor || undefined },
      });

      const { data, serverTime, nextCursor, hasMore, allowedScopes = [] } = response.data.data;

      // 3. Atomically update IndexedDB
      await offlineDb.transaction(
        'rw',
        [
          offlineDb.lockers,
          offlineDb.customers,
          offlineDb.allocations,
          offlineDb.renewalSummaries,
          offlineDb.paymentSummaries,
          offlineDb.syncMetadata,
        ],
        async () => {
          // Remove records immediately when a user's role no longer allows that domain.
          if (!allowedScopes.includes('lockers')) await offlineDb.lockers.clear();
          if (!allowedScopes.includes('customers')) await offlineDb.customers.clear();
          if (!allowedScopes.includes('allocations')) await offlineDb.allocations.clear();
          if (!allowedScopes.includes('renewalSummaries')) await offlineDb.renewalSummaries.clear();
          if (!allowedScopes.includes('payments')) await offlineDb.paymentSummaries.clear();
          if (data.deleted?.lockers?.length) await offlineDb.lockers.bulkDelete(data.deleted.lockers);
          if (data.deleted?.customers?.length) await offlineDb.customers.bulkDelete(data.deleted.customers);
          if (data.deleted?.allocations?.length) await offlineDb.allocations.bulkDelete(data.deleted.allocations);
          if (data.deleted?.renewalSummaries?.length) await offlineDb.renewalSummaries.bulkDelete(data.deleted.renewalSummaries);
          if (data.deleted?.payments?.length) await offlineDb.paymentSummaries.bulkDelete(data.deleted.payments);
          if (data.lockers?.length > 0) {
            await offlineDb.lockers.bulkPut(data.lockers);
          }
          if (data.customers?.length > 0) {
            await offlineDb.customers.bulkPut(data.customers);
          }
          if (data.allocations?.length > 0) {
            await offlineDb.allocations.bulkPut(data.allocations);
          }
          if (data.renewalSummaries?.length > 0) {
            await offlineDb.renewalSummaries.bulkPut(data.renewalSummaries);
          }
          if (data.payments?.length > 0) {
            await offlineDb.paymentSummaries.bulkPut(data.payments);
          }

          await offlineDb.syncMetadata.put({
            key: 'global_sync',
            lastSyncCursor: nextCursor || serverTime,
            lastSuccessfulSyncAt: serverTime,
            lastAttemptAt: new Date().toISOString(),
            status: 'SUCCESS',
            ownerId: meta?.ownerId,
            permissionsHash: meta?.permissionsHash,
            cacheExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          });
        }
      );
      pageCursor = nextCursor;
      if (!hasMore) break;
      if (page === 99) throw new Error('Sync pagination safety limit reached');
      }

      // 4. Update dashboard cache
      this.syncDashboard().catch((err) => console.warn('Dashboard sync skipped:', err));

      return true;
    } catch (err: any) {
      console.warn('Offline sync attempt failed:', err);
      const meta = await offlineDb.syncMetadata.get('global_sync');
      await offlineDb.syncMetadata.put({
        key: 'global_sync',
        lastSyncCursor: meta?.lastSyncCursor || '',
        lastSuccessfulSyncAt: meta?.lastSuccessfulSyncAt || '',
        lastAttemptAt: new Date().toISOString(),
        status: 'FAILED',
        error: err.message || 'Sync failed',
        ownerId: meta?.ownerId,
        permissionsHash: meta?.permissionsHash,
        cacheExpiresAt: meta?.cacheExpiresAt,
      });
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Syncs lightweight dashboard metrics
   */
  async syncDashboard(): Promise<void> {
    try {
      const response = await apiClient.get('/sync/dashboard');
      if (response.data?.data) {
        await offlineDb.dashboardCache.put({
          key: 'main_dashboard',
          data: response.data.data.metrics,
          lastSyncedAt: response.data.data.cachedAt || new Date().toISOString(),
        });
      }
    } catch (err) {
      // Non-fatal
    }
  }

  /**
   * Initial hydration on login or app open
   */
  async hydrateInitialCache(): Promise<void> {
    const count = await offlineDb.lockers.count();
    if (count === 0) {
      await this.syncIncremental();
    }
  }

  /**
   * Gets last sync timestamp and status
   */
  async getLastSyncMetadata() {
    return await offlineDb.syncMetadata.get('global_sync');
  }

  /**
   * Clears all user data from IndexedDB upon logout
   */
  async clearUserCache(): Promise<void> {
    try {
      await offlineDb.transaction(
        'rw',
        [
          offlineDb.lockers,
          offlineDb.customers,
          offlineDb.allocations,
          offlineDb.renewalSummaries,
          offlineDb.paymentSummaries,
          offlineDb.dashboardCache,
          offlineDb.syncMetadata,
        ],
        async () => {
          await offlineDb.lockers.clear();
          await offlineDb.customers.clear();
          await offlineDb.allocations.clear();
          await offlineDb.renewalSummaries.clear();
          await offlineDb.paymentSummaries.clear();
          await offlineDb.dashboardCache.clear();
          await offlineDb.syncMetadata.clear();
        }
      );
    } catch (err) {
      console.error('Error clearing offline cache on logout:', err);
    }
  }

  /**
   * Performs offline search against local Dexie tables
   */
  async searchOffline(query: string): Promise<OfflineSearchMatch> {
    const clean = query.trim().toLowerCase();
    if (!clean || clean.length < 2) {
      return { customers: [], lockers: [], allocations: [] };
    }

    const [matchedCustomers, matchedLockers, matchedAllocations] = await Promise.all([
      offlineDb.customers
        .filter(
          (c) =>
            c.fullName.toLowerCase().includes(clean) ||
            c.customerCode.toLowerCase().includes(clean) ||
            c.phone.includes(clean)
        )
        .limit(6)
        .toArray(),

      offlineDb.lockers
        .filter(
          (l) =>
            l.lockerNumber.toLowerCase().includes(clean) ||
            l.lockerCode.toLowerCase().includes(clean) ||
            l.rackNumber.toLowerCase().includes(clean)
        )
        .limit(6)
        .toArray(),

      offlineDb.allocations
        .filter((a) => a.allocationCode.toLowerCase().includes(clean))
        .limit(6)
        .toArray(),
    ]);

    return {
      customers: matchedCustomers.map((c) => ({
        _id: c.id,
        customerCode: c.customerCode,
        fullName: c.fullName,
        phone: c.phone,
        photoUrl: c.photoUrl,
        kycStatus: c.kycStatus,
        status: c.status,
      })),
      lockers: matchedLockers.map((l) => ({
        _id: l.id,
        lockerNumber: l.lockerNumber,
        lockerCode: l.lockerCode,
        size: l.size,
        rackNumber: l.rackNumber,
        status: l.status,
        operationalStatus: l.operationalStatus,
      })),
      allocations: matchedAllocations.map((a) => ({
        _id: a.id,
        allocationCode: a.allocationCode,
        status: a.status,
        customerName: 'Cached Customer',
        customerCode: '',
        lockerNumber: '',
      })),
    };
  }
}

export const offlineSyncService = new OfflineSyncService();
