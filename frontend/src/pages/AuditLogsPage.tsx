import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, ShieldCheck, RefreshCw, AlertCircle, X } from 'lucide-react';
import { auditService } from '../services/auditService';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

export function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { const timer = window.setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 350); return () => window.clearTimeout(timer); }, [search]);
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['audit-logs', page, debouncedSearch],
    queryFn: ({ signal }) => auditService.list({ page, search: debouncedSearch || undefined }, signal),
    placeholderData: keepPreviousData,
  });
  return <div className="space-y-5">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
      <div className="flex items-center gap-4"><div className="h-12 w-12 rounded-lg bg-slate-100 border flex items-center justify-center"><ShieldCheck className="h-6 w-6" /></div><div><h2 className="text-xl font-bold text-slate-900">Security & Audit Logs</h2><p className="text-sm text-slate-500">Operator actions and compliance trail</p></div></div>
      <div className="flex w-full items-center gap-2 sm:w-auto"><div className="relative w-full sm:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"/><Input aria-label="Search audit trail" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search action, operator or entity" className="pl-9 pr-10"/>{search && <button type="button" onClick={() => setSearch('')} className="absolute right-0 top-0 grid h-11 w-11 place-items-center text-slate-400 hover:text-slate-700" aria-label="Clear audit search"><X className="h-4 w-4" /></button>}</div><Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-11 gap-1.5"><RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /><span className="hidden sm:inline">Refresh</span></Button></div>
    </div>
    {isError && <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="h-4 w-4" />{error instanceof Error ? error.message : 'Audit trail could not be loaded.'}</div>}
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Chronological security and operator audit trail</caption><thead className="bg-slate-50 text-slate-600"><tr><th scope="col" className="text-left p-3">Time</th><th scope="col" className="text-left p-3">Action</th><th scope="col" className="text-left p-3">Operator</th><th scope="col" className="text-left p-3">Entity</th><th scope="col" className="text-left p-3">Description</th></tr></thead><tbody>
        {isLoading ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading audit trail…</td></tr> : data?.logs.map((log) => <tr key={log._id} className="border-t border-slate-100"><td className="p-3 whitespace-nowrap text-xs text-slate-500">{new Date(log.createdAt).toLocaleString('en-IN')}</td><td className="p-3 font-mono text-xs font-semibold text-slate-800">{log.action}</td><td className="p-3">{log.actorUserId?.name || log.performedBy?.name || log.actorUsername || 'SYSTEM'}</td><td className="p-3 text-slate-600">{log.module || log.entityType || '—'}</td><td className="p-3 text-slate-600 max-w-md">{log.description || 'Recorded system event'}</td></tr>)}
        {!isLoading && !data?.logs.length && <tr><td colSpan={5} className="p-8 text-center text-slate-500">No audit records found.</td></tr>}
      </tbody></table></div>
      <div className="p-3 border-t flex items-center justify-between"><span className="text-xs text-slate-500">{data?.pagination.total || 0} records</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page >= (data?.pagination.totalPages || 1)} onClick={() => setPage((p) => p + 1)}>Next</Button></div></div>
    </div>
  </div>;
}
