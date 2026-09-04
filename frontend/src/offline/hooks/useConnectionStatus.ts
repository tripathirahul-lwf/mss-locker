import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../services/apiClient';

export type ConnectionState = 'ONLINE' | 'DEGRADED' | 'OFFLINE';

export function useConnectionStatus() {
  const [browserOnline, setBrowserOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [serverReachable, setServerReachable] = useState<boolean>(true);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const checkHealth = useCallback(async () => {
    if (!navigator.onLine) {
      setServerReachable(false);
      return;
    }
    try {
      const res = await fetch('/api/health', { method: 'GET', cache: 'no-store' });
      setServerReachable(res.ok);
    } catch {
      setServerReachable(false);
    } finally {
      setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setBrowserOnline(true);
      checkHealth();
    };

    const handleOffline = () => {
      setBrowserOnline(false);
      setServerReachable(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    checkHealth();

    // Periodic lightweight reachability check every 45s
    const interval = setInterval(checkHealth, 45000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkHealth]);

  let status: ConnectionState = 'ONLINE';
  if (!browserOnline) {
    status = 'OFFLINE';
  } else if (!serverReachable) {
    status = 'DEGRADED';
  }

  return {
    status,
    isOnline: status === 'ONLINE',
    isDegraded: status === 'DEGRADED',
    isOffline: status === 'OFFLINE',
    lastChecked,
    checkHealth,
  };
}
