import React from 'react';
import {
  Eye,
  KeyRound,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Plus,
} from 'lucide-react';
import { LockerAllocation, AllocationQueryParams } from '../types';
import { AllocationStatusBadge } from './AllocationStatusBadge';
import { Button } from '../../../components/ui/button';
import { usePermission } from '../../../hooks/usePermission';
import { formatPhone } from '../../customers/utils/phoneFormatter';

interface AllocationTableProps {
  allocations: LockerAllocation[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  isLoading: boolean;
  filters: AllocationQueryParams;
  onPageChange: (page: number) => void;
  onView: (allocation: LockerAllocation) => void;
  onActivate: (allocation: LockerAllocation) => void;
  onCancel: (allocation: LockerAllocation) => void;
  onEdit: (allocation: LockerAllocation) => void;
  onNewAllocation?: () => void;
}

export function AllocationTable({
  allocations,
  pagination,
  isLoading,
  filters,
  onPageChange,
  onView,
  onActivate,
  onCancel,
  onEdit,
  onNewAllocation,
}: AllocationTableProps) {
  const canActivate = usePermission('allocations.activate');
  const canCancel = usePermission('allocations.cancel');
  const canUpdate = usePermission('allocations.update');
  const canCreate = usePermission('allocations.create');

  if (isLoading) {
    return (
      <div className="w-full bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 font-normal animate-pulse shadow-xs">
        Loading Locker Tenancy Agreements...
      </div>
    );
  }

  if (allocations.length === 0) {
    return (
      <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-12 text-center space-y-4 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto border border-emerald-200/80 shadow-2xs">
          <KeyRound className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-900">No Allocation Agreements Found</h3>
          <p className="text-xs text-slate-500 font-normal max-w-md mx-auto leading-relaxed">
            No records match your active search or filter selection. Click "New Allocation" below to assign a vacant physical locker to a verified customer.
          </p>
        </div>
        {canCreate && onNewAllocation && (
          <Button
            size="sm"
            onClick={onNewAllocation}
            className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium shadow-xs px-4 h-9.5 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Allocation</span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden select-none">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50/80 text-slate-500 font-medium uppercase tracking-wider text-[11px] border-b border-slate-200">
            <tr>
              <th className="py-3.5 px-4">Agreement Code</th>
              <th className="py-3.5 px-4">Customer</th>
              <th className="py-3.5 px-4">Locker Unit</th>
              <th className="py-3.5 px-4">Start Date</th>
              <th className="py-3.5 px-4 text-right">Annual Rent</th>
              <th className="py-3.5 px-4 text-right">Caution Deposit</th>
              <th className="py-3.5 px-4 text-center">Status</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
            {allocations.map((item) => {
              const customer = item.customerId;
              const locker = item.lockerId;

              return (
                <tr
                  key={item._id}
                  onClick={() => onView(item)}
                  className="hover:bg-emerald-50/30 cursor-pointer transition-colors group"
                >
                  {/* Agreement Code */}
                  <td className="py-3.5 px-4">
                    <span className="font-sans font-medium text-xs text-slate-700 bg-slate-100/80 group-hover:bg-emerald-100/60 group-hover:text-emerald-950 px-2 py-0.5 rounded-md border border-slate-200 transition-colors tabular-nums">
                      {item.allocationCode}
                    </span>
                  </td>

                  {/* Customer */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      {customer?.photoUrl ? (
                        <img
                          src={customer.photoUrl}
                          alt={customer.fullName}
                          className="w-8 h-8 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-semibold font-sans text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          {(customer?.fullName || 'CU').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="truncate max-w-[170px]">
                        <p className="font-semibold text-slate-900 truncate font-sans">
                          {customer?.fullName || 'Unknown Customer'}
                        </p>
                        <p className="font-sans font-medium text-slate-900 text-[13px] tabular-nums tracking-tight truncate">
                          {formatPhone(customer?.phone)}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Locker */}
                  <td className="py-3.5 px-4">
                    <div>
                      <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                        <KeyRound className="w-3.5 h-3.5 text-emerald-800" />
                        <span>Locker #{locker?.lockerNumber || 'N/A'}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
                          {locker?.size}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-normal">
                        {locker?.rackNumber} • {locker?.section || 'Main Vault'}
                      </p>
                    </div>
                  </td>

                  {/* Start Date */}
                  <td className="py-3.5 px-4">
                    <div className="space-y-0.5">
                      <p className="font-normal text-slate-800 tabular-nums">
                        {new Date(item.startDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                      <span className="text-[10px] text-slate-400 uppercase font-medium tracking-wider">
                        {item.billingCycle}
                      </span>
                    </div>
                  </td>

                  {/* Rent Snapshot */}
                  <td className="py-3.5 px-4 text-right font-semibold text-slate-900 tabular-nums font-sans">
                    ₹{(item.rentSnapshot ?? item.annualRent).toLocaleString('en-IN')}
                  </td>

                  {/* Deposit Snapshot */}
                  <td className="py-3.5 px-4 text-right font-semibold text-slate-700 tabular-nums font-sans">
                    ₹{(item.depositSnapshot ?? item.securityDeposit).toLocaleString('en-IN')}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4 text-center">
                    <AllocationStatusBadge status={item.status} />
                  </td>

                  {/* Actions */}
                  <td
                    className="py-3.5 px-4 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onView(item)}
                        className="h-8 w-8 p-0 rounded-lg text-slate-500 hover:text-emerald-800 hover:bg-emerald-50 cursor-pointer"
                        title="View Agreement Dossier"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>

                      {item.status === 'RESERVED' && canActivate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onActivate(item)}
                          className="h-8 px-2.5 rounded-lg text-emerald-800 hover:bg-emerald-50 text-xs font-medium flex items-center gap-1 cursor-pointer"
                          title="Activate Reservation into Live Tenancy"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Activate</span>
                        </Button>
                      )}

                      {item.status === 'RESERVED' && canCancel && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onCancel(item)}
                          className="h-8 px-2 rounded-lg text-rose-700 hover:bg-rose-50 text-xs font-medium cursor-pointer"
                          title="Cancel Hold"
                        >
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        </Button>
                      )}

                      {canUpdate && item.status !== 'CLOSED' && item.status !== 'CANCELLED' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(item)}
                          className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                          title="Edit Agreement Terms"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination && pagination.totalPages > 1 && (
        <div className="p-3.5 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 font-normal">
          <span>
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} agreements
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="h-8 px-2.5 rounded-xl border-slate-300 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-medium text-slate-800 tabular-nums">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="h-8 px-2.5 rounded-xl border-slate-300 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
