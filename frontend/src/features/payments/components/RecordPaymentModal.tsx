import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  IndianRupee,
  Search,
  KeyRound,
  User,
  Calendar,
  CreditCard,
  QrCode,
  Banknote,
  Building2,
  Receipt,
  FileCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  RotateCw,
  ChevronDown,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Trash2,
  Eye,
  ExternalLink,
  Camera,
  Smartphone,
} from 'lucide-react';
import { renewalApi } from '../../renewals/api/renewalApi';
import { LockerInvoice } from '../../renewals/types';
import { RecordPaymentInput, PaymentMethod, Payment } from '../types';
import { paymentApi } from '../api/paymentApi';
import { customerApi } from '../../customers/api/customerApi';
import { CameraCaptureModal } from './CameraCaptureModal';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface RecordPaymentModalProps {
  initialInvoiceId?: string;
  onClose: () => void;
  onSubmit: (data: RecordPaymentInput, idempotencyKey: string) => Promise<Payment>;
  onSuccessViewReceipt?: (payment: Payment) => void;
}

export function RecordPaymentModal({
  initialInvoiceId,
  onClose,
  onSubmit,
  onSuccessViewReceipt,
}: RecordPaymentModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const searchRequestRef = useRef(0);
  const submittingRef = useRef(false);
  const closeRef = useRef(onClose);
  const localToday = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [invoiceList, setInvoiceList] = useState<LockerInvoice[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchRetry, setSearchRetry] = useState(0);
  const [selectedInvoice, setSelectedInvoice] = useState<LockerInvoice | null>(null);
  const [isLoadingInitialInvoice, setIsLoadingInitialInvoice] = useState(Boolean(initialInvoiceId));

  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentDate, setPaymentDate] = useState(localToday);

  // Dynamic references
  const [upiReference, setUpiReference] = useState('');
  const [bankReference, setBankReference] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [notes, setNotes] = useState('');

  // Proof / Document attachment state
  const [proofUrl, setProofUrl] = useState<string>('');
  const [proofDocumentName, setProofDocumentName] = useState<string>('');
  const [proofFileSize, setProofFileSize] = useState<number | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [proofUploadError, setProofUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [idempotencyKey] = useState(() => `IDEM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recordedPayment, setRecordedPayment] = useState<Payment | null>(null);

  useEffect(() => { submittingRef.current = isSubmitting; }, [isSubmitting]);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    titleRef.current?.focus();
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submittingRef.current) closeRef.current();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const controls = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  // If initialInvoiceId passed, fetch and prefill
  useEffect(() => {
    if (initialInvoiceId) {
      renewalApi.getInvoiceById(initialInvoiceId).then((inv) => {
        if (!inv) return;
        setSelectedInvoice(inv);
        setAmount(inv.balanceAmount);
      }).catch(() => setError('The selected invoice could not be loaded. Close this dialog and try again.'))
        .finally(() => setIsLoadingInitialInvoice(false));
    } else {
      setIsLoadingInitialInvoice(false);
    }
  }, [initialInvoiceId]);

  // Search outstanding invoices
  useEffect(() => {
    if (selectedInvoice || isLoadingInitialInvoice) return;
    const requestId = ++searchRequestRef.current;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const result = await renewalApi.getInvoices({
          search: invoiceQuery.trim() || undefined,
          paymentStatus: 'UNPAID',
          limit: 10,
        });
        if (requestId === searchRequestRef.current) setInvoiceList(result.invoices);
      } catch {
        if (requestId === searchRequestRef.current) setSearchError('Outstanding invoices could not be loaded.');
      } finally {
        if (requestId === searchRequestRef.current) setIsSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [invoiceQuery, selectedInvoice, searchRetry, isLoadingInitialInvoice]);

  const handleSelectInvoice = (inv: LockerInvoice) => {
    setSelectedInvoice(inv);
    setAmount(inv.balanceAmount);
    setError(null);
  };

  const handleFileUpload = async (file: File) => {
    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_SIZE) {
      setProofUploadError('File exceeds 5MB limit. Please upload a smaller compressed image or PDF.');
      return;
    }

    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validMimes.includes(file.type.toLowerCase())) {
      setProofUploadError('Only JPG, PNG, WebP, and PDF files are supported.');
      return;
    }

    setProofUploadError(null);
    setIsUploadingProof(true);
    setUploadProgress(15);

    try {
      const result = await paymentApi.uploadProof(file, (percent) => {
        setUploadProgress(percent);
      });
      setProofUrl(result.fileUrl);
      setProofDocumentName(file.name);
      setProofFileSize(file.size);
    } catch (err: any) {
      setProofUploadError(err.response?.data?.message || err.message || 'Failed to upload document proof.');
    } finally {
      setIsUploadingProof(false);
      setUploadProgress(0);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    if (e.target) e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleRemoveProof = () => {
    setProofUrl('');
    setProofDocumentName('');
    setProofFileSize(null);
    setProofUploadError(null);
  };

  const handleOpenProof = () => {
    if (!proofUrl) return;
    customerApi.openProtectedFile(proofUrl).catch(() => {
      window.open(proofUrl, '_blank', 'noopener,noreferrer');
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) {
      setError('Please select an invoice to settle.');
      return;
    }

    if (amount <= 0) {
      setError('Payment amount must be greater than 0.');
      return;
    }

    if (selectedInvoice.balanceAmount <= 0) {
      setError('This invoice no longer has an outstanding balance. Select another invoice.');
      return;
    }

    if (amount > selectedInvoice.balanceAmount) {
      setError(
        `Payment amount (₹${amount.toLocaleString('en-IN')}) cannot exceed current outstanding balance (₹${selectedInvoice.balanceAmount.toLocaleString('en-IN')}).`
      );
      return;
    }

    if (paymentMethod === 'UPI' && !upiReference.trim()) return setError('UPI reference/UTR number is required.');
    if (paymentMethod === 'BANK_TRANSFER' && !bankReference.trim()) return setError('Bank UTR/IMPS reference is required.');
    if ((paymentMethod === 'CARD' || paymentMethod === 'OTHER') && !transactionReference.trim()) return setError('Manual transaction reference is required.');
    if (paymentMethod === 'CHEQUE' && (!chequeNumber.trim() || !bankName.trim() || !chequeDate)) return setError('Cheque number, bank name and cheque date are required.');

    setError(null);
    setIsSubmitting(true);

    try {
      const payment = await onSubmit(
        {
          invoiceId: selectedInvoice._id,
          amount: Number(amount),
          paymentMethod,
          paymentDate,
          upiReference: paymentMethod === 'UPI' ? upiReference.trim() : undefined,
          bankReference: paymentMethod === 'BANK_TRANSFER' ? bankReference.trim() : undefined,
          transactionReference: paymentMethod === 'CARD' || paymentMethod === 'OTHER' ? transactionReference.trim() : undefined,
          chequeNumber: paymentMethod === 'CHEQUE' ? chequeNumber.trim() : undefined,
          bankName: paymentMethod === 'CHEQUE' ? bankName.trim() : undefined,
          chequeDate: paymentMethod === 'CHEQUE' ? chequeDate : undefined,
          proofUrl: proofUrl.trim() || undefined,
          proofDocumentName: proofDocumentName.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        idempotencyKey
      );

      setRecordedPayment(payment);
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || 'Failed to record payment transaction.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const remainingBalance = selectedInvoice ? Math.max(0, selectedInvoice.balanceAmount - (Number(amount) || 0)) : 0;

  const modalContent = (
    <div
      className="fixed inset-0 z-[120] flex h-[100dvh] w-screen items-center justify-center bg-slate-900/60 p-3 backdrop-blur-xs select-none animate-in fade-in-0 duration-150 sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-payment-title"
        aria-describedby="record-payment-description"
        className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[92vh] border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:px-6 sm:py-4.5 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-800 text-white flex items-center justify-center shadow-xs">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <h2
                ref={titleRef}
                tabIndex={-1}
                id="record-payment-title"
                className="text-base sm:text-lg font-bold text-slate-900 tracking-tight outline-none"
              >
                Record Payment Collection
              </h2>
              <p id="record-payment-description" className="text-xs text-slate-500 font-normal mt-0.5">
                Cashier collection and official receipt issuance
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-8 w-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Success Screen */}
        {recordedPayment ? (
          <div role="status" aria-live="polite" className="p-6 sm:p-8 space-y-6 text-center overflow-y-auto flex-1 text-xs">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto border border-emerald-200 shadow-xs">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">
                Payment Recorded Successfully!
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Receipt #{recordedPayment.receiptNumber} &bull; Payment #{recordedPayment.paymentNumber}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 max-w-md mx-auto space-y-2.5 text-left text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Amount Received:</span>
                <strong className="text-emerald-950 font-black text-sm">
                  ₹{recordedPayment.amount.toLocaleString('en-IN')}
                </strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Payment Method:</span>
                <strong className="text-slate-800 font-bold">
                  {recordedPayment.paymentMethod}
                </strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Remaining Invoice Balance:</span>
                <strong className="text-slate-800 font-bold">
                  ₹{(recordedPayment.invoiceId?.balanceAmount ?? remainingBalance).toLocaleString('en-IN')}
                </strong>
              </div>
              {recordedPayment.proofUrl && (
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-slate-500 font-medium">Transaction Proof:</span>
                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Attached</span>
                    <button
                      type="button"
                      onClick={() => {
                        customerApi.openProtectedFile(recordedPayment.proofUrl!).catch(() => {
                          window.open(recordedPayment.proofUrl, '_blank', 'noopener,noreferrer');
                        });
                      }}
                      className="ml-1 text-emerald-800 hover:text-emerald-950 underline flex items-center gap-0.5 cursor-pointer font-semibold"
                    >
                      <span>View</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl font-semibold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                Close Window
              </button>

              {onSuccessViewReceipt && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSuccessViewReceipt(recordedPayment);
                  }}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-800 hover:bg-emerald-900 transition shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <Receipt className="w-4 h-4" />
                  <span>View Official Receipt</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Payment Form Body */
          <>
            <form id="record-payment-form" onSubmit={handleFormSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {error && (
                <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* 1. Invoice Selection */}
              {isLoadingInitialInvoice ? (
                <div role="status" className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center font-semibold text-slate-600">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-emerald-800" aria-hidden="true" />
                  <span>Loading selected statement...</span>
                </div>
              ) : !selectedInvoice ? (
                <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 sm:p-5 space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-lg bg-emerald-800 text-white text-xs font-bold flex items-center justify-center shadow-xs">
                        1
                      </div>
                      <h3 className="font-bold text-slate-800 text-xs sm:text-sm">
                        Search & Select Outstanding Invoiced Statement
                      </h3>
                    </div>
                    {!selectedInvoice && invoiceList.length > 0 && (
                      <span className="text-[11px] text-slate-500 font-medium">
                        <span className="font-bold text-emerald-800">{invoiceList.length}</span> Unpaid Statements
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      id="invoice-search"
                      type="text"
                      value={invoiceQuery}
                      onChange={(e) => setInvoiceQuery(e.target.value)}
                      placeholder="Search invoice number (e.g. INV-2026-000001), customer, phone, or locker..."
                      className="w-full h-11 pl-10 pr-10 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 text-sm focus:outline-hidden focus:border-emerald-600 focus:ring-3 focus:ring-emerald-600/15 shadow-xs transition hover:border-slate-400 placeholder:text-slate-400 placeholder:font-normal"
                    />
                    {invoiceQuery && (
                      <button
                        type="button"
                        onClick={() => setInvoiceQuery('')}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                        aria-label="Clear search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {isSearching && (
                    <div role="status" className="p-6 text-center text-slate-500 font-semibold flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-800" aria-hidden="true" />
                      <span>Searching outstanding invoices...</span>
                    </div>
                  )}

                  {searchError && !isSearching && (
                    <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800 font-medium">
                      <span>{searchError}</span>
                      <button
                        type="button"
                        onClick={() => setSearchRetry((value) => value + 1)}
                        className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <RotateCw className="h-3 w-3" />
                        <span>Retry</span>
                      </button>
                    </div>
                  )}

                  {!isSearching && !searchError && invoiceList.length === 0 && (
                    <p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-center text-slate-500 font-medium">
                      No unpaid invoices match this search.
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                    {invoiceList.map((inv) => (
                      <button
                        type="button"
                        key={inv._id}
                        onClick={() => handleSelectInvoice(inv)}
                        className="p-3.5 text-left rounded-xl border border-slate-200 bg-white hover:border-emerald-600 hover:bg-emerald-50/50 cursor-pointer transition-all flex flex-col justify-between gap-2.5 shadow-2xs hover:shadow-xs group focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                        aria-label={`Select invoice ${inv.invoiceNumber} for ${inv.customerId?.fullName}, balance ₹${inv.balanceAmount.toLocaleString('en-IN')}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md text-[11px] border border-slate-200/80">
                            {inv.invoiceNumber}
                          </span>
                          <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md text-[11px] border border-emerald-200/60">
                            Locker #{inv.lockerId?.lockerNumber} ({inv.lockerId?.size})
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                          <span className="font-bold text-slate-800 truncate max-w-[170px]">
                            {inv.customerId?.fullName}
                          </span>
                          <span className="font-bold text-rose-600 tabular-nums">
                            Due: ₹{inv.balanceAmount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Selected Invoice Card */
                <div className="rounded-2xl border border-emerald-300 bg-white p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <FileCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          {selectedInvoice.invoiceNumber}
                        </span>
                        <span className="font-bold text-xs text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          Locker #{selectedInvoice.lockerId?.lockerNumber} ({selectedInvoice.lockerId?.size})
                        </span>
                        <span className="text-[10.5px] font-bold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Verified
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        Tenant: <strong className="text-slate-900">{selectedInvoice.customerId?.fullName}</strong> &bull; Total: ₹{selectedInvoice.totalAmount.toLocaleString('en-IN')} &bull; Outstanding: <strong className="text-rose-600">₹{selectedInvoice.balanceAmount.toLocaleString('en-IN')}</strong>
                      </p>
                    </div>
                  </div>
                  {!initialInvoiceId && (
                    <button
                      type="button"
                      onClick={() => setSelectedInvoice(null)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
                    >
                      Change Statement
                    </button>
                  )}
                </div>
              )}

              {/* 2. Payment Details */}
              {selectedInvoice && (
                <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 sm:p-5 space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-lg bg-emerald-800 text-white text-xs font-bold flex items-center justify-center shadow-xs">
                        2
                      </div>
                      <h3 className="font-bold text-slate-800 text-xs sm:text-sm">
                        Collection Details & Payment Method
                      </h3>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Balance Due: <strong className="text-rose-600 font-bold">₹{selectedInvoice.balanceAmount.toLocaleString('en-IN')}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Amount to Collect */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="payment-amount" className="block text-xs font-semibold text-slate-700">
                          Amount to Collect <span className="text-emerald-700">*</span>
                        </label>
                        {amount !== selectedInvoice.balanceAmount && (
                          <button
                            type="button"
                            onClick={() => setAmount(selectedInvoice.balanceAmount)}
                            className="text-[10.5px] font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                          >
                            Fill Full
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 select-none pointer-events-none">
                          ₹
                        </span>
                        <input
                          id="payment-amount"
                          type="number"
                          min="1"
                          step="0.01"
                          max={selectedInvoice.balanceAmount}
                          value={amount}
                          onChange={(e) => setAmount(Number(e.target.value))}
                          required
                          className="w-full h-11 pl-11 pr-4 text-base font-black text-emerald-950 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-emerald-600 focus:ring-3 focus:ring-emerald-600/15 tabular-nums transition shadow-xs"
                        />
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div>
                      <label htmlFor="payment-method" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Payment Method <span className="text-emerald-700">*</span>
                      </label>
                      <div className="relative">
                        <select
                          id="payment-method"
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value as any)}
                          className="w-full h-11 pl-4 pr-10 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 text-sm focus:outline-hidden focus:border-emerald-600 focus:ring-3 focus:ring-emerald-600/15 appearance-none cursor-pointer shadow-xs transition hover:border-slate-400"
                        >
                          <option value="CASH">Cash Payment</option>
                          <option value="UPI">UPI / QR (GPay, PhonePe)</option>
                          <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                          <option value="CARD">Card via POS Machine</option>
                          <option value="CHEQUE">Cheque / DD</option>
                          <option value="OTHER">Other Mode</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      </div>
                    </div>

                    {/* Payment Date */}
                    <div>
                      <label htmlFor="payment-date" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Collection Date <span className="text-emerald-700">*</span>
                      </label>
                      <input
                        id="payment-date"
                        type="date"
                        max={localToday}
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        required
                        className="w-full h-11 px-4 text-sm font-semibold bg-white border border-slate-300 text-slate-900 rounded-xl focus:outline-hidden focus:border-emerald-600 focus:ring-3 focus:ring-emerald-600/15 shadow-xs transition hover:border-slate-400 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Dynamic Method Reference Fields */}
                  {paymentMethod === 'UPI' && (
                    <div className="space-y-1.5 p-4 rounded-xl bg-violet-50/70 border border-violet-200">
                      <label htmlFor="upi-reference" className="font-semibold text-xs text-violet-900 flex items-center gap-1.5">
                        <QrCode className="w-4 h-4" />
                        <span>UPI Reference / UTR Number <span className="text-rose-500">*</span></span>
                      </label>
                      <input
                        id="upi-reference"
                        type="text"
                        value={upiReference}
                        onChange={(e) => setUpiReference(e.target.value)}
                        required
                        maxLength={100}
                        placeholder="e.g. 423589234821 or UPI Ref ID"
                        className="w-full h-11 px-4 text-sm bg-white border border-violet-300 font-mono rounded-xl focus:outline-hidden focus:border-violet-600 focus:ring-3 focus:ring-violet-600/15 shadow-xs transition"
                      />
                    </div>
                  )}

                  {paymentMethod === 'BANK_TRANSFER' && (
                    <div className="space-y-1.5 p-4 rounded-xl bg-blue-50/70 border border-blue-200">
                      <label htmlFor="bank-reference" className="font-semibold text-xs text-blue-900 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4" />
                        <span>Bank Transfer UTR / IMPS Reference <span className="text-rose-500">*</span></span>
                      </label>
                      <input
                        id="bank-reference"
                        type="text"
                        value={bankReference}
                        onChange={(e) => setBankReference(e.target.value)}
                        required
                        maxLength={100}
                        placeholder="e.g. HDFCN00012345678"
                        className="w-full h-11 px-4 text-sm bg-white border border-blue-300 font-mono rounded-xl focus:outline-hidden focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 shadow-xs transition"
                      />
                    </div>
                  )}

                  {(paymentMethod === 'CARD' || paymentMethod === 'OTHER') && (
                    <div className="space-y-1.5 p-4 rounded-xl bg-indigo-50/70 border border-indigo-200">
                      <label htmlFor="transaction-reference" className="font-semibold text-xs text-indigo-900 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4" />
                        <span>
                          {paymentMethod === 'CARD' ? 'POS Machine Auth / Txn Reference' : 'Transaction Reference'}{' '}
                          <span className="text-rose-500">*</span>
                        </span>
                      </label>
                      <input
                        id="transaction-reference"
                        type="text"
                        value={transactionReference}
                        onChange={(e) => setTransactionReference(e.target.value)}
                        required
                        maxLength={100}
                        placeholder={paymentMethod === 'CARD' ? 'e.g. POS-AUTH-987654' : 'Enter verifiable transaction reference'}
                        className="w-full h-11 px-4 text-sm bg-white border border-indigo-300 font-mono rounded-xl focus:outline-hidden focus:border-indigo-600 focus:ring-3 focus:ring-indigo-600/15 shadow-xs transition"
                      />
                    </div>
                  )}

                  {paymentMethod === 'CHEQUE' && (
                    <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <label htmlFor="cheque-number" className="font-semibold text-xs text-amber-900">
                            Cheque Number <span className="text-rose-500">*</span>
                          </label>
                          <input
                            id="cheque-number"
                            type="text"
                            value={chequeNumber}
                            onChange={(e) => setChequeNumber(e.target.value)}
                            required
                            maxLength={50}
                            placeholder="e.g. 000456"
                            className="w-full h-11 px-4 text-sm bg-white border border-amber-300 font-mono rounded-xl focus:outline-hidden focus:border-amber-600 focus:ring-3 focus:ring-amber-600/15 shadow-xs transition"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor="cheque-bank" className="font-semibold text-xs text-amber-900">
                            Drawee Bank Name <span className="text-rose-500">*</span>
                          </label>
                          <input
                            id="cheque-bank"
                            type="text"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            required
                            maxLength={120}
                            placeholder="e.g. State Bank of India"
                            className="w-full h-11 px-4 text-sm bg-white border border-amber-300 rounded-xl focus:outline-hidden focus:border-amber-600 focus:ring-3 focus:ring-amber-600/15 shadow-xs transition"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor="cheque-date" className="font-semibold text-xs text-amber-900">
                            Cheque Date <span className="text-rose-500">*</span>
                          </label>
                          <input
                            id="cheque-date"
                            type="date"
                            value={chequeDate}
                            onChange={(e) => setChequeDate(e.target.value)}
                            required
                            className="w-full h-11 px-4 text-sm bg-white border border-amber-300 rounded-xl focus:outline-hidden focus:border-amber-600 focus:ring-3 focus:ring-amber-600/15 shadow-xs transition cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Proof of Payment / Document Attachment */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200/70 shrink-0">
                          <UploadCloud className="w-4 h-4" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-900 block">
                            {paymentMethod === 'UPI' && 'UPI Payment Proof / Screenshot'}
                            {paymentMethod === 'BANK_TRANSFER' && 'Bank Transfer Advice / NEFT Slip'}
                            {paymentMethod === 'CARD' && 'POS Machine Slip / Charge Slip Photo'}
                            {paymentMethod === 'CHEQUE' && 'Cheque Leaf Copy / Pay-in Slip'}
                            {paymentMethod === 'CASH' && 'Cash Voucher / Signed Counter Slip'}
                            {paymentMethod === 'OTHER' && 'Transaction Slip / Acknowledgement'}
                          </label>
                          <p className="text-[11px] text-slate-500 font-normal">
                            Manual counter entry verification &bull; Max 5 MB (JPG, PNG, WebP, PDF)
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md self-start sm:self-auto ${
                          paymentMethod === 'CASH'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                        }`}
                      >
                        {paymentMethod === 'CASH' ? 'Optional' : 'Recommended'}
                      </span>
                    </div>

                    {proofUploadError && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>{proofUploadError}</span>
                      </div>
                    )}

                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {/* Hidden native tablet camera capture input */}
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {isUploadingProof ? (
                      <div className="p-5 rounded-xl border border-emerald-200 bg-emerald-50/40 text-center space-y-2">
                        <div className="flex items-center justify-center gap-2 text-emerald-800 font-semibold text-xs">
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                          <span>Uploading proof document ({uploadProgress}%)...</span>
                        </div>
                        <div className="w-full bg-emerald-100 rounded-full h-1.5 overflow-hidden max-w-xs mx-auto">
                          <div
                            className="bg-emerald-700 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : proofUrl ? (
                      /* Uploaded Document Card */
                      <div className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center shrink-0 shadow-xs">
                            {proofDocumentName.toLowerCase().endsWith('.pdf') ? (
                              <FileText className="w-5 h-5" />
                            ) : (
                              <ImageIcon className="w-5 h-5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-slate-900 text-xs truncate max-w-[220px] sm:max-w-xs">
                                {proofDocumentName}
                              </p>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Ready
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                              {proofFileSize ? formatFileSize(proofFileSize) : 'Attached Proof'} &bull; Uploaded to Vault Records
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={handleOpenProof}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-white hover:bg-emerald-100/80 border border-emerald-300 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveProof}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition flex items-center gap-1 cursor-pointer"
                            title="Remove document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="sr-only sm:not-sr-only">Remove</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Tablet-Optimized Dual Action: Open Camera + Browse Files */
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {/* 1. Open Camera Button (Tablet First) */}
                          <button
                            type="button"
                            onClick={() => setIsCameraModalOpen(true)}
                            className="p-3.5 rounded-xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50/50 hover:border-emerald-600 hover:bg-emerald-100/60 transition-all flex items-center gap-3 text-left cursor-pointer group shadow-2xs hover:shadow-xs"
                          >
                            <div className="h-10 w-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
                              <Camera className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                <span>Open Camera</span>
                                <span className="bg-emerald-200/90 text-emerald-950 text-[9.5px] px-1.5 py-0.2 rounded font-black tracking-wide uppercase">
                                  Tablet
                                </span>
                              </span>
                              <p className="text-[11px] text-emerald-900 font-medium truncate mt-0.5">
                                Snap cheque, slip, or receipt photo
                              </p>
                            </div>
                          </button>

                          {/* 2. Browse Files / Gallery */}
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50/80 transition-all flex items-center gap-3 text-left cursor-pointer group shadow-2xs hover:shadow-xs"
                          >
                            <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200/80 group-hover:scale-105 transition-transform shrink-0">
                              <UploadCloud className="w-5 h-5 text-emerald-800" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 text-xs block">
                                Browse Files / Gallery
                              </span>
                              <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                                Choose JPG, PNG, or PDF file
                              </p>
                            </div>
                          </button>
                        </div>

                        {/* Drag & drop dropzone hint */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDragOver(true);
                          }}
                          onDragLeave={() => setIsDragOver(false)}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={`p-2.5 rounded-xl border border-dashed transition-all cursor-pointer text-center ${
                            isDragOver
                              ? 'border-emerald-600 bg-emerald-50/60'
                              : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
                          }`}
                        >
                          <p className="text-[11px] text-slate-400 font-medium">
                            Or drag & drop receipt file here &bull; Max 5 MB
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label htmlFor="payment-notes" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Payment Remarks / Counter Notes <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <input
                      id="payment-notes"
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={500}
                      placeholder="Optional cashier notes or counter instructions"
                      className="w-full h-11 px-4 text-sm font-medium bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-emerald-600 focus:ring-3 focus:ring-emerald-600/15 shadow-xs transition hover:border-slate-400 placeholder:text-slate-400 placeholder:font-normal"
                    />
                  </div>

                  {/* Final Review & Balance Calculation */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
                    <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Statement Due
                        </span>
                        <span className="text-sm font-bold text-slate-900 tabular-nums">
                          ₹{selectedInvoice.balanceAmount.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <span className="text-slate-300 font-light text-base select-none">−</span>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-800 block tracking-wider">
                          Collecting Now
                        </span>
                        <span className="text-sm font-bold text-emerald-950 tabular-nums">
                          ₹{Number(amount || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <span className="text-slate-300 font-light text-base select-none">=</span>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Balance Remaining
                        </span>
                        <span className={`text-sm font-bold tabular-nums ${remainingBalance === 0 ? 'text-emerald-700' : 'text-slate-800'}`}>
                          {remainingBalance === 0 ? '₹0 (Settled in Full)' : `₹${remainingBalance.toLocaleString('en-IN')}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </form>

            {/* Pinned Modal Footer */}
            <div className="p-4 sm:px-6 sm:py-3.5 bg-slate-50/90 border-t border-slate-200/90 flex items-center justify-between gap-2.5 shrink-0">
              <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                {selectedInvoice ? (
                  <span>
                    Statement: <strong className="font-mono text-slate-700">{selectedInvoice.invoiceNumber}</strong> &bull; Due: <strong className="text-rose-600">₹{selectedInvoice.balanceAmount.toLocaleString('en-IN')}</strong>
                  </span>
                ) : (
                  <span>Select an unpaid statement from the directory above to proceed</span>
                )}
              </div>

              <div className="flex items-center gap-2.5 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl font-semibold text-xs text-slate-600 hover:bg-slate-200/70 transition cursor-pointer"
                >
                  Cancel
                </button>

                {selectedInvoice ? (
                  <button
                    type="submit"
                    form="record-payment-form"
                    disabled={isSubmitting || amount <= 0 || amount > selectedInvoice.balanceAmount || !paymentDate}
                    className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-800 hover:bg-emerald-900 transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 min-w-[140px] justify-center"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Recording payment...</span>
                      </>
                    ) : (
                      <>
                        <Receipt className="h-4 w-4" />
                        <span>Confirm Payment &bull; ₹{Number(amount || 0).toLocaleString('en-IN')}</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="px-4 py-2 rounded-xl font-semibold text-xs text-slate-400 bg-slate-200/80 cursor-not-allowed"
                  >
                    Select Statement to Proceed
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {createPortal(modalContent, document.body)}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleFileUpload}
        onFallbackNativeCamera={() => cameraInputRef.current?.click()}
      />
    </>
  );
}
