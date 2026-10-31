import { OccupiedLockerSummary, occupiedHealth, money, referenceId, ledgerDate } from './OccupiedLockerSummary';
import { LockerCustomerProfileModal } from './LockerCustomerProfileModal';
import { LockerClosureFlow } from './LockerClosureFlow';
import { AllocationWizardModal } from '../../allocations/components/AllocationWizardModal';
import { CollectDepositModal } from '../../deposits/components/CollectDepositModal';
import { AdjustDepositModal } from '../../deposits/components/AdjustDepositModal';
import { CreateRefundModal } from '../../deposits/components/CreateRefundModal';
import { RefundApprovalModal } from '../../deposits/components/RefundApprovalModal';
import { RefundPaymentModal } from '../../deposits/components/RefundPaymentModal';
import { LockerKycPanel } from './LockerKycPanel';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  KeyRound,
  Shield,
  Layers,
  MapPin,
  IndianRupee,
  Clock,
  User,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  Copy,
  Check,
  Calendar,
  Eye,
  EyeOff,
  Plus,
  ExternalLink,
  Phone,
  CreditCard,
  RotateCw,
  Receipt,
  FileText,
  FileCheck,
  Download,
  Trash2,
  Undo2,
  Inbox,
  AlertCircle,
  Building,
  Lock,
  Wrench,
  Loader2,
} from 'lucide-react';
import { Locker } from '../types';
import { lockerApi } from '../api/lockerApi';
import { allocationApi } from '../../allocations/api/allocationApi';
import { LockerAllocation } from '../../allocations/types';
import { renewalApi } from '../../renewals/api/renewalApi';
import { LockerInvoice, GenerateRenewalInput } from '../../renewals/types';
import { paymentApi } from '../../payments/api/paymentApi';
import { Payment, RecordPaymentInput } from '../../payments/types';
import { customerApi } from '../../customers/api/customerApi';
import { CustomerKycDocument } from '../../customers/types';
import { depositApi } from '../../deposits/api/depositApi';
import { RefundRequest } from '../../deposits/types';
import { LOCKER_SIZES } from '../constants';
import { usePermission } from '../../../hooks/usePermission';
import { Button } from '../../../components/ui/button';
import { ConfirmationModal } from '../../../components/common/ConfirmationModal';
import { RecordPaymentModal } from '../../payments/components/RecordPaymentModal';
import { PaymentReceiptModal } from '../../payments/components/PaymentReceiptModal';
import { GenerateRenewalModal } from '../../renewals/components/GenerateRenewalModal';
import { InvoiceDetailModal } from '../../renewals/components/InvoiceDetailModal';

interface LockerDetailModalProps {
  locker: Locker;
  initialTab?: 'details' | 'kyc';
  onClose: () => void;
  onEdit?: (locker: Locker) => void;
  onAllocate?: (locker: Locker) => void;
}

