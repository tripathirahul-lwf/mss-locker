import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
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
  onClose: () => void;
  onEdit?: (locker: Locker) => void;
  onAllocate?: (locker: Locker) => void;
}

export function LockerDetailModal({
  locker,
  onClose,
  onEdit,
  onAllocate,
}: LockerDetailModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const canUpdate = usePermission('lockers.update');
  const canViewSensitive = usePermission('lockers.view_sensitive');
  const canRecordPayment = usePermission('payments.create');
  const canGenerateRenewal = usePermission('renewals.create');
  const canAllocate = usePermission('allocations.create');

  const [activeTab, setActiveTab] = useState<'details' | 'receipts' | 'kyc' | 'refunds'>('details');
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
  const { data: lockerAllocData } = useQuery({
    queryKey: ['locker-allocations', locker._id],
    queryFn: () => allocationApi.getLockerAllocations(locker._id),
    enabled: Boolean(locker._id),
  });

  const currentAlloc = lockerAllocData?.currentAllocation;
  const tenant = currentAlloc?.customerId;
  const tenantId = tenant?._id;

  // 2. Billing & Invoices Query
  const { data: lockerInvoices } = useQuery({
    queryKey: ['locker-invoices', locker._id],
    queryFn: () => renewalApi.getLockerInvoices(locker._id),
    enabled: Boolean(locker._id),
  });

  const invoices: LockerInvoice[] = useMemo(() => {
    if (!lockerInvoices || !Array.isArray(lockerInvoices)) return [];
    return [...lockerInvoices].sort((a, b) => {
      const dateA = new Date(a.dueDate || a.createdAt).getTime();
      const dateB = new Date(b.dueDate || b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [lockerInvoices]);

  // 3. KYC Documents Query (Fetched for the tenant)
  const { data: kycDocs = [] } = useQuery<CustomerKycDocument[]>({
    queryKey: ['customer-kyc', tenantId],
    queryFn: () => customerApi.getKycDocuments(tenantId!),
    enabled: Boolean(tenantId),
  });

  // 4. Refunds Query
  const { data: refundsData } = useQuery({
    queryKey: ['locker-refunds', locker._id],
    queryFn: () => depositApi.getRefunds({ lockerId: locker._id }),
    enabled: Boolean(locker._id),
  });

  const refunds: RefundRequest[] = refundsData?.refunds || [];

  // Child Modals State
  const [recordingPaymentInvoiceId, setRecordingPaymentInvoiceId] = useState<string | null>(null);
  const [renewingAllocation, setRenewingAllocation] = useState<LockerAllocation | null>(null);
  const [isSubmittingRenewal, setIsSubmittingRenewal] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<LockerInvoice | null>(null);
  const [viewingReceiptPayment, setViewingReceiptPayment] = useState<Payment | null>(null);

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

  // Keyboard accessibility and scroll lock
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

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
      onClose();
      navigate(`/allocations?allocateLocker=${locker._id}&lockerNumber=${locker.lockerNumber}`);
    }
  };

  const totalAnnualRent = locker.annualRent || sizeDefinition?.defaultRent || 0;
  const isDefaultSizeRent =
    !locker.annualRent || (sizeDefinition && locker.annualRent === sizeDefinition.defaultRent);
  const baseRent =
    isDefaultSizeRent && sizeDefinition?.baseRent
      ? sizeDefinition.baseRent
      : locker.securityDeposit
      ? Math.round(locker.securityDeposit / 2)
      : Math.round(totalAnnualRent / 1.18);
  const gstAmount = Math.max(0, totalAnnualRent - baseRent);
  const deposit = locker.securityDeposit || sizeDefinition?.defaultDeposit || 0;
  const totalMoveInPayable = totalAnnualRent + deposit;

  // Unpaid balance
  const unpaidInvoice = invoices.find(
    (inv) => inv.balanceAmount > 0 && inv.paymentStatus !== 'PAID'
  );

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex h-screen w-screen items-center justify-center bg-slate-950/70 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in-0 duration-150 overflow-y-auto font-sans">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="locker-dossier-title"
        className="flex w-full max-w-2xl sm:max-w-3xl flex-col overflow-hidden bg-white shadow-2xl rounded-2xl sm:rounded-3xl border border-slate-200 my-auto animate-in zoom-in-95 duration-150"
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

        {/* 1. Refined Bank Header */}
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

        {/* 2. Sub-Navigation Tabs */}
        <div className="flex items-center border-b border-slate-200 px-4 sm:px-6 bg-slate-50/50 overflow-x-auto select-none gap-1 sm:gap-2">
          <button
            type="button"
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
            onClick={() => setActiveTab('receipts')}
            className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'receipts'
                ? 'border-emerald-800 text-emerald-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Receipts</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                activeTab === 'receipts'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-200/80 text-slate-600'
              }`}
            >
              {invoices.length}
            </span>
          </button>

          <button
            type="button"
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
                  tenant?.kycStatus === 'VERIFIED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : kycDocs.length > 0
                    ? 'bg-slate-200 text-slate-700'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {tenant?.kycStatus === 'VERIFIED'
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
            onClick={() => setActiveTab('refunds')}
            className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'refunds'
                ? 'border-emerald-800 text-emerald-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Deposit & Escrow</span>
            {isOccupied && deposit > 0 ? (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  activeTab === 'refunds'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200/80 text-slate-600'
                }`}
              >
                ₹{deposit.toLocaleString('en-IN')}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200/70 text-slate-600">
                ₹0 Held
              </span>
            )}
          </button>
        </div>

        {/* 3. Modal Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto max-h-[74vh] space-y-3.5">
          {/* TAB 1: DETAILS */}
          {activeTab === 'details' && (
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

              {/* --- SCENARIO B: OCCUPIED LOCKER --- */}
              {isOccupied && (
                <>
                  {/* Customer Allotment Dossier Card */}
                  <div className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs space-y-3">
                    {/* Header: Clean title + Click-to-copy Agreement pill */}
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-emerald-800" />
                        <h3 className="text-xs font-bold text-slate-800 tracking-wide uppercase">
                          Active Allottee Dossier
                        </h3>
                      </div>

                      {currentAlloc?.allocationCode && (
                        <button
                          type="button"
                          onClick={() => handleCopyAllocCode(currentAlloc.allocationCode)}
                          className="group font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200/80 px-2 py-0.5 rounded-md border border-slate-200 flex items-center gap-1.5 transition cursor-pointer"
                          title="Click to copy Agreement #"
                        >
                          <span>Agreement #{currentAlloc.allocationCode}</span>
                          {copiedAllocCode ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3 text-slate-400 group-hover:text-slate-600" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* 4-Column Grid: Customer, Phone, Allotment, Renewal */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Box 1: Customer Name & ID */}
                      <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 space-y-1">
                        <span className="text-[11px] font-medium text-slate-500">Customer Name</span>
                        {tenantId ? (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              navigate(`/customers/${tenantId}`);
                            }}
                            className="font-bold text-slate-900 text-sm hover:text-emerald-800 text-left transition flex items-center gap-1.5 group cursor-pointer"
                            title="View Customer Profile"
                          >
                            <span>{tenant?.fullName || 'Active Allottee'}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-emerald-700 transition opacity-0 group-hover:opacity-100" />
                          </button>
                        ) : (
                          <p className="font-bold text-slate-900 text-sm">
                            {tenant?.fullName || 'Active Allottee'}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-normal">
                          {tenant?.customerCode && (
                            <button
                              type="button"
                              onClick={() => handleCopyCode(tenant.customerCode)}
                              className="group inline-flex items-center gap-1 font-mono hover:text-slate-800 transition cursor-pointer"
                              title="Click to copy Customer ID"
                            >
                              <span>ID: {tenant.customerCode}</span>
                              {copiedCode ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3 text-slate-400 group-hover:text-slate-600" />
                              )}
                            </button>
                          )}
                          {tenant?.city && (
                            <>
                              <span>&bull;</span>
                              <span>{tenant.city}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Box 2: Phone & Contact */}
                      <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 space-y-1">
                        <span className="text-[11px] font-medium text-slate-500">Phone & Contact</span>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900 font-mono text-xs">
                            {tenant?.phone || '—'}
                          </span>
                          {tenant?.phone && (
                            <button
                              type="button"
                              onClick={() => handleCopyPhone(tenant.phone)}
                              className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                              title="Copy Phone"
                            >
                              {copiedPhone ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                        {tenant?.email ? (
                          <p className="text-[11px] text-slate-500 truncate font-sans">
                            {tenant.email}
                          </p>
                        ) : (tenant as any)?.alternatePhone ? (
                          <p className="text-[11px] text-slate-500">
                            Alt: {(tenant as any).alternatePhone}
                          </p>
                        ) : null}
                      </div>

                      {/* Box 3: Allotment Started */}
                      <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 space-y-1">
                        <span className="text-[11px] font-medium text-slate-500">Allotment Started</span>
                        <p className="font-semibold text-slate-900">
                          {formatDate(currentAlloc?.startDate)}
                        </p>
                        <p className="text-[10.5px] text-slate-500">
                          Plan: {currentAlloc?.billingCycle === 'ANNUAL' ? '1 Year Annual' : currentAlloc?.billingCycle || 'Annual'}
                        </p>
                      </div>

                      {/* Box 4: Next Renewal Due */}
                      <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 space-y-1">
                        <span className="text-[11px] font-medium text-slate-500">Next Renewal Due</span>
                        <p className="font-semibold text-slate-900">
                          {formatDate(currentAlloc?.endDate)}
                        </p>
                        {currentAlloc?.paidThroughDate && (
                          <p className="text-[10.5px] text-slate-500">
                            Paid up to: {formatDate(currentAlloc.paidThroughDate)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Renewal Notice (Calm Due Notice if upcoming, High-Priority Alert if overdue) */}
                  {unpaidInvoice && (() => {
                    const todayTime = new Date().setHours(0, 0, 0, 0);
                    const dueDateTime = new Date(unpaidInvoice.dueDate).setHours(0, 0, 0, 0);
                    const isOverdue = dueDateTime < todayTime;
                    const diffDays = Math.round(Math.abs(dueDateTime - todayTime) / (1000 * 60 * 60 * 24));
                    const dueDateFormatted = formatDate(unpaidInvoice.dueDate);

                    return (
                      <div
                        className={`p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs border ${
                          isOverdue
                            ? 'bg-rose-50/90 border-rose-200 text-rose-950'
                            : 'bg-amber-50/70 border-amber-200/90 text-amber-950'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                              isOverdue
                                ? 'bg-rose-100 border-rose-200 text-rose-700'
                                : 'bg-amber-100 border-amber-200 text-amber-700'
                            }`}
                          >
                            {isOverdue ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs sm:text-sm font-bold">
                                {isOverdue ? 'Locker Renewal Overdue' : 'Upcoming Renewal Notice'}: ₹{unpaidInvoice.balanceAmount.toLocaleString('en-IN')}
                              </span>
                              <span
                                className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${
                                  isOverdue
                                    ? 'bg-rose-200/60 text-rose-900 border-rose-300'
                                    : 'bg-amber-200/60 text-amber-900 border-amber-300'
                                }`}
                              >
                                {isOverdue ? `Overdue by ${diffDays} days` : `Due in ${diffDays} days`}
                              </span>
                            </div>
                            <span className="text-[11.5px] font-normal block mt-0.5 opacity-90">
                              Invoice #{unpaidInvoice.invoiceNumber} due on {dueDateFormatted} &bull; Total Tariff ₹{unpaidInvoice.totalAmount?.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingInvoice(unpaidInvoice)}
                            className="h-8 rounded-xl bg-white border-slate-300 text-slate-800 hover:bg-slate-50 text-xs font-semibold px-3 shadow-2xs cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 mr-1 text-slate-500" />
                            <span>View Invoice</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Specs & Caution Deposit Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs space-y-2 text-xs">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 font-bold text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-slate-500" />
                          <span>Vault Location & Specs</span>
                        </div>
                        <span className="text-[11px] font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                          Size {locker.size}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-slate-500">Dimensions</span>
                        <span className="font-mono text-slate-800">
                          {sizeDefinition?.dimensions || '159 x 210 x 492 mm'}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-slate-500">Rack & Compartment</span>
                        <span className="font-semibold text-slate-800">
                          {formatRackTitle(locker.rackNumber)}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-slate-500">Vault Location</span>
                        <span className="text-slate-700 font-medium">
                          {formatSectionTitle(locker.section, locker.rackNumber)} &bull; {locker.floor || 'Ground Floor'}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5 items-center">
                        <span className="text-slate-500">Key Reference</span>
                        <div className="flex items-center gap-1.5 font-mono text-slate-800">
                          <span>
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
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs space-y-2 text-xs">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 font-bold text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-slate-500" />
                          <span>Caution Escrow Deposit</span>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                          100% Refundable
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-slate-500">Deposit In Escrow</span>
                        <span className="font-bold text-slate-900 font-mono text-xs">
                          ₹{deposit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-slate-500">Annual Base Tariff</span>
                        <span className="font-semibold text-slate-800 tabular-nums">
                          ₹{baseRent.toLocaleString('en-IN', { minimumFractionDigits: 2 })} / yr
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-slate-500">GST (18%)</span>
                        <span className="font-semibold text-slate-800 tabular-nums">
                          ₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} / yr
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5 border-t border-dashed border-slate-200 pt-1">
                        <span className="text-slate-700 font-semibold">Total Annual Rent (inc. GST)</span>
                        <span className="font-bold text-slate-900 tabular-nums">
                          ₹{totalAnnualRent.toLocaleString('en-IN', { minimumFractionDigits: 2 })} / yr
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-slate-500">Billing Schedule</span>
                        <span className="font-semibold text-slate-700">
                          {currentAlloc?.billingCycle === 'ANNUAL' ? '1 Year Annual' : currentAlloc?.billingCycle || 'Annual'}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}

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
              {isClosed && (
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
              {invoices.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Receipt className="h-10 w-10 mx-auto text-slate-300" />
                  <p className="font-semibold text-slate-700 text-sm">No Receipts Recorded</p>
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
                            {inv.paymentStatus}
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
                          {inv.balanceAmount > 0 && canRecordPayment && (
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

          {/* TAB 3: KYC COMPLIANCE */}
          {activeTab === 'kyc' && (
            <div className="space-y-4">
              {kycDocs.length === 0 ? (
                <>
                  {tenant?.kycStatus === 'VERIFIED' ? (
                    <div className="py-4 text-center">
                      <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 max-w-xl mx-auto text-left space-y-2.5 shadow-2xs">
                        <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
                          <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
                          <span>KYC Verified Compliance Record</span>
                        </div>
                        <p className="text-xs text-emerald-900 font-normal leading-relaxed">
                          Customer identity and address verification has been officially verified for{' '}
                          <span className="font-semibold">{tenant?.fullName}</span>{' '}
                          ({tenant?.customerCode || 'Registered Client'}) under safe-deposit box regulatory compliance mandates.
                        </p>
                        <div className="pt-2 border-t border-emerald-200/70 flex items-center justify-between text-[11px] text-emerald-800">
                          <span>Physical proof verified in bank records</span>
                          {tenantId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                onClose();
                                navigate(`/customers/${tenantId}`);
                              }}
                              className="h-7 text-xs font-semibold bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-100/50 cursor-pointer"
                            >
                              <span>Manage in Profile &rarr;</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : !tenantId ? (
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-4 shadow-2xs text-left">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700 shrink-0 shadow-2xs">
                            <ShieldCheck className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-900 text-sm">
                                Mandatory Allotment Compliance Norms
                              </h4>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100/80 text-emerald-800 border border-emerald-200">
                                RBI / IBA Norms
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Locker #{locker.lockerNumber} is vacant. The following 4 statutory proofs must be collected during customer onboarding.
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 self-start sm:self-center">
                          <span className="text-[11px] font-medium text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                            Verified in Allotment Wizard
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 hover:border-slate-300 transition-colors shadow-2xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-700 font-mono text-[10.5px] font-bold flex items-center justify-center border border-emerald-200/60">
                                01
                              </span>
                              <span>Identity Proof (POI)</span>
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              Mandatory
                            </span>
                          </div>
                          <p className="text-[11.5px] text-slate-600 pl-7 leading-relaxed">
                            Officially Valid Documents (OVD): Aadhaar Card, Passport, Voter ID, or Driving License with clear photograph.
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 hover:border-slate-300 transition-colors shadow-2xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-700 font-mono text-[10.5px] font-bold flex items-center justify-center border border-emerald-200/60">
                                02
                              </span>
                              <span>Address Proof (POA)</span>
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              Mandatory
                            </span>
                          </div>
                          <p className="text-[11.5px] text-slate-600 pl-7 leading-relaxed">
                            Recent utility bill, bank account passbook, or registered agreement (not older than 3 months).
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 hover:border-slate-300 transition-colors shadow-2xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-700 font-mono text-[10.5px] font-bold flex items-center justify-center border border-emerald-200/60">
                                03
                              </span>
                              <span>Specimen Signature & Photos</span>
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              Mandatory
                            </span>
                          </div>
                          <p className="text-[11.5px] text-slate-600 pl-7 leading-relaxed">
                            Two recent passport-size photographs and physical ink specimen card for the vault master access register.
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 hover:border-slate-300 transition-colors shadow-2xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-700 font-mono text-[10.5px] font-bold flex items-center justify-center border border-emerald-200/60">
                                04
                              </span>
                              <span>Nomination Facility (DA-1)</span>
                            </span>
                            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                              Recommended
                            </span>
                          </div>
                          <p className="text-[11.5px] text-slate-600 pl-7 leading-relaxed">
                            Statutory Form DA-1 safe deposit nominee declaration under the Banking Companies (Nomination) Rules.
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Click <strong>Allocate Locker</strong> below to choose a customer and verify proofs.</span>
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 shrink-0">
                          COMPARTMENT #{locker.lockerNumber} • VACANT
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center">
                      <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200/80 max-w-xl mx-auto text-left space-y-2.5 shadow-2xs">
                        <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
                          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0" />
                          <span>KYC Documents Pending</span>
                        </div>
                        <p className="text-xs text-amber-900 font-normal leading-relaxed">
                          This customer has not yet uploaded digitized identity verification proofs.
                        </p>
                        {tenantId && (
                          <div className="pt-2 border-t border-amber-200/70 flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                onClose();
                                navigate(`/customers/${tenantId}`);
                              }}
                              className="h-7 text-xs font-semibold bg-white border-amber-300 text-amber-900 hover:bg-amber-100/50 cursor-pointer"
                            >
                              <span>Upload KYC Documents &rarr;</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {kycDocs.map((doc) => (
                    <div
                      key={doc._id}
                      className="p-3.5 rounded-2xl border border-slate-200/90 bg-slate-50/60 flex flex-col justify-between gap-3 shadow-2xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                            {doc.documentType}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              doc.verificationStatus === 'VERIFIED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {doc.verificationStatus}
                          </span>
                        </div>
                        <p className="font-mono text-xs text-slate-600">
                          {doc.maskedDocumentNumber || doc.documentNumber}
                        </p>
                        {doc.verifiedAt && (
                          <p className="text-[10.5px] text-slate-400 font-normal">
                            Verified on {new Date(doc.verifiedAt).toLocaleDateString('en-IN')}
                          </p>
                        )}
                      </div>

                      {doc.documentUrl && (
                        <a
                          href={doc.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold shadow-2xs transition"
                        >
                          <Eye className="h-3.5 w-3.5 text-emerald-700" />
                          <span>View Document</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DEPOSIT & ESCROW */}
          {activeTab === 'refunds' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-emerald-700" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                      Security Caution Deposit Policy
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
                    ₹{deposit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs text-emerald-800 font-medium">
                    {deposit > 0
                      ? isOccupied
                        ? 'Held in Bank Escrow Account • 100% Refundable on Key Surrender'
                        : `Standard Escrow Mandate for Size ${locker.size} • Payable at Allotment`
                      : 'No Caution Deposit Required'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white border border-emerald-200 text-xs text-slate-600 space-y-1 min-w-[240px]">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-400">Escrow Status:</span>
                    <span className={`font-semibold ${isOccupied ? 'text-emerald-800' : 'text-slate-600'}`}>
                      {isOccupied ? 'Active Escrow' : 'Unallocated (Vacant)'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-400">Custody Holder:</span>
                    <span className="font-medium text-slate-800">
                      {isOccupied && tenant?.fullName ? tenant.fullName : 'Vault Reserve'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-400">Settlement:</span>
                    <span className="font-semibold text-slate-800">Refundable upon closure</span>
                  </div>
                </div>
              </div>

              {refunds.length === 0 ? (
                <div className="py-6 text-center text-slate-400 space-y-1 bg-slate-50/60 rounded-2xl border border-slate-100 p-4">
                  <p className="font-semibold text-slate-700 text-xs">
                    {isOccupied ? 'No Active Refund Claims' : 'Deposit Payable at Allotment'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {isOccupied
                      ? 'Caution deposit remains safely held in bank custody escrow until locker surrender or tenancy closure.'
                      : `Standard cautionary deposit of ₹${deposit.toLocaleString('en-IN')} will be collected and held in escrow once this vacant locker is allocated.`}
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. Footer Action Bar */}
        <div className="flex items-center justify-between p-3.5 sm:px-6 sm:py-4 bg-slate-50/90 border-t border-slate-200/80">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl border-slate-300 text-slate-700 font-semibold text-xs h-9 px-4 cursor-pointer hover:bg-slate-100"
          >
            Close
          </Button>

          <div className="flex items-center gap-2">
            {isClosed && (
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

            {isOccupied && (
              <>
                {/* Surrender Locker button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    navigate(`/closures?lockerId=${locker._id}`);
                  }}
                  className="rounded-xl border-slate-300 text-slate-700 hover:text-rose-700 hover:border-rose-300 hover:bg-rose-50/50 font-semibold text-xs h-9 px-3 cursor-pointer"
                  title="Initiate Surrender / Closure"
                >
                  <Undo2 className="h-3.5 w-3.5 mr-1" />
                  <span className="hidden sm:inline">Surrender</span>
                </Button>

                {/* Proactive Lease Renewal button if no unpaid invoice */}
                {!unpaidInvoice && canGenerateRenewal && currentAlloc && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRenewingAllocation(currentAlloc)}
                    className="rounded-xl border-slate-300 text-slate-800 font-semibold text-xs h-9 px-3 hover:bg-slate-100 cursor-pointer inline-flex items-center gap-1"
                    title="Generate Next Lease Renewal"
                  >
                    <RotateCw className="h-3.5 w-3.5 text-slate-600" />
                    <span>Renew Lease</span>
                  </Button>
                )}

                {/* Primary CTA: Record Payment if unpaid invoice exists */}
                {unpaidInvoice && canRecordPayment && (
                  <Button
                    size="sm"
                    onClick={() => setRecordingPaymentInvoiceId(unpaidInvoice._id)}
                    className="rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs h-9 px-4 shadow-2xs gap-1.5 cursor-pointer"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>Record Payment (₹{unpaidInvoice.balanceAmount.toLocaleString('en-IN')})</span>
                  </Button>
                )}

                {tenantId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onClose();
                      navigate(`/customers/${tenantId}`);
                    }}
                    className="rounded-xl border-slate-300 text-slate-700 font-semibold text-xs h-9 px-3 hover:bg-slate-100 cursor-pointer"
                  >
                    <User className="h-3.5 w-3.5 mr-1" />
                    <span>Customer Profile</span>
                  </Button>
                )}
              </>
            )}

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
          onClose={() => setRenewingAllocation(null)}
          onSubmit={async (data) => {
            setIsSubmittingRenewal(true);
            try {
              await renewalApi.generateRenewal(data);
              queryClient.invalidateQueries({ queryKey: ['locker-invoices', locker._id] });
              queryClient.invalidateQueries({ queryKey: ['locker-allocations', locker._id] });
              setRenewingAllocation(null);
              setNotice('Renewal invoice generated successfully.');
            } finally {
              setIsSubmittingRenewal(false);
            }
          }}
          isSubmitting={isSubmittingRenewal}
        />
      )}

      {recordingPaymentInvoiceId && (
        <RecordPaymentModal
          initialInvoiceId={recordingPaymentInvoiceId}
          onClose={() => setRecordingPaymentInvoiceId(null)}
          onSubmit={async (data, idempotencyKey) => {
            const p = await paymentApi.recordPayment(data, idempotencyKey);
            queryClient.invalidateQueries({ queryKey: ['locker-invoices', locker._id] });
            queryClient.invalidateQueries({ queryKey: ['lockers'] });
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
