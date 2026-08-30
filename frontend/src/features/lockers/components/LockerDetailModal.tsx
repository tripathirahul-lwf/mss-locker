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
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white p-4 sm:px-6 sm:py-5 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <KeyRound className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 ref={titleRef} tabIndex={-1} id="locker-detail-title" className="text-lg font-black text-slate-950 tracking-tight outline-none sm:text-xl">
                  Locker #{locker.lockerNumber}
                </h2>
                <span className="px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {locker.lockerCode}
                </span>
                {available ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Available for Allotment
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    Allocation Restricted
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Physical location, status, tariffs and audit details
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close locker details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Status & Operational Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Occupancy Status
              </span>
              <LockerStatusBadge status={locker.status} />
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Operational Health
              </span>
              <OperationalStatusBadge status={locker.operationalStatus} />
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Size Category
              </span>
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-bold text-slate-900 text-sm">
                  Size {locker.size}
                </span>
              </div>
              {sizeDefinition && <span className="mt-1 block truncate text-[9px] text-slate-500">{sizeDefinition.dimensions}</span>}
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Master Registry
              </span>
              <span
                className={`font-bold ${
                  locker.isActive ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {locker.isActive ? 'Active record' : 'Archived record'}
              </span>
            </div>
          </div>

          {/* Current Customer Tenancy Dossier */}
          {lockerAllocData?.currentAllocation ? (
            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/90 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  <span>Current Customer Tenancy ({lockerAllocData.currentAllocation.allocationCode})</span>
                </span>
                <AllocationStatusBadge status={lockerAllocData.currentAllocation.status} />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {lockerAllocData.currentAllocation.customerId?.photoUrl ? (
                    <img
                      src={lockerAllocData.currentAllocation.customerId.photoUrl}
                      alt={lockerAllocData.currentAllocation.customerId.fullName}
                      className="w-10 h-10 rounded-full object-cover border border-blue-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                      {(lockerAllocData.currentAllocation.customerId?.fullName || 'CU').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-black text-slate-900 leading-tight">
                      {lockerAllocData.currentAllocation.customerId?.fullName}
                    </h4>
                    <p className="text-[11px] text-slate-600 font-mono">
                      {lockerAllocData.currentAllocation.customerId?.customerCode} • {lockerAllocData.currentAllocation.customerId?.phone}
                    </p>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <span className="text-[9px] text-slate-500 font-sans block">LEASE START</span>
                  <strong className="text-xs text-slate-900">
                    {new Date(lockerAllocData.currentAllocation.startDate).toLocaleDateString('en-IN')}
                  </strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-slate-500 font-medium">
              <span>Current Allocation: <strong className="text-emerald-700">VACANT</strong> (No active tenant)</span>
              <span className="text-[11px] text-slate-400">Ready for allotment</span>
            </div>
          )}

          {/* Locker Billing & Renewal Ledger History */}
          {lockerInvoices && lockerInvoices.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-blue-600" />
                  <span>Renewal & Billing History ({lockerInvoices.length})</span>
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">
                  All recorded cycles
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                {lockerInvoices.map((inv: any) => (
                  <div key={inv._id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2 font-bold text-slate-900">
                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                          {inv.invoiceNumber}
                        </span>
                        <span>{inv.customerId?.fullName}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Due: {new Date(inv.dueDate).toLocaleDateString('en-IN')} &bull; Period: {new Date(inv.billingPeriodStart).toLocaleDateString('en-IN')} - {new Date(inv.billingPeriodEnd).toLocaleDateString('en-IN')}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-right">
                      <div className="font-mono">
                        <strong className="text-slate-900 text-xs block">
                          ₹{inv.totalAmount.toLocaleString('en-IN')}
                        </strong>
                        {inv.balanceAmount > 0 ? (
                          <span className="text-[10px] text-rose-600 font-bold">
                            Due: ₹{inv.balanceAmount.toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-700 font-semibold">
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
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>Vault location</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-md">
                {locker.rackNumber}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
              <div>
                <span className="text-slate-400 text-[11px] block font-medium">
                  Rack Identifier
                </span>
                <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">
                  {locker.rackNumber}
                </span>
              </div>

              <div>
                <span className="text-slate-400 text-[11px] block font-medium">
                  Vault Section
                </span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                  {locker.section || 'Main Vault'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 text-[11px] block font-medium">
                  Floor Level
                </span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                  {locker.floor || 'Ground Floor'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 text-[11px] block font-medium">
                  Grid Matrix Position
                </span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                  {locker.position || 'Not specified'}
                </span>
              </div>
            </div>
          </div>

          {/* Financial Tariff Matrix */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-blue-600" />
                <span>Tariffs and deposit</span>
              </h3>
              <span className="text-[11px] text-slate-500 font-semibold">
                Configured values
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200/80 flex flex-col justify-between">
                <div>
                  <span className="text-blue-900 text-xs font-semibold block">
                    Standard Annual Rent
                  </span>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1">
                    {formatINR(locker.annualRent)}
                  </div>
                </div>
                <span className="text-[11px] text-blue-700 font-medium mt-2">
                  Per annum (pre-tax base tariff)
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 flex flex-col justify-between">
                <div>
                  <span className="text-emerald-900 text-xs font-semibold block">
                    Security Caution Deposit
                  </span>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1">
                    {formatINR(locker.securityDeposit)}
                  </div>
                </div>
                <span className="text-[11px] text-emerald-700 font-medium mt-2">
                  Recorded refundable deposit
                </span>
              </div>
            </div>
          </div>

          {/* Confidential Master Key Reference */}
          {canViewSensitive && (
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/80 border border-amber-200/90 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>Confidential: Physical Master-Key Index</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-md">
                  Administrator Clearance
                </span>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="min-h-[44px] flex-1 rounded-xl border border-amber-300 bg-white px-3.5 py-2.5 font-mono text-sm font-bold text-amber-950 shadow-2xs" aria-live="polite">
                  {!locker.masterKeyReference ? 'No master key reference assigned' : sensitiveRevealed ? locker.masterKeyReference : '••••••••••••'}
                </div>
                {locker.masterKeyReference && <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => { setSensitiveRevealed(!sensitiveRevealed); setCopiedKey(false); }} className="flex-1 gap-1.5 border-amber-300 bg-white text-amber-900 hover:bg-amber-100 sm:flex-none">
                    {sensitiveRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {sensitiveRevealed ? 'Hide' : 'Reveal'}
                  </Button>
                  {sensitiveRevealed && <Button type="button" variant="outline" size="sm" onClick={handleCopyKey} className="flex-1 gap-1.5 border-amber-300 bg-white text-amber-900 hover:bg-amber-100 sm:flex-none">
                    {copiedKey ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copiedKey ? 'Copied' : 'Copy'}
                  </Button>}
                </div>}
              </div>

              <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                Protected staff reference. Reveal it only when the physical key workflow requires verification.
              </p>
            </div>
          )}

          {/* Remarks */}
          {locker.remarks && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-500" />
                Operational Notes:
              </span>
              <p className="text-slate-600 text-xs leading-relaxed mt-1">
                {locker.remarks}
              </p>
            </div>
          )}

          {/* Audit Metadata Footer */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-500 font-medium">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Created: </span>
              <strong className="text-slate-700">
                {new Date(locker.createdAt).toLocaleString('en-IN')}
              </strong>
              {locker.createdBy && (
                <span className="text-slate-500"> ({locker.createdBy.name})</span>
              )}
            </div>

            <div className="sm:text-right flex sm:justify-end items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Last Modified: </span>
              <strong className="text-slate-700">
                {new Date(locker.updatedAt).toLocaleString('en-IN')}
              </strong>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl">
              Close
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyAllDetails}
              className="hidden sm:flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 rounded-xl"
            >
              {copiedDetails ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Details Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
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
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5 rounded-xl px-4"
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
