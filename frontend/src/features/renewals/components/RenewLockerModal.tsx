import { lockBodyScroll } from '../../../utils/bodyScrollLock';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Loader2,
  X,
  RotateCw,
  Camera,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Trash2,
  Eye,
  CheckCircle2,
  Banknote,
  QrCode,
  Building2,
} from 'lucide-react';
import { LockerAllocation } from '../../allocations/types';
import { apiClient } from '../../../services/apiClient';
import { customerApi } from '../../customers/api/customerApi';
import { DocumentPreviewModal } from '../../customers/components/DocumentPreviewModal';
import { CameraCaptureModal } from '../../payments/components/CameraCaptureModal';
import { Button } from '../../../components/ui/button';
import { ledgerDate } from '../../lockers/components/OccupiedLockerSummary';

interface ReceiptAsset {
  fileUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
}

interface CollectionPayload {
  requestId: string;
  allocationId: string;
  expectedRenewalDate: string;
  nextRenewalDueDate: string;
  billingCycle: string;
  amount: number;
  receiptNumber: string;
  receiptDate: string;
  cashReceived: boolean;
  paymentMethod?: 'CASH' | 'UPI' | 'BANK_TRANSFER';
  paymentReference?: string;
  receipt?: ReceiptAsset;
}

const terms: Record<string, number> = {
  ANNUAL: 12,
  TRIENNIAL: 36,
  HALF_YEARLY: 6,
  QUARTERLY: 3,
  MONTHLY: 1,
};

const day = (v?: string) =>
  v && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString().slice(0, 10) : '';

const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function tenureDate(start: string, term: string) {
  if (!start) return '';
  const date = new Date(start + 'T00:00:00Z');
  const n = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + (terms[term] || 12));
  date.setUTCDate(
    Math.min(
      n,
      new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
    )
  );
  return day(date.toISOString());
}

