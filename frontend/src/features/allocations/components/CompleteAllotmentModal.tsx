import { AttachmentPreview } from './AttachmentPreview';
import { useDebounce } from '../../../hooks/useDebounce';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Loader2, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';
import { lockerApi } from '../../lockers/api/lockerApi';
import { customerApi } from '../../customers/api/customerApi';
import { Locker } from '../../lockers/types';
import { Customer } from '../../customers/types';
import { Payment } from '../../payments/types';
import { PaymentReceiptModal } from '../../payments/components/PaymentReceiptModal';
import { useAuth } from '../../../hooks/useAuth';

type Asset = { fileUrl: string; fileName: string; size: number; mimeType: string };
const currency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const round = (value: number) => Math.round(value * 100) / 100;
export function CompleteAllotmentModal({ locker: initialLocker, customer: initialCustomer, onClose }: { locker?: Locker | null; customer?: Customer | null; onClose: () => void }) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const dialog = useRef<HTMLDivElement>(null);
  const requestId = useRef(crypto.randomUUID());
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const errorRef = useRef<HTMLParagraphElement>(null);
  const pendingPayload = useRef<Record<string, unknown> | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [cashReceived, setCashReceived] = useState(false);
  const [receiptDate, setReceiptDate] = useState(today);
  const [uploadStatus, setUploadStatus] = useState('');
  const uploaded = useRef(new Map<File, Asset>());
  const submitting = useRef(false);
  const [locker, setLocker] = useState(initialLocker || null);
  const [lockerSearch, setLockerSearch] = useState('');
  const [customer, setCustomer] = useState(initialCustomer || null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [name, setName] = useState(initialCustomer?.fullName || '');
  const [phone, setPhone] = useState(initialCustomer?.phone || '');
  const [email, setEmail] = useState(initialCustomer?.email || '');
  const [keyNumber, setKeyNumber] = useState(initialLocker?.masterKeyReference || '');
  const [startDate, setStartDate] = useState(today);
  const [years, setYears] = useState(1);
  const [annualBase, setAnnualBase] = useState<number | string>(round((initialLocker?.annualRent ?? 1180) / 1.18));
  const [deposit, setDeposit] = useState<number | string>(initialLocker?.securityDeposit ?? 2000);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [documentType, setDocumentType] = useState('AADHAAR');
  const [documentNumber, setDocumentNumber] = useState('');
  const [fileReset, setFileReset] = useState(0);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ payments: Payment[]; invoice: { totalAmount: number; invoiceNumber: string } } | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const canCollect = hasPermission('allocations.create') && hasPermission('payments.create') && hasPermission('deposits.collect');
  const canManageKyc = hasPermission('customers.kyc.manage');
  const debouncedLockerSearch = useDebounce(lockerSearch.trim());
  const debouncedCustomerSearch = useDebounce(customerSearch.trim());
  const lockers = useQuery({ queryKey: ['allotment-lockers', debouncedLockerSearch], queryFn: () => lockerApi.getLockers({ search: debouncedLockerSearch || undefined, status: 'VACANT', operationalStatus: 'ACTIVE', isActive: true, limit: 100 }), enabled: !initialLocker });
  const customers = useQuery({ queryKey: ['allotment-customers', debouncedCustomerSearch], queryFn: () => customerApi.getCustomers({ search: debouncedCustomerSearch, status: 'ACTIVE', limit: 10 }), enabled: debouncedCustomerSearch.length >= 2 && !customer });
  useEffect(() => {
    const root = document.getElementById('root');
    const previousInert = root?.inert || false;
    if (root) root.inert = true;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusBefore = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const keys = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs.length && dialogs[dialogs.length - 1] !== dialog.current) return;
      if (event.key === 'Escape' && !submitting.current) closeRef.current();
      if (event.key === 'Tab') {
        const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:enabled,input:enabled,select:enabled,[tabindex="0"]') || []);
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keys);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', keys); if (root) root.inert = previousInert; if (focusBefore?.isConnected) focusBefore.focus(); };
  }, []);
  const base = round(Number(annualBase) * years);
  const gst = round(base * .18);
  const invoiceTotal = round(base + gst + 50);
  const total = round(invoiceTotal + Number(deposit));
  useEffect(() => { setCashReceived(false); }, [total, locker?._id, customer?._id, name, phone, startDate, receiptDate, receiptNumber]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => { if (success) dialog.current?.focus(); }, [success]);
  const chooseCustomer = (value: Customer | null) => { setCustomer(value); setCustomerSearch(''); setDocumentNumber(''); setIdFile(null); setPhoto(null); setReceiptFile(null); setFileReset(v => v + 1); setError(''); };
  const rackLabel = (value: string) => /^rack\b/i.test(value.trim()) ? value.trim() : `Rack ${value}`;
  const renewal = startDate ? new Date(startDate + 'T00:00:00Z') : null;
  if (renewal && !isNaN(renewal.getTime())) {
    const month = renewal.getUTCMonth(); renewal.setUTCFullYear(renewal.getUTCFullYear() + years);
    if (renewal.getUTCMonth() !== month) renewal.setUTCDate(0);
  }
  const validateFile = (file: File | null, imagesOnly = false) => {
    if (!file) return;
    const allowed = ['image/jpeg','image/png','image/webp', ...(imagesOnly ? [] : ['application/pdf'])];
    if (!file.size || file.size > 5 * 1024 * 1024 || !allowed.includes(file.type)) throw new Error(`${file.name}: choose ${imagesOnly ? 'an image' : 'an image or PDF'} between 1 byte and 5 MB.`);
  };
  const upload = async (file: File | null, label: string): Promise<Asset | undefined> => {
    if (!file) return undefined;
    const previous = uploaded.current.get(file); if (previous) return previous;
    setUploadStatus(`Uploading ${label}...`);
    const asset = { ...await customerApi.uploadFile(file, 'kyc'), mimeType: file.type };
    uploaded.current.set(file, asset); return asset;
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (submitting.current) return;
    setError(''); submitting.current = true; setBusy(true);
    try {
      if (!uncertain) {
        if (!locker) throw new Error('Choose an available locker.');
        if (!canCollect) throw new Error('Allotment, payment and deposit collection permissions are required.');
        if (!cashReceived) throw new Error('Confirm that the displayed cash amount has been received.');
        if (!keyNumber.trim() || !receiptNumber.trim()) throw new Error('Key number and receipt number cannot be blank.');
        if (!customer && name.trim().length < 2) throw new Error('Enter the customer name (at least 2 characters).');
        if (!customer && !/^(?:\+?91)?[6-9]\d{9}$/.test(phone.replace(/[\s()-]/g,''))) throw new Error('Enter a valid Indian mobile number.');
        if (!customer && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Enter a valid email address.');
        if (String(annualBase).trim() === '' || String(deposit).trim() === '' || ![Number(annualBase), Number(deposit)].every(value => Number.isFinite(value) && value >= 0 && value <= 10000000 && Math.abs(value * 100 - Math.round(value * 100)) < .00001)) throw new Error('Enter valid amounts with at most two decimal places.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isFinite(new Date(startDate).getTime()) || new Date(startDate).toISOString().slice(0,10) !== startDate) throw new Error('Choose a valid opening date.');
        if (!receiptDate || receiptDate > today()) throw new Error('Receipt date cannot be in the future.');
        if (documentNumber.trim() && !idFile) throw new Error('Attach the ID proof for this ID number, or clear the number to upload KYC later.');
        if (idFile) {
          const clean = documentNumber.replace(/\s/g,'').toUpperCase();
          const patterns: Record<string, RegExp> = { AADHAAR: /^[2-9]\d{11}$/, PAN: /^[A-Z]{5}\d{4}[A-Z]$/, PASSPORT: /^[A-Z]\d{7}$/, VOTER_ID: /^[A-Z]{3}\d{7}$/, DRIVING_LICENSE: /^[A-Z0-9 -]{10,30}$/, OTHER: /^.{3,100}$/ };
          if (!patterns[documentType].test(clean)) throw new Error('Enter a valid ID number for the selected document type.');
        }
        validateFile(receiptFile); validateFile(photo, true); validateFile(idFile);
        const receiptAsset = await upload(receiptFile, 'receipt'); const photoAsset = await upload(photo, 'KYC photo'); const documentAsset = await upload(idFile, 'ID proof');
        pendingPayload.current = {
          requestId: requestId.current, lockerId: locker._id,
          ...(customer ? { customerId: customer._id } : { customer: { fullName: name.trim(), phone: phone.trim(), ...(email.trim() ? { email: email.trim() } : {}) } }),
          keyNumber: keyNumber.trim(), startDate, receiptDate, cashReceived: true,
          billingCycle: years === 3 ? 'TRIENNIAL' : 'ANNUAL', annualRent: round(Number(annualBase) * 1.18), annualBaseRent: Number(annualBase), securityDeposit: Number(deposit), receiptNumber: receiptNumber.trim(),
          receipt: receiptAsset, photo: photoAsset, idDocument: documentAsset ? { ...documentAsset, documentType, documentNumber: documentNumber.trim() } : undefined,
        };
      }
      setUploadStatus('Saving allotment...');
      const response = await apiClient.post('/allocations/complete', pendingPayload.current);
      setUncertain(false); pendingPayload.current = null;
      setSuccess(response.data.data);
      await queryClient.invalidateQueries();
    } catch (err: any) {
      const unknown = !!pendingPayload.current && (!err.response || err.response.status >= 500);
      setUncertain(unknown);
      if (!unknown) pendingPayload.current = null;
      const issues = err.response?.data?.errors?.issues;
      setError(unknown ? 'The server response was interrupted. The allotment may already be saved. Use Check & Retry to confirm the same request; do not collect cash again.' : issues?.map((issue: { message: string }) => issue.message).join(' ') || err.response?.data?.message || err.message || 'Allotment could not be saved.');
    } finally { submitting.current = false; setBusy(false); setUploadStatus(''); }
  };
  const inputClass = 'mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900';
  const fileInput = (label: string, setter: (file: File | null) => void, imagesOnly = false) => {
    const selected = label.startsWith('Receipt') ? receiptFile : imagesOnly ? photo : idFile;
    return <div><label className="block text-sm font-semibold text-slate-700">{label}<input key={`${label}-${fileReset}`} type="file" accept={imagesOnly ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp,application/pdf'} className={inputClass} aria-describedby="allotment-file-help" onChange={e => { const next = e.target.files?.[0] || null; try { validateFile(next, imagesOnly); setter(next); setError(''); } catch (err: any) { e.target.value = ''; setter(null); setError(err.message); } }} /></label>{selected && <AttachmentPreview file={selected} label={label} />}{selected && <button type="button" aria-label={`Remove ${label}`} className="mt-2 min-h-9 text-sm font-semibold text-slate-600 underline" onClick={event => { setter(null); const input = event.currentTarget.parentElement?.querySelector<HTMLInputElement>('input[type="file"]'); if (input) input.value = ''; }}>Remove attachment</button>}</div>;
  };
  return createPortal(<>
    <div className="vault-modal-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 sm:p-6">
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="complete-allotment-title" aria-busy={busy} className="vault-allotment my-auto flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="z-10 flex shrink-0 items-start justify-between gap-3 border-b bg-white p-5">
          <div><h2 id="complete-allotment-title" className="text-2xl font-bold text-slate-900">{success ? 'Allotment complete' : `New Allotment${locker ? ' - Locker ' + locker.lockerNumber : ''}`}</h2><p className="mt-1 text-sm text-slate-500">{locker ? `Size ${locker.size} / ${rackLabel(locker.rackNumber)}` : 'Customer, tenure, documents and counter receipt'}</p></div>
          <button type="button" disabled={busy} onClick={onClose} aria-label="Close allotment" className="min-h-11 min-w-11 rounded-xl hover:bg-slate-100"><X className="mx-auto h-5 w-5" /></button>
        </header>
        {success ? <div className="vault-allotment-result min-h-0 overflow-y-auto space-y-4 p-5"><CheckCircle2 className="h-10 w-10 text-emerald-600" /><p className="text-emerald-800">Allotment, invoice, deposit and document links saved successfully.</p><p>Invoice {success.invoice.invoiceNumber}: {currency(success.invoice.totalAmount)}</p>{success.payments.map(payment => <button type="button" key={payment._id} onClick={() => setReceipt(payment)} className="block min-h-11 w-full rounded-xl border border-emerald-700 p-3 text-left font-semibold text-emerald-800">View {payment.paymentPurpose === 'SECURITY_DEPOSIT' ? 'deposit' : 'rent'} receipt {payment.receiptNumber} &middot; {currency(payment.amount)}</button>)}<button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white">Done</button></div> : <form onSubmit={submit} className="vault-allotment-form"><div className="vault-allotment-body space-y-6">
          <fieldset disabled={busy || uncertain} className="space-y-5 disabled:opacity-70">
            {!initialLocker && <section className="space-y-2"><h3 className="font-bold text-emerald-800">Locker</h3><label className="block text-sm">Search vacant locker<input className={inputClass} value={lockerSearch} onChange={e => setLockerSearch(e.target.value)} placeholder="Locker number or rack" /></label><label className="block text-sm">Available locker<select required value={locker?._id || ''} className={inputClass} onChange={e => { const value = lockers.data?.lockers.find(l => l._id === e.target.value); setLocker(value || null); if (value) { setAnnualBase(round(value.annualRent / 1.18)); setDeposit(value.securityDeposit); setKeyNumber(value.masterKeyReference || ''); } }}><option value="">Choose locker</option>{locker && !lockers.data?.lockers.some(value => value._id === locker._id) && <option value={locker._id}>Locker {locker.lockerNumber} (selected)</option>}{lockers.data?.lockers.map(l => <option key={l._id} value={l._id}>Locker {l.lockerNumber} &middot; {l.size} &middot; {rackLabel(l.rackNumber)}</option>)}</select></label>{lockers.isError && <p role="alert" className="text-red-700">Could not load lockers. <button type="button" className="underline" onClick={() => lockers.refetch()}>Retry</button></p>}</section>}
            <section className="space-y-3"><h3 className="font-bold text-emerald-800">Customer</h3>
              {customer ? <div className="rounded-xl bg-slate-50 p-3"><strong>{customer.fullName}</strong><p className="text-sm text-slate-500">{customer.customerCode}</p><button type="button" className="mt-2 min-h-11 text-sm text-emerald-800 underline" onClick={() => chooseCustomer(null)}>Choose another / new customer</button></div> : <>
                <label className="block text-sm">Find an existing customer<input className={inputClass} value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Name, phone or customer code" /></label>
                {customers.data?.customers.map(c => <button type="button" key={c._id} className="min-h-11 w-full rounded-xl border p-3 text-left" onClick={() => chooseCustomer(c)}>{c.fullName} &middot; {c.customerCode} &middot; {c.phone}</button>)}
                {customers.isError && <p role="alert" className="text-red-700">Customer search failed. <button type="button" onClick={() => customers.refetch()} className="underline">Retry</button></p>}
                {!hasPermission('customers.create') ? <p>Select an existing customer. Your role cannot create customers.</p> : <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">New customer name<input required minLength={2} maxLength={150} className={inputClass} value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label><label className="text-sm">Phone<input required type="tel" inputMode="tel" title="Indian mobile number, optionally with +91" className={inputClass} value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" /></label><label className="text-sm sm:col-span-2">Email (optional)<input type="email" className={inputClass} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label></div>}
              </>}
              {canManageKyc && <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">ID type<select aria-label="ID type" className={inputClass} value={documentType} onChange={e => setDocumentType(e.target.value)}>{['AADHAAR','PAN','PASSPORT','VOTER_ID','DRIVING_LICENSE','OTHER'].map(type => <option key={type}>{type}</option>)}</select></label><label className="text-sm">ID number<input required={!!idFile} maxLength={100} className={inputClass} value={documentNumber} onChange={e => setDocumentNumber(e.target.value)} /></label></div>}
              {canManageKyc && <p className="text-xs text-slate-500">The ID number is saved with its attached proof. Leave it empty to upload ID later.</p>}
            </section>
            <section className="space-y-3"><h3 className="font-bold text-emerald-800">Key &amp; tenure</h3><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Key number<input required maxLength={100} className={inputClass} value={keyNumber} onChange={e => setKeyNumber(e.target.value)} /></label><label className="text-sm">Opening date<input required type="date" className={inputClass} value={startDate} onChange={e => setStartDate(e.target.value)} /></label><label className="text-sm">Tenure<select aria-label="Tenure" className={inputClass} value={years} onChange={e => setYears(Number(e.target.value))}><option value={1}>1 Year</option><option value={3}>3 Years</option></select></label><div className="text-sm">Next renewal<p className="mt-1 rounded-xl bg-slate-50 p-3 font-semibold">{renewal && !isNaN(renewal.getTime()) ? renewal.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Choose a valid opening date'}</p></div></div></section>
            <section className="space-y-3"><h3 className="font-bold text-emerald-800">Charges</h3><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Annual rent before GST<input required type="number" min="0" max="10000000" step="0.01" className={inputClass} value={annualBase} onChange={e => setAnnualBase(e.target.value)} /></label><label className="text-sm">Refundable security deposit<input required type="number" min="0" max="10000000" step="0.01" className={inputClass} value={deposit} onChange={e => setDeposit(e.target.value)} /></label></div><dl className="space-y-2 rounded-2xl border p-4 text-sm">{[[`Rent (${years} year${years > 1 ? 's' : ''})`, base], ['GST @ 18%', gst], ['KYC charge', 50], ['Security deposit', deposit], ['Total cash to collect', total]].map(([label, amount]) => <div key={label} className="flex justify-between gap-3 last:border-t last:pt-3 last:text-lg last:font-bold"><dt>{label}</dt><dd>{currency(Number(amount))}</dd></div>)}</dl></section>
            <section className="space-y-3"><h3 className="font-bold text-emerald-800">Receipt &amp; collection</h3><p className="text-sm text-slate-500">Confirm the cash collected and enter the receipt details below.</p><p id="allotment-file-help" className="text-xs text-slate-500">Images or PDF, up to 5 MB per file. KYC photos must be images.</p><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Receipt date<input required type="date" max={today()} className={inputClass} value={receiptDate} onChange={e => setReceiptDate(e.target.value)} /></label><label className="block text-sm">Receipt number<input required maxLength={100} className={inputClass} value={receiptNumber} onChange={e => setReceiptNumber(e.target.value)} /></label></div>{fileInput('Receipt image or PDF (optional)', setReceiptFile)}<label className="flex min-h-11 items-start gap-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900"><input required checked={cashReceived} onChange={e => setCashReceived(e.target.checked)} type="checkbox" className="mt-1 h-4 w-4" />Cash received: {currency(total)}</label></section>
            {canManageKyc && <section className="space-y-3"><h3 className="font-bold text-emerald-800">Documents (optional)</h3><p className="text-sm text-slate-500">Attachments remain pending until an authorized operator verifies the ID.</p>{fileInput('KYC photo', setPhoto, true)}{fileInput('ID proof (image or PDF)', setIdFile)}</section>}
          </fieldset>
          {error && <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {!canCollect && <p role="alert" className="text-sm text-red-800">Your role requires payment and deposit collection permissions for this combined flow.</p>}
          {uploadStatus && <p role="status" className="text-sm text-emerald-800">{uploadStatus}</p>}
          </div><footer className="vault-allotment-footer"><button type="submit" disabled={busy || !canCollect || (!customer && !hasPermission('customers.create'))} className="flex min-h-12 items-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 font-bold text-white disabled:opacity-50">{busy && <Loader2 className="h-5 w-5 animate-spin" />}{busy ? 'Saving allotment...' : uncertain ? 'Check & Retry' : 'Collect & Allot Locker'}</button><button type="button" disabled={busy} onClick={onClose} className="min-h-12 rounded-xl bg-slate-100 px-6 py-3 font-semibold">{uncertain ? 'Close' : 'Cancel'}</button></footer>
        </form>}
      </div>
    </div>
    {receipt && <PaymentReceiptModal payment={receipt} onClose={() => setReceipt(null)} />}
  </>, document.body);
}
