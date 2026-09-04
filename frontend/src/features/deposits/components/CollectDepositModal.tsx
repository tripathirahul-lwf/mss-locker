import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, ShieldCheck, X } from 'lucide-react';
import { depositApi } from '../api/depositApi';
import { DepositSummary } from '../types';
import { PaymentMethod } from '../../payments/types';

interface Props { isOpen: boolean; onClose: () => void; allocationId?: string; canOverride?: boolean; onSuccess: (result: any) => void; }
const methods: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'CASH', label: 'Cash' }, { value: 'UPI', label: 'UPI' }, { value: 'CARD', label: 'Card' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' }, { value: 'CHEQUE', label: 'Cheque' },
];
const money = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const CollectDepositModal: React.FC<Props> = ({ isOpen, onClose, allocationId, canOverride = false, onSuccess }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [summary, setSummary] = useState<DepositSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');

  useEffect(() => {
    if (!isOpen || !allocationId) return;
    let active = true;
    previousFocus.current = document.activeElement as HTMLElement;
    setSummary(null); setError(null); setAmount(''); setMethod('CASH'); setReference(''); setNotes(''); setOverride(false); setOverrideReason('');
    setIdempotencyKey(`DEP-${Date.now()}-${crypto.randomUUID()}`);
    setLoading(true);
    depositApi.getDepositSummary(allocationId).then((data) => {
      if (active) { setSummary(data); setAmount(data.outstandingDeposit > 0 ? String(data.outstandingDeposit) : ''); }
    }).catch((err: any) => active && setError(err?.response?.data?.message || 'Deposit details could not be loaded.'))
      .finally(() => active && setLoading(false));
    requestAnimationFrame(() => closeRef.current?.focus());
    return () => { active = false; };
  }, [isOpen, allocationId]);

  useEffect(() => {
    if (!isOpen) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener('keydown', keydown);
    const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = oldOverflow; previousFocus.current?.focus(); };
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;
  const numericAmount = Number(amount);
  const amountValid = Number.isFinite(numericAmount) && numericAmount > 0;
  const overcollecting = Boolean(summary && amountValid && summary.totalDepositReceived + numericAmount > summary.requiredDeposit);
  const excess = summary && overcollecting ? summary.totalDepositReceived + numericAmount - summary.requiredDeposit : 0;
  const referenceRequired = method !== 'CASH';
  const referenceValid = !referenceRequired || reference.trim().length >= 3;
  const overrideValid = !overcollecting || (canOverride && override && overrideReason.trim().length >= 3);
  const submitEnabled = Boolean(summary && allocationId && amountValid && referenceValid && overrideValid && !submitting);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null);
    if (!summary || !allocationId) return;
    if (!amountValid) { setError('Enter a deposit amount greater than zero.'); return; }
    if (!referenceValid) { setError(`Enter the ${method === 'CHEQUE' ? 'cheque number' : 'transaction reference'} for this non-cash payment.`); return; }
    if (overcollecting && !canOverride) { setError('This amount exceeds the required deposit. Ask an authorized supervisor.'); return; }
    if (!overrideValid) { setError('Authorize the override and enter a reason of at least 3 characters.'); return; }
    try {
      setSubmitting(true);
      const result = await depositApi.collectDeposit({ allocationId, amount: numericAmount, paymentMethod: method, transactionReference: reference.trim() || undefined, notes: notes.trim() || undefined, allowOverride: overcollecting && override, overrideReason: overcollecting && override ? overrideReason.trim() : undefined }, idempotencyKey);
      onSuccess(result); onClose();
    } catch (err: any) { setError(err?.response?.data?.message || 'Deposit could not be recorded. Review the details and try again.'); }
    finally { setSubmitting(false); }
  };

  return createPortal(<div className="fixed inset-0 z-[120] flex h-[100dvh] w-screen items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="collect-deposit-title" className="my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-emerald-700"><ShieldCheck className="h-5 w-5" /></div><div><h2 id="collect-deposit-title" className="text-lg font-bold text-slate-950">Collect caution deposit</h2><p className="mt-0.5 text-sm text-slate-600">Record payment and issue an official receipt.</p></div></div>
        <button ref={closeRef} type="button" onClick={onClose} disabled={submitting} aria-label="Close collect deposit dialog" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-50"><X className="h-5 w-5" /></button>
      </header>
      {loading ? <div className="flex min-h-64 flex-col items-center justify-center p-10 text-sm text-slate-600" role="status"><Loader2 className="mb-3 h-7 w-7 animate-spin text-emerald-700" />Loading deposit details…</div>
      : !summary ? <div className="p-8 text-center"><AlertTriangle className="mx-auto mb-3 h-7 w-7 text-rose-600" /><p className="font-semibold text-slate-900">Deposit details unavailable</p><p className="mt-1 text-sm text-slate-600">Close this dialog, verify the selected account and try again.</p></div>
      : <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6"><div className="space-y-5">
          {error && <div id="deposit-form-error" role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
          <section aria-label="Selected account" className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4">
            <div><span className="block text-xs text-slate-500">Customer</span><span className="block truncate text-sm font-semibold text-slate-900">{summary.customerName}</span></div><div><span className="block text-xs text-slate-500">Locker</span><span className="text-sm font-semibold text-emerald-700">{summary.lockerNumber}</span></div><div><span className="block text-xs text-slate-500">Required</span><span className="text-sm font-semibold text-slate-900">{money(summary.requiredDeposit)}</span></div><div><span className="block text-xs text-slate-500">Outstanding</span><span className="text-sm font-bold text-amber-700">{money(summary.outstandingDeposit)}</span></div>
          </section>
          <div><label htmlFor="deposit-amount" className="mb-1.5 block text-sm font-semibold text-slate-800">Deposit amount <span className="text-rose-600">*</span></label><div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-slate-500">₹</span><input id="deposit-amount" type="number" inputMode="decimal" min="0.01" step="0.01" required value={amount} onChange={(e) => { setAmount(e.target.value); setOverride(false); }} aria-invalid={Boolean(amount && !amountValid)} aria-describedby="deposit-amount-help deposit-form-error" className="w-full rounded-xl border border-slate-300 py-3 pl-9 pr-4 text-lg font-bold text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" placeholder="0.00" /></div><p id="deposit-amount-help" className="mt-1.5 text-xs text-slate-500">Current held balance: {money(summary.netDepositHeld)}</p><div className="mt-2 flex flex-wrap gap-2">{summary.outstandingDeposit > 0 && <button type="button" onClick={() => setAmount(String(summary.outstandingDeposit))} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">Use outstanding {money(summary.outstandingDeposit)}</button>}<button type="button" onClick={() => setAmount(String(summary.requiredDeposit))} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700">Use required {money(summary.requiredDeposit)}</button></div></div>
          {overcollecting && <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm"><div className="flex gap-2 font-semibold text-amber-900"><AlertTriangle className="h-5 w-5 shrink-0" /><span>Amount exceeds the required deposit by {money(excess)}.</span></div>{canOverride ? <><label className="flex cursor-pointer items-start gap-2 text-slate-800"><input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="mt-0.5 h-4 w-4" /><span>Use my deposit override permission</span></label>{override && <div><label htmlFor="override-reason" className="mb-1 block text-xs font-semibold">Override reason *</label><input id="override-reason" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} className="w-full rounded-xl border border-amber-400 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200" placeholder="Explain why excess caution money is required" /></div>}</> : <p className="text-amber-900">Reduce the amount or ask an authorized supervisor.</p>}</div>}
          <fieldset><legend className="mb-2 text-sm font-semibold text-slate-800">Payment method <span className="text-rose-600">*</span></legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{methods.map((item) => <label key={item.value} className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center text-xs font-semibold focus-within:ring-2 focus-within:ring-emerald-600 ${method === item.value ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}><input type="radio" name="deposit-method" checked={method === item.value} onChange={() => { setMethod(item.value); setReference(''); }} className="sr-only" />{item.label}</label>)}</div></fieldset>
          {referenceRequired && <div><label htmlFor="deposit-reference" className="mb-1.5 block text-sm font-semibold text-slate-800">{method === 'CHEQUE' ? 'Cheque number' : 'Transaction / UTR reference'} <span className="text-rose-600">*</span></label><input id="deposit-reference" required autoComplete="off" value={reference} onChange={(e) => setReference(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" placeholder="Enter payment reference" /><p className="mt-1 text-xs text-slate-500">Required to reconcile this non-cash payment.</p></div>}
          <div><label htmlFor="deposit-notes" className="mb-1.5 block text-sm font-semibold text-slate-800">Internal remarks <span className="font-normal text-slate-500">(optional)</span></label><textarea id="deposit-notes" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" placeholder="Add notes visible in the audit record" /></div>
        </div></div>
        <footer className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-6"><div className="mb-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="text-slate-600">Receipt total · {methods.find((x) => x.value === method)?.label}</span><span className="font-bold text-slate-950">{amountValid ? money(numericAmount) : '₹0'}</span></div><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} disabled={submitting} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button><button type="submit" disabled={!submitEnabled} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">{submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Recording deposit…</> : <><CheckCircle2 className="h-4 w-4" />Confirm and issue receipt<ArrowRight className="h-4 w-4" /></>}</button></div></footer>
      </form>}
    </div>
  </div>, document.body);
};
