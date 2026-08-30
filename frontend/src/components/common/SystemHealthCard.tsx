import { useQuery } from '@tanstack/react-query';
import { Server, Database, Activity, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { fetchHealthStatus } from '../../services/healthService';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export function SystemHealthCard() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['system-health'],
    queryFn: fetchHealthStatus,
    refetchInterval: 30000, // Check every 30 seconds
    retry: 1,
  });

  const isDbConnected = data?.database?.status === 'connected';

  return (
    <Card className="border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between p-4 pb-3 sm:p-5 sm:pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-700" />
          <CardTitle className="text-sm font-semibold text-slate-800">
            System & Infrastructure Status
          </CardTitle>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-2.5 text-xs flex items-center gap-1"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3 text-sm">
          {/* API Server Status */}
          <div className="flex min-w-0 items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded bg-white border border-slate-200 text-slate-700">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Backend API</p>
                <p className="text-xs font-semibold text-slate-800 font-mono">
                  {isLoading ? 'Checking...' : isError ? 'Offline / Unreachable' : `v${data?.version || '1.0.0'}`}
                </p>
              </div>
            </div>
            <div>
              {isLoading ? (
                <Badge variant="secondary">Checking</Badge>
              ) : isError ? (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Offline
                </Badge>
              ) : (
                <Badge variant="success" className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Healthy
                </Badge>
              )}
            </div>
          </div>

          {/* Database Status */}
          <div className="flex min-w-0 items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded bg-white border border-slate-200 text-slate-700">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">MongoDB Atlas</p>
                <p className="text-xs font-semibold text-slate-800 capitalize font-mono">
                  {isLoading
                    ? 'Checking...'
                    : isError
                    ? 'No API response'
                    : data?.database?.status || 'Unknown'}
                </p>
              </div>
            </div>
            <div>
              {isLoading ? (
                <Badge variant="secondary">Checking</Badge>
              ) : isDbConnected ? (
                <Badge variant="success" className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Ready
                </Badge>
              ) : (
                <Badge variant="warning" className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Standby
                </Badge>
              )}
            </div>
          </div>

          {/* Environment */}
          <div className="flex min-w-0 items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded bg-white border border-slate-200 text-slate-700">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Target Environment</p>
                <p className="text-xs font-semibold text-slate-800 capitalize font-mono">
                  {data?.environment || 'Development'}
                </p>
              </div>
            </div>
            <Badge variant="outline">
              PWA Mode
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