export function LockerDetailModal({
  locker,
  initialTab = 'details',
  onClose,
  onEdit,
  onAllocate,
}: LockerDetailModalProps) {
  const queryClient = useQueryClient();

  const canUpdate = usePermission('lockers.update');
  const canViewSensitive = usePermission('lockers.view_sensitive');
  const canRecordPayment = usePermission('payments.create');
  const canGenerateRenewal = usePermission('renewals.create');
  const canAllocate = usePermission('allocations.create');
  const canViewPayments = usePermission('payments.view');
  const canViewIdNumber = usePermission('customers.view_sensitive');
  const canViewAllocations = usePermission('allocations.view');
  const canViewInvoices = usePermission('renewals.view');
  const canViewKyc = usePermission('customers.kyc.view');
  const canViewRefunds = usePermission('refunds.view');
  const canCloseLocker = usePermission('closures.create');
  const canCollectDeposit = usePermission('deposits.collect');
  const canAdjustDeposit = usePermission('deposits.adjust');
  const canOverrideDeposit = usePermission('deposits.override');
  const canCreateRefund = usePermission('refunds.create');
  const canApproveRefund = usePermission('refunds.approve');
  const canPayRefund = usePermission('refunds.pay');

  const [activeTab, setActiveTab] = useState<'details' | 'receipts' | 'kyc' | 'refunds'>(initialTab);
  const [refundPage, setRefundPage] = useState(1);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedAllocCode, setCopiedAllocCode] = useState(false);
  const [sensitiveRevealed, setSensitiveRevealed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Confirmation dialogs
  const [confirmVacantOpen, setConfirmVacantOpen] = useState(false);
  const [confirmRepairedOpen, setConfirmRepairedOpen] = useState(false);

  // Quick Key Editing state
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [keyInput, setKeyInput] = useState(locker.masterKeyReference || '');
  const [isSavingKey, setIsSavingKey] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeCallback = useRef(onClose); closeCallback.current = onClose;
  const sizeDefinition = LOCKER_SIZES.find((item) => item.code === locker.size);

  // Status flags
  const isClosed = !locker.isActive || locker.operationalStatus === 'DECOMMISSIONED';
  const isOccupied = !isClosed && locker.status === 'OCCUPIED';
  const isReserved = !isClosed && locker.status === 'RESERVED';
  const isMaintenance =
    !isClosed && (locker.operationalStatus === 'MAINTENANCE' || locker.operationalStatus === 'DAMAGED' || locker.status === 'BLOCKED');
  const isAvailable = !isClosed && !isOccupied && !isReserved && !isMaintenance;

  // Status Styling Configuration
  let statusBadgeLabel = 'Closed';
  let statusBadgeStyle = 'bg-slate-100 text-slate-700 border-slate-300';
  let statusDotStyle = 'bg-slate-400';

  if (isOccupied) {
    statusBadgeLabel = 'Occupied';
    statusBadgeStyle = 'bg-blue-50 text-blue-900 border-blue-200';
    statusDotStyle = 'bg-blue-600';
  } else if (isAvailable) {
    statusBadgeLabel = 'Available';
    statusBadgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    statusDotStyle = 'bg-emerald-600 animate-pulse';
  } else if (isReserved) {
    statusBadgeLabel = 'Reserved';
    statusBadgeStyle = 'bg-amber-50 text-amber-800 border-amber-200';
    statusDotStyle = 'bg-amber-500';
  } else if (isMaintenance) {
    statusBadgeLabel = 'Maintenance';
    statusBadgeStyle = 'bg-rose-50 text-rose-800 border-rose-200';
    statusDotStyle = 'bg-rose-500';
  }

  // 1. Tenancy Query
  const { data: lockerAllocData, isLoading: allocationLoading, isError: allocationError, refetch: retryAllocation } = useQuery({
    queryKey: ['locker-allocations', locker._id],
    queryFn: () => allocationApi.getLockerAllocations(locker._id),
    enabled: Boolean(locker._id) && canViewAllocations,
  });

  const currentAlloc = lockerAllocData?.currentAllocation;
  const tenant = currentAlloc?.customerId;
  const tenantId = tenant?._id;
  const canViewDeposits = usePermission('deposits.view');
  const { data: depositSummary, isError: depositError, isFetching: depositFetching, refetch: retryDeposit } = useQuery({ queryKey: ['deposit-summary', currentAlloc?._id], queryFn: () => depositApi.getDepositSummary(currentAlloc!._id), enabled: Boolean(currentAlloc?._id) && canViewDeposits });

  // 2. Billing & Invoices Query
  const { data: lockerInvoices, isLoading: invoicesLoading, isError: invoicesError, refetch: retryInvoices } = useQuery({
    queryKey: ['locker-invoices', locker._id],
    queryFn: () => renewalApi.getLockerInvoices(locker._id),
    enabled: Boolean(locker._id) && canViewInvoices,
  });

  const invoices: LockerInvoice[] = useMemo(() => {
    if (!lockerInvoices || !Array.isArray(lockerInvoices)) return [];
    return [...lockerInvoices].sort((a, b) => {
      const dateA = new Date(a.dueDate || a.createdAt).getTime();
      const dateB = new Date(b.dueDate || b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [lockerInvoices]);

  const { data: lockerPayments = [], isLoading: paymentsLoading, isError: paymentsError, refetch: retryPayments } = useQuery({
    queryKey: ['locker-payments', locker._id], queryFn: () => paymentApi.getLockerPayments(locker._id), enabled: Boolean(currentAlloc?._id) && isOccupied && canViewPayments,
  });
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState('');
  const receiptController = useRef<AbortController | null>(null);
  const [revealedIdentityKey, setRevealedIdentityKey] = useState<string | null>(null);
  const openReceipt = async (payment: Payment) => {
    receiptController.current?.abort();
    const controller = new AbortController(); receiptController.current = controller; setLoadingReceiptId(payment._id); setReceiptError('');
    try { const result = await paymentApi.getPaymentById(payment._id, controller.signal); if (!controller.signal.aborted) setViewingReceiptPayment(result); }
    catch (error: any) { if (!controller.signal.aborted) setReceiptError(error.response?.data?.message || 'Could not load this receipt. Please retry.'); }
    finally { if (receiptController.current === controller) { receiptController.current = null; setLoadingReceiptId(null); } }
  };

  useEffect(() => () => { receiptController.current?.abort(); receiptController.current = null; }, [locker._id]);

  // 3. KYC Documents Query (Fetched for the tenant)
  const { data: kycDocs = [], isLoading: isKycLoading, isError: isKycError, refetch: refetchKyc } = useQuery<CustomerKycDocument[]>({
    queryKey: ['customer-kyc', tenantId],
    queryFn: () => customerApi.getKycDocuments(tenantId!),
    enabled: Boolean(tenantId) && canViewKyc,
  });

  // 4. Refunds Query
  const { data: refundsData, isLoading: refundsLoading, isError: refundsError, refetch: retryRefunds } = useQuery({
    queryKey: ['locker-refunds', locker._id, currentAlloc?._id, refundPage],
    queryFn: () => depositApi.getRefunds({ allocationId: currentAlloc!._id, page: refundPage, limit: 20 }),
    enabled: Boolean(currentAlloc?._id) && canViewRefunds,
  });

  const refunds: RefundRequest[] = (refundsData?.refunds || []).filter(item => referenceId(item.allocationId) === currentAlloc?._id);

  const [profileOpen, setProfileOpen] = useState(false);
  const [closureOpen, setClosureOpen] = useState(false);
  const [allocationOpen, setAllocationOpen] = useState(false);
  const [depositAction, setDepositAction] = useState<'collect' | 'adjust' | 'refund' | null>(null);
  const [approvingRefund, setApprovingRefund] = useState<string | null>(null);
  const [payingRefund, setPayingRefund] = useState<RefundRequest | null>(null);
  const [submittingRefundId, setSubmittingRefundId] = useState<string | null>(null);
  const submittingRefundRef = useRef(false);
  const [settlementError, setSettlementError] = useState('');
  const refreshSettlement = async () => { await Promise.all(['deposit-summary', 'locker-refunds', 'locker-payments', 'locker-allocations', 'lockers', 'locker-stats', 'locker-closures'].map(key => queryClient.invalidateQueries({ queryKey: [key] }))); };

  // Child Modals State
  const [recordingPaymentInvoiceId, setRecordingPaymentInvoiceId] = useState<string | null>(null);
  const [renewingAllocation, setRenewingAllocation] = useState<LockerAllocation | null>(null);
  const [isSubmittingRenewal, setIsSubmittingRenewal] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<LockerInvoice | null>(null);
  const [viewingReceiptPayment, setViewingReceiptPayment] = useState<Payment | null>(null);

  const hasChildModal = useRef(false);
  hasChildModal.current = Boolean(profileOpen || closureOpen || allocationOpen || depositAction || approvingRefund || payingRefund || recordingPaymentInvoiceId || renewingAllocation || viewingInvoice || viewingReceiptPayment || confirmVacantOpen || confirmRepairedOpen);

  // Mark Vacant Mutation (For closed / decommissioned lockers)
  const markVacantMutation = useMutation({
    mutationFn: () =>
      lockerApi.updateLocker(locker._id, {
        status: 'VACANT',
        operationalStatus: 'ACTIVE',
        isActive: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      queryClient.invalidateQueries({ queryKey: ['locker', locker._id] });
      queryClient.invalidateQueries({ queryKey: ['locker-stats'] });
      setNotice('Locker marked as Vacant & Ready for Allocation.');
      setTimeout(() => {
        onClose();
      }, 1200);
    },
    onError: (err: any) => {
      setNotice(err.response?.data?.message || err.message || 'Failed to mark vacant.');
    },
  });

  // Mark Repaired Mutation (For lockers under maintenance/damaged)
  const markRepairedMutation = useMutation({
    mutationFn: () =>
      lockerApi.updateLocker(locker._id, {
        status: 'VACANT',
        operationalStatus: 'ACTIVE',
        isActive: true,
        remarks: undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      queryClient.invalidateQueries({ queryKey: ['locker', locker._id] });
      queryClient.invalidateQueries({ queryKey: ['locker-stats'] });
      setNotice('Maintenance resolved. Locker is now Active & Vacant.');
      setTimeout(() => {
        onClose();
      }, 1000);
    },
    onError: (err: any) => {
      setNotice(err.response?.data?.message || err.message || 'Failed to return locker to service.');
    },
  });

  // Save Key Reference directly
  const handleSaveKey = async () => {
    setIsSavingKey(true);
    try {
      await lockerApi.updateLocker(locker._id, {
        masterKeyReference: keyInput.trim() || undefined,
      });
      locker.masterKeyReference = keyInput.trim() || undefined;
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      queryClient.invalidateQueries({ queryKey: ['locker', locker._id] });
      setIsEditingKey(false);
      setNotice('Locker key reference saved successfully.');
    } catch (err: any) {
      setNotice(err.response?.data?.message || err.message || 'Failed to save key reference.');
    } finally {
      setIsSavingKey(false);
    }
  };

  // Only the top dialog handles keyboard events; closing an invoice must not close the locker beneath it.
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (hasChildModal.current) return;
      const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
      if (dialogs[dialogs.length - 1] !== dialogRef.current) return;
      if (event.key === 'Escape') { event.preventDefault(); closeCallback.current(); }
      if (event.key === 'Tab') {
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]') || []).filter(control => control.getClientRects().length > 0);
        if (!controls.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    const frame = requestAnimationFrame(() => dialogRef.current?.focus());
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  // Copy Key Number
  const handleCopyKey = () => {
    if (locker.masterKeyReference) {
      navigator.clipboard.writeText(locker.masterKeyReference);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  // Copy Phone Number
  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  // Copy Customer Code
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Copy Allocation Code
  const handleCopyAllocCode = (allocCode: string) => {
    navigator.clipboard.writeText(allocCode);
    setCopiedAllocCode(true);
    setTimeout(() => setCopiedAllocCode(false), 2000);
  };

  // Consistent Date Formatter
  const formatDate = (dateStr?: string | Date) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  };

  const formatRackTitle = (rack?: string) => {
    if (!rack) return 'Vault Matrix';
    const trimmed = rack.trim();
    return trimmed.toLowerCase().startsWith('rack') ? trimmed : `Rack ${trimmed}`;
  };

  const formatSectionTitle = (section?: string, rack?: string) => {
    if (!section) return 'Main Vault';
    const trimmed = section.trim();
    if (rack) {
      const rackCore = rack.replace(/rack/gi, '').trim();
      if (rackCore && trimmed.toLowerCase().includes(rackCore.toLowerCase())) {
        const cleaned = trimmed
          .replace(new RegExp(`rack\\s*${rackCore}`, 'gi'), '')
          .replace(new RegExp(rackCore, 'gi'), '')
          .trim()
          .replace(/^[-•\s]+/, '')
          .trim();
        return cleaned.toLowerCase() === 'vault' ? 'Vault Room' : cleaned || 'Vault Room';
      }
    }
    return trimmed;
  };

  const handleAllocate = () => {
    if (onAllocate) {
      onAllocate(locker);
    } else {
      setAllocationOpen(true);
    }
  };

  const totalAnnualRent = currentAlloc?.annualRent ?? currentAlloc?.rentSnapshot ?? locker.annualRent ?? sizeDefinition?.defaultRent ?? 0;
  const isDefaultSizeRent =
    sizeDefinition && totalAnnualRent === sizeDefinition.defaultRent;
  const baseRent =
    isDefaultSizeRent && sizeDefinition?.baseRent
      ? sizeDefinition.baseRent
      : Math.round(totalAnnualRent / 1.18 * 100) / 100;
  const gstAmount = Math.max(0, Math.round((totalAnnualRent - baseRent) * 100) / 100);
  const deposit = currentAlloc?.depositSnapshot ?? locker.securityDeposit ?? sizeDefinition?.defaultDeposit ?? 0;
  const depositValid = !!depositSummary && depositSummary.allocationId === currentAlloc?._id && [depositSummary.requiredDeposit, depositSummary.totalDepositReceived, depositSummary.totalAddAdjustments, depositSummary.totalDeductAdjustments, depositSummary.totalRefunded, depositSummary.netDepositHeld, depositSummary.pendingRefundAmount, depositSummary.availableRefundableBalance, depositSummary.outstandingDeposit].every(value => Number.isFinite(value) && value >= 0) && depositSummary.pendingRefundAmount <= depositSummary.netDepositHeld + .001 && Math.abs(depositSummary.totalDepositReceived + depositSummary.totalAddAdjustments - depositSummary.totalDeductAdjustments - depositSummary.totalRefunded - depositSummary.netDepositHeld) < .011;
  const depositReady = depositValid && !depositError && !depositFetching;
  const depositLabel = !currentAlloc && isOccupied ? !canViewAllocations ? 'Restricted' : allocationError ? 'Unavailable' : allocationLoading ? 'Loading...' : 'No active allotment' : currentAlloc ? !canViewDeposits ? 'Restricted' : depositError || depositSummary && !depositValid ? 'Unavailable' : depositSummary ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(depositSummary.netDepositHeld) : 'Loading...' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(deposit);
  const totalMoveInPayable = totalAnnualRent + deposit;

  // Opening rent, renewal and historical tenancy invoices are distinct.
  const unpaidInvoice = invoices.filter(inv => {
    const allocationId = typeof inv.allocationId === 'string' ? inv.allocationId : inv.allocationId?._id;
    return allocationId === currentAlloc?._id && !['CANCELLED','DRAFT'].includes(inv.status) && inv.balanceAmount > 0 ;
  }).sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  const health = occupiedHealth(currentAlloc || undefined, invoices, canViewAllocations && !allocationLoading && !allocationError && canViewInvoices && !invoicesLoading && !invoicesError);
  const identityDoc = [...kycDocs].filter(doc => doc.isActive !== false && doc.documentNumber?.trim() && !/^(kyc[\s_-]*(document|scan[\s_-]*attached)|attachment|document)$/i.test(doc.documentNumber.trim())).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))[0];
  const identityKey = identityDoc ? `${tenantId}:${identityDoc._id}:${identityDoc.documentNumber}` : null;
  const identityRevealed = Boolean(identityKey && revealedIdentityKey === identityKey);

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex h-[100dvh] w-screen items-center justify-center bg-slate-950/70 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in-0 duration-150 overflow-y-auto font-sans">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Locker #${locker.lockerNumber}`}
        className={`flex max-h-[94dvh] w-full max-w-2xl ${isOccupied ? 'sm:max-w-6xl' : 'sm:max-w-3xl'} flex-col overflow-hidden bg-white shadow-2xl rounded-2xl sm:rounded-3xl border border-slate-200 my-auto animate-in zoom-in-95 duration-150`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toast Alert Inside Modal */}
        {notice && (
          <div
            role="status"
            className="bg-emerald-50 border-b border-emerald-200 p-3 px-5 text-xs font-semibold text-emerald-800 flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              {notice}
            </span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {isOccupied ? <div className="shrink-0 bg-white px-5 pb-3 pt-5 sm:px-8 sm:pt-7">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 id="locker-dossier-title" aria-label={`Locker #${locker.lockerNumber}`} className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Locker {locker.lockerNumber}</h2>
            <p className="mt-2 break-words text-sm text-slate-600 sm:text-base">Size {locker.size} &bull; {formatRackTitle(locker.rackNumber)} &bull; Key {canViewSensitive ? locker.masterKeyReference || 'Not assigned' : 'Restricted'}</p></div>
            <div className="flex flex-wrap justify-end gap-2"><span aria-label="Payment and renewal status" className={`rounded-full px-3 py-1.5 text-xs font-bold sm:text-sm ${health.style}`}>{health.label}</span>
            {canUpdate && onEdit && <button type="button" aria-label="Edit" onClick={() => { onClose(); onEdit(locker); }} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><Edit3 className="h-4 w-4" /></button>}
            <button type="button" onClick={onClose} aria-label="Close modal" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
          </div>
        </div> : <>        {/* 1. Refined Bank Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-white border-b border-slate-200/90">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs ${
                isOccupied
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : isMaintenance
                  ? 'bg-rose-50 border-rose-200 text-rose-600'
                  : isReserved
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}
            >
              {isOccupied ? (
                <Lock className="w-5 h-5 text-blue-700" />
              ) : isMaintenance ? (
                <Wrench className="w-5 h-5 text-rose-600" />
              ) : isReserved ? (
                <Clock className="w-5 h-5 text-amber-700" />
              ) : (
                <KeyRound className="w-5 h-5 text-emerald-700" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="locker-dossier-title"
                  className="text-lg sm:text-xl font-bold font-mono tracking-tight text-slate-900"
                >
                  Locker #{locker.lockerNumber}
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadgeStyle}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotStyle}`} />
                  <span>{statusBadgeLabel}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal truncate mt-0.5">
                {formatRackTitle(locker.rackNumber)} &bull;{' '}
                {formatSectionTitle(locker.section, locker.rackNumber)} &bull; {locker.floor || 'Ground Floor'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {canUpdate && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(locker);
                }}
                className="h-8 px-2.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-medium inline-flex items-center gap-1 transition cursor-pointer"
                title="Edit Locker Specifications"
                aria-label="Edit"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

</>}

        {(!isOccupied || activeTab !== 'details') && <>
        {/* 2. Sub-Navigation Tabs */}
        <div className="flex items-center border-b border-slate-200 px-4 sm:px-6 bg-slate-50/50 overflow-x-auto select-none gap-1 sm:gap-2">
          <button
            type="button"
            aria-pressed={activeTab === 'details'}
            onClick={() => setActiveTab('details')}
            className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'details'
                ? 'border-emerald-800 text-emerald-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Details
          </button>

          <button
            type="button"
            aria-pressed={activeTab === 'receipts'}
            onClick={() => setActiveTab('receipts')}
            className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'receipts'
                ? 'border-emerald-800 text-emerald-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Invoices</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                activeTab === 'receipts'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-200/80 text-slate-600'
              }`}
            >
              {!canViewInvoices ? 'Restricted' : invoicesLoading ? '...' : invoicesError ? 'Unavailable' : invoices.length}
            </span>
          </button>

          <button
            type="button"
            aria-pressed={activeTab === 'kyc'}
            onClick={() => setActiveTab('kyc')}
            className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'kyc'
                ? 'border-emerald-800 text-emerald-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>KYC Compliance</span>
            {tenant ? (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  tenant?.kycStatus === 'VERIFIED' && kycDocs.length > 0 && !isKycLoading && !isKycError && canViewKyc
                    ? 'bg-emerald-100 text-emerald-800'
                    : kycDocs.length > 0
                    ? 'bg-slate-200 text-slate-700'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {!canViewKyc ? 'Restricted' : isKycLoading ? 'Loading...' : isKycError ? 'Unavailable' : tenant?.kycStatus === 'VERIFIED' && kycDocs.length === 0 ? 'Legacy verification' : tenant?.kycStatus === 'VERIFIED'
                  ? '✓ Verified'
                  : kycDocs.length > 0
                  ? kycDocs.length
                  : 'Pending'}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200/70 text-slate-600">
                Vacant
              </span>
            )}
          </button>

          <button
            type="button"
            aria-pressed={activeTab === 'refunds'}
            onClick={() => setActiveTab('refunds')}
            className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'refunds'
                ? 'border-emerald-800 text-emerald-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Deposit & Refunds</span>
            {isOccupied && deposit > 0 ? (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  activeTab === 'refunds'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200/80 text-slate-600'
                }`}
              >
                {depositLabel}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200/70 text-slate-600">
                ₹0 Held
              </span>
            )}
          </button>
        </div>

        {/* 3. Modal Body Content */}
        </>}

        <div className={`p-4 sm:p-5 overflow-y-auto min-h-0 flex-1 space-y-3.5 ${isOccupied ? 'sm:px-8 sm:pb-7' : ''}`}>
          {/* TAB 1: DETAILS */}
          {allocationLoading && <p role="status">Loading allotment...</p>}
          {allocationError && <p role="alert">Could not load the current allotment. <button type="button" onClick={() => retryAllocation()}>Retry</button></p>}
          {!canViewAllocations && isOccupied && <p>Allotment details are restricted.</p>}
          {activeTab === 'details' && !allocationLoading && !allocationError && (canViewAllocations || !isOccupied) && (
            <div className="space-y-3.5">
              {/* --- SCENARIO A: AVAILABLE LOCKER --- */}
              {isAvailable && (
                <>
                  {/* Availability Notice Card */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-white border border-emerald-200 flex items-center justify-center shrink-0 text-emerald-700 shadow-2xs mt-0.5 sm:mt-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-emerald-950">
                          Vacant & Ready for Customer Allotment
                        </h4>
                        <p className="text-xs text-emerald-800 font-normal mt-0.5">
                          Compartment cleaned, master lock inspected, and open for immediate customer onboarding.
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 self-start sm:self-center">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100/90 text-emerald-900 border border-emerald-300/60 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        <span>Immediate Lease Ready</span>
                      </span>
                    </div>
                  </div>

                  {/* Two-Column Structured Banking Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 items-stretch">
                    {/* Card 1: Compartment & Physical Specs */}
                    <div className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <Layers className="w-4 h-4 text-slate-500" />
                          <h3 className="text-xs font-bold text-slate-700">
                            Vault Location & Specifications
                          </h3>
                        </div>

                        <div className="space-y-2 text-xs mt-3">
                          <div className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500 font-medium">Locker Size</span>
                            <span className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-[11px] font-bold border border-slate-200">
                                Size {locker.size}
                              </span>
                              <span className="text-slate-600 font-normal">
                                {sizeDefinition?.label?.replace(/^Size [A-Z0-9]+ /, '') || ''}
                              </span>
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500 font-medium">Dimensions</span>
                            <span className="font-semibold text-slate-800 font-mono text-[11.5px]">
                              {sizeDefinition?.dimensions || '159 x 210 x 492 mm'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500 font-medium">Rack & Bay</span>
                            <span className="font-semibold text-slate-800">
                              {formatRackTitle(locker.rackNumber)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500 font-medium">Section & Floor</span>
                            <span className="font-semibold text-slate-800">
                              {formatSectionTitle(locker.section, locker.rackNumber)} &bull; {locker.floor || 'Ground Floor'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1">
                            <span className="text-slate-500 font-medium">Key Reference</span>
                            {isEditingKey ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={keyInput}
                                  onChange={(e) => setKeyInput(e.target.value)}
                                  placeholder="e.g. K-104-A"
                                  className="h-7 w-28 px-2 text-xs font-mono font-semibold border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600 uppercase"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={handleSaveKey}
                                  disabled={isSavingKey}
                                  className="h-7 px-2.5 rounded-lg bg-emerald-800 text-white text-[11px] font-semibold hover:bg-emerald-900 transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                >
                                  {isSavingKey ? (
                                    <>
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      <span>Saving</span>
                                    </>
                                  ) : (
                                    <span>Save</span>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsEditingKey(false);
                                    setKeyInput(locker.masterKeyReference || '');
                                  }}
                                  className="h-7 px-1.5 rounded-lg border border-slate-200 text-slate-500 text-[11px] hover:bg-slate-100 transition cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`font-mono text-xs ${
                                    locker.masterKeyReference
                                      ? 'font-bold text-slate-800'
                                      : 'text-slate-400 font-normal'
                                  }`}
                                >
                                  {sensitiveRevealed
                                    ? locker.masterKeyReference || 'Not Assigned'
                                    : locker.masterKeyReference
                                    ? '••••••'
                                    : 'Not Assigned'}
                                </span>
                                {locker.masterKeyReference && canViewSensitive && (
                                  <button
                                    type="button"
                                    onClick={() => setSensitiveRevealed(!sensitiveRevealed)}
                                    className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                                    title={sensitiveRevealed ? 'Hide Key' : 'Reveal Key'}
                                  >
                                    {sensitiveRevealed ? (
                                      <EyeOff className="h-3.5 w-3.5" />
                                    ) : (
                                      <Eye className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                )}
                                {locker.masterKeyReference && (
                                  <button
                                    type="button"
                                    onClick={handleCopyKey}
                                    className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                                    title="Copy Key Reference"
                                  >
                                    {copiedKey ? (
                                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                )}
                                {canUpdate && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setKeyInput(locker.masterKeyReference || '');
                                      setIsEditingKey(true);
                                    }}
                                    className="text-slate-400 hover:text-emerald-700 p-0.5 cursor-pointer ml-0.5 inline-flex items-center gap-0.5 text-[11px]"
                                    title={locker.masterKeyReference ? 'Edit Key' : 'Assign Key'}
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                    {!locker.masterKeyReference && (
                                      <span className="text-emerald-700 font-medium">Assign</span>
                                    )}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Commercial Tariff & Move-In Breakdown */}
                    <div className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <IndianRupee className="w-4 h-4 text-slate-500" />
                          <h3 className="text-xs font-bold text-slate-700">
                            Tariff & Move-In Structure
                          </h3>
                        </div>

                        <div className="space-y-2 text-xs mt-3">
                          <div className="flex items-center justify-between py-0.5">
                            <span className="text-slate-500 font-medium">Annual Base Rent</span>
                            <span className="font-bold text-slate-900 tabular-nums">
                              <span className="text-slate-400 font-normal mr-0.5">₹</span>
                              {baseRent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-0.5">
                            <span className="text-slate-500 font-medium">GST (18%)</span>
                            <span className="font-semibold text-slate-800 tabular-nums">
                              <span className="text-slate-400 font-normal mr-0.5">₹</span>
                              {gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1 border-t border-dashed border-slate-200">
                            <span className="text-slate-700 font-semibold">Total Annual Rent (inc. GST)</span>
                            <span className="font-bold text-slate-900 tabular-nums">
                              <span className="text-slate-400 font-normal mr-0.5">₹</span>
                              {totalAnnualRent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-0.5">
                            <span className="text-slate-500 font-medium">Security Deposit (Refundable)</span>
                            <span className="font-bold text-emerald-800 tabular-nums">
                              <span className="text-emerald-600 font-normal mr-0.5">₹</span>
                              {deposit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Total Move-in Ledger Box */}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 mt-3 space-y-1">
                        <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                          <span>Total Move-in Cost (Rent + Deposit)</span>
                          <span className="text-[10.5px] text-emerald-800 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/70">
                            First Year Allotment
                          </span>
                        </div>
                        <div className="text-xl font-bold font-mono tracking-tight text-slate-900 tabular-nums flex items-baseline">
                          <span className="text-slate-400 font-normal mr-1 text-base">₹</span>
                          <span>{totalMoveInPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {isOccupied && (currentAlloc ? <OccupiedLockerSummary
                allocation={currentAlloc} annualRent={currentAlloc.annualRent ?? currentAlloc.rentSnapshot} deposit={depositLabel} depositNote={!canViewDeposits ? 'Deposit balance restricted' : depositError ? 'Could not load deposit balance' : !depositSummary ? 'Loading deposit ledger...' : depositSummary.netDepositHeld < 0 ? 'Ledger needs review' : depositSummary.totalDepositReceived + depositSummary.totalAddAdjustments === 0 ? `No collection recorded. Required: ${money(depositSummary.requiredDeposit)}` : depositSummary.netDepositHeld === 0 ? 'Collected deposit has been settled' : 'Deposit held (recorded)'}
                identity={!canViewKyc ? 'Restricted' : isKycLoading ? 'Loading...' : isKycError ? 'Unavailable' : identityDoc ? identityRevealed && canViewIdNumber ? identityDoc.documentNumber : identityDoc.maskedDocumentNumber || 'ID on file' : kycDocs.length ? 'Documents on file' : 'Not recorded'}
                identityControl={identityDoc && !isKycError && !isKycLoading && canViewIdNumber ? <button type="button" className="font-semibold text-emerald-800 underline" onClick={() => setRevealedIdentityKey(value => value === identityKey ? null : identityKey)}>{identityRevealed ? 'Hide ID number' : 'Show ID number'}</button> : undefined}
                invoices={invoices} payments={lockerPayments}
                historyState={!canViewInvoices ? 'restricted' : invoicesLoading ? 'loading' : invoicesError ? 'error' : 'ready'}
                receiptState={!canViewPayments ? 'restricted' : paymentsLoading ? 'loading' : paymentsError ? 'error' : 'ready'}
                canReceipt={canViewPayments} canRenew={canViewInvoices && !invoicesLoading && !invoicesError && !unpaidInvoice && canGenerateRenewal && ['All good', 'Due soon', 'Renewal overdue'].includes(health.label)}
                canKyc={canViewKyc} canClose={canCloseLocker} canPay={canRecordPayment && !['Billing needs review', 'Coverage needs review', 'Status unavailable'].includes(health.label)} unpaid={unpaidInvoice}
                loadingReceiptId={loadingReceiptId} receiptError={receiptError} onReceipt={payment => void openReceipt(payment)}
                onRenew={() => setRenewingAllocation(currentAlloc)} onKyc={() => setActiveTab('kyc')} onCloseLocker={() => setClosureOpen(true)}
                onPay={setRecordingPaymentInvoiceId} onInvoice={setViewingInvoice} onRetry={() => void retryInvoices()} onRetryReceipts={() => void retryPayments()}
                secondary={<div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-600">
                  {canViewInvoices && <button type="button" onClick={() => setActiveTab('receipts')} className="underline">Invoices</button>}
                  {canViewDeposits && <button type="button" onClick={() => setActiveTab('refunds')} className="underline">Deposit &amp; Refunds</button>}
                  {tenantId && <button type="button" onClick={() => setProfileOpen(true)} className="underline">Customer Profile</button>}
                </div>}
              /> : <p role="status" className="rounded-xl bg-amber-50 p-4 text-amber-950">No active allotment is recorded for this occupied locker. Review the allocation before taking payment or renewal actions.</p>)}

              {/* --- SCENARIO C: MAINTENANCE / DAMAGED / BLOCKED --- */}
              {isMaintenance && (
                <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-rose-950">
                        Unit Under {locker.operationalStatus === 'DAMAGED' ? 'Damaged Lock Repair' : 'Maintenance / Lock Service'}
                      </h4>
                      <p className="text-xs text-rose-800 mt-1">
                        {locker.remarks || 'This compartment is currently held for maintenance or technical lock inspection. Not available for new allocation.'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-rose-200/80">
                    <div>
                      <span className="text-rose-700 font-medium">Rack & Section:</span>{' '}
                      <span className="font-semibold text-rose-950">
                        {formatRackTitle(locker.rackNumber)} &bull; {locker.section || 'Main Vault'}
                      </span>
                    </div>
                    <div>
                      <span className="text-rose-700 font-medium">Size:</span>{' '}
                      <span className="font-semibold text-rose-950">Size {locker.size}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* --- SCENARIO D: DECOMMISSIONED / CLOSED --- */}
              {isClosed && canUpdate && (
                <div className="p-4 rounded-2xl bg-slate-100 border border-slate-300 space-y-3">
                  <div className="flex items-start gap-3">
                    <Trash2 className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Decommissioned / Inactive Locker
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        This locker has been soft-deactivated. You can reactivate it as Vacant to make it available again.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setConfirmVacantOpen(true)}
                    disabled={markVacantMutation.isPending}
                    className="rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs h-8.5 px-3.5 shadow-2xs gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{markVacantMutation.isPending ? 'Reactivating...' : 'Reactivate & Mark Vacant'}</span>
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RECEIPTS */}
          {activeTab === 'receipts' && (
            <div className="space-y-4">
              {!canViewInvoices ? <p>Invoice access is restricted.</p> : invoicesLoading ? <p role="status">Loading invoices...</p> : invoicesError ? <p role="alert">Could not load invoices. <button type="button" onClick={() => retryInvoices()}>Retry</button></p> : invoices.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Receipt className="h-10 w-10 mx-auto text-slate-300" />
                  <p className="font-semibold text-slate-700 text-sm">No Invoices Recorded</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {isAvailable
                      ? 'This locker is vacant. Billing invoices and GST payment receipts will be generated once allocated to a customer.'
                      : 'No payment invoices or receipts recorded for this locker unit.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-xs">
                  {invoices.map((inv) => (
                    <div
                      key={inv._id}
                      className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                            {inv.invoiceNumber}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              inv.paymentStatus === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {['CANCELLED', 'DRAFT'].includes(inv.status) ? inv.status : inv.paymentStatus}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Due Date: {new Date(inv.dueDate).toLocaleDateString('en-IN')} &bull;{' '}
                          {inv.customerId?.fullName || 'Customer'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <div className="text-left sm:text-right">
                          <span className="font-bold text-slate-900 text-sm block">
                            ₹{inv.totalAmount?.toLocaleString('en-IN')}
                          </span>
                          {inv.balanceAmount > 0 && (
                            <span className="text-xs font-semibold text-rose-600 block">
                              Bal: ₹{inv.balanceAmount?.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {inv.balanceAmount > 0 && canRecordPayment && !['CANCELLED', 'DRAFT'].includes(inv.status) && (
                            <Button
                              size="sm"
                              onClick={() => setRecordingPaymentInvoiceId(inv._id)}
                              className="h-8 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs px-2.5 shadow-2xs cursor-pointer"
                            >
                              <CreditCard className="h-3.5 w-3.5 mr-1" />
                              Pay Due
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingInvoice(inv)}
                            className="h-8 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs px-2.5 cursor-pointer"
                            title="View Invoice Dossier"
                            aria-label={`View invoice ${inv.invoiceNumber}`}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'kyc' && (
            !canViewKyc ? <p>KYC document access is restricted.</p> : <LockerKycPanel
              customerId={tenantId}
              customerName={tenant?.fullName}
              customerCode={tenant?.customerCode}
              customerPhone={tenant?.phone}
              photoUrl={tenant?.photoUrl}
              kycStatus={tenant?.kycStatus}
              documents={kycDocs}
              loading={isKycLoading}
              failed={isKycError}
              onRetry={() => {
                void refetchKyc();
              }}
            />
          )}

          {/* TAB 4: DEPOSIT & ESCROW */}
          {activeTab === 'refunds' && !allocationLoading && !allocationError && (canViewAllocations || !isOccupied) && (
            <div role="region" aria-label="Deposit and refunds" className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-emerald-700" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                      Security Deposit Ledger
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
                    {depositLabel}
                  </span>
                  <span className="text-xs text-emerald-800 font-medium">
                    {deposit > 0
                      ? isOccupied
                        ? 'Deposit ledger balance; settlement is handled through locker closure'
                        : `Required deposit for Size ${locker.size} / Payable at allotment`
                      : 'No Caution Deposit Required'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white border border-emerald-200 text-xs text-slate-600 space-y-1 min-w-[240px]">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-400">Ledger status:</span>
                    <span className={`font-semibold ${isOccupied ? 'text-emerald-800' : 'text-slate-600'}`}>
                      {currentAlloc ? !canViewDeposits ? 'Restricted' : depositError ? 'Unavailable' : !depositSummary ? 'Loading...' : !depositValid ? 'Ledger requires review' : depositSummary.netDepositHeld > 0 ? depositSummary.outstandingDeposit > 0 ? 'Partial deposit held' : 'Deposit held' : depositSummary.totalDepositReceived + depositSummary.totalAddAdjustments > 0 ? 'Deposit settled' : depositSummary.requiredDeposit > 0 ? 'Deposit collection pending' : 'No deposit required' : 'Unallocated'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-400">Customer:</span>
                    <span className="font-medium text-slate-800">
                      {isOccupied && tenant?.fullName ? tenant.fullName : 'Vault Reserve'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-400">Settlement:</span>
                    <span className="font-semibold text-slate-800">Subject to ledger settlement</span>
                  </div>
                </div>
              </div>

              {currentAlloc && canViewDeposits && (depositError || depositSummary && !depositValid) && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{depositError ? 'Could not load deposit balance.' : 'Deposit ledger needs reconciliation.'} <button type="button" className="font-semibold underline" onClick={() => void retryDeposit()}>Retry deposit balance</button></p>}
              {currentAlloc && canViewDeposits && depositFetching && <p role="status">Refreshing deposit balance...</p>}
              {settlementError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{settlementError}</p>}
              {currentAlloc && canViewDeposits && <div className="flex flex-wrap gap-2">
                {canCollectDeposit && <Button variant="outline" disabled={!depositReady || !canOverrideDeposit && (depositSummary?.outstandingDeposit || 0) <= 0} onClick={() => setDepositAction('collect')}>Collect deposit</Button>}
                {canAdjustDeposit && <Button variant="outline" disabled={!depositReady} onClick={() => setDepositAction('adjust')}>Adjust deposit</Button>}
                {canCreateRefund && <Button variant="outline" disabled={!depositReady || !depositSummary || depositSummary.availableRefundableBalance <= 0} onClick={() => setDepositAction('refund')}>Request refund</Button>}
              </div>}
              {currentAlloc && depositSummary && canViewDeposits && depositValid && !depositError && <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-2xl border border-slate-200 p-4 text-xs">
                {[['Required deposit', depositSummary.requiredDeposit], ['Collected', depositSummary.totalDepositReceived], ['Adjustment credits', depositSummary.totalAddAdjustments], ['Deductions', depositSummary.totalDeductAdjustments], ['Deposit still required', depositSummary.outstandingDeposit], ['Refunded', depositSummary.totalRefunded], ['Pending refunds', depositSummary.pendingRefundAmount], ['Available for refund', depositSummary.availableRefundableBalance]].map(([label, value]) => <div key={String(label)}><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-900">{typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) : 'Not recorded'}</dd></div>)}
              </dl>}
              {!canViewRefunds ? <p>Refund history access is restricted.</p> : refundsLoading ? <p role="status">Loading refund history...</p> : refundsError ? <p role="alert">Could not load refund history. <button type="button" onClick={() => retryRefunds()}>Retry</button></p> : refunds.length === 0 ? (
                <div className="py-6 text-center text-slate-400 space-y-1 bg-slate-50/60 rounded-2xl border border-slate-100 p-4">
                  <p className="font-semibold text-slate-700 text-xs">
                    {isOccupied ? 'No Refund Requests Recorded' : 'Deposit Payable at Allotment'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {isOccupied
                      ? !canViewDeposits ? 'Deposit balance is restricted.' : depositError ? 'Deposit balance could not be loaded.' : !depositSummary ? 'Loading deposit balance...' : depositSummary.netDepositHeld ? 'Recorded deposit balance is available for settlement through the closure workflow.' : depositSummary.totalDepositReceived + depositSummary.totalAddAdjustments > 0 ? 'The collected deposit has been settled; no balance remains held.' : 'No security deposit collection is recorded for this allotment.'
                      : `Standard cautionary deposit of ₹${deposit.toLocaleString('en-IN')} is payable when this locker is allocated.`}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                  {refunds.map((ref) => (
                    <div
                      key={ref._id}
                      className="p-3.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-slate-900">
                          {ref.refundNumber}
                        </span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Date: {new Date(ref.createdAt).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 block">
                          ₹{(ref.approvedAmount ?? ref.requestedAmount)?.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {ref.status}
                        </span>
                        <div className="mt-2 flex flex-wrap justify-end gap-2">
                          {ref.status === 'DRAFT' && canCreateRefund && <Button size="sm" variant="outline" disabled={submittingRefundId === ref._id} onClick={async () => {
                            if (submittingRefundRef.current) return;
                            submittingRefundRef.current = true; setSubmittingRefundId(ref._id); setSettlementError('');
                            try { await depositApi.submitRefund(ref._id); await refreshSettlement(); }
                            catch (err: any) { setSettlementError(err.response?.data?.message || 'Could not submit the refund. Please retry.'); }
                            finally { submittingRefundRef.current = false; setSubmittingRefundId(null); }
                          }}>{submittingRefundId === ref._id ? 'Submitting...' : 'Submit refund'}</Button>}
                          {ref.status === 'PENDING_APPROVAL' && canApproveRefund && <Button size="sm" variant="outline" onClick={() => setApprovingRefund(ref._id)}>Review refund</Button>}
                          {ref.status === 'APPROVED' && canPayRefund && <Button size="sm" onClick={() => setPayingRefund(ref)}>Pay refund</Button>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {canViewRefunds && (refundsData?.pagination.totalPages || 0) > 1 && <div className="flex items-center justify-between gap-2 text-xs"><Button disabled={refundPage <= 1 || refundsLoading} onClick={() => setRefundPage(page => page - 1)}>Previous refunds</Button><span>Page {refundPage} of {refundsData?.pagination.totalPages}</span><Button disabled={refundPage >= (refundsData?.pagination.totalPages || 1) || refundsLoading} onClick={() => setRefundPage(page => page + 1)}>Next refunds</Button></div>}
            </div>
          )}
        </div>

        {/* 4. Footer Action Bar */}
        <div className="shrink-0 flex flex-wrap gap-2 items-center justify-between p-3.5 sm:px-6 sm:py-4 bg-slate-50/90 border-t border-slate-200/80">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl border-slate-300 text-slate-700 font-semibold text-xs h-9 px-4 cursor-pointer hover:bg-slate-100"
          >
            Close
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            {isClosed && canUpdate && (
              <Button
                size="sm"
                onClick={() => setConfirmVacantOpen(true)}
                disabled={markVacantMutation.isPending}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs h-9 px-4 shadow-xs gap-1.5 cursor-pointer"
              >
                {markVacantMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span>
                  {markVacantMutation.isPending ? 'Marking Vacant...' : 'Mark Vacant'}
                </span>
              </Button>
            )}

            {isOccupied && activeTab !== 'details' && <>
              {canCloseLocker && currentAlloc && <Button variant="outline" aria-label="Close Locker" onClick={() => setClosureOpen(true)}>Close locker</Button>}
              {unpaidInvoice && canRecordPayment && !['Billing needs review', 'Coverage needs review', 'Status unavailable'].includes(health.label) && <Button onClick={() => setRecordingPaymentInvoiceId(unpaidInvoice._id)}>Record Payment ({money(unpaidInvoice.balanceAmount)})</Button>}
              {tenantId && <Button variant="outline" onClick={() => setProfileOpen(true)}>Customer Profile</Button>}
            </>}
            {isMaintenance && canUpdate && (
              <Button
                size="sm"
                onClick={() => setConfirmRepairedOpen(true)}
                disabled={markRepairedMutation.isPending}
                className="rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs h-9 px-4 shadow-xs gap-1.5 cursor-pointer"
              >
                {markRepairedMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <span>
                  {markRepairedMutation.isPending ? 'Restoring Unit...' : 'Mark Repaired & Available'}
                </span>
              </Button>
            )}

            {isAvailable && (
              <Button
                size="sm"
                onClick={handleAllocate}
                className="rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs h-9 px-4 shadow-xs gap-1.5 cursor-pointer"
              >
                <KeyRound className="h-4 w-4" />
                <span>Allocate Locker</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Child Modals */}
      {renewingAllocation && (
        <GenerateRenewalModal
          preSelectedAllocation={renewingAllocation}
          context={{
            identity: !canViewKyc ? 'Restricted' : isKycLoading ? 'Loading...' : isKycError ? 'Unavailable' : identityDoc ? identityDoc.maskedDocumentNumber || 'ID on file' : kycDocs.length ? 'Documents on file' : 'Not recorded',
            deposit: depositLabel, key: canViewSensitive ? locker.masterKeyReference || 'Not assigned' : 'Restricted', health,
            onKyc: canViewKyc ? () => { setRenewingAllocation(null); setActiveTab('kyc'); } : undefined,
            onCloseLocker: canCloseLocker ? () => { setRenewingAllocation(null); setClosureOpen(true); } : undefined,
            history: <section aria-label="Renewal bill and receipt history" className="space-y-3">
              <h3 className="border-b border-slate-200 pb-3 font-extrabold uppercase tracking-wide text-emerald-800">Bill &amp; receipt history</h3>
              {invoices.filter(item => referenceId(item.allocationId) === renewingAllocation._id).map(item => <article key={item._id} className="space-y-3 border-b border-slate-200 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><strong className="break-all text-slate-950">{item.invoiceNumber}</strong><span className="ml-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">{item.invoiceType === 'NEW_ALLOCATION' ? 'New allotment' : item.invoiceType === 'RENEWAL' ? 'Renewal' : 'Bill'}</span><p className="mt-2 text-sm text-slate-600">{ledgerDate(item.billingPeriodStart)} &rarr; {ledgerDate(item.billingPeriodEnd)} &middot; {item.status}</p></div><div className="flex flex-wrap items-center gap-3"><strong>{money(item.totalAmount)}</strong><Button type="button" variant="outline" disabled={isSubmittingRenewal} onClick={() => { setRenewingAllocation(null); setViewingInvoice(item); }}>View bill</Button></div></div>
                {canViewPayments && lockerPayments.filter(payment => referenceId(payment.invoiceId) === item._id).map(payment => <div key={payment._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><span>{payment.receiptNumber || payment.paymentNumber} &middot; {money(payment.amount)}</span><Button type="button" variant="outline" disabled={isSubmittingRenewal || loadingReceiptId === payment._id} onClick={() => { setRenewingAllocation(null); void openReceipt(payment); }}>View receipt</Button></div>)}
              </article>)}
              {paymentsError && <p role="alert">Could not load receipts. <button type="button" className="underline" onClick={() => void retryPayments()}>Retry receipts</button></p>}
              {paymentsLoading && <p role="status">Loading receipts...</p>}
              {!canViewPayments && <p>Receipt access is restricted.</p>}
            </section>,
          }}
          onClose={() => setRenewingAllocation(null)}
          onSubmit={async (data) => {
            setIsSubmittingRenewal(true);
            try {
              const issued = await renewalApi.generateRenewal(data);
              queryClient.invalidateQueries({ queryKey: ['locker-payments', locker._id] });
            queryClient.invalidateQueries({ queryKey: ['locker-invoices', locker._id] });
              queryClient.invalidateQueries({ queryKey: ['locker-allocations', locker._id] });
              setRenewingAllocation(null);
              setNotice('Renewal bill issued. Record payment to confirm collection.');
              if (canRecordPayment) setRecordingPaymentInvoiceId(issued._id);
              for (const key of ['renewals', 'renewal-stats', 'lockers', 'allocations', 'invoices']) void queryClient.invalidateQueries({ queryKey: [key] });
            } finally {
              setIsSubmittingRenewal(false);
            }
          }}
          isSubmitting={isSubmittingRenewal}
        />
      )}

      {profileOpen && tenantId && <LockerCustomerProfileModal customerId={tenantId} onClose={() => setProfileOpen(false)} onKyc={() => { setProfileOpen(false); setActiveTab('kyc'); }} onInvoices={() => { setProfileOpen(false); setActiveTab('receipts'); }} />}
      {allocationOpen && <AllocationWizardModal mode="allocate" preSelectedLocker={locker} isSubmitting={false} onClose={() => setAllocationOpen(false)} onSubmit={async () => {}} />}
      {closureOpen && currentAlloc && <LockerClosureFlow lockerId={locker._id} allocationId={currentAlloc._id} onClose={() => setClosureOpen(false)} onPayments={id => { setClosureOpen(false); if (id) setRecordingPaymentInvoiceId(id); else setActiveTab('receipts'); }} onDeposits={() => { setClosureOpen(false); setActiveTab('refunds'); }} onCompleted={() => { setClosureOpen(false); onClose(); }} />}
      {depositAction === 'collect' && currentAlloc && <CollectDepositModal isOpen allocationId={currentAlloc._id} canOverride={canOverrideDeposit} onClose={() => setDepositAction(null)} onSuccess={result => { setDepositAction(null); void refreshSettlement(); if (canViewPayments && result.payment) void openReceipt(result.payment); }} />}
      {depositAction === 'adjust' && currentAlloc && <AdjustDepositModal isOpen allocationId={currentAlloc._id} onClose={() => setDepositAction(null)} onSuccess={() => { setDepositAction(null); void refreshSettlement(); }} />}
      {depositAction === 'refund' && currentAlloc && <CreateRefundModal isOpen allocationId={currentAlloc._id} onClose={() => setDepositAction(null)} onSuccess={() => { setDepositAction(null); void refreshSettlement(); }} />}
      {approvingRefund && <RefundApprovalModal isOpen refundId={approvingRefund} onClose={() => setApprovingRefund(null)} onSuccess={() => { setApprovingRefund(null); void refreshSettlement(); }} />}
      {payingRefund && <RefundPaymentModal isOpen refund={payingRefund} onClose={() => { setPayingRefund(null); void refreshSettlement(); }} onSuccess={() => { setPayingRefund(null); void refreshSettlement(); }} />}

      {recordingPaymentInvoiceId && (
        <RecordPaymentModal
          initialInvoiceId={recordingPaymentInvoiceId}
          onClose={() => setRecordingPaymentInvoiceId(null)}
          onSubmit={async (data, idempotencyKey) => {
            const p = await paymentApi.recordPayment(data, idempotencyKey);
            queryClient.invalidateQueries({ queryKey: ['locker-payments', locker._id] });
            queryClient.invalidateQueries({ queryKey: ['locker-invoices', locker._id] });
            queryClient.invalidateQueries({ queryKey: ['lockers'] });
            queryClient.invalidateQueries({ queryKey: ['locker-allocations', locker._id] });
            return p;
          }}
          onSuccessViewReceipt={(p) => {
            setRecordingPaymentInvoiceId(null);
            setViewingReceiptPayment(p);
          }}
        />
      )}

      {viewingInvoice && (
        <InvoiceDetailModal
          invoice={viewingInvoice}
          fallbackLocker={locker}
          onClose={() => setViewingInvoice(null)}
          onRecordPayment={(inv) => {
            setViewingInvoice(null);
            setRecordingPaymentInvoiceId(inv._id);
          }}
        />
      )}

      {viewingReceiptPayment && (
        <PaymentReceiptModal
          payment={viewingReceiptPayment}
          onClose={() => setViewingReceiptPayment(null)}
        />
      )}

      {/* State Transition Confirmation Modals */}
      <ConfirmationModal
        isOpen={confirmVacantOpen}
        onClose={() => setConfirmVacantOpen(false)}
        onConfirm={async () => {
          await markVacantMutation.mutateAsync();
          setConfirmVacantOpen(false);
        }}
        title="Mark Locker as Vacant?"
        message={`Are you sure you want to mark Locker ${locker.lockerNumber} (${locker.lockerCode}) as VACANT? This will transition the locker to active vault inventory, making it immediately available for allotment.`}
        confirmLabel="Mark Vacant"
        variant="emerald"
        isLoading={markVacantMutation.isPending}
      />

      <ConfirmationModal
        isOpen={confirmRepairedOpen}
        onClose={() => setConfirmRepairedOpen(false)}
        onConfirm={async () => {
          await markRepairedMutation.mutateAsync();
          setConfirmRepairedOpen(false);
        }}
        title="Restore Locker to Service?"
        message={`Confirm that maintenance and inspection for Locker ${locker.lockerNumber} (${locker.lockerCode}) is complete. The locker will be returned to active inventory as VACANT.`}
        confirmLabel="Restore to Service"
        variant="emerald"
        isLoading={markRepairedMutation.isPending}
      />
    </div>
  );

  return createPortal(modalContent, document.body);
}
