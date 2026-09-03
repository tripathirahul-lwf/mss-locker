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
    <Card className="rounded-2xl border border-slate-200/90 bg-white shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between p-4 pb-3 sm:p-5 sm:pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-800" />
          <CardTitle className="text-sm font-semibold text-slate-900 tracking-tight">
            System & Infrastructure Telemetry
          </CardTitle>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-8 px-3 text-xs font-medium rounded-xl border-slate-200 flex items-center gap-1.5 cursor-pointer hover:bg-slate-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-emerald-700' : 'text-slate-600'}`} />
          <span>Refresh Status</span>
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-3.5 sm:p-5 sm:pt-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3.5 text-sm">
          {/* API Server Status */}
          <div className="flex min-w-0 items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/90">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-slate-700 shadow-2xs">
                <Server className="w-4 h-4 text-emerald-800" />
              </div>
              <div>
                <p className="text-[10.5px] text-slate-500 font-medium uppercase tracking-wider">Backend API</p>
                <p className="text-xs font-medium text-slate-900 font-mono mt-0.5">
                  {isLoading ? 'Checking...' : isError ? 'Offline / Unreachable' : `v${data?.version || '1.0.0'}`}
                </p>
              </div>
            </div>
            <div>
              {isLoading ? (
                <Badge variant="secondary">Checking</Badge>
              ) : isError ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-rose-50 text-rose-800 border border-rose-200">
                  <AlertCircle className="w-3 h-3 text-rose-600" /> Offline
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> Healthy
                </span>
              )}
            </div>
          </div>

          {/* Database Status */}
          <div className="flex min-w-0 items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/90">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-slate-700 shadow-2xs">
                <Database className="w-4 h-4 text-emerald-800" />
              </div>
              <div>
                <p className="text-[10.5px] text-slate-500 font-medium uppercase tracking-wider">MongoDB Atlas</p>
                <p className="text-xs font-medium text-slate-900 capitalize font-mono mt-0.5">
                  {isLoading
                    ? 'Checking...'
                    : isError
                    ? 'No API response'
                    : data?.database?.status || 'Connected'}
                </p>
              </div>
            </div>
            <div>
              {isLoading ? (
                <Badge variant="secondary">Checking</Badge>
              ) : isDbConnected ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> Ready
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                  <AlertCircle className="w-3 h-3 text-amber-600" /> Standby
                </span>
              )}
            </div>
          </div>

          {/* Environment */}
          <div className="flex min-w-0 items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/90">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-slate-700 shadow-2xs">
                <Activity className="w-4 h-4 text-emerald-800" />
              </div>
              <div>
                <p className="text-[10.5px] text-slate-500 font-medium uppercase tracking-wider">Target Environment</p>
                <p className="text-xs font-medium text-slate-900 capitalize font-mono mt-0.5">
                  {data?.environment || 'Development'}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200 font-mono">
              PWA Mode
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
