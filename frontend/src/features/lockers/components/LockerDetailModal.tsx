import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
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
  CheckCircle2,
  AlertTriangle,
  Edit3,
  Copy,
  Check,
  Building,
  Grid,
  Info,
  Calendar,
  Eye,
  EyeOff,
  Plus,
  ExternalLink,
  Phone,
  Sparkles,
  CreditCard,
  RotateCw,
  Receipt,
  FileText,
} from 'lucide-react';
import { Locker } from '../types';
import { LockerStatusBadge, OperationalStatusBadge } from './LockerStatusBadge';
import { formatINR, isLockerAvailable } from '../utils/formatters';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { usePermission } from '../../../hooks/usePermission';
import { LOCKER_SIZES } from '../constants';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { allocationApi } from '../../allocations/api/allocationApi';
import { AllocationStatusBadge } from '../../allocations/components/AllocationStatusBadge';
import { LockerAllocation } from '../../allocations/types';
import { renewalApi } from '../../renewals/api/renewalApi';
import { PaymentStatusBadge } from '../../renewals/components/RenewalStatusBadge';
import { GenerateRenewalInput, LockerInvoice } from '../../renewals/types';
import { paymentApi } from '../../payments/api/paymentApi';
import { RecordPaymentInput, Payment } from '../../payments/types';
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
  const canUpdate = usePermission('lockers.update');
  const canViewSensitive = usePermission('lockers.view_sensitive');
  const available = isLockerAvailable(locker);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedDetails, setCopiedDetails] = useState(false);
  const [sensitiveRevealed, setSensitiveRevealed] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const sizeDefinition = LOCKER_SIZES.find((item) => item.code === locker.size);

  const formatRackName = (rack?: string) => {
    if (!rack) return '—';
    const trimmed = rack.trim();
    return trimmed.toLowerCase().startsWith('rack') ? trimmed : `Rack ${trimmed}`;
  };

  // Financial calculations
  const annualRent = locker.annualRent || 0;
  const monthlyEquivalent = Math.round(annualRent / 12);
  const deposit = locker.securityDeposit || 0;
  const totalInitial = annualRent + deposit;

  const queryClient = useQueryClient();
  const canRecordPayment = usePermission('payments.create');
  const canGenerateRenewal = usePermission('renewals.create');

  const [recordingPaymentInvoiceId, setRecordingPaymentInvoiceId] = useState<string | null>(null);
  const [renewingAllocation, setRenewingAllocation] = useState<LockerAllocation | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<LockerInvoice | null>(null);
  const [viewingReceiptPayment, setViewingReceiptPayment] = useState<Payment | null>(null);

  // Fetch real locker allocation tenancy history
  const { data: lockerAllocData } = useQuery({
    queryKey: ['locker-allocations', locker._id],
    queryFn: () => allocationApi.getLockerAllocations(locker._id),
    enabled: Boolean(locker._id),
  });

  // Fetch locker billing history
  const { data: lockerInvoices } = useQuery({
    queryKey: ['locker-invoices', locker._id],
    queryFn: () => renewalApi.getLockerInvoices(locker._id),
    enabled: Boolean(locker._id),
  });

  // Sorted invoices (latest due date first)
  const sortedInvoices = React.useMemo(() => {
    if (!lockerInvoices || !Array.isArray(lockerInvoices)) return [];
    return [...lockerInvoices].sort((a, b) => {
      const dateA = new Date(a.dueDate || a.createdAt).getTime();
      const dateB = new Date(b.dueDate || b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [lockerInvoices]);

  // Unpaid invoice on this locker
  const unpaidInvoice = sortedInvoices.find((inv: any) => inv.balanceAmount > 0 && inv.paymentStatus !== 'PAID');

  // Lease Expiry calculation
  const currentAlloc = lockerAllocData?.currentAllocation;
  const leaseEndDate = currentAlloc?.endDate ? new Date(currentAlloc.endDate) : null;
  const now = new Date();
  const daysUntilExpiry = leaseEndDate ? Math.ceil((leaseEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const isOverdue = daysUntilExpiry !== null && daysUntilExpiry < 0;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30;

  // Mutations
  const recordPaymentMutation = useMutation({
    mutationFn: ({ data, idempotencyKey }: { data: RecordPaymentInput; idempotencyKey: string }) =>
      paymentApi.recordPayment(data, idempotencyKey),
    onSuccess: (payment) => {
      setRecordingPaymentInvoiceId(null);
      queryClient.invalidateQueries({ queryKey: ['locker-invoices', locker._id] });
      queryClient.invalidateQueries({ queryKey: ['locker-allocations', locker._id] });
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['renewals'] });
      setViewingReceiptPayment(payment);
    },
  });

  const generateRenewalMutation = useMutation({
    mutationFn: (data: GenerateRenewalInput) => renewalApi.generateRenewal(data),
    onSuccess: () => {
      setRenewingAllocation(null);
      queryClient.invalidateQueries({ queryKey: ['locker-invoices', locker._id] });
      queryClient.invalidateQueries({ queryKey: ['locker-allocations', locker._id] });
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      queryClient.invalidateQueries({ queryKey: ['renewals'] });
    },
  });

  useEffect(() => {
    titleRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab' && dialogRef.current) {
        const controls = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
          )
        );
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (!sensitiveRevealed) return;
    const timer = window.setTimeout(() => {
      setSensitiveRevealed(false);
      setCopiedKey(false);
    }, 30000);
    return () => window.clearTimeout(timer);
  }, [sensitiveRevealed]);

  const handleCopyKey = () => {
    if (locker.masterKeyReference && sensitiveRevealed) {
      navigator.clipboard.writeText(locker.masterKeyReference);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleCopyAllDetails = () => {
    const text =
      `Locker Unit #${locker.lockerNumber} (${locker.lockerCode})\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Size: ${locker.size} (${sizeDefinition?.dimensions || 'Standard'})\n` +
      `Status: ${locker.status} (${locker.operationalStatus})\n` +
      `Annual Rent: ₹${annualRent.toLocaleString('en-IN')}/yr (~₹${monthlyEquivalent}/mo)\n` +
      `Caution Deposit: ₹${deposit.toLocaleString('en-IN')}\n` +
      `Location: ${formatRackName(locker.rackNumber)}, ${locker.section || 'Main Vault'}, ${
        locker.floor || 'Ground Floor'
      }\n` +
      `Grid Position: ${locker.position || '—'}`;
    navigator.clipboard.writeText(text);
    setCopiedDetails(true);
    setTimeout(() => setCopiedDetails(false), 2000);
  };

  const handleAllocate = () => {
    if (onAllocate) {
      onAllocate(locker);
    } else {
      onClose();
      navigate(`/allocations?allocateLocker=${locker._id}&lockerNumber=${locker.lockerNumber}`);
    }
  };

  const handleOpenRenewal = () => {
    if (!lockerAllocData?.currentAllocation) return;
    const enrichedAllocation: any = {
      ...lockerAllocData.currentAllocation,
      lockerId:
        typeof lockerAllocData.currentAllocation.lockerId === 'object' &&
        lockerAllocData.currentAllocation.lockerId
          ? lockerAllocData.currentAllocation.lockerId
          : locker,
    };
    setRenewingAllocation(enrichedAllocation);
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex h-[100dvh] w-screen items-end sm:items-center justify-center bg-slate-950/75 p-0 sm:p-4 md:p-6 backdrop-blur-xs animate-in fade-in-0 duration-150 overflow-hidden">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="locker-detail-title"
        className="flex w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl rounded-t-2xl sm:rounded-2xl border border-slate-200 max-h-[92dvh] sm:max-h-[90vh] animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 text-slate-900 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div className="sm:hidden w-10 h-1 bg-slate-300 rounded-full mx-auto mt-2 mb-0.5 shrink-0" />

        {/* Top Header */}
        <div className="flex items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-100 bg-slate-50/95 p-3.5 sm:px-6 sm:py-4.5 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-xl bg-emerald-100 border border-emerald-200/80 text-emerald-800 flex items-center justify-center shadow-2xs">
              <KeyRound className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-800" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2
                  ref={titleRef}
                  tabIndex={-1}
                  id="locker-detail-title"
                  className="text-base sm:text-lg font-bold text-slate-900 tracking-tight outline-none truncate"
                >
                  Locker #{locker.lockerNumber}
                </h2>
                <span className="px-1.5 sm:px-2 py-0.5 rounded-md font-mono text-[10.5px] sm:text-[11px] font-semibold bg-white text-slate-700 border border-slate-200 shadow-2xs">
                  {locker.lockerCode}
                </span>
                {available ? (
                  <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    Available for Allotment
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    {locker.status}
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 font-normal truncate">
                Vault location, tariff rates, master key registry &amp; tenancy history
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 sm:h-8.5 sm:w-8.5 shrink-0 place-items-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            aria-label="Close locker details"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3.5 sm:p-6 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Status & Overview 4-Card Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Occupancy
              </span>
              <LockerStatusBadge status={locker.status} />
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Health
              </span>
              <OperationalStatusBadge status={locker.operationalStatus} />
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Size &amp; Dims
              </span>
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-800" />
                <span className="font-bold text-slate-900 text-sm">Size {locker.size}</span>
              </div>
              {sizeDefinition && (
                <span className="mt-0.5 sm:mt-1 block truncate text-[10px] text-slate-500 font-mono">
                  {sizeDefinition.dimensions}
                </span>
              )}
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Base Rent
              </span>
              <div className="text-sm font-bold text-slate-900">
                ₹{annualRent.toLocaleString('en-IN')}{' '}
                <span className="text-[10px] font-normal text-slate-500">/yr</span>
              </div>
              <span className="text-[10px] text-emerald-800 font-semibold mt-0.5">
                ~₹{monthlyEquivalent}/month
              </span>
            </div>
          </div>

          {/* Tenancy Dossier / Vacant Action Banner */}
          {lockerAllocData?.currentAllocation ? (
            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/80 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-800" />
                  <span>
                    Current Active Tenancy ({lockerAllocData.currentAllocation.allocationCode})
                  </span>
                </span>
                
                <div className="flex items-center gap-2">
                  {daysUntilExpiry !== null && (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${
                        isOverdue
                          ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                          : isExpiringSoon
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      {isOverdue
                        ? `Renewal Overdue by ${Math.abs(daysUntilExpiry)} days`
                        : isExpiringSoon
                        ? `Expires in ${daysUntilExpiry} days`
                        : `Active • ${daysUntilExpiry} days left`}
                    </span>
                  )}
                  <AllocationStatusBadge status={lockerAllocData.currentAllocation.status} />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-3">
                  {lockerAllocData.currentAllocation.customerId?.photoUrl ? (
                    <img
                      src={lockerAllocData.currentAllocation.customerId.photoUrl}
                      alt={lockerAllocData.currentAllocation.customerId.fullName}
                      className="w-10 h-10 rounded-xl object-cover border border-emerald-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white font-bold flex items-center justify-center text-xs shadow-2xs shrink-0">
                      {(lockerAllocData.currentAllocation.customerId?.fullName || 'CU')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 leading-tight">
                      {lockerAllocData.currentAllocation.customerId?.fullName}
                    </h4>
                    <p className="text-[11px] text-slate-600 font-mono mt-0.5 flex items-center gap-2">
                      <span>{lockerAllocData.currentAllocation.customerId?.customerCode}</span>
                      {lockerAllocData.currentAllocation.customerId?.phone && (
                        <>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1 text-slate-700 font-semibold">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {lockerAllocData.currentAllocation.customerId.phone}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-end sm:self-center">
                  <div className="text-right hidden sm:block">
                    <span className="text-[10px] text-slate-500 font-semibold block uppercase">
                      Lease Expiry
                    </span>
                    <span className="text-xs font-bold text-slate-900 tabular-nums">
                      {leaseEndDate ? leaseEndDate.toLocaleDateString('en-IN') : '—'}
                    </span>
                  </div>

                  {canGenerateRenewal && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleOpenRenewal}
                      className="h-8 text-xs font-bold gap-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl shadow-2xs cursor-pointer px-3"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Renew Tenancy</span>
                    </Button>
                  )}

                  {lockerAllocData.currentAllocation.customerId?._id && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const custId = lockerAllocData.currentAllocation?.customerId?._id;
                        if (custId) {
                          onClose();
                          navigate(`/customers/${custId}`);
                        }
                      }}
                      className="h-8 text-xs font-semibold gap-1 bg-white hover:bg-emerald-50 text-slate-700 border-slate-300 rounded-xl cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Customer</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-50/40 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-800 animate-ping" />
                  <span className="font-bold text-emerald-950 text-xs">
                    Locker #{locker.lockerNumber} is Ready for Allotment
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800/80 font-normal">
                  Unit is verified clean and available to be allocated to any registered customer.
                </p>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={handleAllocate}
                className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold px-4 h-8.5 rounded-xl shadow-xs shrink-0 cursor-pointer flex items-center justify-center gap-1.5 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Allocate This Locker</span>
              </Button>
            </div>
          )}

          {/* Physical Vault Location Coordinates */}
          <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/90 bg-white space-y-2.5 sm:space-y-3 shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-800" />
                <span>Vault Location &amp; Grid Matrix</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-800 font-bold bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                {formatRackName(locker.rackNumber)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 pt-0.5">
              <div className="p-2 sm:p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
                <span className="text-slate-500 text-[10.5px] block font-medium">Floor Level</span>
                <span className="font-bold text-slate-900 text-xs mt-0.5 block truncate">
                  {locker.floor || 'Ground Floor'}
                </span>
              </div>

              <div className="p-2 sm:p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
                <span className="text-slate-500 text-[10.5px] block font-medium">
                  Vault Section
                </span>
                <span className="font-bold text-slate-900 text-xs mt-0.5 block truncate">
                  {locker.section || 'Main Vault'}
                </span>
              </div>

              <div className="p-2 sm:p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
                <span className="text-slate-500 text-[10.5px] block font-medium">Rack ID</span>
                <span className="font-mono font-bold text-slate-900 text-xs mt-0.5 block truncate">
                  {locker.rackNumber}
                </span>
              </div>

              <div className="p-2 sm:p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
                <span className="text-slate-500 text-[10.5px] block font-medium">
                  Grid Position
                </span>
                <span className="font-bold text-slate-900 text-xs mt-0.5 block truncate">
                  {locker.position || `Unit ${locker.lockerNumber}`}
                </span>
              </div>
            </div>
          </div>

          {/* Financial Tariff & Deposit Breakdown */}
          <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/90 bg-white space-y-2.5 sm:space-y-3 shadow-2xs">
            <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1.5 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5 text-emerald-800" />
                <span>Tariff &amp; Deposit Schedule</span>
              </h3>
              {lockerAllocData?.currentAllocation ? (
                <span className="text-[10.5px] font-mono text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 self-start xs:self-auto">
                  Caution Deposit: ₹{deposit.toLocaleString('en-IN')}
                </span>
              ) : (
                <span className="text-[10.5px] font-mono text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 self-start xs:self-auto">
                  Total Initial Due: ₹{totalInitial.toLocaleString('en-IN')}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 pt-0.5">
              <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
                <span className="text-slate-600 text-[11px] font-semibold block">
                  Standard Annual Rent
                </span>
                <div className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 tabular-nums">
                  {formatINR(annualRent)}
                </div>
                <span className="text-[10px] text-slate-400 font-normal block mt-1">
                  ~₹{monthlyEquivalent}/mo billing rate
                </span>
              </div>

              <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
                <span className="text-slate-600 text-[11px] font-semibold block">
                  Security Caution Deposit
                </span>
                <div className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 tabular-nums">
                  {formatINR(deposit)}
                </div>
                <span className="text-[10px] text-emerald-800 font-medium block mt-1">
                  100% refundable upon surrender
                </span>
              </div>

              {lockerAllocData?.currentAllocation ? (
                <div
                  className={`p-2.5 sm:p-3 rounded-xl border ${
                    unpaidInvoice
                      ? 'bg-rose-50/70 border-rose-200'
                      : 'bg-emerald-50/60 border-emerald-200/80'
                  }`}
                >
                  <span
                    className={`text-[11px] font-bold block ${
                      unpaidInvoice ? 'text-rose-950' : 'text-emerald-950'
                    }`}
                  >
                    {unpaidInvoice ? 'Outstanding Balance' : 'Financial Standing'}
                  </span>
                  <div
                    className={`text-base sm:text-lg font-bold mt-0.5 tabular-nums ${
                      unpaidInvoice ? 'text-rose-700' : 'text-emerald-900'
                    }`}
                  >
                    {unpaidInvoice
                      ? `₹${unpaidInvoice.balanceAmount.toLocaleString('en-IN')}`
                      : '₹0 (All Clear)'}
                  </div>
                  <span
                    className={`text-[10px] font-normal block mt-1 ${
                      unpaidInvoice ? 'text-rose-700 font-medium' : 'text-emerald-800'
                    }`}
                  >
                    {unpaidInvoice ? 'Payment pending on lease' : 'All billing cycles up to date'}
                  </span>
                </div>
              ) : (
                <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
                  <span className="text-emerald-950 text-[11px] font-bold block">
                    Initial Booking Inflow
                  </span>
                  <div className="text-base sm:text-lg font-bold text-emerald-900 mt-0.5 tabular-nums">
                    {formatINR(totalInitial)}
                  </div>
                  <span className="text-[10px] text-emerald-800 font-normal block mt-1">
                    Annual Rent + Caution Deposit
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Master Key Index Reference (Only displayed if a master key reference is registered) */}
          {canViewSensitive && Boolean(locker.masterKeyReference) && (
            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/90 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-amber-950 font-bold text-xs">
                  <ShieldAlert className="w-4 h-4 text-amber-800" />
                  <span>Physical Master Key Reference</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                  Manager Clearance
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div
                  className="min-h-[36px] flex-1 rounded-xl border border-amber-300/80 bg-white px-3.5 py-1.5 font-mono text-xs font-bold text-amber-950 shadow-2xs flex items-center"
                  aria-live="polite"
                >
                  {sensitiveRevealed ? locker.masterKeyReference : '••••••••••••••••'}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSensitiveRevealed(!sensitiveRevealed);
                      setCopiedKey(false);
                    }}
                    className="h-8.5 px-3 border-amber-300 bg-white text-amber-900 hover:bg-amber-100 font-semibold text-xs rounded-xl cursor-pointer"
                  >
                    {sensitiveRevealed ? (
                      <EyeOff className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <Eye className="h-3.5 w-3.5 mr-1" />
                    )}
                    <span>{sensitiveRevealed ? 'Hide' : 'Reveal'}</span>
                  </Button>
                  {sensitiveRevealed && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyKey}
                      className="h-8.5 px-3 border-amber-300 bg-white text-amber-900 hover:bg-amber-100 font-semibold text-xs rounded-xl cursor-pointer"
                    >
                      {copiedKey ? (
                        <Check className="h-3.5 w-3.5 text-emerald-800 mr-1" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 mr-1" />
                      )}
                      <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Billing & Invoice Cycle Records */}
          {sortedInvoices && sortedInvoices.length > 0 && (
            <div className="p-4 rounded-xl border border-slate-200/90 bg-white space-y-3 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Renewal &amp; Billing History ({sortedInvoices.length})</span>
                </h3>
                <span className="text-[10px] text-slate-500 font-medium">Sorted latest cycle first</span>
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                {sortedInvoices.map((inv: any) => (
                  <div
                    key={inv._id}
                    className={`py-2 px-2.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-colors ${
                      inv.balanceAmount > 0 ? 'bg-amber-50/40 border border-amber-200/60 my-1' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 font-semibold text-slate-900">
                        <button
                          type="button"
                          onClick={() => setViewingInvoice(inv)}
                          className="font-mono bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded text-[10.5px] text-slate-800 font-bold transition-colors cursor-pointer"
                        >
                          {inv.invoiceNumber}
                        </button>
                        <span className="truncate max-w-[150px] sm:max-w-none">{inv.customerId?.fullName}</span>
                      </div>
                      <p className="text-[10.5px] text-slate-500 font-normal mt-0.5">
                        Due: {new Date(inv.dueDate).toLocaleDateString('en-IN')}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-2.5 text-left sm:text-right w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div>
                        <span className="text-slate-900 text-xs font-bold block tabular-nums">
                          ₹{inv.totalAmount.toLocaleString('en-IN')}
                        </span>
                        {inv.balanceAmount > 0 ? (
                          <span className="text-[10px] text-rose-600 font-bold tabular-nums">
                            Due: ₹{inv.balanceAmount.toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-800 font-semibold">Paid</span>
                        )}
                      </div>
                      <PaymentStatusBadge status={inv.paymentStatus} />

                      {inv.balanceAmount > 0 && canRecordPayment && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setRecordingPaymentInvoiceId(inv._id)}
                          className="h-7 text-[11px] font-bold gap-1 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg px-2.5 shadow-2xs cursor-pointer ml-1"
                        >
                          <CreditCard className="w-3 h-3" />
                          <span>Pay Due</span>
                        </Button>
                      )}

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setViewingInvoice(inv)}
                        className="h-7 text-[11px] text-slate-500 hover:text-slate-900 px-2 rounded-lg cursor-pointer"
                        title="View Invoice Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Metadata Footer */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px] text-slate-500 font-normal">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Created: </span>
              <span className="text-slate-700 font-medium">
                {new Date(locker.createdAt).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="sm:text-right flex sm:justify-end items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Last Modified: </span>
              <span className="text-slate-700 font-medium">
                {new Date(locker.updatedAt).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:px-6 sm:py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="rounded-xl border-slate-300 text-slate-700 font-semibold text-xs h-9 px-3.5 sm:px-4 hover:bg-slate-100 cursor-pointer"
            >
              Close
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyAllDetails}
              className="hidden md:flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 border-slate-300 rounded-xl h-9 px-3 font-semibold cursor-pointer bg-white"
            >
              {copiedDetails ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Specs Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Specs</span>
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {canUpdate && onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onEdit(locker);
                }}
                className="border-slate-300 text-slate-700 font-semibold flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3.5 text-xs h-9 cursor-pointer bg-white hover:bg-slate-100 shrink-0"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden xs:inline">Edit Locker</span>
                <span className="inline xs:hidden">Edit</span>
              </Button>
            )}

            {available ? (
              <Button
                size="sm"
                onClick={handleAllocate}
                className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold flex items-center justify-center gap-1.5 rounded-xl px-3 sm:px-4 text-xs h-9 shadow-xs cursor-pointer truncate"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span className="truncate">Allocate Locker</span>
              </Button>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {unpaidInvoice && canRecordPayment && (
                  <Button
                    size="sm"
                    onClick={() => setRecordingPaymentInvoiceId(unpaidInvoice._id)}
                    className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold flex items-center justify-center gap-1.5 rounded-xl px-2.5 sm:px-3.5 text-xs h-9 shadow-xs cursor-pointer truncate"
                  >
                    <CreditCard className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Pay Due (₹{unpaidInvoice.balanceAmount.toLocaleString('en-IN')})</span>
                  </Button>
                )}

                {lockerAllocData?.currentAllocation && canGenerateRenewal && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenRenewal}
                    className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold flex items-center justify-center gap-1.5 rounded-xl px-2.5 sm:px-3.5 text-xs h-9 bg-white cursor-pointer truncate"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
                    <span className="truncate">Renew Tenancy</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {recordingPaymentInvoiceId && (
        <RecordPaymentModal
          initialInvoiceId={recordingPaymentInvoiceId}
          onClose={() => setRecordingPaymentInvoiceId(null)}
          onSubmit={async (data, idempotencyKey) => {
            return await recordPaymentMutation.mutateAsync({ data, idempotencyKey });
          }}
          onSuccessViewReceipt={(payment) => {
            setRecordingPaymentInvoiceId(null);
            setViewingReceiptPayment(payment);
          }}
        />
      )}

      {/* Generate Renewal Modal */}
      {renewingAllocation && (
        <GenerateRenewalModal
          preSelectedAllocation={renewingAllocation}
          onClose={() => setRenewingAllocation(null)}
          onSubmit={async (data) => {
            await generateRenewalMutation.mutateAsync(data);
          }}
          isSubmitting={generateRenewalMutation.isPending}
        />
      )}

      {/* Invoice Detail Modal */}
      {viewingInvoice && (
        <InvoiceDetailModal
          invoice={viewingInvoice}
          onClose={() => setViewingInvoice(null)}
          onRecordPayment={(inv) => {
            setViewingInvoice(null);
            setRecordingPaymentInvoiceId(inv._id);
          }}
        />
      )}

      {/* Payment Receipt Modal */}
      {viewingReceiptPayment && (
        <PaymentReceiptModal
          payment={viewingReceiptPayment}
          onClose={() => setViewingReceiptPayment(null)}
        />
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}
