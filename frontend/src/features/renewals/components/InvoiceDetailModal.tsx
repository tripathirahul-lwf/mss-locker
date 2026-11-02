import { lockBodyScroll } from '../../../utils/bodyScrollLock';
import React,{ useState,useEffect,useRef } from 'react';
import { createPortal } from 'react-dom';
import {
X,KeyRound,Calendar,
IndianRupee,
Clock,Ban,
Printer,
Copy,
Check,
AlertTriangle,Receipt,Loader2,
Edit2,
Save
} from 'lucide-react';
import { LockerInvoice } from '../types';
import { PaymentStatusBadge } from './RenewalStatusBadge';
import { Button } from '../../../components/ui/button';
import { usePermission } from '../../../hooks/usePermission';
import { ConfirmationModal } from '../../../components/common/ConfirmationModal';
import { LockerCustomerProfileModal } from '../../lockers/components/LockerCustomerProfileModal';
import { LockerKycModal } from '../../lockers/components/LockerKycModal';
import { customerApi } from '../../customers/api/customerApi';

import { useQuery,useQueryClient } from '@tanstack/react-query';
import { paymentApi } from '../../payments/api/paymentApi';
import { PaymentMethodBadge,PaymentStatusBadge as TransactionStatusBadge } from '../../payments/components/PaymentMethodBadge';
import { renewalApi } from '../api/renewalApi';
import { formatPhone } from '../../customers/utils/phoneFormatter';

function invoiceMoney(value: unknown): string { return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) : 'Not recorded'; }

function formatInvoiceDate(dateInput?: string | Date): string {
  if (!dateInput) return 'N/A';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'Invalid date';

  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric', timeZone: 'Asia/Kolkata',
  });
}

function toInputDateFormat(dateInput?: string | Date): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

