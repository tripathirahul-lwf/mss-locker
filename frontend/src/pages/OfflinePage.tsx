import { WifiOff, RefreshCw, Database, ShieldCheck } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Link } from 'react-router-dom';

export function OfflinePage() {
  const { isOnline } = useNetworkStatus();

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-[600px] flex items-center justify-center p-4">
      <Card className="max-w-xl w-full border-slate-200 shadow-md">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3">
            <WifiOff className="w-8 h-8" />
          </div>
          <CardTitle className="text-xl font-bold text-slate-900">
            {isOnline ? 'Connection Restored' : 'No Internet Connection'}
          </CardTitle>
          <CardDescription className="text-sm text-slate-600 max-w-md mx-auto mt-1">
            {isOnline
              ? 'Your device is back online. You can now synchronize with the cloud database.'
              : 'MSS Locker is running in offline mode. Cached read-only functions remain available until the connection returns.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs text-slate-700">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Database className="w-4 h-4 text-sky-600" />
              <span>Offline Capabilities Status</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li>IndexedDB local storage is active for local records.</li>
              <li>Locker directory and cached customer records remain accessible.</li>
              <li>Transactions performed offline will queue for automatic sync upon reconnection.</li>
            </ul>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-center gap-2 text-xs text-emerald-800">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>PWA Service Worker is actively safeguarding your local state.</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Button onClick={handleRetry} className="w-full flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4" />
              <span>Retry Connection</span>
            </Button>
            <Link to="/" className="w-full">
              <Button variant="outline" className="w-full">
                Continue to Offline Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
