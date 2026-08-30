import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  KeyRound,
  User,
  ShieldCheck,
  Calendar,
  IndianRupee,
  Layers,
  Clock,
  CheckCircle2,
  XCircle,
  Edit3,
  ExternalLink,
  MapPin,
  Phone,
} from 'lucide-react';
import { LockerAllocation } from '../types';
import { AllocationStatusBadge } from './AllocationStatusBadge';
import { KycStatusBadge } from '../../customers/components/KycStatusBadge';
import { Button } from '../../../components/ui/button';
import { Link } from 'react-router-dom';
import { usePermission } from '../../../hooks/usePermission';

import { useQuery } from '@tanstack/react-query';
import { renewalApi } from '../../renewals/api/renewalApi';
import { PaymentStatusBadge } from '../../renewals/components/RenewalStatusBadge';

interface AllocationDetailModalProps {
  allocation: LockerAllocation | null;
  onClose: () => void;
  onActivate?: (allocation: LockerAllocation) => void;
  onCancel?: (allocation: LockerAllocation) => void;
  onEdit?: (allocation: LockerAllocation) => void;
}

export function AllocationDetailModal({
  allocation,
  onClose,
  onActivate,
  onCancel,
  onEdit,
}: AllocationDetailModalProps) {
  const canActivate = usePermission('allocations.activate');
  const canCancel = usePermission('allocations.cancel');
  const canUpdate = usePermission('allocations.update');

  if (!allocation) return null;

  const customer = allocation.customerId;
  const locker = allocation.lockerId;

  // Fetch allocation billing invoices
  const { data: allocationInvoices } = useQuery({
    queryKey: ['allocation-invoices', allocation?._id],
    queryFn: () => renewalApi.getAllocationInvoices(allocation!._id),
    enabled: Boolean(allocation?._id),
  });

  const modalContent = (
    <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm select-none animate-in fade-in-0 duration-150">
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-slate-100 bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <KeyRound className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Tenancy Agreement #{allocation.allocationCode}
                </h2>
                <AllocationStatusBadge status={allocation.status} />
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Physical Locker Allocation & Tenancy Agreement Dossier
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Customer & Locker Dual Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Customer Dossier Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Verified Tenant Customer
                </span>
                <KycStatusBadge status={customer?.kycStatus || 'PENDING'} />
              </div>

              <div className="flex items-center gap-3">
                {customer?.photoUrl ? (
                  <img
                    src={customer.photoUrl}
                    alt={customer.fullName}
                    className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center shrink-0">
                    {(customer?.fullName || 'CU').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-black text-slate-900 leading-tight">
                    {customer?.fullName}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {customer?.customerCode}
                  </p>
                </div>
              </div>

              <div className="space-y-1 pt-1 border-t border-slate-200/60">
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-mono font-bold">{customer?.phone}</span>
                </div>
                {customer?.address && (
                  <div className="flex items-start gap-2 text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <p className="truncate">{customer.address}, {customer.city}</p>
                  </div>
                )}
              </div>

              {customer?._id && (
                <Link
                  to={`/customers/${customer._id}`}
                  onClick={onClose}
                  className="text-blue-700 hover:underline font-bold text-[11px] flex items-center gap-1 pt-1"
                >
                  <span>Open Customer Profile</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>

            {/* Locker Dossier Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Physical Locker Coordinates
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 font-mono font-bold text-[11px]">
                  Size {locker?.size}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    Locker #{locker?.lockerNumber}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {locker?.lockerCode}
                  </p>
                </div>
              </div>

              <div className="space-y-1 pt-1 border-t border-slate-200/60">
                <p className="text-slate-700 font-medium">
                  <strong>Rack:</strong> {locker?.rackNumber}
                </p>
                <p className="text-slate-700 font-medium">
                  <strong>Vault Section:</strong> {locker?.section || 'Main Vault'} ({locker?.floor || 'Ground Floor'})
                </p>
              </div>

              {locker?._id && (
                <Link
                  to={`/lockers?search=${locker.lockerNumber}`}
                  onClick={onClose}
                  className="text-blue-700 hover:underline font-bold text-[11px] flex items-center gap-1 pt-1"
                >
                  <span>View in Locker Matrix</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>

          {/* Financial Snapshot Card */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Agreed Financial Pricing (Captured at Allocation)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[9px] font-sans text-slate-500 block">START DATE</span>
                <strong className="text-slate-900 text-xs">
                  {new Date(allocation.startDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[9px] font-sans text-slate-500 block">CYCLE</span>
                <strong className="text-slate-900 text-xs font-sans">
                  {allocation.billingCycle}
                </strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[9px] font-sans text-slate-500 block">ANNUAL RENT</span>
                <strong className="text-emerald-700 text-xs">
                  ₹{(allocation.rentSnapshot ?? allocation.annualRent).toLocaleString()}
                </strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[9px] font-sans text-slate-500 block">CAUTION DEPOSIT</span>
                <strong className="text-blue-700 text-xs">
                  ₹{(allocation.depositSnapshot ?? allocation.securityDeposit).toLocaleString()}
                </strong>
              </div>
            </div>

            {/* Quick Link to Deposit Desk */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
              <div className="flex items-center space-x-1.5 text-slate-600">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Security Deposit Ledger & Caution Receipts</span>
              </div>
              <Link
                to="/deposits-refunds"
                onClick={onClose}
                className="text-cyan-600 hover:text-cyan-700 font-bold flex items-center space-x-1"
              >
                <span>Open Deposit Desk</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Renewal & Billing Statements */}
          {allocationInvoices && allocationInvoices.length > 0 && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Renewal & Billing Statements ({allocationInvoices.length})
                </span>
                <span className="text-[10px] text-slate-400">
                  Paid Through: {allocation.paidThroughDate ? new Date(allocation.paidThroughDate).toLocaleDateString('en-IN') : 'Cycle End'}
                </span>
              </div>

              <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                {allocationInvoices.map((inv: any) => (
                  <div key={inv._id} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <strong className="font-mono text-slate-900">{inv.invoiceNumber}</strong>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        Due: {new Date(inv.dueDate).toLocaleDateString('en-IN')} &bull; Period: {new Date(inv.billingPeriodStart).toLocaleDateString('en-IN')} - {new Date(inv.billingPeriodEnd).toLocaleDateString('en-IN')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <strong className="font-mono text-slate-900">₹{inv.totalAmount.toLocaleString('en-IN')}</strong>
                      <PaymentStatusBadge status={inv.paymentStatus} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Operational Remarks */}
          {allocation.remarks && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <span className="font-bold text-slate-700 block mb-1">
                Operational Notes & Instructions:
              </span>
              <p className="text-slate-600 leading-relaxed">{allocation.remarks}</p>
            </div>
          )}

          {/* Agreement Lifecycle Audit */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
            <span>
              Agreement registered by <strong>{allocation.createdBy?.name || 'Staff'}</strong> on{' '}
              {new Date(allocation.createdAt).toLocaleString('en-IN')}
            </span>
            <span className="font-mono">ID: {allocation._id}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl">
            Close
          </Button>

          <div className="flex items-center gap-2">
            {allocation.status === 'RESERVED' && canActivate && onActivate && (
              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  onActivate(allocation);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-500/20 rounded-xl flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Activate Tenancy</span>
              </Button>
            )}

            {allocation.status === 'RESERVED' && canCancel && onCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onCancel(allocation);
                }}
                className="text-rose-600 border-rose-200 hover:bg-rose-50 rounded-xl font-bold"
              >
                Cancel Hold
              </Button>
            )}

            {canUpdate && allocation.status !== 'CLOSED' && allocation.status !== 'CANCELLED' && onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onEdit(allocation);
                }}
                className="rounded-xl flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Terms</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
