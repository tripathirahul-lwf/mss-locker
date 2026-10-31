import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, RotateCw, ShieldCheck, Undo2, X } from 'lucide-react';
import { allocationApi } from '../../allocations/api/allocationApi';
import { LockerAllocation } from '../../allocations/types';
import { BillingCycle, GenerateRenewalInput } from '../types';
import { Button } from '../../../components/ui/button';
import { ledgerDate, money } from '../../lockers/components/OccupiedLockerSummary';

const months: Record<BillingCycle, number> = { ANNUAL: 12, TRIENNIAL: 36, HALF_YEARLY: 6, QUARTERLY: 3, MONTHLY: 1, CUSTOM: 12 };
const day = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString().slice(0, 10) : '';
function nextDate(start: string, cycle: BillingCycle) {
  if (!start || !Number.isFinite(Date.parse(start))) return '';
  const date = new Date(start + 'T00:00:00Z'), dateOfMonth = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + months[cycle]);
  date.setUTCDate(Math.min(dateOfMonth, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()));
  return day(date.toISOString());
}
const startFor = (a?: LockerAllocation | null) => day(a?.nextRenewalDueDate) || (day(a?.endDate) ? day(new Date(Date.parse(day(a?.endDate)) + 86400000).toISOString()) : '');
const annualBase = (a?: LockerAllocation | null) => { const value = a?.rentSnapshot ?? a?.annualRent; return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value / 1.18 * 100) / 100 : null; };
const initialRent = (a?: LockerAllocation | null) => { const base = annualBase(a); return base === null ? '' : String(Math.round(base * months[a?.billingCycle || 'ANNUAL'] / 12 * 100) / 100); };
interface Props {
  preSelectedAllocation?: LockerAllocation | null;
  onClose: () => void;
  onSubmit: (data: GenerateRenewalInput) => Promise<void>;
  isSubmitting: boolean;
  context?: { identity: string; deposit: string; key: string; health: { label: string; style: string }; history: ReactNode; onKyc?: () => void; onCloseLocker?: () => void };
}
export function GenerateRenewalModal({ preSelectedAllocation = null, onClose, onSubmit, isSubmitting, context }: Props) {
  const [selected, setSelected] = useState(preSelectedAllocation);
  const [search, setSearch] = useState(''), [results, setResults] = useState<LockerAllocation[]>([]);
  const [searching, setSearching] = useState(false), [searchError, setSearchError] = useState('');
  const [retry, setRetry] = useState(0), [error, setError] = useState('');
  const [start, setStart] = useState(startFor(preSelectedAllocation));
  const [cycle, setCycle] = useState<BillingCycle>(preSelectedAllocation?.billingCycle || 'ANNUAL');
  const [next, setNext] = useState(nextDate(startFor(preSelectedAllocation), preSelectedAllocation?.billingCycle || 'ANNUAL'));
  const [customDate, setCustomDate] = useState(false);
  const [rent, setRent] = useState(initialRent(preSelectedAllocation));
  const [late, setLate] = useState('0'), [other, setOther] = useState('0'), [discount, setDiscount] = useState('0');
  const [gst, setGst] = useState(18), [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const annualRate = useRef(annualBase(preSelectedAllocation));
  const submitLock = useRef(false), dialog = useRef<HTMLDivElement>(null);
  const busy = isSubmitting || saving;
  const live = useRef({ onClose, busy }); live.current = { onClose, busy };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; dialog.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (Array.from(document.querySelectorAll('[role="dialog"]')).at(-1) !== dialog.current) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); if (!live.current.busy) live.current.onClose(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []).filter(el => el.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handler, true);
    return () => { document.removeEventListener('keydown', handler, true); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    if (selected) return;
    let active = true; setSearching(true); setSearchError('');
    const timer = setTimeout(async () => {
      try { const result = await allocationApi.getAllocations({ search: search.trim() || undefined, status: 'ACTIVE', limit: 10 }); if (active) setResults(result.allocations); }
      catch { if (active) { setSearchError('Could not load active agreements.'); setResults([]); } }
      finally { if (active) setSearching(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [search, selected, retry]);
  const select = (allocation: LockerAllocation) => {
    setSelected(allocation); const date = startFor(allocation), term = allocation.billingCycle || 'ANNUAL';
    setStart(date); setCycle(term); setNext(nextDate(date, term)); setCustomDate(false); setRent(initialRent(allocation)); annualRate.current = annualBase(allocation);
    setLate('0'); setOther('0'); setDiscount('0'); setNotes(''); setError('');
  };
  const subtotal = Math.round((Number(rent) + Number(late) + Number(other) - Number(discount)) * 100) / 100;
  const tax = Math.round(subtotal * gst) / 100, total = Math.round((subtotal + tax) * 100) / 100;
  const validAmounts = [rent, late, other, discount].every(v => v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100000000 && Math.abs(Number(v) * 100 - Math.round(Number(v) * 100)) < .00001) && subtotal >= 0;
  const validDates = /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(next) && day(start) === start && day(next) === next && next > start;
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (submitLock.current || busy) return;
    if (!selected || selected.status !== 'ACTIVE') { setError('Select an active agreement.'); return; }
    if (!validDates) { setError('Choose valid dates. Next renewal must be after the start date.'); return; }
    if (!validAmounts || total <= 0) { setError('Enter valid amounts with up to two decimals. Discount cannot exceed charges.'); return; }
    submitLock.current = true; setSaving(true); setError('');
    try { await onSubmit({ allocationId: selected._id, startDate: start, nextRenewalDueDate: next, billingCycle: next !== nextDate(start, cycle) ? 'CUSTOM' : cycle, baseRent: Number(rent), lateFee: Number(late), otherCharges: Number(other), discount: Number(discount), taxAmount: tax, notes: notes.trim() || undefined }); }
    catch (err: any) { setError(err.response?.data?.message || err.message || 'Could not issue renewal invoice.'); }
    finally { submitLock.current = false; setSaving(false); }
  };
  const fieldClass = 'mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 disabled:opacity-60';
  const card = (label: string, value: string) => <div className="min-w-0 rounded-2xl bg-slate-100 p-4 sm:p-5"><dt className="text-sm text-slate-600">{label}</dt><dd className="mt-1 break-words text-lg font-bold text-slate-950">{value}</dd></div>;
  return createPortal(<div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="renew-locker-title" tabIndex={-1} className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl outline-none">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-5 sm:px-8">
        <div><h2 id="renew-locker-title" className="text-2xl font-extrabold text-slate-950 sm:text-3xl">{selected ? `Renew locker ${selected.lockerId?.lockerNumber || ''}` : 'Renew locker'}</h2><p className="mt-2 text-sm text-slate-600">{selected ? `Size ${selected.lockerId?.size || 'Not recorded'} · ${selected.lockerId?.rackNumber || 'Rack not recorded'} · Key ${context?.key || 'Not assigned'}` : 'Select an active customer agreement'}</p>{context && <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold sm:hidden ${context.health.style}`}>{context.health.label}</span>}</div>
        <div className="flex items-center gap-3">{context && <span className={`hidden rounded-full px-4 py-2 text-sm font-bold sm:block ${context.health.style}`}>{context.health.label}</span>}<button type="button" aria-label="Close renewal" disabled={busy} onClick={onClose} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"><X /></button></div>
      </header>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-8">
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">{error}</p>}
          {!selected ? <section className="space-y-4"><label className="block font-semibold">Find active agreement<input className={fieldClass} value={search} onChange={e => setSearch(e.target.value)} placeholder="Customer, locker or agreement code" /></label>{searching && <p role="status">Loading agreements...</p>}{searchError && <p role="alert">{searchError} <button type="button" className="underline" onClick={() => setRetry(v => v + 1)}>Retry</button></p>}{!searching && !searchError && !results.length && <p>No active agreements found.</p>}<div className="grid gap-3 sm:grid-cols-2">{!searching && results.map(a => <button key={a._id} type="button" onClick={() => select(a)} className="rounded-xl border border-slate-300 p-4 text-left hover:border-emerald-700"><strong>{a.customerId?.fullName || 'Customer not recorded'}</strong><p>Locker {a.lockerId?.lockerNumber || 'Not recorded'} &middot; {a.allocationCode}</p></button>)}</div></section> : <>
            <dl className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-3">
              {card('Customer', selected.customerId?.fullName || 'Not recorded')}{card('Phone', selected.customerId?.phone || 'Not recorded')}{card('ID', context?.identity || 'View customer KYC documents')}
              {card('Opening date', ledgerDate(selected.startDate))}{card('Next renewal', ledgerDate(selected.nextRenewalDueDate))}{card('Annual rent (including GST)', Number.isFinite(selected.annualRent) ? money(selected.annualRent) : 'Not recorded')}{card('Security deposit held', context?.deposit || 'View deposit ledger')}
            </dl>
            <div className="flex flex-wrap gap-3">{context?.onKyc && <Button type="button" variant="outline" disabled={busy} onClick={context.onKyc} className="rounded-xl border-emerald-700 text-emerald-800"><ShieldCheck className="mr-2 h-4 w-4" />KYC &amp; ID documents</Button>}{context?.onCloseLocker && <Button type="button" variant="outline" disabled={busy} onClick={context.onCloseLocker} className="rounded-xl border-red-600 text-red-700"><Undo2 className="mr-2 h-4 w-4" />Close locker</Button>}{!preSelectedAllocation && <Button type="button" variant="outline" disabled={busy} onClick={() => setSelected(null)}>Change agreement</Button>}</div>
            {start && startFor(selected) && start !== startFor(selected) && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">The start date differs from the recorded next renewal date ({ledgerDate(startFor(selected))}). Check for a gap or overlap in coverage.</p>}
            <fieldset disabled={busy} className="space-y-5 rounded-2xl border border-slate-200 p-4 sm:p-5">
              <legend className="px-2 font-extrabold uppercase tracking-wide text-emerald-800">Renewal details</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="font-semibold">Renewal start date<input required type="date" className={fieldClass} value={start} onChange={e => { setStart(e.target.value); if (!customDate) setNext(nextDate(e.target.value, cycle)); }} /></label>
                <label className="font-semibold">Tenure<select aria-label="Tenure" className={fieldClass} value={cycle} onChange={e => { const term = e.target.value as BillingCycle; setRent(annualRate.current === null ? '' : String(Math.round(annualRate.current * months[term] / 12 * 100) / 100)); setCycle(term); if (!customDate) setNext(nextDate(start, term)); }}><option value="ANNUAL">1 year</option><option value="TRIENNIAL">3 years</option><option value="HALF_YEARLY">6 months</option><option value="QUARTERLY">3 months</option><option value="MONTHLY">1 month</option><option value="CUSTOM">Custom period</option></select></label>
                <div><label className="font-semibold">Next renewal date<input required type="date" className={fieldClass} value={next} min={start || undefined} onChange={e => { setNext(e.target.value); setCustomDate(true); }} /></label><button type="button" onClick={() => { setCustomDate(false); setNext(nextDate(start, cycle)); }} className="mt-2 text-sm font-semibold text-emerald-800 underline">Use tenure date</button></div>
                <div className="self-center text-sm text-slate-600">{validDates ? `Coverage: ${ledgerDate(start)} to ${ledgerDate(new Date(Date.parse(next) - 86400000).toISOString())}` : 'Choose a valid renewal period.'}<p className="mt-2">Changing the period does not prorate the entered rent. Review the amount before issuing.</p></div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">{([['Base rent for this period', rent, setRent], ['Late fee', late, setLate], ['Other charges', other, setOther], ['Discount', discount, setDiscount]] as const).map(([label, value, setter]) => <label key={label} className="font-semibold">{label} (INR)<input required type="number" min="0" max="100000000" step="0.01" className={fieldClass} value={value} onChange={e => { setter(e.target.value); if (label === 'Base rent for this period') annualRate.current = e.target.value === '' ? null : Number(e.target.value) * 12 / months[cycle]; }} /></label>)}</div>
              <label className="block font-semibold">GST rate<select aria-label="GST rate" className={fieldClass} value={gst} onChange={e => setGst(Number(e.target.value))}><option value={18}>18%</option><option value={0}>0%</option></select></label>
              <label className="block font-semibold">Notes (optional)<textarea className={fieldClass} value={notes} maxLength={2000} onChange={e => setNotes(e.target.value)} /></label>
              <dl className="space-y-2 rounded-xl bg-emerald-50 p-4 text-emerald-950"><div className="flex justify-between"><dt>Charges after discount</dt><dd>{validAmounts ? money(subtotal) : 'Check amounts'}</dd></div><div className="flex justify-between"><dt>GST ({gst}%)</dt><dd>{validAmounts ? money(tax) : 'Check amounts'}</dd></div><div className="flex justify-between border-t border-emerald-200 pt-3 text-xl font-extrabold"><dt>Total renewal bill</dt><dd>{validAmounts ? money(total) : 'Check amounts'}</dd></div></dl>
              {validAmounts && total <= 0 && <p role="status" className="text-sm text-rose-800">Renewal bill total must be greater than zero.</p>}
              <p className="text-sm text-slate-600">This issues a bill. Record payment separately to confirm collection and update paid coverage. Security deposit is not charged again.</p>
            </fieldset>
            {context?.history}
          </>}
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-8"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || !selected || !validAmounts || total <= 0 || !validDates} className="rounded-xl bg-emerald-700 text-white hover:bg-emerald-800">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCw className="mr-2 h-4 w-4" />}{busy ? 'Issuing...' : 'Issue renewal bill'}</Button></footer>
      </form>
    </div>
  </div>, document.body);
}
