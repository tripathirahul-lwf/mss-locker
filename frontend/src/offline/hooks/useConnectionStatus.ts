import { useState,useEffect,useCallback,useRef } from 'react';
const healthUrl = `${(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')}/health/ready`;

export type ConnectionState = 'ONLINE' | 'DEGRADED' | 'OFFLINE';

export function useConnectionStatus() {
  const [browserOnline, setBrowserOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [serverReachable, setServerReachable] = useState<boolean>(true);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const consecutiveFailuresRef = useRef<number>(0);

  const checkHealth = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setBrowserOnline(false);
      setServerReachable(false);
      return;
    }
    try {
      const res = await fetch(healthUrl, { method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(8000) });
      // Readiness requires a healthy API and database, not an HTML fallback or rate-limit response.
      const body = res.ok && res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
      if (res.ok && body?.success === true && body?.readiness === 'ready') {
        consecutiveFailuresRef.current = 0;
        setServerReachable(true);
      } else {
        consecutiveFailuresRef.current += 1;
        if (consecutiveFailuresRef.current >= 2) {
          setServerReachable(false);
        }
      }
    } catch {
      consecutiveFailuresRef.current += 1;
      if (consecutiveFailuresRef.current >= 2) {
        setServerReachable(false);
      }
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
