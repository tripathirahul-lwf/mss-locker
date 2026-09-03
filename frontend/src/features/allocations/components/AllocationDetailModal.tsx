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
  Save,
  AlertCircle,
  Loader2,
  Info,
} from 'lucide-react';
import { LockerAllocation, BillingCycle } from '../types';
import { BILLING_CYCLES } from '../constants';
import { AllocationStatusBadge } from './AllocationStatusBadge';
import { KycStatusBadge } from '../../customers/components/KycStatusBadge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Link } from 'react-router-dom';
import { usePermission } from '../../../hooks/usePermission';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { renewalApi } from '../../renewals/api/renewalApi';
import { allocationApi } from '../api/allocationApi';
import { PaymentStatusBadge } from '../../renewals/components/RenewalStatusBadge';

interface AllocationDetailModalProps {
  allocation: LockerAllocation | null;
  onClose: () => void;
  onActivate?: (allocation: LockerAllocation) => void;
  onCancel?: (allocation: LockerAllocation) => void;
  onUpdated?: () => void;
  initialEditMode?: boolean;
}

export function AllocationDetailModal({
  allocation,
  onClose,
  onActivate,
  onCancel,
  onUpdated,
  initialEditMode = false,
}: AllocationDetailModalProps) {
  const queryClient = useQueryClient();
  const canActivate = usePermission('allocations.activate');
  const canCancel = usePermission('allocations.cancel');
  const canUpdate = usePermission('allocations.update');

  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    (allocation?.billingCycle as BillingCycle) || 'ANNUAL'
  );
  const [endDate, setEndDate] = useState(
    allocation?.endDate ? new Date(allocation.endDate).toISOString().slice(0, 10) : ''
  );
  const [remarks, setRemarks] = useState(allocation?.remarks || '');
  const [editError, setEditError] = useState<string | null>(null);

  // Fetch allocation billing invoices
  const { data: allocationInvoices } = useQuery({
    queryKey: ['allocation-invoices', allocation?._id],
    queryFn: () => renewalApi.getAllocationInvoices(allocation!._id),
    enabled: Boolean(allocation?._id),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { billingCycle: BillingCycle; endDate?: string; remarks?: string }) =>
      allocationApi.updateAllocation(allocation!._id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['allocation-stats'] });
      setIsEditing(false);
      if (onUpdated) onUpdated();
    },
    onError: (err: any) => {
      setEditError(
        err.response?.data?.message || err.message || 'Failed to update agreement terms.'
      );
    },
  });

  if (!allocation) return null;

  const customer = allocation.customerId;
  const locker = allocation.lockerId;

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    updateMutation.mutate({
      billingCycle,
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
      remarks: remarks.trim() || undefined,
    });
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-[2px] select-none animate-in fade-in-0 duration-150">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200/90"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-slate-100 bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs">
              <KeyRound className="w-5 h-5 text-emerald-800" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-semibold text-slate-900 tracking-tight font-sans">
                  Tenancy Agreement #{allocation.allocationCode}
                </h2>
                <AllocationStatusBadge status={allocation.status} />
              </div>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                {isEditing
                  ? 'Modify Agreement Terms & Operational Remarks'
                  : 'Physical Locker Allocation & Tenancy Agreement Dossier'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs font-normal">
          {editError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span className="font-medium text-xs leading-relaxed">{editError}</span>
            </div>
          )}

          {/* EDIT MODE FORM */}
          {isEditing ? (
            <form id="edit-allocation-form" onSubmit={handleSaveEdit} className="space-y-4">
              {/* Info alert */}
              <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/90 text-emerald-950 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed font-normal">
                  Annual rent and security deposit amounts are frozen legal contract snapshots. You can modify billing frequency, tenure end date, and key handover remarks.
                </p>
              </div>

              {/* Customer & Locker Summary Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                    Tenant Customer
                  </span>
                  <p className="font-semibold text-slate-900 text-xs font-sans">
                    {customer?.fullName} ({customer?.customerCode})
                  </p>
                  <p className="text-[11px] text-slate-500 font-sans tabular-nums">
                    {customer?.phone}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                    Locker Coordinates
                  </span>
                  <p className="font-semibold text-slate-900 text-xs font-sans">
                    Locker #{locker?.lockerNumber} (Size {locker?.size})
                  </p>
                  <p className="text-[11px] text-slate-500 font-normal">
                    {locker?.rackNumber} &bull; {locker?.section || 'Main Vault'}
                  </p>
                </div>
              </div>

              {/* Editable Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-medium text-xs text-slate-700">Billing Cycle *</label>
                  <select
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                    className="w-full h-10 px-3 bg-slate-50/80 border border-slate-300 rounded-xl font-medium text-xs text-slate-900 cursor-pointer focus:border-emerald-700 focus:bg-white"
                  >
                    {BILLING_CYCLES.map((bc) => (
                      <option key={bc.value} value={bc.value}>
                        {bc.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-xs text-slate-700">Custom Tenancy End Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-10 text-xs bg-slate-50/80 border-slate-300 font-normal rounded-xl focus:border-emerald-700 focus:bg-white"
                  />
                  <span className="text-[10px] text-slate-500 font-normal">
                    Leave blank to follow automatic cycle renewal
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-xs text-slate-700">
                  Operational Remarks & Handover Notes
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Notes regarding key handover, nominee details, or special instructions..."
                  rows={3}
                  className="w-full p-2.5 text-xs bg-slate-50/80 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 font-normal"
                />
              </div>
            </form>
          ) : (
            /* VIEW MODE */
            <>
              {/* Customer & Locker Dual Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Customer Dossier Card */}
                <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                      Verified Tenant Customer
                    </span>
                    <KycStatusBadge status={customer?.kycStatus || 'PENDING'} />
                  </div>

                  <div className="flex items-center gap-3">
                    {customer?.photoUrl ? (
                      <img
                        src={customer.photoUrl}
                        alt={customer.fullName}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-semibold font-sans flex items-center justify-center shrink-0 shadow-2xs">
                        {(customer?.fullName || 'CU').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 leading-tight font-sans">
                        {customer?.fullName}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-sans tabular-nums">
                        {customer?.customerCode}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1 pt-1 border-t border-slate-200/60 font-normal">
                    <div className="flex items-center gap-1.5 text-slate-900">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-sans font-medium text-sm tabular-nums tracking-tight">
                        {customer?.phone}
                      </span>
                    </div>
                    {customer?.address && (
                      <div className="flex items-start gap-1.5 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <p className="truncate font-sans">
                          {customer.address}, {customer.city}
                        </p>
                      </div>
                    )}
                  </div>

                  {customer?._id && (
                    <Link
                      to={`/customers/${customer._id}`}
                      onClick={onClose}
                      className="text-emerald-800 hover:text-emerald-900 font-medium text-[11px] flex items-center gap-1 pt-1"
                    >
                      <span>Open Customer Profile</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>

                {/* Locker Dossier Card */}
                <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                      Physical Locker Coordinates
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-sans font-medium text-[11px]">
                      Size {locker?.size}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 leading-tight font-sans">
                        Locker #{locker?.lockerNumber}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-sans">
                        {locker?.lockerCode}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1 pt-1 border-t border-slate-200/60 font-normal">
                    <p className="text-slate-700">
                      <strong>Rack:</strong> {locker?.rackNumber}
                    </p>
                    <p className="text-slate-700">
                      <strong>Vault Section:</strong> {locker?.section || 'Main Vault'} (
                      {locker?.floor || 'Ground Floor'})
                    </p>
                  </div>

                  {locker?._id && (
                    <Link
                      to={`/lockers?search=${locker.lockerNumber}`}
                      onClick={onClose}
                      className="text-emerald-800 hover:text-emerald-900 font-medium text-[11px] flex items-center gap-1 pt-1"
                    >
                      <span>View in Locker Matrix</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>

              {/* Financial Snapshot Card */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                  Agreed Financial Pricing (Captured at Allocation)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80">
                    <span className="text-[9.5px] font-sans text-slate-500 block uppercase">START DATE</span>
                    <strong className="text-slate-900 text-xs font-sans font-medium tabular-nums">
                      {new Date(allocation.startDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80">
                    <span className="text-[9.5px] font-sans text-slate-500 block uppercase">CYCLE</span>
                    <strong className="text-slate-900 text-xs font-sans font-medium uppercase">
                      {allocation.billingCycle}
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80">
                    <span className="text-[9.5px] font-sans text-slate-500 block uppercase">ANNUAL RENT</span>
                    <strong className="text-emerald-800 text-xs font-sans font-semibold tabular-nums">
                      ₹{(allocation.rentSnapshot ?? allocation.annualRent).toLocaleString('en-IN')}
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80">
                    <span className="text-[9.5px] font-sans text-slate-500 block uppercase">CAUTION DEPOSIT</span>
                    <strong className="text-slate-800 text-xs font-sans font-semibold tabular-nums">
                      ₹{(allocation.depositSnapshot ?? allocation.securityDeposit).toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>

                {/* Quick Link to Deposit Desk */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs font-normal">
                  <div className="flex items-center space-x-1.5 text-slate-600">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>Security Deposit Ledger & Caution Receipts</span>
                  </div>
                  <Link
                    to="/deposits-refunds"
                    onClick={onClose}
                    className="text-emerald-800 hover:text-emerald-900 font-medium flex items-center space-x-1"
                  >
                    <span>Open Deposit Desk</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Renewal & Billing Statements */}
              {allocationInvoices && allocationInvoices.length > 0 && (
                <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                      Renewal & Billing Statements ({allocationInvoices.length})
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Paid Through: {allocation.paidThroughDate ? new Date(allocation.paidThroughDate).toLocaleDateString('en-IN') : 'Cycle End'}
                    </span>
                  </div>

                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 font-normal">
                    {allocationInvoices.map((inv: any) => (
                      <div key={inv._id} className="py-2 flex items-center justify-between gap-2 text-xs">
                        <div>
                          <strong className="font-sans font-medium text-slate-900">{inv.invoiceNumber}</strong>
                          <span className="text-[10.5px] text-slate-500 font-sans tabular-nums block">
                            Due: {new Date(inv.dueDate).toLocaleDateString('en-IN')} &bull; Period: {new Date(inv.billingPeriodStart).toLocaleDateString('en-IN')} - {new Date(inv.billingPeriodEnd).toLocaleDateString('en-IN')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <strong className="font-sans font-semibold text-slate-900 tabular-nums">
                            ₹{inv.totalAmount.toLocaleString('en-IN')}
                          </strong>
                          <PaymentStatusBadge status={inv.paymentStatus} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Operational Remarks */}
              {allocation.remarks && (
                <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 text-xs">
                  <span className="font-semibold text-slate-700 block mb-1">
                    Operational Notes & Instructions:
                  </span>
                  <p className="text-slate-600 leading-relaxed font-normal">{allocation.remarks}</p>
                </div>
              )}

              {/* Agreement Lifecycle Audit */}
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2 font-normal">
                <span>
                  Agreement registered by <strong className="font-semibold text-slate-700">{allocation.createdBy?.name || 'Staff'}</strong> on{' '}
                  {new Date(allocation.createdAt).toLocaleString('en-IN')}
                </span>
                <span className="font-sans tabular-nums">ID: {allocation._id}</span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-4.5 bg-slate-50/80 border-t border-slate-200/90 flex items-center justify-between gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (isEditing) {
                setIsEditing(false);
              } else {
                onClose();
              }
            }}
            className="rounded-xl border-slate-300 font-medium text-xs h-9 px-3.5 hover:bg-slate-50 cursor-pointer"
          >
            {isEditing ? 'Cancel Edit' : 'Close'}
          </Button>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <Button
                type="submit"
                form="edit-allocation-form"
                disabled={updateMutation.isPending}
                className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium shadow-xs rounded-xl h-9 px-4 text-xs flex items-center gap-1.5 cursor-pointer"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Save Changes</span>
              </Button>
            ) : (
              <>
                {allocation.status === 'RESERVED' && canActivate && onActivate && (
                  <Button
                    size="sm"
                    onClick={() => {
                      onClose();
                      onActivate(allocation);
                    }}
                    className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium shadow-xs rounded-xl h-9 px-3.5 text-xs flex items-center gap-1.5 cursor-pointer"
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
                    className="text-rose-700 border-rose-200 hover:bg-rose-50 rounded-xl font-medium text-xs h-9 px-3.5 cursor-pointer"
                  >
                    Cancel Hold
                  </Button>
                )}

                {canUpdate && allocation.status !== 'CLOSED' && allocation.status !== 'CANCELLED' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="rounded-xl border-slate-300 font-medium text-xs h-9 px-3.5 flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 text-slate-700"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-emerald-800" />
                    <span>Edit Agreement Terms</span>
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
