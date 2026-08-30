import { useState, useEffect, useCallback } from 'react';
import { offlineSyncService } from '../services/offline-sync.service';
import { useConnectionStatus } from './useConnectionStatus';

export function useOfflineSync() {
  const { isOnline } = useConnectionStatus();
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SYNCING' | 'SUCCESS' | 'FAILED'>('IDLE');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const loadMetadata = useCallback(async () => {
    const meta = await offlineSyncService.getLastSyncMetadata();
    if (meta?.lastSuccessfulSyncAt) {
      setLastSyncedAt(meta.lastSuccessfulSyncAt);
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!isOnline) return false;
    setSyncStatus('SYNCING');
    const success = await offlineSyncService.syncIncremental();
    setSyncStatus(success ? 'SUCCESS' : 'FAILED');
    await loadMetadata();
    setTimeout(() => setSyncStatus('IDLE'), 3000);
    return success;
  }, [isOnline, loadMetadata]);

  // Initial load
  useEffect(() => {
    loadMetadata();
    if (isOnline) {
      offlineSyncService.hydrateInitialCache().then(() => loadMetadata());
    }
  }, [isOnline, loadMetadata]);

  // Auto-sync when reconnecting
  useEffect(() => {
    if (isOnline) {
      syncNow();
    }
  }, [isOnline, syncNow]);

  return {
    syncStatus,
    isSyncing: syncStatus === 'SYNCING',
    lastSyncedAt,
    syncNow,
  };
}
