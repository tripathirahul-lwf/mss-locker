import React from 'react';
import { LockerClosure } from '../types';
import { ClosureStatusBadge } from './ClosureStatusBadge';
import {
  Eye,
  CheckCircle,
  FileCheck2,
  Printer,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

interface ClosureTableProps {
  closures: LockerClosure[];
  loading: boolean;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  onView: (closure: LockerClosure) => void;
  onReview: (closure: LockerClosure) => void;
  onApprove: (closure: LockerClosure) => void;
  onComplete: (closure: LockerClosure) => void;
  onPrint: (closure: LockerClosure) => void;
  userPermissions: string[];
  currentUserId?: string;
  hasActiveFilters?: boolean;
  onClearFilters: () => void;
  onCreate?: () => void;
}

export const ClosureTable: React.FC<ClosureTableProps> = ({
  closures,
  loading,
  page,
  totalPages,
  total,
  onPageChange,
  onView,
  onReview,
  onApprove,
  onComplete,
  onPrint,
  userPermissions,
  currentUserId,
  hasActiveFilters = false,
  onClearFilters,
  onCreate,
}) => {
  const canReview = userPermissions.includes('closures.review');
  const canApprove = userPermissions.includes('closures.approve');
  const canComplete = userPermissions.includes('closures.complete');
  const canPrint = userPermissions.includes('closures.print');

  if (loading && closures.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center" role="status">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-3" />
        <p className="text-sm text-slate-500 font-medium">Loading closure records...</p>
      </div>
    );
  }

  if (closures.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <h3 className="mb-1 text-base font-semibold text-slate-800">{hasActiveFilters ? 'No matching closures' : 'No closure requests yet'}</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          {hasActiveFilters ? 'No requests match the current search and filters.' : 'Start a closure when a customer surrenders a locker or an allocation must be ended.'}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">{hasActiveFilters && <button type="button" onClick={onClearFilters} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Clear filters</button>}{!hasActiveFilters && onCreate && <button type="button" onClick={onCreate} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Start a closure</button>}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Mobile Card View (<md) */}
      <div className="block md:hidden divide-y divide-slate-100">
        {closures.map((closure) => {
          const customer = closure.customerId;
          const locker = closure.lockerId;
          const allocation = closure.allocationId;
          const isRequester = currentUserId && String(closure.requestedBy?._id) === String(currentUserId);

          return (
            <div
              key={closure._id}
              className="p-4 space-y-3 hover:bg-slate-50/60 transition-colors"
            >
              {/* Header row: Closure code + Status */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-xs">
                      {closure.closureNumber}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
                      {closure.closureType.toLowerCase().replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Req: {closure.requestedClosureDate
                      ? new Date(closure.requestedClosureDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'N/A'}
                  </p>
                </div>
                <ClosureStatusBadge status={closure.status} size="sm" />
              </div>

              {/* Customer & Locker info row */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/70 p-2.5 rounded-lg border border-slate-200/60">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Customer</span>
                  <div className="font-bold text-slate-900 truncate mt-0.5">{customer?.fullName || 'N/A'}</div>
                  <div className="font-mono text-[10.5px] text-slate-500 truncate">{customer?.customerCode || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Locker Unit</span>
                  <div className="font-bold font-mono text-slate-900 mt-0.5">
                    #{locker?.lockerNumber || 'N/A'}
                  </div>
                  <div className="text-[10.5px] text-slate-500">
                    Size {locker?.size || 'STD'} • Rack {locker?.rackNumber || '—'}
                  </div>
                </div>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex items-center justify-between gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => onView(closure)}
                  className="flex-1 min-h-[36px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 active:scale-[0.98] transition cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>Dossier</span>
                </button>

                {canReview && ['PENDING_REVIEW', 'PENDING_SETTLEMENT'].includes(closure.status) && (
                  <button
                    type="button"
                    onClick={() => onReview(closure)}
                    className="flex-1 min-h-[36px] inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold rounded-lg active:scale-[0.98] transition cursor-pointer"
                  >
                    Review
                  </button>
                )}

                {canApprove && ['READY_FOR_CLOSURE', 'PENDING_REVIEW'].includes(closure.status) && !isRequester && (
                  <button
                    type="button"
                    onClick={() => onApprove(closure)}
                    className="flex-1 min-h-[36px] inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-semibold rounded-lg active:scale-[0.98] transition cursor-pointer"
                  >
                    Approve
                  </button>
                )}

                {canComplete && closure.status === 'APPROVED' && (
                  <button
                    type="button"
                    onClick={() => onComplete(closure)}
                    className="flex-1 min-h-[36px] inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-2xs active:scale-[0.98] transition cursor-pointer"
                  >
                    Complete
                  </button>
                )}

                {canPrint && ['COMPLETED', 'APPROVED'].includes(closure.status) && (
                  <button
                    type="button"
                    onClick={() => onPrint(closure)}
                    title="Print Statement"
                    aria-label="Print Statement"
                    className="min-h-[36px] p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop View Table (md+) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
          <caption className="sr-only">Locker closure requests and workflow status</caption>
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <th scope="col" className="py-3.5 px-4">Closure No.</th>
              <th scope="col" className="py-3.5 px-4">Customer</th><th scope="col" className="py-3.5 px-4">Locker</th><th scope="col" className="py-3.5 px-4">Allocation</th><th scope="col" className="py-3.5 px-4">Requested Date</th><th scope="col" className="py-3.5 px-4">Status</th><th scope="col" className="py-3.5 px-4">Operator</th><th scope="col" className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {closures.map((closure) => {
              const customer = closure.customerId;
              const locker = closure.lockerId;
              const allocation = closure.allocationId;

              const isRequester = currentUserId && String(closure.requestedBy?._id) === String(currentUserId);

              return (
                <tr
                  key={closure._id}
                  className="transition-colors hover:bg-slate-50/70"
                >
                  {/* Closure Number */}
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-xs">
                    {closure.closureNumber}
                    <div className="text-[11px] font-normal font-sans text-slate-500 capitalize">
                      {closure.closureType.toLowerCase().replace('_', ' ')}
                    </div>
                  </td>

                  {/* Customer */}
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900 leading-tight">
                      {customer?.fullName || 'N/A'}
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      {customer?.customerCode || 'N/A'} • {customer?.phone || ''}
                    </div>
                  </td>

                  {/* Locker */}
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 font-mono font-bold text-slate-800 text-xs">
                      #{locker?.lockerNumber || 'N/A'}
                    </span>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Size {locker?.size || 'STD'} • Rack {locker?.rackNumber || 'N/A'}
                    </div>
                  </td>

                  {/* Allocation */}
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-xs text-slate-700 font-medium">
                      {allocation?.allocationCode || 'N/A'}
                    </span>
                  </td>

                  {/* Requested Date */}
                  <td className="py-3.5 px-4 text-xs text-slate-600">
                    {closure.requestedClosureDate
                      ? new Date(closure.requestedClosureDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'N/A'}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4">
                    <ClosureStatusBadge status={closure.status} size="sm" />
                  </td>

                  {/* Operator */}
                  <td className="py-3.5 px-4 text-xs text-slate-600">
                    <div className="font-medium text-slate-800">
                      {closure.requestedBy?.name || 'Staff'}
                    </div>
                    {closure.approvedBy && (
                      <div className="text-[11px] text-slate-400">
                        Apprv: {closure.approvedBy.name}
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td
                    className="py-3.5 px-4 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="inline-flex items-center gap-1">
                      {/* View details */}
                      <button
                        onClick={() => onView(closure)}
                        title="View Details"
                        aria-label={`View closure ${closure.closureNumber}`}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Review Button */}
                      {canReview && ['PENDING_REVIEW', 'PENDING_SETTLEMENT'].includes(closure.status) && (
                        <button
                          onClick={() => onReview(closure)}
                          title="Review Checklist & Dues"
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold rounded-md transition-colors"
                        >
                          Review
                        </button>
                      )}

                      {/* Approve Button */}
                      {canApprove && ['READY_FOR_CLOSURE', 'PENDING_REVIEW'].includes(closure.status) && !isRequester && (
                        <button
                          onClick={() => onApprove(closure)}
                          title="Authorize Closure"
                          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-semibold rounded-md transition-colors"
                        >
                          Approve
                        </button>
                      )}

                      {/* Complete Execution Button */}
                      {canComplete && closure.status === 'APPROVED' && (
                        <button
                          onClick={() => onComplete(closure)}
                          title="Release Locker & Complete Closure"
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors"
                        >
                          Complete
                        </button>
                      )}

                      {/* Print Statement */}
                      {canPrint && ['COMPLETED', 'APPROVED'].includes(closure.status) && (
                        <button
                          onClick={() => onPrint(closure)}
                          title="Print Closure Statement"
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
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
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200/80 bg-slate-50/50 text-xs text-slate-600">
          <div>
            Showing <span className="font-semibold">{closures.length}</span> of{' '}
            <span className="font-semibold">{total}</span> records
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous closure page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next closure page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
