import React, { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useConnectionStatus } from '../../offline/hooks/useConnectionStatus';
import { useOfflineSync } from '../../offline/hooks/useOfflineSync';
import { cn } from '../../lib/utils';

export interface NetworkStatusBadgeProps {
  className?: string;
  showText?: boolean;
}

export function NetworkStatusBadge({
  className,
  showText = true,
}: NetworkStatusBadgeProps) {
  const { status, isOnline, isDegraded, isOffline } = useConnectionStatus();
  const { syncStatus, isSyncing, lastSyncedAt, syncNow } = useOfflineSync();
  const [popoverOpen, setPopoverOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setPopoverOpen(!popoverOpen)}
        title={
          isOnline
            ? 'Network: Online. Click to view sync details.'
            : isDegraded
            ? 'Network: Degraded (Server unreachable)'
            : 'Network: Offline (Operating from local cache)'
        }
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all select-none cursor-pointer',
          isOnline
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            : isDegraded
            ? 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse'
            : 'bg-rose-50 text-rose-800 border-rose-300 animate-pulse',
          className
        )}
      >
        <span
          className={cn(
            'w-2 h-2 rounded-full',
            isOnline
              ? 'bg-emerald-600'
              : isDegraded
              ? 'bg-amber-600'
              : 'bg-rose-600'
          )}
        />
        {isOnline ? (
          isSyncing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
          ) : (
            <Wifi className="w-3.5 h-3.5" />
          )
        ) : isDegraded ? (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-rose-600" />
        )}
        {showText && (
          <span className="font-semibold uppercase tracking-wider text-[10px]">
            {isSyncing ? 'Syncing...' : status}
          </span>
        )}
      </button>

      {/* Sync Status Popover */}
      {popoverOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setPopoverOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 z-50 space-y-3 text-xs animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-900">
                PWA Offline Sync Status
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isOnline
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {status}
              </span>
            </div>

            <div className="space-y-1 text-slate-600 text-[11px]">
              <div>
                <strong>Local Cache:</strong> IndexedDB (Dexie) Active
              </div>
              <div>
                <strong>Last Full Sync:</strong>{' '}
                {lastSyncedAt
                  ? new Date(lastSyncedAt).toLocaleString('en-IN')
                  : 'Just now'}
              </div>
              <div>
                <strong>Write Policy:</strong> Online Auth Required
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                await syncNow();
              }}
              disabled={isSyncing || isOffline}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`}
              />
              {isSyncing ? 'Syncing with Atlas...' : 'Sync Now'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
