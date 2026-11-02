import { lockBodyScroll } from '../../../utils/bodyScrollLock';
import { useDebounce } from '../../../hooks/useDebounce';
import { useEffect,useRef,useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { X,Loader2,CheckCircle2 } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';
import { lockerApi } from '../../lockers/api/lockerApi';
import { customerApi } from '../../customers/api/customerApi';
import { Locker } from '../../lockers/types';
import { Customer } from '../../customers/types';
import { Payment } from '../../payments/types';
import { PaymentReceiptModal } from '../../payments/components/PaymentReceiptModal';
import { useAuth } from '../../../hooks/useAuth';
import { AllotmentDocumentUploadBox } from './AllotmentDocumentUploadBox';
import { DocumentPreviewModal } from '../../customers/components/DocumentPreviewModal';

type Asset = { fileUrl: string; fileName: string; size: number; mimeType: string };
const currency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const round = (value: number) => Math.round(value * 100) / 100;

export function CompleteAllotmentModal({
  locker: initialLocker,
  customer: initialCustomer,
  onClose,
}: {
  locker?: Locker | null;
  customer?: Customer | null;
  onClose: () => void;
}) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const dialog = useRef<HTMLDivElement>(null);
  const requestId = useRef(crypto.randomUUID());
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
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
  const customer = initialCustomer || null;
  const [name, setName] = useState(initialCustomer?.fullName || '');
  const [phone, setPhone] = useState(initialCustomer?.phone || '');
  const [email, setEmail] = useState(initialCustomer?.email || '');
  const [keyNumber, setKeyNumber] = useState(initialLocker?.masterKeyReference || '');
  const [startDate, setStartDate] = useState(today);
  const [years, setYears] = useState(1);
  const [renewalDateOverride, setRenewalDateOverride] = useState<string | null>(null);
  const [annualBase, setAnnualBase] = useState<number | string>(round((initialLocker?.annualRent ?? 1180) / 1.18));
  const [deposit, setDeposit] = useState<number | string>(initialLocker?.securityDeposit ?? 2000);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [documentType, setDocumentType] = useState('AADHAAR');
  const [documentNumber, setDocumentNumber] = useState('');

  // Uploaded Files State
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);

  // Full Inspection / Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<{
    isOpen: boolean;
    url: string;
    documentName: string;
    documentType: string;
    mimeType?: string;
    fileSize?: number;
  } | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ payments: Payment[]; invoice: { totalAmount: number; invoiceNumber: string } } | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);

  const canCollect = hasPermission('allocations.create') && hasPermission('payments.create') && hasPermission('deposits.collect');
  const canManageKyc = hasPermission('customers.kyc.manage');

  const debouncedLockerSearch = useDebounce(lockerSearch.trim());
  const lockers = useQuery({
    queryKey: ['allotment-lockers', debouncedLockerSearch],
    queryFn: () =>
      lockerApi.getLockers({
        search: debouncedLockerSearch || undefined,
        status: 'VACANT',
        operationalStatus: 'ACTIVE',
        isActive: true,
        limit: 100,
      }),
    enabled: !initialLocker,
  });

  // Modal accessibility, keyboard trap & scroll lock
  useEffect(() => {
    const root = document.getElementById('root');
    const previousInert = root?.inert || false;
    if (root) root.inert = true;

    const releaseScroll = lockBodyScroll();
    const focusBefore = document.activeElement as HTMLElement | null;
    dialog.current?.focus();

    const keys = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs.length && dialogs[dialogs.length - 1] !== dialog.current) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!submitting.current) closeRef.current(); }
      if (event.key === 'Tab') {
        const items = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            'button:enabled,input:enabled,select:enabled,textarea:enabled,[tabindex="0"]'
          ) || []
        ).filter(item => item.getClientRects().length && !item.closest('fieldset:disabled'));
        if (!items.length) { event.preventDefault(); dialog.current?.focus(); return; }
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current || !dialog.current?.contains(document.activeElement))) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current || !dialog.current?.contains(document.activeElement))) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', keys);
    return () => {
      releaseScroll();
      document.removeEventListener('keydown', keys);
      if (root) root.inert = previousInert;
      if (focusBefore?.isConnected) focusBefore.focus();
    };
  }, []);

  // Cleanup preview object URLs
  useEffect(() => {
    return () => {
      if (previewDoc?.url) URL.revokeObjectURL(previewDoc.url);
    };
  }, [previewDoc]);

  const handleOpenPreview = (file: File, label: string) => {
    const url = URL.createObjectURL(file);
    setPreviewDoc({
      isOpen: true,
      url,
      documentName: file.name,
      documentType: label,
      mimeType: file.type,
      fileSize: file.size,
    });
  };

  const handleClosePreview = () => {
    if (previewDoc?.url) {
      URL.revokeObjectURL(previewDoc.url);
    }
    setPreviewDoc(null);
  };

  const base = round(Number(annualBase) * years);
  const gst = round(base * 0.18);
  const invoiceTotal = round(base + gst + 50);
  const total = round(invoiceTotal + Number(deposit));

  useEffect(() => {
    setCashReceived(false);
  }, [total, locker?._id, customer?._id, name, phone, email, keyNumber, startDate, years, renewalDateOverride, receiptDate, receiptNumber]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (success) dialog.current?.focus();
  }, [success]);

  const rackLabel = (value: string) => (/^rack\b/i.test(value.trim()) ? value.trim() : `Rack ${value}`);

  const renewal = startDate ? new Date(startDate + 'T00:00:00Z') : null;
  if (renewal && !isNaN(renewal.getTime())) {
    const month = renewal.getUTCMonth();
    renewal.setUTCFullYear(renewal.getUTCFullYear() + years);
    if (renewal.getUTCMonth() !== month) renewal.setUTCDate(0);
  }

  const automaticRenewalDate = renewal && Number.isFinite(renewal.getTime()) ? renewal.toISOString().slice(0, 10) : '';
  const renewalDate = renewalDateOverride ?? automaticRenewalDate;

  const validateFile = (file: File | null, imagesOnly = false) => {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', ...(imagesOnly ? [] : ['application/pdf'])];
    if (!file.size || file.size > 5 * 1024 * 1024 || !allowed.includes(file.type)) {
      throw new Error(`${file.name}: choose ${imagesOnly ? 'an image' : 'an image or PDF'} between 1 byte and 5 MB.`);
    }
  };

  const handleReceiptChange = (file: File | null) => {
    try {
      validateFile(file);
      setReceiptFile(file);
      setError('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePhotoChange = (file: File | null) => {
    try {
      validateFile(file, true);
      setPhoto(file);
      setError('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleIdFileChange = (file: File | null) => {
    try {
      validateFile(file);
      setIdFile(file);
      setError('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const upload = async (file: File | null, label: string): Promise<Asset | undefined> => {
    if (!file) return undefined;
    const previous = uploaded.current.get(file);
    if (previous) return previous;
    setUploadStatus(`Uploading ${label}...`);
    const result = await customerApi.uploadFile(file, 'kyc');
    const asset = { ...result, mimeType: result.mimeType || file.type };
    uploaded.current.set(file, asset);
    return asset;
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    submitting.current = true;
    setBusy(true);

    try {
      if (!uncertain) {
        if (!locker) throw new Error('Choose an available locker.');
        if (!canCollect) throw new Error('Allotment, payment and deposit collection permissions are required.');
        if (!cashReceived) throw new Error('Confirm that the displayed cash amount has been received.');
        if (!keyNumber.trim() || !receiptNumber.trim()) throw new Error('Key number and receipt number cannot be blank.');
        if (!customer && name.trim().length < 2) throw new Error('Enter the customer name (at least 2 characters).');
        if (!customer && !/^(?:\+?91)?[6-9]\d{9}$/.test(phone.replace(/[\s()-]/g, '')))
          throw new Error('Enter a valid Indian mobile number.');
        if (!customer && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
          throw new Error('Enter a valid email address.');
        if (
          String(annualBase).trim() === '' ||
          String(deposit).trim() === '' ||
          ![Number(annualBase), Number(deposit)].every(
            (value) =>
              Number.isFinite(value) &&
              value >= 0 &&
              value <= 10000000 &&
              Math.abs(value * 100 - Math.round(value * 100)) < 0.00001
          )
        )
          throw new Error('Enter valid amounts with at most two decimal places.');
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
          !Number.isFinite(new Date(startDate).getTime()) ||
          new Date(startDate).toISOString().slice(0, 10) !== startDate
        )
          throw new Error('Choose a valid opening date.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(renewalDate) || !Number.isFinite(Date.parse(renewalDate)) || new Date(renewalDate).toISOString().slice(0, 10) !== renewalDate || renewalDate <= startDate) throw new Error('Next renewal must be a valid date after the opening date.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(receiptDate) || !Number.isFinite(Date.parse(receiptDate)) || new Date(receiptDate).toISOString().slice(0, 10) !== receiptDate || receiptDate > today()) throw new Error('Choose a valid receipt date on or before today.');

        if (documentNumber.trim() && !idFile)
          throw new Error('Attach the ID proof for this ID number, or clear the number to upload KYC later.');

        if (idFile && documentNumber.trim()) {
          const clean = documentNumber.replace(/\s/g, '').toUpperCase();
          const patterns: Record<string, RegExp> = {
            AADHAAR: /^[2-9]\d{11}$/,
            PAN: /^[A-Z]{5}\d{4}[A-Z]$/,
            PASSPORT: /^[A-Z]\d{7}$/,
            VOTER_ID: /^[A-Z]{3}\d{7}$/,
            DRIVING_LICENSE: /^[A-Z0-9 -]{10,30}$/,
            OTHER: /^.{3,100}$/,
          };
          if (clean && !patterns[documentType].test(clean))
            throw new Error('Enter a valid ID number for the selected document type.');
        }

        validateFile(receiptFile);
        validateFile(photo, true);
        validateFile(idFile);

        const receiptAsset = await upload(receiptFile, 'receipt');
        const photoAsset = await upload(photo, 'KYC photo');
        const documentAsset = await upload(idFile, 'ID proof');

        pendingPayload.current = {
          requestId: requestId.current,
          lockerId: locker._id,
          ...(customer
            ? { customerId: customer._id }
            : {
                customer: {
                  fullName: name.trim(),
                  phone: phone.trim(),
                  ...(email.trim() ? { email: email.trim() } : {}),
                },
              }),
          keyNumber: keyNumber.trim(),
          startDate,
          nextRenewalDueDate: renewalDate,
          receiptDate,
          cashReceived: true,
          billingCycle: years === 3 ? 'TRIENNIAL' : 'ANNUAL',
          annualRent: round(Number(annualBase) * 1.18),
          annualBaseRent: Number(annualBase),
          securityDeposit: Number(deposit),
          receiptNumber: receiptNumber.trim(),
          receipt: receiptAsset,
          photo: photoAsset,
          idDocument: documentAsset
            ? {
                ...documentAsset,
                documentType: documentNumber.trim() ? documentType : 'OTHER',
                documentNumber: documentNumber.trim(),
              }
            : undefined,
        };
      }

      setUploadStatus('Saving allotment...');
      const response = await apiClient.post('/allocations/complete', pendingPayload.current);
      setUncertain(false);
      pendingPayload.current = null;
      setSuccess(response.data.data);
      await queryClient.invalidateQueries();
    } catch (err: any) {
      const unknown = !!pendingPayload.current && (!err.response || err.response.status >= 500);
      setUncertain(unknown);
      if (!unknown) pendingPayload.current = null;
      const issues = err.response?.data?.errors?.issues;
      setError(
        unknown
          ? 'The server response was interrupted. The allotment may already be saved. Use Check & Retry to confirm the same request; do not collect cash again.'
          : issues?.map((issue: { message: string }) => issue.message).join(' ') ||
              err.response?.data?.message ||
              err.message ||
              'Allotment could not be saved.'
      );
    } finally {
      submitting.current = false;
      setBusy(false);
      setUploadStatus('');
    }
  };

  const inputClass =
    'mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent';

  return createPortal(
    <>
      <div className="vault-modal-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 sm:p-6 backdrop-blur-xs">
        <div
          ref={dialog}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="complete-allotment-title"
          aria-busy={busy}
          className="vault-allotment my-auto flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200"
        >
          {/* Header */}
          <header className="z-10 flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white p-5">
            <div>
              <h2 id="complete-allotment-title" className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900">
                {success ? 'Allotment Complete' : `New Allotment${locker ? ' - Locker ' + locker.lockerNumber : ''}`}
              </h2>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-medium">
                {locker
                  ? `Size ${locker.size} / ${rackLabel(locker.rackNumber)}`
                  : 'Customer, tenure, documents and counter receipt'}
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              aria-label="Close allotment"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          {/* Success Screen */}
          {success ? (
            <div className="vault-allotment-result min-h-0 overflow-y-auto space-y-4 p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
              <div>
                <h3 className="text-lg font-bold text-slate-900">Allotment Saved Successfully</h3>
                <p className="text-sm text-emerald-800 mt-1">
                  Allotment, invoice, caution deposit, and documents registered in vault ledger.
                </p>
                <p className="text-xs font-mono font-semibold text-slate-600 mt-1">
                  Invoice #{success.invoice.invoiceNumber} &bull; Total: {currency(success.invoice.totalAmount)}
                </p>
              </div>

              <div className="max-w-md mx-auto space-y-2 pt-2">
                {success.payments.map((payment) => (
                  <button
                    type="button"
                    key={payment._id}
                    onClick={() => setReceipt(payment)}
                    className="block w-full rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-left font-semibold text-emerald-900 hover:bg-emerald-100/80 cursor-pointer transition-colors shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {payment.paymentPurpose === 'SECURITY_DEPOSIT' ? 'Caution Deposit Receipt' : 'Rent Receipt'}
                      </span>
                      <span className="text-xs font-mono">{payment.receiptNumber}</span>
                    </div>
                    <p className="text-base font-bold font-mono mt-1 text-slate-900">{currency(payment.amount)}</p>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="mt-4 px-8 py-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 font-bold text-white text-sm cursor-pointer shadow-xs transition-colors"
              >
                Done &amp; Close
              </button>
            </div>
          ) : (
            /* Form Screen */
            <form onSubmit={submit} className="vault-allotment-form flex flex-1 flex-col overflow-hidden min-h-0">
              <div className="vault-allotment-body flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                <fieldset disabled={busy || uncertain} className="space-y-6 disabled:opacity-70">
                  {/* Locker Selection if not initial */}
                  {!initialLocker && (
                    <section className="space-y-2.5">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">Locker</h3>
                      <label className="block text-sm font-semibold text-slate-700">
                        Search vacant locker
                        <input
                          className={inputClass}
                          value={lockerSearch}
                          onChange={(e) => setLockerSearch(e.target.value)}
                          placeholder="Locker number or rack"
                        />
                      </label>
                      <label className="block text-sm font-semibold text-slate-700">
                        Available locker
                        <select
                          required
                          value={locker?._id || ''}
                          className={inputClass}
                          onChange={(e) => {
                            const value = lockers.data?.lockers.find((l) => l._id === e.target.value);
                            setLocker(value || null);
                            if (value) {
                              setAnnualBase(round(value.annualRent / 1.18));
                              setDeposit(value.securityDeposit);
                              setKeyNumber(value.masterKeyReference || '');
                            }
                          }}
                        >
                          <option value="">Choose locker</option>
                          {locker && !lockers.data?.lockers.some((value) => value._id === locker._id) && (
                            <option value={locker._id}>Locker {locker.lockerNumber} (selected)</option>
                          )}
                          {lockers.data?.lockers.map((l) => (
                            <option key={l._id} value={l._id}>
                              Locker {l.lockerNumber} &middot; {l.size} &middot; {rackLabel(l.rackNumber)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {lockers.isError && (
                        <p role="alert" className="text-xs text-rose-700">
                          Could not load lockers.{' '}
                          <button type="button" className="underline font-bold" onClick={() => lockers.refetch()}>
                            Retry
                          </button>
                        </p>
                      )}
                    </section>
                  )}

                  {/* Section 1: Customer */}
                  <section className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">Customer</h3>
                    {customer ? (
                      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5">
                        <strong className="text-sm font-bold text-slate-900">{customer.fullName}</strong>
                        <p className="text-xs font-mono text-slate-500 mt-0.5">{customer.customerCode}</p>
                      </div>
                    ) : (
                      <>
                        {!hasPermission('customers.create') ? (
                          <p className="text-xs text-rose-700">
                            Your role cannot create customers. Start the allotment from an existing customer profile.
                          </p>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="text-xs sm:text-sm font-semibold text-slate-700">
                              New customer name
                              <input
                                required
                                minLength={2}
                                maxLength={150}
                                className={inputClass}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoComplete="name"
                                placeholder="e.g. Ramesh Chandra"
                              />
                            </label>
                            <label className="text-xs sm:text-sm font-semibold text-slate-700">
                              Phone
                              <input
                                required
                                type="tel"
                                inputMode="tel"
                                title="Indian mobile number, optionally with +91"
                                className={inputClass}
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                autoComplete="tel"
                                placeholder="e.g. 9876543210"
                              />
                            </label>
                            <label className="text-xs sm:text-sm font-semibold text-slate-700 sm:col-span-2">
                              Email (optional)
                              <input
                                type="email"
                                className={inputClass}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                                placeholder="customer@example.com"
                              />
                            </label>
                          </div>
                        )}
                      </>
                    )}

                    {canManageKyc && (
                      <div className="grid gap-3 sm:grid-cols-2 pt-1">
                        <label className="text-xs sm:text-sm font-semibold text-slate-700">
                          ID type
                          <select
                            aria-label="ID type"
                            className={inputClass}
                            value={documentType}
                            onChange={(e) => setDocumentType(e.target.value)}
                          >
                            {['AADHAAR', 'PAN', 'PASSPORT', 'VOTER_ID', 'DRIVING_LICENSE', 'OTHER'].map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs sm:text-sm font-semibold text-slate-700">
                          ID number
                          <input
                            maxLength={100}
                            className={inputClass}
                            value={documentNumber}
                            onChange={(e) => setDocumentNumber(e.target.value)}
                            placeholder={
                              documentType === 'AADHAAR'
                                ? 'e.g. 5432 9876 1234'
                                : documentType === 'PAN'
                                ? 'e.g. ABCDE1234F'
                                : 'Enter ID number'
                            }
                          />
                        </label>
                      </div>
                    )}
                    {canManageKyc && (
                      <p className="text-[11px] text-slate-500">
                        Enter an ID number with its proof, or attach a generic KYC document without a number.
                      </p>
                    )}
                  </section>

                  {/* Section 2: Key & Tenure */}
                  <section className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">Key &amp; tenure</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs sm:text-sm font-semibold text-slate-700">
                        Key number
                        <input
                          required
                          maxLength={100}
                          className={inputClass}
                          value={keyNumber}
                          onChange={(e) => setKeyNumber(e.target.value)}
                          placeholder="e.g. KEY-A-493"
                        />
                      </label>
                      <label className="text-xs sm:text-sm font-semibold text-slate-700">
                        Opening date
                        <input
                          required
                          type="date"
                          className={inputClass}
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                        />
                      </label>
                      <label className="text-xs sm:text-sm font-semibold text-slate-700">
                        Tenure
                        <select
                          aria-label="Tenure"
                          className={inputClass}
                          value={years}
                          onChange={(e) => setYears(Number(e.target.value))}
                        >
                          <option value={1}>1 Year</option>
                          <option value={3}>3 Years</option>
                        </select>
                      </label>
                      <div className="text-xs sm:text-sm font-semibold text-slate-700">
                        <label>Next renewal<input required type="date" className={inputClass} value={renewalDate} onChange={event => setRenewalDateOverride(event.target.value)} aria-describedby="renewal-date-help" /></label>
                        <p id="renewal-date-help" className="mt-1 text-xs font-normal text-slate-500">Editable. Rent is charged for the selected tenure.</p>
                        {renewalDateOverride !== null && <button type="button" className="mt-1 text-xs text-emerald-800 underline" onClick={() => setRenewalDateOverride(null)}>Use tenure date</button>}
                      </div>
                    </div>
                  </section>

                  {/* Section 3: Charges */}
                  <section className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">Charges</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs sm:text-sm font-semibold text-slate-700">
                        Annual rent before GST
                        <input
                          required
                          type="number"
                          min="0"
                          max="10000000"
                          step="0.01"
                          className={inputClass}
                          value={annualBase}
                          onChange={(e) => setAnnualBase(e.target.value)}
                        />
                      </label>
                      <label className="text-xs sm:text-sm font-semibold text-slate-700">
                        Refundable security deposit
                        <input
                          required
                          type="number"
                          min="0"
                          max="10000000"
                          step="0.01"
                          className={inputClass}
                          value={deposit}
                          onChange={(e) => setDeposit(e.target.value)}
                        />
                      </label>
                    </div>
                    <dl className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-xs sm:text-sm">
                      {[
                        [`Rent (${years} year${years > 1 ? 's' : ''})`, base],
                        ['GST @ 18%', gst],
                        ['KYC charge', 50],
                        ['Security deposit', deposit],
                        ['Total cash to collect', total],
                      ].map(([lbl, amount]) => (
                        <div key={lbl} className="flex justify-between gap-3 last:border-t last:border-slate-300 last:pt-2.5 last:text-base last:font-bold last:text-slate-900">
                          <dt className="text-slate-600">{lbl}</dt>
                          <dd className="font-mono font-semibold">{currency(Number(amount))}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>

                  {/* Section 4: Receipt & Collection */}
                  <section className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">Receipt &amp; collection</h3>
                    <p className="text-xs sm:text-sm text-slate-500">Confirm the cash collected and enter the receipt details below.</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs sm:text-sm font-semibold text-slate-700">
                        Receipt date
                        <input
                          required
                          type="date"
                          max={today()}
                          className={inputClass}
                          value={receiptDate}
                          onChange={(e) => setReceiptDate(e.target.value)}
                        />
                      </label>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                        Receipt number
                        <input
                          required
                          maxLength={100}
                          className={inputClass}
                          value={receiptNumber}
                          onChange={(e) => setReceiptNumber(e.target.value)}
                          placeholder="e.g. REC-2026-001"
                        />
                      </label>
                    </div>

                    {/* Enhanced Receipt Upload Box with Preview & Delete */}
                    <AllotmentDocumentUploadBox
                      label="Receipt image or PDF (optional)"
                      helperText="Optional counter payment receipt"
                      file={receiptFile}
                      onFileChange={handleReceiptChange}
                      onPreview={handleOpenPreview}
                      category="receipt"
                      disabled={busy || uncertain}
                    />

                    <label className="flex min-h-11 items-center gap-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 p-3.5 text-xs sm:text-sm font-bold text-emerald-900 cursor-pointer shadow-2xs">
                      <input
                        required
                        checked={cashReceived}
                        onChange={(e) => setCashReceived(e.target.checked)}
                        type="checkbox"
                        className="h-4 w-4 rounded accent-emerald-700"
                      />
                      <span>Cash received: {currency(total)}</span>
                    </label>
                  </section>

                  {/* Section 5: Documents (Optional) */}
                  {canManageKyc && (
                    <section className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">Documents (optional)</h3>
                      <p className="text-xs sm:text-sm text-slate-500">
                        Attachments remain pending until an authorized operator verifies the ID.
                      </p>

                      <div className="grid gap-4 sm:grid-cols-2">
                        {/* Enhanced KYC Photo Upload Box with Preview & Delete */}
                        <AllotmentDocumentUploadBox
                          label="KYC photo"
                          helperText="Customer facial headshot"
                          file={photo}
                          onFileChange={handlePhotoChange}
                          onPreview={handleOpenPreview}
                          imagesOnly={true}
                          category="photo"
                          disabled={busy || uncertain}
                        />

                        {/* Enhanced ID Proof Upload Box with Preview & Delete */}
                        <AllotmentDocumentUploadBox
                          label="ID proof (image or PDF)"
                          helperText={documentNumber.trim() ? `${documentType} proof` : 'Generic KYC document'}
                          file={idFile}
                          onFileChange={handleIdFileChange}
                          onPreview={handleOpenPreview}
                          category="id"
                          disabled={busy || uncertain}
                        />
                      </div>
                    </section>
                  )}
                </fieldset>

                {/* Error Banner */}
                {error && (
                  <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs sm:text-sm text-rose-800 font-semibold shadow-2xs">
                    {error}
                  </p>
                )}

                {!canCollect && (
                  <p role="alert" className="text-xs sm:text-sm text-rose-800 font-semibold">
                    Your role requires payment and deposit collection permissions for this combined flow.
                  </p>
                )}

                {uploadStatus && (
                  <p role="status" className="text-xs sm:text-sm text-emerald-800 font-bold flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {uploadStatus}
                  </p>
                )}
              </div>

              {/* Modal Footer */}
              <footer className="vault-allotment-footer flex items-center justify-end gap-2.5 p-4 border-t border-slate-200 bg-white">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold cursor-pointer transition-colors"
                >
                  {uncertain ? 'Close' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  disabled={busy || !canCollect || (!customer && !hasPermission('customers.create'))}
                  className="px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{busy ? 'Saving Allotment...' : uncertain ? 'Check & Retry' : 'Collect & Allot Locker'}</span>
                </button>
              </footer>
            </form>
          )}
        </div>
      </div>

      {/* Receipt Modal */}
      {receipt && <PaymentReceiptModal payment={receipt} onClose={() => setReceipt(null)} />}

      {/* Full Document Preview Inspection Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          isOpen={previewDoc.isOpen}
          onClose={handleClosePreview}
          documentUrl={previewDoc.url}
          documentName={previewDoc.documentName}
          documentType={previewDoc.documentType}
          mimeType={previewDoc.mimeType}
          fileSize={previewDoc.fileSize}
          customerName={name || customer?.fullName || 'Allotment Customer'}
        />
      )}
    </>,
    document.body
  );
}