export function RenewLockerModal({
  allocation,
  onClose,
  onComplete,
}: {
  allocation: LockerAllocation;
  onClose: () => void;
  onComplete: () => void;
}) {
  const paidThrough = day(allocation.paidThroughDate);
  const start =
    day(allocation.nextRenewalDueDate) ||
    (paidThrough
      ? day(new Date(Date.parse(paidThrough) + 86400000).toISOString())
      : '');
  const initialTerm = terms[allocation.billingCycle]
    ? allocation.billingCycle
    : 'ANNUAL';
  const annual = allocation.rentSnapshot ?? allocation.annualRent;

  const [term, setTerm] = useState<string>(initialTerm);
  const [amount, setAmount] = useState(
    Number.isFinite(annual) && annual >= 0
      ? String(Math.round(((annual * terms[initialTerm]) / 12) * 100) / 100)
      : ''
  );
  const [next, setNext] = useState(tenureDate(start, initialTerm));
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER'>('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [receipt, setReceipt] = useState('');
  const [receiptDate, setReceiptDate] = useState(today);
  const [file, setFile] = useState<File | null>(null);
  const [cashConfirmed, setCashConfirmed] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Tablet Camera and Document Preview State
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [previewDoc, setPreviewDoc] = useState<{
    isOpen: boolean;
    url: string;
    documentName: string;
    documentType: string;
    mimeType: string;
    fileSize: number;
  } | null>(null);

  const annualRate = useRef<number | null>(
    Number.isFinite(annual) && annual >= 0 ? annual : null
  );
  const root = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  const frozen = useRef<CollectionPayload | null>(null);
  const uploaded = useRef<ReceiptAsset | null>(null);
  const live = useRef({ busy, onClose });
  live.current = { busy, onClose };

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const backdrop = root.current?.parentElement;
    const background = Array.from(document.body.children).filter(
      (node) => node !== backdrop && !node.hasAttribute('inert')
    );
    background.forEach((node) => node.setAttribute('inert', ''));
    const releaseScroll = lockBodyScroll();
    root.current?.focus();

    const key = (e: KeyboardEvent) => {
      if (
        Array.from(
          document.querySelectorAll('[role="dialog"], [role="alertdialog"]')
        ).at(-1) !== root.current
      )
        return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!live.current.busy) live.current.onClose();
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(
        root.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled)'
        ) || []
      ).filter((v) => v.getClientRects().length && !v.closest('fieldset:disabled'));
      const first = items[0],
        last = items.at(-1);
      if (!first) {
        e.preventDefault();
        return;
      }
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !root.current?.contains(document.activeElement) ||
          document.activeElement === root.current)
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !root.current?.contains(document.activeElement) ||
          document.activeElement === root.current)
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      releaseScroll();
      document.removeEventListener('keydown', key, true);
      background.forEach((node) => node.removeAttribute('inert'));
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  const handleSelectFile = (selectedFile: File) => {
    const MAX_SIZE = 5 * 1024 * 1024;
    if (selectedFile.size > MAX_SIZE) {
      setError('File exceeds 5MB limit. Please upload a smaller compressed image or PDF.');
      return;
    }
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validMimes.includes(selectedFile.type.toLowerCase())) {
      setError('Only JPG, PNG, WebP, and PDF files are supported.');
      return;
    }
    setError('');
    setFile(selectedFile);
    uploaded.current = null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      handleSelectFile(selected);
    }
    if (e.target) e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const selected = e.dataTransfer.files?.[0];
    if (selected) {
      handleSelectFile(selected);
    }
  };

  const handleRemoveFile = () => {
    if (previewDoc?.url) {
      URL.revokeObjectURL(previewDoc.url);
      setPreviewDoc(null);
    }
    setFile(null);
    uploaded.current = null;
  };

  const handleOpenLocalPreview = () => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewDoc({
      isOpen: true,
      url,
      documentName: file.name,
      documentType:
        paymentMethod === 'UPI'
          ? 'UPI Payment Proof'
          : paymentMethod === 'BANK_TRANSFER'
          ? 'Bank Transfer Advice'
          : 'Cash Voucher',
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

  const validDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && day(v) === v;
  const numAmount = Number(amount);
  const amountIssue =
    amount.trim() === '' ||
    !Number.isFinite(numAmount) ||
    numAmount <= 0 ||
    numAmount > 100000000 ||
    Math.abs(numAmount * 100 - Math.round(numAmount * 100)) >= 0.00001
      ? 'Enter a positive amount with at most two decimal places.'
      : '';
  const nextIssue =
    !validDay(next) || !validDay(start) || next <= start
      ? 'Next renewal date must be after the current renewal date.'
      : '';
  const receiptDateIssue =
    !validDay(receiptDate) ||
    receiptDate > today() ||
    !validDay(day(allocation.startDate)) ||
    receiptDate < day(allocation.startDate)
      ? 'Receipt date must be between the opening date and today.'
      : '';

  const referenceIssue =
    paymentMethod === 'UPI' && !paymentReference.trim()
      ? 'Enter UPI reference / UTR number.'
      : paymentMethod === 'BANK_TRANSFER' && !paymentReference.trim()
      ? 'Enter Bank Transfer / IMPS UTR number.'
      : '';

  const readiness =
    allocation.status !== 'ACTIVE'
      ? 'This agreement is not active.'
      : !validDay(start)
      ? 'The current renewal date needs review.'
      : amountIssue ||
        nextIssue ||
        receiptDateIssue ||
        (!receipt.trim() ? 'Enter a receipt number to enable Renew.' : '') ||
        referenceIssue ||
        (!cashConfirmed ? 'Confirm payment collection to proceed.' : '');
  const valid = !readiness;
  const customPeriod =
    validDay(start) && validDay(next) && next > start && next !== tenureDate(start, term);
  const coverageEnd = validDay(next)
    ? day(new Date(Date.parse(next) - 86400000).toISOString())
    : '';

  // Calculate Base Rent & 18% GST breakdown
  const baseRent =
    Number.isFinite(numAmount) && numAmount > 0
      ? Math.round((numAmount / 1.18) * 100) / 100
      : 0;
  const gstTax =
    Number.isFinite(numAmount) && numAmount > 0
      ? Math.round((numAmount - baseRent) * 100) / 100
      : 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (lock.current || (!valid && !uncertain)) return;
    lock.current = true;
    setBusy(true);
    setError('');
    let posted = false,
      saved = false;
    try {
      if (!frozen.current) {
        if (file && !uploaded.current) {
          setUploadProgress(0);
          const asset = await customerApi.uploadFile(
            file,
            'payments',
            setUploadProgress
          );
          uploaded.current = {
            fileUrl: asset.fileUrl,
            fileName: asset.fileName,
            mimeType: asset.mimeType || file.type,
            size: asset.size,
          };
          setUploadProgress(null);
        }
        frozen.current = {
          requestId: requestId.current,
          allocationId: allocation._id,
          expectedRenewalDate: start,
          nextRenewalDueDate: next,
          billingCycle: next === tenureDate(start, term) ? term : 'CUSTOM',
          amount: Number(amount),
          receiptNumber: receipt.trim(),
          receiptDate,
          cashReceived: true,
          paymentMethod,
          ...(paymentReference.trim() ? { paymentReference: paymentReference.trim() } : {}),
          ...(uploaded.current ? { receipt: uploaded.current } : {}),
        };
      }
      posted = true;
      await apiClient.post('/renewals/collect', frozen.current);
      saved = true;
    } catch (err: any) {
      const ambiguous =
        posted && (uncertain || !err.response || err.response.status >= 500);
      setUncertain(ambiguous);
      setError(
        ambiguous
          ? 'Could not confirm the saved renewal. Do not collect payment again. Check & retry using this same request.'
          : err.response?.data?.message || err.message || 'Could not renew this locker.'
      );
      if (!ambiguous) {
        frozen.current = null;
        requestId.current = crypto.randomUUID();
      }
    } finally {
      lock.current = false;
      setBusy(false);
      setUploadProgress(null);
    }
    if (saved) onComplete();
  };

  const inputClass =
    'mt-1 w-full h-10 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 transition-colors shadow-2xs font-medium';

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-xs sm:p-5">
      <div
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-labelledby="renew-cash-title"
        tabIndex={-1}
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl outline-none"
      >
        {/* Header */}
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-7">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                <RotateCw className="h-4 w-4" />
              </span>
              <h2
                id="renew-cash-title"
                className="text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl"
              >
                Renew &mdash; Locker {allocation.lockerId?.lockerNumber}
              </h2>
            </div>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-600">
              <strong className="text-slate-900">
                {allocation.customerId?.fullName || 'Customer'}
              </strong>{' '}
              {allocation.lockerId?.size ? `(Size ${allocation.lockerId.size})` : ''} &middot; Current Renewal: {ledgerDate(start)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close renewal"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Form Body */}
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4 sm:px-7">
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs sm:text-sm text-rose-900 font-medium"
              >
                {error}
              </p>
            )}

            <fieldset disabled={busy || uncertain} className="space-y-4">
              {/* 1. Tenure & Next Renewal Date */}
              <section className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Tenure &amp; Coverage Period
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Renewal tenure
                    <select
                      aria-label="Next tenure"
                      className={inputClass}
                      value={term}
                      onChange={(e) => {
                        const value = e.target.value;
                        setTerm(value);
                        setNext(tenureDate(start, value));
                        setAmount(
                          annualRate.current === null
                            ? ''
                            : String(
                                Math.round(
                                  ((annualRate.current * terms[value]) / 12) * 100
                                ) / 100
                              )
                        );
                      }}
                    >
                      <option value="ANNUAL">1 Year (12 Months)</option>
                      <option value="TRIENNIAL">3 Years (36 Months)</option>
                      <option value="HALF_YEARLY">6 Months</option>
                      <option value="QUARTERLY">3 Months</option>
                      <option value="MONTHLY">1 Month</option>
                    </select>
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Total renewal rent (₹)
                    <input
                      aria-label="Renewal amount"
                      className={inputClass}
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </label>
                </div>

                <div className="rounded-2xl border border-emerald-300/80 bg-emerald-50/60 p-3 text-xs text-emerald-950 font-medium shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-bold uppercase tracking-wider text-[11px] text-emerald-800">
                        Next Renewal Due Date
                      </span>
                      <p className="mt-0.5 text-xs text-slate-700 font-semibold">
                        Coverage:{' '}
                        <strong>
                          {ledgerDate(start)} &mdash; {ledgerDate(coverageEnd)}
                        </strong>
                      </p>
                    </div>
                    <input
                      type="date"
                      aria-label="Next renewal due date"
                      className="h-9 rounded-xl border border-emerald-400 bg-white px-3 py-1 font-mono font-bold text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-700 cursor-pointer"
                      min={start}
                      value={next}
                      onChange={(e) => setNext(e.target.value)}
                    />
                  </div>

                  {customPeriod && (
                    <p className="mt-2 text-[11px] text-amber-900 font-medium">
                      Custom renewal date selected. The amount has not been changed.{' '}
                      <button
                        type="button"
                        className="font-bold underline cursor-pointer"
                        onClick={() => setNext(tenureDate(start, term))}
                      >
                        Reset to tenure date
                      </button>
                    </p>
                  )}

                  {start > today() && (
                    <div className="mt-2 rounded-xl bg-amber-100/70 border border-amber-200 p-2 text-[11px] text-amber-950 font-medium">
                      Advance renewal: new coverage starts on{' '}
                      <strong>{ledgerDate(start)}</strong>. Today ({ledgerDate(today())}) is the collection date.
                    </div>
                  )}
                </div>
              </section>

              {/* 2. Charges & Financial Summary */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Renewal Charges &amp; 18% GST
                </h3>
                <dl className="space-y-1.5 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-xs sm:text-sm">
                  <div className="flex justify-between gap-3 text-slate-600">
                    <dt>Base Rent ({terms[term] ? `${terms[term]} Months` : '1 Year'})</dt>
                    <dd className="font-mono font-semibold">
                      ₹{baseRent.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 text-slate-600">
                    <dt>GST @ 18% (SGST 9% + CGST 9%)</dt>
                    <dd className="font-mono font-semibold">
                      ₹{gstTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 text-sm sm:text-base font-bold text-slate-900">
                    <dt>Total To Collect</dt>
                    <dd className="font-mono font-bold text-emerald-800">
                      ₹{numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </dd>
                  </div>
                </dl>
              </section>

              {/* 3. Payment Method & Receipt Details */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Payment Method &amp; Receipt Details
                </h3>

                {/* Payment Method Selector */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Payment Method <span aria-hidden="true" className="text-rose-600">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CASH')}
                      className={`h-10 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                        paymentMethod === 'CASH'
                          ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <Banknote className="w-4 h-4" />
                      <span>Cash</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('UPI')}
                      className={`h-10 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                        paymentMethod === 'UPI'
                          ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <QrCode className="w-4 h-4" />
                      <span>UPI</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('BANK_TRANSFER')}
                      className={`h-10 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                        paymentMethod === 'BANK_TRANSFER'
                          ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      <span>Bank Transfer</span>
                    </button>
                  </div>
                </div>

                {/* Dynamic Reference Field */}
                {paymentMethod === 'UPI' && (
                  <div className="space-y-1.5 p-3 rounded-xl bg-violet-50/80 border border-violet-200">
                    <label htmlFor="renew-upi-reference" className="font-semibold text-xs sm:text-sm text-violet-950 flex items-center gap-1.5">
                      <QrCode className="w-4 h-4 text-violet-700" />
                      <span>UPI Reference / UTR Number <span className="text-rose-600 font-bold">*</span></span>
                    </label>
                    <input
                      id="renew-upi-reference"
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      required
                      maxLength={100}
                      placeholder="e.g. 423589234821 or UPI Ref ID"
                      className="w-full h-10 px-3.5 text-sm bg-white border border-violet-300 font-mono rounded-xl focus:outline-hidden focus:border-violet-600 focus:ring-2 focus:ring-violet-600/20 shadow-xs transition"
                    />
                  </div>
                )}

                {paymentMethod === 'BANK_TRANSFER' && (
                  <div className="space-y-1.5 p-3 rounded-xl bg-blue-50/80 border border-blue-200">
                    <label htmlFor="renew-bank-reference" className="font-semibold text-xs sm:text-sm text-blue-950 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-blue-700" />
                      <span>Bank Transfer UTR / IMPS Reference <span className="text-rose-600 font-bold">*</span></span>
                    </label>
                    <input
                      id="renew-bank-reference"
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      required
                      maxLength={100}
                      placeholder="e.g. HDFCN00012345678"
                      className="w-full h-10 px-3.5 text-sm bg-white border border-blue-300 font-mono rounded-xl focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 shadow-xs transition"
                    />
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Receipt number{' '}
                    <span aria-hidden="true" className="text-rose-600 font-bold">
                      *
                    </span>
                    <input
                      aria-label="Receipt number"
                      className={inputClass}
                      required
                      maxLength={100}
                      value={receipt}
                      onChange={(e) => setReceipt(e.target.value)}
                      placeholder="e.g. REC-2026-001"
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Receipt date{' '}
                    <span aria-hidden="true" className="text-rose-600 font-bold">
                      *
                    </span>
                    <input
                      className={inputClass}
                      type="date"
                      required
                      min={day(allocation.startDate)}
                      max={today()}
                      aria-invalid={Boolean(receiptDateIssue)}
                      aria-describedby={
                        receiptDateIssue ? 'renew-receipt-date-error' : undefined
                      }
                      value={receiptDate}
                      onChange={(e) => setReceiptDate(e.target.value)}
                    />
                  </label>
                </div>

                {receiptDateIssue && (
                  <p
                    id="renew-receipt-date-error"
                    className="text-xs text-rose-800 font-medium"
                  >
                    {receiptDateIssue}
                  </p>
                )}

                {/* Consistent Tablet Upload Component with Camera & Browse */}
                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200/70 shrink-0">
                        <UploadCloud className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-900 block">
                          {paymentMethod === 'UPI' && 'UPI Payment Proof / Screenshot'}
                          {paymentMethod === 'BANK_TRANSFER' && 'Bank Transfer Advice / NEFT Slip'}
                          {paymentMethod === 'CASH' && 'Cash Voucher / Signed Counter Slip'}
                        </label>
                        <p className="text-[11px] text-slate-500 font-normal">
                          Counter verification &bull; Max 5 MB (JPG, PNG, WebP, PDF)
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        paymentMethod === 'CASH'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                      }`}
                    >
                      {paymentMethod === 'CASH' ? 'Optional' : 'Recommended'}
                    </span>
                  </div>

                  {/* Hidden inputs */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {file ? (
                    /* Uploaded Document Card */
                    <div className="p-3 rounded-xl border border-emerald-300 bg-emerald-50/50 flex items-center justify-between gap-2.5 shadow-2xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-9 w-9 rounded-xl bg-emerald-800 text-white flex items-center justify-center shrink-0 shadow-xs">
                          {file.name.toLowerCase().endsWith('.pdf') ? (
                            <FileText className="w-4 h-4" />
                          ) : (
                            <ImageIcon className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-slate-900 text-xs sm:text-sm truncate max-w-[190px] sm:max-w-xs">
                              {file.name}
                            </p>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded flex items-center gap-1 shrink-0">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Ready
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            {formatFileSize(file.size)} &bull; Attached Proof
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={handleOpenLocalPreview}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-white hover:bg-emerald-100/80 border border-emerald-300 transition flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Preview</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          className="px-2 py-1.5 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition flex items-center gap-0.5 cursor-pointer"
                          title="Remove document"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span className="sr-only sm:not-sr-only">Remove</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Dual Action: Open Camera (Tablet) + Browse Files */
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setIsCameraModalOpen(true)}
                          className="p-3 rounded-xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50/50 hover:border-emerald-600 hover:bg-emerald-100/60 transition-all flex items-center gap-2.5 text-left cursor-pointer group shadow-2xs"
                        >
                          <div className="h-9 w-9 rounded-xl bg-emerald-800 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
                            <Camera className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                              <span>Open Camera</span>
                              <span className="bg-emerald-200/90 text-emerald-950 text-[10px] px-1 py-0.2 rounded font-black tracking-wide uppercase">
                                Tablet
                              </span>
                            </span>
                            <p className="text-xs text-emerald-900 font-medium truncate mt-0.5">
                              Snap slip or receipt photo
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all flex items-center gap-2.5 text-left cursor-pointer group"
                        >
                          <div className="h-9 w-9 rounded-xl bg-slate-200 text-slate-700 group-hover:bg-emerald-100 group-hover:text-emerald-800 flex items-center justify-center transition-colors shrink-0">
                            <UploadCloud className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 group-hover:text-emerald-950 text-xs sm:text-sm block">
                              Browse Files / Gallery
                            </span>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              Choose JPG, PNG, or PDF file
                            </p>
                          </div>
                        </button>
                      </div>

                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={handleDrop}
                        className={`py-1.5 px-3 rounded-lg border text-center text-[11px] transition-colors ${
                          isDragOver
                            ? 'border-emerald-500 bg-emerald-100/50 text-emerald-900 font-semibold'
                            : 'border-slate-200/60 bg-slate-50/50 text-slate-400'
                        }`}
                      >
                        Or drag &amp; drop receipt file here &bull; Max 5 MB
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirmation Checkbox */}
                <label className="flex items-center gap-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 p-3.5 text-xs sm:text-sm font-bold text-emerald-900 cursor-pointer shadow-2xs hover:bg-emerald-50 transition">
                  <input
                    type="checkbox"
                    checked={cashConfirmed}
                    onChange={(e) => setCashConfirmed(e.target.checked)}
                    className="h-4 w-4 rounded accent-emerald-700 cursor-pointer shrink-0"
                  />
                  <span>
                    {paymentMethod === 'CASH' && `Cash received: ₹${numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                    {paymentMethod === 'UPI' && `UPI payment received & verified: ₹${numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                    {paymentMethod === 'BANK_TRANSFER' && `Bank transfer received & verified: ₹${numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                  </span>
                </label>
              </section>
            </fieldset>

            {uploadProgress !== null && (
              <p
                role="status"
                className="text-xs font-semibold text-emerald-800 flex items-center gap-2"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading receipt document: {uploadProgress}%
              </p>
            )}

            {!busy && !uncertain && readiness && (
              <p
                id="renew-readiness"
                role="status"
                className="text-xs font-medium text-slate-500"
              >
                {readiness}
              </p>
            )}
          </div>

          {/* Footer CTA */}
          <footer className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50/70 px-5 py-3.5 sm:px-7">
            <Button
              type="button"
              disabled={busy}
              variant="outline"
              onClick={onClose}
              className="rounded-xl px-5 py-2 font-semibold text-sm cursor-pointer"
            >
              Close
            </Button>
            <Button
              type="submit"
              disabled={busy || (!valid && !uncertain)}
              className="rounded-xl bg-emerald-800 px-6 py-2 font-bold text-white hover:bg-emerald-900 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            >
              {busy ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Renewing...
                </span>
              ) : uncertain ? (
                'Check & Retry Renewal'
              ) : (
                <span className="flex items-center gap-1.5">
                  <Check className="h-4 w-4" />
                  <span>Renew Locker &bull; ₹{numAmount.toLocaleString('en-IN')}</span>
                </span>
              )}
            </Button>
          </footer>
        </form>
      </div>

      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleSelectFile}
        onFallbackNativeCamera={() => cameraInputRef.current?.click()}
      />

      {previewDoc && (
        <DocumentPreviewModal
          isOpen={previewDoc.isOpen}
          onClose={handleClosePreview}
          documentUrl={previewDoc.url}
          documentName={previewDoc.documentName}
          documentType={previewDoc.documentType}
          mimeType={previewDoc.mimeType}
          fileSize={previewDoc.fileSize}
        />
      )}
    </div>,
    document.body
  );
}
