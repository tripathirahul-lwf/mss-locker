import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Archive, CheckCircle2, CircleHelp, Printer, X } from 'lucide-react';
import { LockerClosure } from '../types';
import { lockBodyScroll } from '../../../utils/bodyScrollLock';
import { usePermission } from '../../../hooks/usePermission';
import { Button } from '../../../components/ui/button';

const day = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }) : 'Not recorded';
const timestamp = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded';
const amount = (value?: number) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) : 'Not recorded';
const text = (value?: string) => value?.trim() || 'Not recorded';
const humanize = (value?: string) => value ? value.toLowerCase().replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) : 'Not recorded';

export function CompletedClosureModal({ closure, onClose, onPrint }: { closure: LockerClosure; onClose: () => void; onPrint: (closure: LockerClosure) => void }) {
  const root = useRef<HTMLDivElement>(null), close = useRef(onClose); close.current = onClose;
  const title = useId(), description = useId();
  const canPrint = usePermission('closures.print');
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const release = lockBodyScroll(); root.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]')).at(-1) !== root.current) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close.current(); }
      if (event.key === 'Tab') {
        const buttons = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []).filter(el => el.getClientRects().length);
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root.current)) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => { document.removeEventListener('keydown', keydown, true); release(); if (previous?.isConnected) previous.focus(); };
  }, []);
  const snapshot = closure.financialSnapshot, checklist = closure.physicalChecklist;
  const fields = [
    ['Closing date', day(closure.actualClosureDate)],
    ['Refunded date', closure.refundedDate ? day(closure.refundedDate) : snapshot?.depositRefunded === 0 ? 'No refund recorded' : 'Not recorded'],
    ['Rent billed', amount(snapshot?.totalBilled)], ['Rent paid', amount(snapshot?.totalPaid)],
    ['Rent outstanding', amount(snapshot?.outstandingAtClosure)], ['Deposit required', amount(snapshot?.depositRequired)],
    ['Deposit collected', amount(snapshot?.depositCollected)], ['Deposit deductions', amount(snapshot?.depositDeductions)],
    ['Deposit refunded', amount(snapshot?.depositRefunded)], ['Deposit balance', amount(snapshot?.depositBalanceAtClosure)],
  ];
  const checks = [['Locker emptied', checklist?.lockerEmptied], ['Keys returned', checklist?.customerKeyReturned], ['Locker inspected', checklist?.lockerInspected], ['Access removed', checklist?.physicalAccessRevoked], ['Documents returned', checklist?.documentsReturned]] as const;
  return createPortal(<div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6"><div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={title} aria-describedby={description} className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl outline-none">
    <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-5 sm:px-6"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 id={title} className="break-all text-xl font-bold text-slate-950 sm:text-2xl">{closure.closureNumber || 'Closed locker record'}</h2><span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800"><CheckCircle2 className="h-3.5 w-3.5" />Completed</span></div><p className="mt-2 text-sm text-slate-600">Locker {closure.lockerId?.lockerNumber || 'Not recorded'} &middot; Closed on {day(closure.actualClosureDate)}</p></div><button type="button" aria-label="Close closure details" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-700"><X className="h-5 w-5" /></button></header>
    <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
      <p id={description} className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><Archive className="mt-0.5 h-4 w-4 shrink-0" />Completed tenancy record. The physical locker may have been allotted again. Settlement amounts below are the recorded closure snapshot.</p>
      <div className="grid gap-3 sm:grid-cols-3">{[
        ['Customer', text(closure.customerId?.fullName), text(closure.customerId?.customerCode), text(closure.customerId?.phone)],
        ['Locker', `Locker ${closure.lockerId?.lockerNumber || 'Not recorded'}`, `Size ${closure.lockerId?.size || 'Not recorded'}`, [closure.lockerId?.rackNumber, closure.lockerId?.section, closure.lockerId?.floor].filter(Boolean).join(' ? ') || 'Location not recorded'],
        ['Agreement', text(closure.allocationId?.allocationCode), `Opening date: ${day(closure.allocationId?.startDate)}`, `Condition at closure: ${humanize(checklist?.lockerCondition)}`],
      ].map(([label, value, extra, detail]) => <section key={label} aria-label={label} className="min-w-0 space-y-1.5 rounded-2xl border border-slate-200 p-4"><h3 className="text-sm font-medium text-slate-600">{label}</h3><p className="break-words text-base font-semibold text-slate-950">{value}</p><p className="break-all text-sm text-slate-600">{extra}</p><p className="break-words text-sm text-slate-600">{detail}</p></section>)}</div>
      <section aria-label="Closure financial snapshot" className="rounded-2xl border border-slate-200 p-4"><h3 className="text-base font-semibold text-slate-900">Recorded settlement at closure</h3>{!snapshot && <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No historical settlement snapshot recorded. Missing amounts are not treated as zero.</p>}<dl className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-sm text-slate-600">{label}</dt><dd className="mt-1 break-words text-base font-semibold text-slate-950">{value}</dd></div>)}</dl>{snapshot?.snapshotCapturedAt && <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">Snapshot captured: {timestamp(snapshot.snapshotCapturedAt)}</p>}</section>
      <section className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-semibold text-slate-900">Closure reason</h3><span className="text-xs text-slate-500">{humanize(closure.closureType)}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{text(closure.closureReason)}</p>{closure.notes && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-600">Notes: {closure.notes}</p>}</section>
      <section><h3 className="mb-3 text-base font-semibold text-slate-900">Handover checklist</h3><ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{checks.map(([label, checked]) => <li key={label} className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm">{checked === true ? <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0 text-emerald-700" /> : <CircleHelp aria-hidden className="h-4 w-4 shrink-0 text-amber-700" />}<span>{label}<span className="block text-xs text-slate-500">{checked === true ? 'Confirmed' : checked === false ? 'Not confirmed' : 'Not recorded'}</span></span></li>)}</ul>{checklist?.damageNotes && <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Damage notes: {checklist.damageNotes}</p>}</section>
      <section className="border-t border-slate-200 pt-4"><h3 className="mb-3 text-base font-semibold text-slate-900">Activity record</h3><dl className="space-y-3 text-sm">{[
        ['Requested', closure.requestedBy?.name, closure.requestedAt], ['Reviewed', closure.reviewedBy?.name, closure.reviewedAt], ['Approved', closure.approvedBy?.name, closure.approvedAt], ['Completed', closure.completedBy?.name, closure.completedAt],
      ].filter(([label, name, date]) => label === 'Requested' || label === 'Completed' || name || date).map(([label, name, date]) => <div key={label} className="flex flex-wrap justify-between gap-x-4 gap-y-1"><dt className="text-slate-600">{label} by {text(name)}</dt><dd className="text-slate-700">{timestamp(date)}</dd></div>)}</dl></section>
    </div>
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6"><Button variant="outline" className="min-h-11 rounded-xl" onClick={onClose}>Close</Button>{canPrint && <Button className="min-h-11 gap-2 rounded-xl bg-emerald-800 text-white hover:bg-emerald-900" onClick={() => onPrint(closure)}><Printer className="h-4 w-4" />Print Statement</Button>}</footer>
  </div></div>, document.body);
}
