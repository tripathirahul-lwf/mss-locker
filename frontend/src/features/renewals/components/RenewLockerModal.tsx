import { lockBodyScroll } from '../../../utils/bodyScrollLock';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2, X, RotateCw } from 'lucide-react';
import { LockerAllocation } from '../../allocations/types';
import { apiClient } from '../../../services/apiClient';
import { customerApi } from '../../customers/api/customerApi';
import { AllotmentDocumentUploadBox } from '../../allocations/components/AllotmentDocumentUploadBox';
import { DocumentPreviewModal } from '../../customers/components/DocumentPreviewModal';
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
  const [receipt, setReceipt] = useState('');
  const [receiptDate, setReceiptDate] = useState(today);
  const [file, setFile] = useState<File | null>(null);
  const [cashConfirmed, setCashConfirmed] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Document preview state for clean lightbox popup
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

  const handleOpenPreview = (selectedFile: File, label: string) => {
    const url = URL.createObjectURL(selectedFile);
    setPreviewDoc({
      isOpen: true,
      url,
      documentName: selectedFile.name,
      documentType: label,
      mimeType: selectedFile.type,
      fileSize: selectedFile.size,
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
  const readiness =
    allocation.status !== 'ACTIVE'
      ? 'This agreement is not active.'
      : !validDay(start)
      ? 'The current renewal date needs review.'
      : amountIssue ||
        nextIssue ||
        receiptDateIssue ||
        (!receipt.trim() ? 'Enter a receipt number to enable Renew.' : '') ||
        (!cashConfirmed ? 'Confirm cash collection to proceed.' : '');
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
          ? 'Could not confirm the saved renewal. Do not collect cash again. Check & retry using this same request.'
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
    'mt-1.5 w-full h-11 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 transition-colors shadow-2xs font-medium';

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-xs sm:p-6">
      <div
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-labelledby="renew-cash-title"
        tabIndex={-1}
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl outline-none"
      >
        {/* Header */}
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-6 py-5 sm:px-8">
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
            <p className="mt-1 text-xs sm:text-sm text-slate-600">
              <strong className="text-slate-900">
                {allocation.customerId?.fullName || 'Customer'}
              </strong>{' '}
              &middot; Current Renewal: {ledgerDate(start)}
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
          <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5 sm:px-8">
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs sm:text-sm text-rose-900 font-medium"
              >
                {error}
              </p>
            )}

            <fieldset disabled={busy || uncertain} className="space-y-5">
              {/* 1. Tenure & Next Renewal Date */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Tenure &amp; Coverage Period
                </h3>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700">
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

                  <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                    Total renewal rent (₹)
                    <input
                      aria-label="Amount paid"
                      className={inputClass}
                      type="number"
                      min="0.01"
                      max="100000000"
                      step="0.01"
                      required
                      aria-invalid={Boolean(amountIssue)}
                      aria-describedby={amountIssue ? 'renew-amount-error' : undefined}
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        annualRate.current =
                          e.target.value.trim() !== '' &&
                          Number.isFinite(Number(e.target.value)) &&
                          Number(e.target.value) > 0
                            ? (Number(e.target.value) * 12) / terms[term]
                            : null;
                      }}
                    />
                  </label>
                </div>

                {amountIssue && (
                  <p id="renew-amount-error" className="text-xs text-rose-800 font-medium">
                    {amountIssue}
                  </p>
                )}

                {/* Next Renewal Date Card */}
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                        Next Renewal Due Date
                      </span>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Coverage:{' '}
                        <strong className="text-slate-800">{ledgerDate(start)}</strong>{' '}
                        &rarr;{' '}
                        <strong className="text-slate-800">
                          {ledgerDate(coverageEnd)}
                        </strong>
                      </p>
                    </div>
                    <input
                      aria-label="Next renewal date"
                      type="date"
                      required
                      aria-invalid={Boolean(nextIssue)}
                      aria-describedby="renew-coverage"
                      value={next}
                      min={
                        start
                          ? day(
                              new Date(Date.parse(start) + 86400000).toISOString()
                            )
                          : undefined
                      }
                      onChange={(e) => setNext(e.target.value)}
                      className="h-10 rounded-xl border border-emerald-300 bg-white px-3 text-sm font-bold text-emerald-900 shadow-2xs"
                    />
                  </div>

                  {nextIssue && (
                    <p className="mt-2 text-xs text-rose-800 font-semibold">{nextIssue}</p>
                  )}

                  {customPeriod && (
                    <p className="mt-2 text-xs text-amber-900 font-medium">
                      Custom renewal date selected. The amount has not been changed.{' '}
                      <button
                        type="button"
                        className="font-bold underline"
                        onClick={() => setNext(tenureDate(start, term))}
                      >
                        Reset to tenure date
                      </button>
                    </p>
                  )}

                  {start > today() && (
                    <div className="mt-2.5 rounded-xl bg-amber-100/70 border border-amber-200 p-2.5 text-xs text-amber-950 font-medium">
                      Advance renewal: new coverage starts on{' '}
                      <strong>{ledgerDate(start)}</strong>. Today (
                      {ledgerDate(today())}) is the collection date.
                    </div>
                  )}
                </div>
              </section>

              {/* 2. Charges & Financial Summary */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Renewal Charges &amp; 18% GST
                </h3>
                <dl className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-xs sm:text-sm">
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
                  <div className="flex justify-between gap-3 border-t border-slate-200 pt-2.5 text-sm sm:text-base font-bold text-slate-900">
                    <dt>Total Cash To Collect</dt>
                    <dd className="font-mono font-bold text-emerald-800">
                      ₹{numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </dd>
                  </div>
                </dl>
              </section>

              {/* 3. Receipt & Payment Confirmation */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Receipt &amp; Payment Details
                </h3>

                <div className="grid gap-3.5 sm:grid-cols-2">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700">
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

                  <label className="block text-xs sm:text-sm font-semibold text-slate-700">
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

                {/* Enhanced Document Upload Box with Preview & Delete */}
                <AllotmentDocumentUploadBox
                  label="Receipt image or PDF (optional)"
                  helperText="Upload scanned cash receipt or online payment advice (Max 5 MB)"
                  file={file}
                  onFileChange={(selected) => {
                    setFile(selected);
                    uploaded.current = null;
                  }}
                  onPreview={handleOpenPreview}
                  category="receipt"
                  disabled={busy || uncertain}
                />

                {/* Confirmation Checkbox */}
                <label className="flex items-center gap-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 p-3.5 text-xs sm:text-sm font-bold text-emerald-900 cursor-pointer shadow-2xs">
                  <input
                    type="checkbox"
                    checked={cashConfirmed}
                    onChange={(e) => setCashConfirmed(e.target.checked)}
                    className="h-4 w-4 rounded accent-emerald-700 cursor-pointer"
                  />
                  <span>
                    Cash received: ₹
                    {numAmount.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
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
          <footer className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-4 sm:px-8">
            <Button
              type="button"
              disabled={busy}
              variant="outline"
              onClick={onClose}
              className="h-11 rounded-xl px-5 text-xs sm:text-sm font-semibold border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Close
            </Button>
            <Button
              type="submit"
              disabled={busy || (!valid && !uncertain)}
              className="h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-6 text-xs sm:text-sm font-bold text-white shadow-xs transition-colors disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              {busy
                ? uploadProgress !== null
                  ? 'Uploading receipt...'
                  : 'Saving...'
                : uncertain
                ? 'Check & retry renewal'
                : 'Renew Locker'}
            </Button>
          </footer>
        </form>
      </div>

      {/* Clean Document Lightbox Preview Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          isOpen={previewDoc.isOpen}
          onClose={handleClosePreview}
          documentUrl={previewDoc.url}
          documentName={previewDoc.documentName}
          documentType={previewDoc.documentType}
          mimeType={previewDoc.mimeType}
          fileSize={previewDoc.fileSize}
          customerName={allocation.customerId?.fullName}
        />
      )}
    </div>,
    document.body
  );
}
