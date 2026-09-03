import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
} from 'lucide-react';
import { Locker } from '../types';
import { LockerStatusBadge, OperationalStatusBadge } from './LockerStatusBadge';
import { formatINR, isLockerAvailable } from '../utils/formatters';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { usePermission } from '../../../hooks/usePermission';
import { LOCKER_SIZES } from '../constants';
import { useQuery } from '@tanstack/react-query';
import { allocationApi } from '../../allocations/api/allocationApi';
import { AllocationStatusBadge } from '../../allocations/components/AllocationStatusBadge';
import { renewalApi } from '../../renewals/api/renewalApi';
import { PaymentStatusBadge } from '../../renewals/components/RenewalStatusBadge';

interface LockerDetailModalProps {
  locker: Locker;
  onClose: () => void;
  onEdit?: (locker: Locker) => void;
}

export function LockerDetailModal({
  locker,
  onClose,
  onEdit,
}: LockerDetailModalProps) {
  const canUpdate = usePermission('lockers.update');
  const canViewSensitive = usePermission('lockers.view_sensitive');
  const available = isLockerAvailable(locker);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedDetails, setCopiedDetails] = useState(false);
  const [sensitiveRevealed, setSensitiveRevealed] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const sizeDefinition = LOCKER_SIZES.find((item) => item.code === locker.size);

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

  useEffect(() => {
    titleRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab' && dialogRef.current) {
        const controls = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
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
    const text = `Locker #${locker.lockerNumber} (${locker.lockerCode})\nRack: ${locker.rackNumber}\nSection: ${locker.section || 'Main Vault'}\nFloor: ${locker.floor || 'Ground Floor'}\nPosition: ${locker.position || 'Not specified'}`;
    navigator.clipboard.writeText(text);
    setCopiedDetails(true);
    setTimeout(() => setCopiedDetails(false), 2000);
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex h-[100dvh] w-screen items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[3px] sm:items-center sm:p-4 animate-in fade-in-0 duration-150" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        ref={dialogRef}
        role="dialog" aria-modal="true" aria-labelledby="locker-detail-title"
        className="flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-3xl sm:border sm:border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white p-4 sm:px-6 sm:py-4.5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 flex items-center justify-center shadow-2xs">
              <KeyRound className="w-5 h-5 text-emerald-800" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  ref={titleRef}
                  tabIndex={-1}
                  id="locker-detail-title"
                  className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight outline-none"
                >
                  Locker #{locker.lockerNumber}
                </h2>
                <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  {locker.lockerCode}
                </span>
                {available ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    Available for Allotment
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    Allocation Restricted
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-normal">
                Physical location, status, tariffs and audit details
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close locker details"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Status & Operational Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-medium text-slate-500 block mb-1">
                Occupancy Status
              </span>
              <LockerStatusBadge status={locker.status} />
            </div>

            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-medium text-slate-500 block mb-1">
                Operational Health
              </span>
              <OperationalStatusBadge status={locker.operationalStatus} />
            </div>

            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-medium text-slate-500 block mb-1">
                Size Category
              </span>
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-800" />
                <span className="font-semibold text-slate-900 text-sm">
                  Size {locker.size}
                </span>
              </div>
              {sizeDefinition && (
                <span className="mt-1 block truncate text-[9.5px] text-slate-500 font-normal">
                  {sizeDefinition.dimensions}
                </span>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-medium text-slate-500 block mb-1">
                Master Registry
              </span>
              <span
                className={`font-medium text-xs ${
                  locker.isActive ? 'text-emerald-800' : 'text-rose-700'
                }`}
              >
                {locker.isActive ? 'Active record' : 'Archived record'}
              </span>
            </div>
          </div>

          {/* Current Customer Tenancy Dossier */}
          {lockerAllocData?.currentAllocation ? (
            <div className="p-4 rounded-xl bg-emerald-50/40 border border-emerald-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-medium text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-800" />
                  <span>
                    Current Customer Tenancy ({lockerAllocData.currentAllocation.allocationCode})
                  </span>
                </span>
                <AllocationStatusBadge status={lockerAllocData.currentAllocation.status} />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {lockerAllocData.currentAllocation.customerId?.photoUrl ? (
                    <img
                      src={lockerAllocData.currentAllocation.customerId.photoUrl}
                      alt={lockerAllocData.currentAllocation.customerId.fullName}
                      className="w-10 h-10 rounded-full object-cover border border-emerald-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white font-medium flex items-center justify-center text-xs shadow-2xs">
                      {(
                        lockerAllocData.currentAllocation.customerId?.fullName || 'CU'
                      )
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 leading-tight">
                      {lockerAllocData.currentAllocation.customerId?.fullName}
                    </h4>
                    <p className="text-[11px] text-slate-600 font-mono font-normal mt-0.5">
                      {lockerAllocData.currentAllocation.customerId?.customerCode} &bull;{' '}
                      {lockerAllocData.currentAllocation.customerId?.phone}
                    </p>
                  </div>
                </div>

                <div className="text-right font-sans">
                  <span className="text-[9.5px] text-slate-500 font-medium block">
                    LEASE START
                  </span>
                  <span className="text-xs font-semibold text-slate-900 tabular-nums">
                    {new Date(
                      lockerAllocData.currentAllocation.startDate
                    ).toLocaleDateString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 flex items-center justify-between text-slate-500 font-normal">
              <span>
                Current Allocation: <span className="font-medium text-emerald-800">VACANT</span> (No active tenant)
              </span>
              <span className="text-[11px] text-slate-400">Ready for allotment</span>
            </div>
          )}

          {/* Locker Billing & Renewal Ledger History */}
          {lockerInvoices && lockerInvoices.length > 0 && (
            <div className="p-4 sm:p-4.5 rounded-xl border border-slate-200/90 bg-white space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="font-medium text-slate-500 uppercase tracking-wider text-[11px] flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-emerald-800" />
                  <span>Renewal & Billing History ({lockerInvoices.length})</span>
                </h3>
                <span className="text-[10px] text-slate-400 font-normal">
                  All recorded cycles
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                {lockerInvoices.map((inv: any) => (
                  <div key={inv._id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2 font-medium text-slate-900">
                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-normal text-slate-700">
                          {inv.invoiceNumber}
                        </span>
                        <span>{inv.customerId?.fullName}</span>
                      </div>
                      <p className="text-[10.5px] text-slate-500 font-normal mt-0.5">
                        Due: {new Date(inv.dueDate).toLocaleDateString('en-IN')} &bull; Period:{' '}
                        {new Date(inv.billingPeriodStart).toLocaleDateString('en-IN')} -{' '}
                        {new Date(inv.billingPeriodEnd).toLocaleDateString('en-IN')}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-right">
                      <div className="font-sans">
                        <span className="text-slate-900 text-xs font-semibold block tabular-nums">
                          ₹{inv.totalAmount.toLocaleString('en-IN')}
                        </span>
                        {inv.balanceAmount > 0 ? (
                          <span className="text-[10px] text-rose-600 font-medium tabular-nums">
                            Due: ₹{inv.balanceAmount.toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-800 font-medium">
                            Paid in Full
                          </span>
                        )}
                      </div>
                      <PaymentStatusBadge status={inv.paymentStatus} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Physical Vault Location Coordinates */}
          <div className="p-4 sm:p-4.5 rounded-xl border border-slate-200/90 bg-white space-y-3 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-medium text-slate-500 uppercase tracking-wider text-[11px] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-800" />
                <span>Vault Location</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-700 font-medium bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                Rack {locker.rackNumber}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
              <div>
                <span className="text-slate-500 text-xs block font-normal">
                  Rack Identifier
                </span>
                <span className="font-semibold text-slate-900 text-sm mt-0.5 block font-mono">
                  {locker.rackNumber}
                </span>
              </div>

              <div>
                <span className="text-slate-500 text-xs block font-normal">
                  Vault Section
                </span>
                <span className="font-medium text-slate-900 text-sm mt-0.5 block">
                  {locker.section || 'Main Vault'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 text-xs block font-normal">
                  Floor Level
                </span>
                <span className="font-medium text-slate-900 text-sm mt-0.5 block">
                  {locker.floor || 'Ground Floor'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 text-xs block font-normal">
                  Grid Matrix Position
                </span>
                <span className="font-medium text-slate-900 text-sm mt-0.5 block">
                  {locker.position || 'Not specified'}
                </span>
              </div>
            </div>
          </div>

          {/* Financial Tariff Matrix */}
          <div className="p-4 sm:p-4.5 rounded-xl border border-slate-200/90 bg-white space-y-3 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-medium text-slate-500 uppercase tracking-wider text-[11px] flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-emerald-800" />
                <span>Tariffs and Deposit</span>
              </h3>
              <span className="text-[11px] text-slate-500 font-normal">
                Configured values
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <span className="text-slate-700 text-xs font-medium block">
                    Standard Annual Rent
                  </span>
                  <div className="text-xl font-semibold text-slate-900 mt-1 tabular-nums font-sans">
                    {formatINR(locker.annualRent)}
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 font-normal mt-2">
                  Per annum (pre-tax base tariff)
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <span className="text-slate-700 text-xs font-medium block">
                    Security Caution Deposit
                  </span>
                  <div className="text-xl font-semibold text-slate-900 mt-1 tabular-nums font-sans">
                    {formatINR(locker.securityDeposit)}
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 font-normal mt-2">
                  Recorded refundable deposit
                </span>
              </div>
            </div>
          </div>

          {/* Confidential Master Key Reference */}
          {canViewSensitive && (
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/90 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-900 font-medium text-xs">
                  <ShieldAlert className="w-4 h-4 text-amber-700" />
                  <span>Confidential: Physical Master-Key Index</span>
                </div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                  Administrator Clearance
                </span>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div
                  className="min-h-[40px] flex-1 rounded-xl border border-amber-300/80 bg-white px-3.5 py-2 font-mono text-sm font-medium text-amber-950 shadow-2xs"
                  aria-live="polite"
                >
                  {!locker.masterKeyReference
                    ? 'No master key reference assigned'
                    : sensitiveRevealed
                    ? locker.masterKeyReference
                    : '••••••••••••'}
                </div>
                {locker.masterKeyReference && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSensitiveRevealed(!sensitiveRevealed);
                        setCopiedKey(false);
                      }}
                      className="flex-1 gap-1.5 border-amber-300 bg-white text-amber-900 hover:bg-amber-100 sm:flex-none h-9 rounded-xl font-medium text-xs"
                    >
                      {sensitiveRevealed ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}{' '}
                      {sensitiveRevealed ? 'Hide' : 'Reveal'}
                    </Button>
                    {sensitiveRevealed && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCopyKey}
                        className="flex-1 gap-1.5 border-amber-300 bg-white text-amber-900 hover:bg-amber-100 sm:flex-none h-9 rounded-xl font-medium text-xs"
                      >
                        {copiedKey ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}{' '}
                        {copiedKey ? 'Copied' : 'Copy'}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <p className="text-[10.5px] text-amber-800 leading-relaxed font-normal">
                Protected staff reference. Reveal it only when the physical key workflow requires
                verification.
              </p>
            </div>
          )}

          {/* Remarks */}
          {locker.remarks && (
            <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 space-y-1">
              <span className="font-medium text-slate-700 text-xs flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-500" />
                Operational Notes:
              </span>
              <p className="text-slate-600 text-xs leading-relaxed mt-1 font-normal">
                {locker.remarks}
              </p>
            </div>
          )}

          {/* Audit Metadata Footer */}
          <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-500 font-normal">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Created: </span>
              <span className="text-slate-700 font-medium">
                {new Date(locker.createdAt).toLocaleString('en-IN')}
              </span>
              {locker.createdBy && (
                <span className="text-slate-500"> ({locker.createdBy.name})</span>
              )}
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

        {/* Footer Buttons */}
        <div className="p-3.5 sm:px-6 sm:py-3.5 bg-white border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="rounded-xl border-slate-300 text-slate-700 font-medium text-xs h-9.5 px-4 hover:bg-slate-50 cursor-pointer"
            >
              Close
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyAllDetails}
              className="hidden sm:flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 border-slate-300 rounded-xl h-9.5 px-3.5 font-medium cursor-pointer"
            >
              {copiedDetails ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Details Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Coordinates</span>
                </>
              )}
            </Button>
          </div>

          {canUpdate && onEdit && (
            <Button
              size="sm"
              onClick={() => {
                onClose();
                onEdit(locker);
              }}
              className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium shadow-xs flex items-center gap-1.5 rounded-xl px-4 text-xs h-9.5 cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit Locker</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