const getInitials = (fullName?: string): string => {
  if (!fullName) return 'CU';
  const clean = fullName.replace(/[^a-zA-Z\s]/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (fullName.slice(0, 2).replace(/[^a-zA-Z]/g, '') || 'CU').toUpperCase();
};

const formatRackTitle = (rack?: string) => {
  if (!rack) return 'Standard Vault Matrix';
  const trimmed = rack.trim();
  return trimmed.toLowerCase().startsWith('rack') ? trimmed : `Rack ${trimmed}`;
};

interface InvoiceDetailModalProps {
  invoice: LockerInvoice;
  fallbackLocker?: {
    lockerNumber?: string;
    size?: string;
    rackNumber?: string;
    section?: string;
    floor?: string;
  };
  paymentBlockedReason?: string;
  onClose: () => void;
  onCancelInvoice?: (invoice: LockerInvoice, reason: string) => Promise<void>;
  onRecordPayment?: (invoice: LockerInvoice) => void;
}

export function InvoiceDetailModal({
  invoice,
  fallbackLocker,
  onClose,
  onCancelInvoice,
  onRecordPayment,
  paymentBlockedReason,
}: InvoiceDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const canCreate = usePermission('renewals.create');
  const canPay = usePermission('payments.create');
  const canViewPayments = usePermission('payments.view');
  const canViewCustomer = usePermission('customers.view');
  const canViewKyc = usePermission('customers.kyc.view');
  const [currentInvoice, setCurrentInvoice] = useState<LockerInvoice>(invoice);

  const details = useQuery({ queryKey: ['invoice-detail', invoice._id], queryFn: () => renewalApi.getInvoiceById(invoice._id), staleTime: 0 });
  useEffect(() => { if (details.data) setCurrentInvoice(details.data); }, [details.data]);
  useEffect(() => { setCurrentInvoice(invoice); setIsEditingPeriod(false); }, [invoice._id]);
  const [kycBusy,setKycBusy]=useState(false);
  const [context, setContext] = useState<'profile' | 'matrix' | 'kyc' | null>(null);
  const [actionError, setActionError] = useState('');
  const busyRef = useRef(false);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const stateRef = useRef({ child: false, busy: false });


  const [copiedNumber, setCopiedNumber] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Billing period inline editing state
  const [isEditingPeriod, setIsEditingPeriod] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [periodVersion, setPeriodVersion] = useState<string | undefined>();
  const [isSavingPeriod, setIsSavingPeriod] = useState(false);
  const [periodError, setPeriodError] = useState<string | null>(null);
  const [periodSuccess, setPeriodSuccess] = useState<string | null>(null);

  stateRef.current = { child: Boolean(context || cancelModalOpen), busy: isSavingPeriod || isCancelling };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const releaseScroll = lockBodyScroll(); dialogRef.current?.focus();
    const handler = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
      if (stateRef.current.child || dialogs[dialogs.length - 1] !== dialogRef.current) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); if (!stateRef.current.busy) closeRef.current(); }
      if (event.key === 'Tab') {
        const items = [...dialogRef.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]')].filter(el => el.getClientRects().length);
        const first = items[0], last = items[items.length - 1];
        if (!first) { event.preventDefault(); dialogRef.current?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => { window.removeEventListener('keydown', handler, true); releaseScroll(); if (previous?.isConnected) previous.focus(); };
  }, []);
  const canEditPeriod = canCreate && !!details.data && !details.isError && currentInvoice.status !== 'CANCELLED';

  const handleStartEditPeriod = () => {
    setPeriodStart(toInputDateFormat(currentInvoice.billingPeriodStart));
    setPeriodEnd(toInputDateFormat(currentInvoice.billingPeriodEnd));
    setPeriodError(null);
    setPeriodVersion(currentInvoice.updatedAt);
    setIsEditingPeriod(true);
  };

  const handleSaveBillingPeriod = async () => {
    if (busyRef.current || !canEditPeriod) return;
    if (!periodStart || !periodEnd) {
      setPeriodError('Both start and end dates are required');
      return;
    }
    if (![periodStart, periodEnd].every(value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value) || new Date(periodEnd) < new Date(periodStart)) {
      setPeriodError('End date cannot be earlier than start date');
      return;
    }

    busyRef.current = true;
    setIsSavingPeriod(true);
    setPeriodError(null);
    try {
      const updated = await renewalApi.updateBillingPeriod(
        currentInvoice._id,
        periodStart,
        periodEnd,
        periodVersion
      );
      setCurrentInvoice(updated);
      queryClient.setQueryData(['invoice-detail', updated._id], updated);
      setIsEditingPeriod(false);
      setPeriodSuccess('Billing period updated successfully');
      setTimeout(() => setPeriodSuccess(null), 3500);

      queryClient.invalidateQueries({ queryKey: ['renewals'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-detail', currentInvoice._id] });
      queryClient.invalidateQueries({ queryKey: ['renewal-stats'] });
      queryClient.invalidateQueries({ queryKey: ['locker-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      queryClient.invalidateQueries({ queryKey: ['locker'] });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['allocation'] });
      queryClient.invalidateQueries({ queryKey: ['locker-allocations'] });
    } catch (err: any) {
      setPeriodError(err.response?.data?.message || err.message || 'Failed to update billing period');
    } finally {
      busyRef.current = false;
      setIsSavingPeriod(false);
    }
  };

  // Fetch payments recorded against this invoice
  const { data: invoicePayments, isPending: paymentsLoading, isError: paymentsError, refetch: retryPayments } = useQuery({
    queryKey: ['invoice-payments', currentInvoice._id],
    enabled: canViewPayments,
    queryFn: () => paymentApi.getInvoicePayments(currentInvoice._id),
  });

  const customer = currentInvoice.customerId;
  const rawLocker = currentInvoice.lockerId;
  const locker =
    typeof rawLocker === 'object' && rawLocker !== null && (rawLocker as any).lockerNumber
      ? (rawLocker as any)
      : fallbackLocker || (rawLocker as any) || {};
  const allocation = currentInvoice.allocationId;

  const calendarDay = (value: string | Date) => { const d = new Date(value); return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d) : ''; };
  const todayDay = calendarDay(new Date()), dueDay = calendarDay(currentInvoice.dueDate);
  const signedDays = dueDay ? Math.round((Date.parse(dueDay + 'T00:00:00Z') - Date.parse(todayDay + 'T00:00:00Z')) / 86400000) : null;
  const isOverdue = signedDays !== null && signedDays < 0 && currentInvoice.balanceAmount > 0;
  const daysDiff = Math.abs(signedDays || 0);

  const effectiveTax = currentInvoice.taxAmount;
  const effectiveBase = currentInvoice.baseRent;
  const amounts = [effectiveBase, effectiveTax, currentInvoice.lateFee, currentInvoice.otherCharges, currentInvoice.discount, currentInvoice.totalAmount, currentInvoice.paidAmount, currentInvoice.balanceAmount];
  const inconsistent = !['UNPAID', 'PARTIALLY_PAID', 'PAID'].includes(currentInvoice.paymentStatus) || !['DRAFT', 'ISSUED', 'PAID', 'CANCELLED'].includes(currentInvoice.status) || !amounts.every(Number.isFinite) || amounts.some(value => value < 0) || Math.abs(effectiveBase + effectiveTax + currentInvoice.lateFee + currentInvoice.otherCharges - currentInvoice.discount - currentInvoice.totalAmount) > .011 || Math.abs(currentInvoice.totalAmount - currentInvoice.paidAmount - currentInvoice.balanceAmount) > .011 || currentInvoice.paymentStatus === 'PAID' && currentInvoice.balanceAmount > 0;
  const settled = !inconsistent && currentInvoice.paymentStatus === 'PAID' && currentInvoice.balanceAmount === 0 && currentInvoice.status !== 'CANCELLED' && currentInvoice.status !== 'DRAFT';
  const { data: kycDocs = [], isPending: kycLoading, isError: kycError, refetch: retryKyc } = useQuery({ queryKey: ['customer-kyc', customer?._id], queryFn: () => customerApi.getKycDocuments(customer!._id), enabled: context === 'kyc' && !!customer?._id && canViewKyc });

  const handleCopyInvoiceNumber = async () => {
    try { await navigator.clipboard.writeText(currentInvoice.invoiceNumber); } catch { setActionError('Could not copy invoice number.'); return; }
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  const handleCopyPhone = async (phone: string) => {
    try { await navigator.clipboard.writeText(phone); } catch { setActionError('Could not copy phone number.'); return; }
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleConfirmCancel = async () => {
    if (busyRef.current || cancelReason.trim().length < 3) return;
    busyRef.current = true; setActionError('');
    setIsCancelling(true);
    try {
      if (onCancelInvoice) await onCancelInvoice(currentInvoice, cancelReason); else await renewalApi.cancelInvoice(currentInvoice._id, cancelReason);
      await Promise.all(['renewals', 'invoices', 'invoice-detail', 'locker-invoices', 'locker-allocations', 'lockers', 'renewal-stats'].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
      setCancelModalOpen(false);
      onClose();
    } catch (error: any) {
      setActionError(error.response?.data?.message || error.message || 'Could not cancel invoice.');
    } finally {
      busyRef.current = false;
      setIsCancelling(false);
    }
  };

  const handlePrintInvoice = async () => {
    if (isPrinting) return;
    setActionError('');
    setIsPrinting(true);
    try {
      await renewalApi.printInvoicePdf(currentInvoice._id, currentInvoice.invoiceNumber);
    } catch (err: any) {
      console.error('Print invoice error:', err);
      setActionError(err.response?.data?.message || 'Could not print invoice. Please retry.');
    } finally {
      setIsPrinting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[120] w-screen h-[100dvh] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs select-none animate-in fade-in-0 duration-150 font-sans">
      <div
        ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Invoice ${currentInvoice.invoiceNumber}`}
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94dvh] border border-slate-200/90 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs">
              <Receipt className="w-5 h-5 text-emerald-800" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight font-mono">
                  {currentInvoice.invoiceNumber}
                </h2>
                <button
                  type="button"
                  onClick={handleCopyInvoiceNumber}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                  title="Copy Invoice Number"
                >
                  {copiedNumber ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                {currentInvoice.invoiceType === 'LEGACY_IMPORT'
                  ? 'Historical Ledger Custody Bill'
                  : 'Safe Deposit Locker Tenancy Periodic Billing Statement'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { if (!stateRef.current.busy) onClose(); }} disabled={isSavingPeriod || isCancelling}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs font-normal">
          {details.isPending && <p role="status">Loading invoice details...</p>}
          {details.isError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-800">Could not refresh invoice. Actions are disabled. <button onClick={() => details.refetch()} className="underline">Retry invoice</button></p>}
          {actionError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-800">{actionError}</p>}
          {paymentBlockedReason && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Payment is paused: {paymentBlockedReason}. Review the billing period before collecting money.</p>}
          {inconsistent && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-amber-950">Recorded invoice amounts do not reconcile. Review the ledger before collecting payment.</p>}
          {/* Banking Ledger Status Bar */}
          <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/90 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              {inconsistent ? <span className="font-semibold text-amber-900">Billing needs review</span> : ['CANCELLED', 'DRAFT'].includes(currentInvoice.status) ? <span className="font-semibold text-slate-700">{currentInvoice.status}</span> : <PaymentStatusBadge status={currentInvoice.paymentStatus} />}
              {settled ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <Check className="w-3 h-3 text-emerald-700" />
                  <span>Settled in Full</span>
                </span>
              ) : ['CANCELLED', 'DRAFT'].includes(currentInvoice.status) || inconsistent ? null : isOverdue ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  <span>Overdue by {daysDiff} days</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  <Clock className="w-3 h-3 text-amber-600" />
                  <span>{signedDays === null ? 'Due date not recorded' : signedDays === 0 ? 'Due today' : `Upcoming (Due in ${daysDiff} days)`}</span>
                </span>
              )}
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-500 font-medium block">Balance Outstanding</span>
              <span className={`text-base font-bold font-mono tracking-tight tabular-nums ${currentInvoice.balanceAmount > 0 ? 'text-slate-900' : 'text-emerald-800'}`}>
                {invoiceMoney(currentInvoice.balanceAmount)}
              </span>
            </div>
          </div>

          {/* Customer & Locker Coordinates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Customer Box */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Billed Allottee Account
                </span>
                {customer?._id && canViewCustomer && (
                  <button type="button" onClick={() => setContext('profile')} className="text-emerald-800 font-semibold">Profile</button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-bold font-sans text-xs flex items-center justify-center shrink-0 shadow-2xs">
                  {getInitials(customer?.fullName)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-sm truncate font-sans">
                    {customer?.fullName || 'Customer not recorded'}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11.5px] text-slate-500 font-sans tabular-nums truncate mt-0.5">
                    <span>{customer?.customerCode || 'Customer code not recorded'}</span>
                    {customer?.phone && (
                      <>
                        <span>&bull;</span>
                        <span className="font-medium text-slate-700">{formatPhone(customer.phone)}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(customer.phone)}
                          className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                          title="Copy Phone"
                        >
                          {copiedPhone ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Locker Box */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Physical Vault Compartment
                </span>
                {locker?.lockerNumber && (
                  <button type="button" onClick={() => setContext('matrix')} className="text-emerald-800 font-semibold">Matrix</button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 border border-slate-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                  <KeyRound className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm font-sans">
                    Locker #{locker?.lockerNumber || '—'}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      (Size {locker?.size || 'A'})
                    </span>
                  </p>
                  <p className="text-[11.5px] text-slate-500 font-normal font-sans mt-0.5">
                    {formatRackTitle(locker?.rackNumber)} &bull; {locker?.section || 'Main Vault'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Billing Dates & Cycle */}
          <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center font-sans">
            <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] text-slate-500 block uppercase font-medium">ISSUE DATE</span>
              <strong className="text-slate-900 text-xs font-semibold tabular-nums mt-0.5 block">
                {formatInvoiceDate(currentInvoice.issueDate)}
              </strong>
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] text-slate-500 block uppercase font-medium">DUE DATE</span>
              <strong className={`text-xs font-bold tabular-nums mt-0.5 block ${isOverdue ? 'text-rose-700' : 'text-slate-900'}`}>
                {formatInvoiceDate(currentInvoice.dueDate)}
              </strong>
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] text-slate-500 block uppercase font-medium">BILLING CYCLE</span>
              <strong className="text-slate-900 text-xs font-semibold uppercase mt-0.5 block">
                {currentInvoice.billingCycle === 'ANNUAL' ? '1 Year Annual' : currentInvoice.billingCycle}
              </strong>
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] text-slate-500 block uppercase font-medium">AGREEMENT</span>
              {allocation?.allocationCode ? (
                <strong className="text-emerald-800">{allocation.allocationCode}</strong>
              ) : (
                <strong className="text-emerald-800 text-xs font-semibold tabular-nums mt-0.5 block">
                  Not recorded
                </strong>
              )}
            </div>
          </div>

          {/* Financial Breakdown Table */}
          <div className="p-4 rounded-xl border border-slate-200/90 bg-white space-y-3 shadow-2xs font-sans">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Financial Tariff Breakdown
              </h3>
              {!isEditingPeriod && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-600 text-[11px] font-medium font-sans">
                    Billing Period:{' '}
                    <strong className="text-slate-900 font-semibold font-mono">
                      {formatInvoiceDate(currentInvoice.billingPeriodStart)} – {formatInvoiceDate(currentInvoice.billingPeriodEnd)}
                    </strong>
                  </span>
                  {canEditPeriod && (
                    <button
                      type="button"
                      onClick={handleStartEditPeriod}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                      title="Adjust Tenancy Billing Period"
                    >
                      <Edit2 className="w-3 h-3 text-emerald-700" />
                      <span>Edit Period</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Inline Billing Period Editor */}
            {isEditingPeriod && (
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/90 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-950">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>Adjust billing period</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-normal">
                    (Transaction Issue Date: {formatInvoiceDate(currentInvoice.issueDate)})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-semibold text-slate-700 block">
                      Period Start Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      aria-label="Period start date" disabled={isSavingPeriod} value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                      className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-semibold text-slate-700 block">
                      Period End Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      aria-label="Period end date" disabled={isSavingPeriod} value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                      className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 font-medium"
                    />
                  </div>
                </div>

                {periodError && (
                  <p role="alert" className="text-[11px] text-rose-600 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                    <span>{periodError}</span>
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditingPeriod(false);
                      setPeriodError(null);
                    }}
                    disabled={isSavingPeriod}
                    className="h-7 px-2.5 text-[11px] rounded-lg border-slate-300 cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveBillingPeriod}
                    disabled={isSavingPeriod}
                    className="h-7 px-3 text-[11px] rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white flex items-center gap-1 cursor-pointer"
                  >
                    {isSavingPeriod ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3" />
                    )}
                    <span>{isSavingPeriod ? 'Saving...' : 'Save Period'}</span>
                  </Button>
                </div>
              </div>
            )}

            {periodSuccess && (
              <div role="status" className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-1.5 text-xs text-emerald-800 font-medium">
                <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>{periodSuccess}</span>
              </div>
            )}

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 text-slate-600">
                <span>{effectiveTax > 0 ? 'Rent before recorded tax' : 'Rent amount (as recorded)'}</span>
                <span className="font-semibold text-slate-900 font-mono tabular-nums">
                  {invoiceMoney(effectiveBase)}
                </span>
              </div>

              {effectiveTax > 0 && (
                <div className="flex items-center justify-between py-1 text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span>Goods &amp; Services Tax (recorded)</span>

                  </span>
                  <span className="font-semibold text-slate-900 font-mono tabular-nums">
                    +{invoiceMoney(effectiveTax)}
                  </span>
                </div>
              )}

              {currentInvoice.lateFee > 0 && (
                <div className="flex items-center justify-between py-1 text-rose-700">
                  <span>Late Fee Surcharge</span>
                  <span className="font-semibold font-mono tabular-nums">
                    +{invoiceMoney(currentInvoice.lateFee)}
                  </span>
                </div>
              )}

              {currentInvoice.discount > 0 && (
                <div className="flex items-center justify-between py-1 text-emerald-700">
                  <span>Tariff Concession / Discount</span>
                  <span className="font-semibold font-mono tabular-nums">
                    -{invoiceMoney(currentInvoice.discount)}
                  </span>
                </div>
              )}

              {currentInvoice.otherCharges > 0 && (
                <div className="flex items-center justify-between py-1 text-slate-600">
                  <span>Other charges</span>
                  <span className="font-semibold font-mono tabular-nums">
                    +{invoiceMoney(currentInvoice.otherCharges)}
                  </span>
                </div>
              )}

              <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between text-sm font-bold text-slate-900">
                <span>Total Invoiced Amount</span>
                <span className="text-base text-slate-900 font-mono tabular-nums">
                  {invoiceMoney(currentInvoice.totalAmount)}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Paid to Date:</span>
                <span className={`font-mono font-semibold tabular-nums ${currentInvoice.paidAmount > 0 ? 'text-emerald-800' : 'text-slate-600'}`}>
                  {invoiceMoney(currentInvoice.paidAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-900 font-bold">Balance Outstanding:</span>
                <span className={`font-mono font-bold text-sm tabular-nums ${currentInvoice.balanceAmount > 0 ? 'text-slate-900' : 'text-emerald-800'}`}>
                  {invoiceMoney(currentInvoice.balanceAmount)}
                </span>
              </div>
            </div>
          </div>

          {!canViewPayments ? <p>Payment receipt access is restricted.</p> : paymentsLoading ? <p role="status">Loading payment receipts...</p> : paymentsError ? <p role="alert">Could not load payment receipts. <button onClick={() => retryPayments()}>Retry receipts</button></p> : invoicePayments?.length === 0 ? <p className="text-slate-600">No payment receipts recorded for this bill.</p> : null}
          {/* Recorded Payment Settlements */}
          {canViewPayments && !paymentsError && invoicePayments && invoicePayments.length > 0 && (
            <div className="p-4 rounded-xl bg-white border border-slate-200/90 space-y-2.5 shadow-2xs font-sans">
              <h3 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] pb-1.5 border-b border-slate-100 flex items-center justify-between">
                <span>Recorded Payment Receipts ({invoicePayments.length})</span>
                <span className="text-emerald-800 font-semibold tabular-nums">
                  Invoice paid amount: {invoiceMoney(currentInvoice.paidAmount)}
                </span>
              </h3>

              <div className="divide-y divide-slate-100">
                {invoicePayments.map((p) => (
                  <div key={p._id} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="font-medium text-slate-900 tabular-nums">{p.receiptNumber}</strong>
                        <PaymentMethodBadge method={p.paymentMethod} />
                      </div>
                      <span className="text-[10.5px] text-slate-400 tabular-nums block font-normal">
                        {formatInvoiceDate(p.paymentDate)} &bull; Pay #{p.paymentNumber} &bull; By {p.recordedBy?.name || 'Staff'}
                      </span>
                    </div>

                    <div className="text-right">
                      <strong className="text-emerald-800 text-xs font-semibold tabular-nums block">
                        {invoiceMoney(p.amount)}
                      </strong>
                      <TransactionStatusBadge status={p.paymentStatus} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes / Remarks */}
          {currentInvoice.notes && (
            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 text-slate-600 leading-relaxed text-xs">
              <strong className="text-slate-800 block mb-0.5 font-medium">Notes & Legacy Ledger Reference:</strong>
              <span className="font-normal">{currentInvoice.notes}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-4.5 bg-slate-50/80 border-t border-slate-200/90 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { if (!stateRef.current.busy) onClose(); }} disabled={isSavingPeriod || isCancelling}
            className="rounded-xl border-slate-300 font-medium text-xs h-9 px-3.5 hover:bg-slate-50 cursor-pointer"
          >
            Close
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            {!!details.data && !details.isError && !inconsistent && !paymentBlockedReason && !isEditingPeriod && !isSavingPeriod && currentInvoice.balanceAmount > 0 && !['CANCELLED', 'DRAFT'].includes(currentInvoice.status) && canPay && onRecordPayment && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onClose();
                  onRecordPayment(invoice);
                }}
                className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium rounded-xl text-xs h-9 px-3.5 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <IndianRupee className="w-3.5 h-3.5" />
                <span>Record Payment</span>
              </Button>
            )}

            {!!details.data && !details.isError && !inconsistent && currentInvoice.paidAmount === 0 && currentInvoice.paymentStatus === 'UNPAID' && currentInvoice.status !== 'CANCELLED' && canCreate && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCancelModalOpen(true)}
                className="text-rose-700 hover:bg-rose-50 border-rose-200 rounded-xl text-xs h-9 px-3.5 font-medium flex items-center gap-1 cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Cancel Invoice</span>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handlePrintInvoice}
              disabled={isPrinting}
              className="bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl flex items-center gap-1.5 text-xs h-9 px-3.5 cursor-pointer shadow-xs disabled:opacity-70"
            >
              {isPrinting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
              <span>{isPrinting ? 'Opening Print...' : 'Print Invoice'}</span>
            </Button>
          </div>
        </div>
      </div>

      <ConfirmationModal layer={140} isOpen={cancelModalOpen} title={`Cancel Invoice ${currentInvoice.invoiceNumber}?`} onClose={() => { if (!isCancelling) setCancelModalOpen(false); }} onConfirm={handleConfirmCancel} isLoading={isCancelling} confirmLabel="Confirm Cancellation" cancelLabel="Go Back" description="Cancel this unpaid invoice? Financial records with payments require reversal instead.">
        <label className="block text-sm">Cancellation reason<input aria-label="Cancellation reason" maxLength={500} value={cancelReason} disabled={isCancelling} onChange={event => setCancelReason(event.target.value)} className="mt-1 w-full rounded-xl border p-2" /></label>
        {cancelReason.trim().length < 3 && <p className="text-xs text-slate-600">Enter at least 3 characters to confirm.</p>}
        {actionError && <p role="alert" className="text-red-700">{actionError}</p>}
      </ConfirmationModal>
      {context === 'profile' && customer?._id && <LockerCustomerProfileModal layer={130} customerId={customer._id} onClose={() => setContext(null)} onKyc={canViewKyc ? () => setContext('kyc') : undefined} onInvoices={() => setContext(null)} />}
      {context === 'matrix' && <InvoiceContextDialog title="Locker location" onClose={() => setContext(null)}><dl className="grid grid-cols-2 gap-3">{[['Locker', locker?.lockerNumber], ['Size', locker?.size], ['Rack', locker?.rackNumber], ['Section', locker?.section], ['Floor', locker?.floor]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><dt>{label}</dt><dd className="font-semibold">{value || 'Not recorded'}</dd></div>)}</dl></InvoiceContextDialog>}
      {context === 'kyc' && canViewKyc && customer?._id && <LockerKycModal layer={130} busy={kycBusy} onBusyChange={setKycBusy} onClose={()=>{if(!kycBusy)setContext(null);}} customerId={customer._id} customerName={customer.fullName} customerCode={customer.customerCode} documents={kycDocs} loading={kycLoading} failed={kycError} onRetry={()=>void retryKyc()}/>}


    </div>
  );

  return createPortal(modalContent, document.body);
}

function InvoiceContextDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null); const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null; ref.current?.focus();
    const key = (event: KeyboardEvent) => {
      const all = document.querySelectorAll('[role="dialog"], [role="alertdialog"]'); if (all[all.length - 1] !== ref.current) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close.current(); }
      if (event.key === 'Tab') { const items = [...ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]')].filter(el => el.getClientRects().length); const first = items[0], last = items[items.length - 1]; if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first?.focus(); } }
    };
    window.addEventListener('keydown', key, true); return () => { window.removeEventListener('keydown', key, true); if (previous?.isConnected) previous.focus(); };
  }, []);
  return createPortal(<div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 p-3"><div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl"><header className="flex items-center justify-between border-b p-4"><h2 className="font-bold">{title}</h2><button aria-label="Close context" onClick={onClose}><X /></button></header><div className="overflow-y-auto p-4">{children}</div></div></div>, document.body);
}
