import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { usePermission } from '../../../hooks/usePermission';
import { allocationApi } from '../../allocations/api/allocationApi';
import { closureApi } from '../../closures/api/closureApi';
import { LockerCondition } from '../../closures/types';
import { Button } from '../../../components/ui/button';
import { money } from './OccupiedLockerSummary';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function CloseLockerModal({ allocationId, onClose, onSuccess, onDeposits, onPayments }: { allocationId: string; onClose: () => void; onSuccess: () => void; onDeposits: () => void; onPayments: (id?: string) => void }) {
  const [date, setDate] = useState(today), [notes, setNotes] = useState(''), [confirmed, setConfirmed] = useState(false);
  const [condition, setCondition] = useState<LockerCondition>('GOOD'), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false), root = useRef<HTMLDivElement>(null), live = useRef({ busy, onClose }); live.current = { busy, onClose };
  const canView = usePermission('closures.view'), canDeposits = usePermission('deposits.view');
  const canCreate = usePermission('closures.create'), canPay = usePermission('payments.create'), canViewInvoices = usePermission('renewals.view');
  const allocation = useQuery({ queryKey: ['allocation', allocationId], queryFn: () => allocationApi.getAllocationById(allocationId), staleTime: 0 });
  const readiness = useQuery({ queryKey: ['closure-readiness', allocationId], queryFn: () => closureApi.getClosureReadiness(allocationId), enabled: canView, staleTime: 0 });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; root.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]')).at(-1) !== root.current) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); if (!live.current.busy) live.current.onClose(); }
      if (event.key === 'Tab') {
        const controls = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)') || []).filter(el => el.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current || !root.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root.current || !root.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => { document.removeEventListener('keydown', handler, true); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  const a = allocation.data, r = readiness.data;
  const openingDay = a?.startDate && Number.isFinite(Date.parse(a.startDate)) ? a.startDate.slice(0, 10) : '';
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date && date <= today() && !!a && !!openingDay && date >= openingDay;
  const validSummary = !!r && r.allocationId === allocationId && [r.depositRequired, r.depositCollected, r.depositCredits, r.netDepositHeld, r.totalDeductions, r.totalRefunded, r.pendingRefundAmount, r.availableRefundableBalance, r.totalBilledAmount, r.totalPaidAmount, r.outstandingInvoiceAmount].every(value => Number.isFinite(value) && value >= 0) && r.pendingRefundAmount <= r.netDepositHeld + .001 && Math.abs(Math.max(0, r.netDepositHeld - r.pendingRefundAmount) - r.availableRefundableBalance) < .011;
  const currentDetails = canView && !allocation.isError && !readiness.isError && !allocation.isFetching && !readiness.isFetching;
  const ready = canCreate && !!a && a._id === allocationId && a.status === 'ACTIVE' && validSummary && currentDetails;
  const usable = validSummary && currentDetails;
  const refundStatus = !usable ? 'Unavailable' : r.pendingRefundAmount > 0 ? 'Refund approval/payment pending' : r.netDepositHeld > 0 ? 'Refund or settlement pending' : r.totalRefunded > 0 && r.totalDeductions > 0 ? 'Settled by refund and deductions' : r.totalRefunded > 0 ? 'Refunded' : r.totalDeductions > 0 ? 'Settled by deductions' : r.depositCollected + r.depositCredits === 0 && r.depositRequired > 0 ? 'No deposit collection recorded' : 'No refund due';
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (lock.current || busy || !ready || !confirmed || !validDate) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await closureApi.createClosure({ allocationId, requestedClosureDate: date, closureReason: notes.trim().length >= 3 ? notes.trim() : 'Customer requested locker closure', notes: notes.trim() || undefined, submitForReview: true, physicalChecklist: { lockerEmptied: true, lockerInspected: true, customerKeyReturned: true, documentsReturned: true, physicalAccessRevoked: true, lockerCondition: condition } });
      onSuccess();
    } catch (err: any) {
      if (err.response?.status === 409 || !err.response || err.response?.status >= 500) {
        try {
          const records = await closureApi.getClosures({ allocationId, limit: 100 });
          const existing = records.closures.find(item => !['CANCELLED', 'REJECTED'].includes(item.status));
          if (existing) { onSuccess(); return; }
        } catch { /* Keep the original save error visible when recovery cannot be confirmed. */ }
      }
      setError(err.response?.data?.message || err.message || 'Could not confirm the closure request. Reload the locker before trying again.');
    }
    finally { lock.current = false; setBusy(false); }
  };
  const inputClass = 'mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-lg text-slate-950 disabled:opacity-70';
  return createPortal(<div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6"><div ref={root} role="dialog" aria-modal="true" aria-labelledby="close-locker-title" tabIndex={-1} className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl outline-none">
    <header className="flex items-start justify-between gap-3 px-5 pt-6 sm:px-8"><div><h2 id="close-locker-title" className="text-3xl font-extrabold text-slate-950">Close Locker {a?.lockerId?.lockerNumber || ''}</h2><p className="mt-3 text-base text-slate-600">{a?.customerId?.fullName || 'Loading customer...'} &middot; {condition === 'GOOD' ? 'After settlement and approval, the locker becomes vacant and this customer record appears under Closed.' : 'After settlement and approval, the customer record appears under Closed. This locker remains unavailable for repair.'}</p></div><button type="button" aria-label="Dismiss closure" disabled={busy} onClick={onClose} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"><X /></button></header>
    <form onSubmit={submit} className="flex min-h-0 flex-col"><div className="space-y-5 overflow-y-auto px-5 py-6 sm:px-8">
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-800">{error}</p>}
      {(!canView || allocation.isError || readiness.isError) && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-amber-950">{!canView ? 'Closure ledger access is required to review settlement.' : 'Could not load current closure details.'}{canView && <button type="button" className="ml-2 underline" onClick={() => { void allocation.refetch(); void readiness.refetch(); }}>Retry</button>}</p>}
      {(allocation.isLoading || canView && readiness.isLoading) && <p role="status">Loading closure details...</p>}
      {a && a.status !== 'ACTIVE' && <p role="alert">This agreement is no longer active. Reload the locker.</p>}
      {!canCreate && <p role="alert">Closure creation permission is required.</p>}
      {r && !validSummary && !readiness.isError && !readiness.isFetching && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-800">Settlement data needs review. <button type="button" className="underline" onClick={() => void readiness.refetch()}>Retry settlement</button></p>}
      <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2">
        <label className="font-bold text-slate-900">Closing date<input type="date" required value={date} min={openingDay || undefined} max={today()} onChange={e => setDate(e.target.value)} className={inputClass} /></label>
        <label className="font-bold text-slate-900">Deposit refund (INR)<input aria-label="Deposit refund (INR)" readOnly value={usable && r && Number.isFinite(r.availableRefundableBalance) ? r.availableRefundableBalance.toFixed(2) : ''} placeholder="Loading ledger..." className={inputClass + ' bg-slate-50'} /><span className="mt-1 block text-xs font-normal text-slate-600">Available refundable balance from the deposit ledger.</span></label>
        <label className="font-bold text-slate-900">Refund status<select aria-label="Refund status" disabled value={refundStatus} className={inputClass}><option>{refundStatus}</option></select><span className="mt-1 block text-xs font-normal text-slate-600">Updates after an actual refund or settlement is recorded.</span></label>
        <label className="font-bold text-slate-900">Reason / notes (optional)<textarea maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} rows={2} /></label>
        <label className="font-semibold text-slate-900">Locker condition<select aria-label="Locker condition" value={condition} onChange={e => setCondition(e.target.value as LockerCondition)} className={inputClass}><option value="GOOD">Good</option><option value="MINOR_DAMAGE">Minor damage</option><option value="DAMAGED">Damaged</option><option value="KEY_ISSUE">Key issue</option></select></label>
        <label className="flex items-start gap-3 self-center rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-emerald-700" /><span>I confirm the locker is empty and inspected, keys and documents are returned, and access is removed.</span></label>
      </fieldset>
      {usable && r && <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700"><span>Outstanding rent: <strong>{money(r.outstandingInvoiceAmount)}</strong></span>{r.outstandingInvoiceAmount > 0 && canPay && canViewInvoices && <Button type="button" variant="outline" disabled={busy} onClick={() => onPayments(r.openInvoices[0]?._id)}>Settle rent</Button>}{(r.netDepositHeld > 0 || r.pendingRefundAmount > 0) && canDeposits && <Button type="button" variant="outline" disabled={busy} onClick={onDeposits}>Manage refund</Button>}</div>}
      {usable && r?.financialBlockers?.length ? <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-semibold">Settlement required before approval</p><ul className="mt-2 list-disc space-y-1 pl-5">{r.financialBlockers.map(message => <li key={message}>{message}</li>)}</ul></div> : null}
      {date && !validDate && openingDay && <p className="text-sm text-rose-800">Closing date must be between {openingDay} and {today()}.</p>}
      {ready && !confirmed && <p className="text-sm text-slate-600">Confirm the physical handover checklist to enable submission.</p>}
      {condition !== 'GOOD'  && <p className="text-sm text-amber-900">The locker will remain unavailable for maintenance after closure.</p>}
      <p className="text-sm text-slate-600">Confirming submits the closure for review. Financial settlement and approval must finish before the locker is released.</p>
    </div><footer className="flex shrink-0 flex-wrap gap-3 border-t border-slate-200 px-5 py-4 sm:px-8"><Button type="submit" disabled={busy || !ready || !confirmed || !validDate} className="min-h-12 rounded-2xl bg-red-600 px-6 text-base font-bold text-white hover:bg-red-700">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Submitting...' : 'Confirm close'}</Button><Button type="button" variant="secondary" disabled={busy} onClick={onClose} className="min-h-12 rounded-2xl px-6 text-base font-semibold">Back</Button></footer></form>
  </div></div>, document.body);
}
