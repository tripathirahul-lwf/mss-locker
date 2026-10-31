import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { closureApi } from '../../closures/api/closureApi';
import { ClosureDetailModal } from '../../closures/components/ClosureDetailModal';
import { ClosureStatementModal } from '../../closures/components/ClosureStatementModal';
import { LockerClosure } from '../../closures/types';
import { Button } from '../../../components/ui/button';
import { ledgerDate, money } from './OccupiedLockerSummary';

export function ClosedLockerRecords({ search, size, page, onPage }: { search: string; size?: string; page: number; onPage: (page: number) => void }) {
  const { user, permissions, hasPermission } = useAuth();
  const canView = hasPermission('closures.view');
  const [selected, setSelected] = useState<string | null>(null), [statement, setStatement] = useState<LockerClosure | null>(null);
  const records = useQuery({ queryKey: ['closed-locker-records', { search, size, page }], queryFn: () => closureApi.getClosures({ status: 'COMPLETED', search: search.trim() || undefined, size, page, limit: 12, sortBy: 'actualClosureDate', sortOrder: 'desc' }), enabled: canView, staleTime: 0 });
  const detail = useQuery({ queryKey: ['closure', selected], queryFn: () => closureApi.getClosureById(selected!), enabled: canView && !!selected, staleTime: 0 });
  return <section aria-label="Closed locker records" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-950">Closed locker records</h2><p className="mt-1 text-sm text-slate-600">Completed customer tenancies. The physical locker may have been allotted again.</p></div>{canView && <Button variant="outline" onClick={() => void records.refetch()} disabled={records.isFetching}>Refresh closed records</Button>}</div>
    {!canView ? <p role="alert">You do not have access to closed locker records.</p> : records.isError ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-800">Could not load closed records. <button className="underline" onClick={() => void records.refetch()}>Retry</button></p> : records.isLoading ? <p role="status">Loading closed records...</p> : <>
      <p className="text-sm text-slate-600">{records.data?.pagination.total || 0} completed closure records</p>
      {!records.data?.closures.length ? <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">No closed locker records match these filters.</p> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{records.data.closures.map(record => <article key={record._id} className="space-y-4 rounded-2xl border border-slate-300 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xl font-bold text-slate-950">Locker {record.lockerId?.lockerNumber || 'Not recorded'}</h3><span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-800">Closed</span></div>
        <p className="text-sm text-slate-600">Size {record.lockerId?.size || 'Not recorded'} &middot; {record.lockerId?.rackNumber || 'Rack not recorded'}</p>
        <div><p className="text-lg font-bold text-slate-950">{record.customerId?.fullName || 'Customer not recorded'}</p><p className="break-all text-sm text-slate-600">{record.customerId?.phone || 'Phone not recorded'}</p></div>
        <dl className="space-y-2 text-sm"><div className="flex justify-between gap-2"><dt>Closing date</dt><dd className="font-semibold">{ledgerDate(record.actualClosureDate)}</dd></div><div className="flex justify-between gap-2"><dt>Deposit refunded</dt><dd className="font-semibold">{Number.isFinite(record.financialSnapshot?.depositRefunded) ? money(record.financialSnapshot!.depositRefunded) : 'Not recorded'}</dd></div></dl>
        <p className="break-all text-xs text-slate-500">{record.closureNumber}</p><Button variant="outline" className="w-full rounded-xl" onClick={() => setSelected(record._id)}>View closed record</Button>
      </article>)}</div>}
      {(records.data?.pagination.totalPages || 0) > 1 && <div className="flex items-center justify-center gap-4"><Button variant="outline" disabled={page <= 1 || records.isFetching} onClick={() => onPage(page - 1)}>Previous closed records</Button><span>Page {page} of {records.data?.pagination.totalPages}</span><Button variant="outline" disabled={page >= (records.data?.pagination.totalPages || 1) || records.isFetching} onClick={() => onPage(page + 1)}>Next closed records</Button></div>}
    </>}
    {selected && detail.isLoading && <p role="status">Loading closed record...</p>}
    {selected && detail.isError && <p role="alert">Could not load this closed record. <button className="underline" onClick={() => void detail.refetch()}>Retry record</button><button className="ml-3 underline" onClick={() => setSelected(null)}>Dismiss</button></p>}
    {selected && detail.data && !detail.isError && !statement && <ClosureDetailModal isOpen closure={detail.data} userPermissions={permissions} currentUserId={user?.id} onClose={() => setSelected(null)} onRefresh={() => { void detail.refetch(); void records.refetch(); }} onPrint={setStatement} />}
    {statement && <ClosureStatementModal isOpen closure={statement} onClose={() => setStatement(null)} />}
  </section>;
}
