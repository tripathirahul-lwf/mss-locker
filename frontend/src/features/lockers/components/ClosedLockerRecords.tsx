import { Archive,ArrowRight,CalendarDays,Phone,RefreshCw,UserRound } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { closureApi } from '../../closures/api/closureApi';
import { ClosureDetailModal } from '../../closures/components/ClosureDetailModal';
import { ClosureStatementModal } from '../../closures/components/ClosureStatementModal';
import { LockerClosure } from '../../closures/types';
import { Button } from '../../../components/ui/button';
import { ledgerDate,money } from './OccupiedLockerSummary';

export function ClosedLockerRecords({ search, size, page, onPage }: { search: string; size?: string; page: number; onPage: (page: number) => void }) {
  const { user, permissions, hasPermission } = useAuth();
  const canView = hasPermission('closures.view');
  const [selected, setSelected] = useState<string | null>(null), [statement, setStatement] = useState<LockerClosure | null>(null);
  const records = useQuery({ queryKey: ['closed-locker-records', { search, size, page }], queryFn: () => closureApi.getClosures({ status: 'COMPLETED', search: search.trim() || undefined, size, page, limit: 12, sortBy: 'actualClosureDate', sortOrder: 'desc' }), enabled: canView, staleTime: 0 });
  const detail = useQuery({ queryKey: ['closure', selected], queryFn: () => closureApi.getClosureById(selected!), enabled: canView && !!selected, staleTime: 0 });
  return <section aria-label="Closed locker records" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div><h2 className="text-xl font-bold text-slate-950">Closed locker records</h2><p className="mt-1 text-sm text-slate-600">Completed customer tenancies. The physical locker may have been allotted again.</p></div>{canView && <Button variant="outline" onClick={() => void records.refetch()} disabled={records.isFetching} className="gap-2 rounded-xl text-sm"><RefreshCw className={`h-4 w-4 ${records.isFetching ? 'animate-spin' : ''}`} />Refresh closed records</Button>}</div>
    {!canView ? <p role="alert">You do not have access to closed locker records.</p> : records.isError ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-800">Could not load closed records. <button className="underline" onClick={() => void records.refetch()}>Retry</button></p> : records.isLoading ? <p role="status">Loading closed records...</p> : <>
      <p className="text-sm text-slate-600">{records.data?.pagination.total || 0} completed closure record{records.data?.pagination.total === 1 ? '' : 's'}</p>
      {!records.data?.closures.length ? <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">No closed locker records match these filters.</p> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{records.data.closures.map(record => <article key={record._id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-lg font-bold text-slate-950">Locker {record.lockerId?.lockerNumber || 'Not recorded'}</h3><p className="mt-1 text-xs text-slate-500">Size {record.lockerId?.size || 'Not recorded'} &middot; {record.lockerId?.rackNumber || 'Rack not recorded'}</p></div><span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"><Archive className="h-3 w-3" />Closed</span></div>
        <div className="my-5 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><UserRound className="h-5 w-5" /></span><div className="min-w-0"><p className="break-words text-base font-semibold text-slate-950">{record.customerId?.fullName || 'Customer not recorded'}</p><p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600"><Phone className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="break-all">{record.customerId?.phone || 'Phone not recorded'}</span></p></div></div>
        <dl className="space-y-3 border-t border-slate-100 pt-4 text-sm"><div className="flex justify-between gap-3"><dt className="flex items-center gap-1.5 text-slate-600"><CalendarDays className="h-3.5 w-3.5" />Closing date</dt><dd className="text-right font-medium text-slate-900">{ledgerDate(record.actualClosureDate)}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-600">Deposit refunded</dt><dd className="text-right font-semibold text-emerald-800">{Number.isFinite(record.financialSnapshot?.depositRefunded) ? money(record.financialSnapshot!.depositRefunded) : 'Not recorded'}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-600">Refunded date</dt><dd className="text-right font-medium text-slate-900">{record.refundedDate ? ledgerDate(record.refundedDate) : record.financialSnapshot?.depositRefunded === 0 ? 'No refund' : 'Not recorded'}</dd></div></dl>
        <div className="mt-auto pt-4"><p className="mb-3 break-all text-xs text-slate-500">{record.closureNumber}</p><Button variant="outline" className="w-full justify-between rounded-xl text-sm" onClick={() => setSelected(record._id)}>View closed record<ArrowRight className="ml-2 h-4 w-4" /></Button></div>
      </article>)}</div>}
      {(records.data?.pagination.totalPages || 0) > 1 && <div className="flex items-center justify-center gap-4"><Button variant="outline" disabled={page <= 1 || records.isFetching} onClick={() => onPage(page - 1)}>Previous closed records</Button><span>Page {page} of {records.data?.pagination.totalPages}</span><Button variant="outline" disabled={page >= (records.data?.pagination.totalPages || 1) || records.isFetching} onClick={() => onPage(page + 1)}>Next closed records</Button></div>}
    </>}
    {selected && detail.isLoading && <p role="status">Loading closed record...</p>}
    {selected && detail.isError && <p role="alert">Could not load this closed record. <button className="underline" onClick={() => void detail.refetch()}>Retry record</button><button className="ml-3 underline" onClick={() => setSelected(null)}>Dismiss</button></p>}
    {selected && detail.data && !detail.isError && !statement && <ClosureDetailModal isOpen closure={detail.data} userPermissions={permissions} currentUserId={user?.id} onClose={() => setSelected(null)} onRefresh={() => { void detail.refetch(); void records.refetch(); }} onPrint={setStatement} />}
    {statement && <ClosureStatementModal isOpen closure={statement} onClose={() => setStatement(null)} />}
  </section>;
}
