import React from 'react';
import { WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { useConnectionStatus } from '../hooks/useConnectionStatus';
import { useOfflineSync } from '../hooks/useOfflineSync';

export const OfflineBanner: React.FC = () => {
  const { isOffline, isDegraded, checkHealth } = useConnectionStatus();
  const { lastSyncedAt, isSyncing } = useOfflineSync();

  if (!isOffline && !isDegraded) return null;

  return (
    <div className="w-full bg-amber-500 text-amber-950 px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-xs sticky top-0 z-[90] border-b border-amber-600/30 select-none">
      <div className="flex items-center gap-2">
        {isOffline ? (
          <WifiOff className="w-4 h-4 text-amber-950 shrink-0" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-950 shrink-0" />
        )}
        <span>
          <strong>
            {isOffline ? 'Offline Mode Active:' : 'Degraded Connection:'}
          </strong>{' '}
          Operating with safe local cached records. Critical financial actions and modifications are disabled.
        </span>
        {lastSyncedAt && (
          <span className="hidden md:inline-block font-mono text-[11px] opacity-80">
            &bull; Last synced:{' '}
            {new Date(lastSyncedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>

      <button
        onClick={() => checkHealth()}
        disabled={isSyncing}
        className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 rounded-lg text-amber-950 transition-colors cursor-pointer text-[11px] font-bold"
      >
        <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
        Check Connection
      </button>
    </div>
  );
};
