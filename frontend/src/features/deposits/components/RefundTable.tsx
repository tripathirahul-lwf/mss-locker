import React from 'react';
import { RefundRequest, RefundStatus } from '../types';
import { RefundStatusBadge } from './RefundStatusBadge';
import { Search, Filter, RefreshCw, CheckCircle, DollarSign, Send, Ban, Inbox } from 'lucide-react';

interface RefundTableProps {
  refunds: RefundRequest[];
  isLoading: boolean;
  onRefresh: () => void;
  onSubmitDraft: (refund: RefundRequest) => void;
  onReviewRefund: (refund: RefundRequest) => void;
  onPayRefund: (refund: RefundRequest) => void;
  onCancelRefund: (refund: RefundRequest) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  search: string;
  onSearchChange: (search: string) => void;
  selectedStatus: RefundStatus | '';
  onStatusChange: (status: RefundStatus | '') => void;
  canSubmit?: boolean;
  canReview?: boolean;
  canPay?: boolean;
  canCancel?: boolean;
}

export const RefundTable: React.FC<RefundTableProps> = ({
  refunds,
  isLoading,
  onRefresh,
  onSubmitDraft,
  onReviewRefund,
  onPayRefund,
  onCancelRefund,
  currentPage,
  totalPages,
  onPageChange,
  search,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  canSubmit = false,
  canReview = false,
  canPay = false,
  canCancel = false,
}) => {
  const statusOptions: { value: RefundStatus | ''; label: string }[] = [
    { value: '', label: 'All Statuses' },
    { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
    { value: 'APPROVED', label: 'Approved (Ready to Pay)' },
    { value: 'PAID', label: 'Paid / Disbursed' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'DRAFT', label: 'Drafts' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-4">
      {/* Filters Ribbon */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex-1 flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Refund #, Customer, Reason..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search refund requests"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 placeholder:text-slate-400"
            />
          </div>

          {/* Status Dropdown */}
          <div className="relative min-w-[200px]">
            <select
              value={selectedStatus}
              onChange={(e) => onStatusChange(e.target.value as any)}
              aria-label="Filter refund requests by status"
              className="w-full cursor-pointer appearance-none rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Filter className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center justify-center space-x-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Table Container */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm text-slate-700" aria-busy={isLoading}>
            <caption className="sr-only">Refund request workflow</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <tr>
                <th scope="col" className="py-3.5 px-4">Refund #</th>
                <th scope="col" className="py-3.5 px-4">Customer & Locker</th>
                <th scope="col" className="py-3.5 px-4 text-right">Requested</th>
                <th scope="col" className="py-3.5 px-4 text-right">Approved</th>
                <th scope="col" className="py-3.5 px-4">Reason</th>
                <th scope="col" className="py-3.5 px-4">Status</th>
                <th scope="col" className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500" role="status">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" />
                    Loading refund requests...
                  </td>
                </tr>
              ) : refunds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Inbox className="mx-auto mb-2 h-6 w-6 text-slate-400" />
                    <p className="font-medium text-slate-700">No refund requests found</p>
                    <p className="mt-1 text-xs">Try clearing the search or status filter.</p>
                  </td>
                </tr>
              ) : (
                refunds.map((refund) => (
                  <tr key={refund._id} className="transition-colors hover:bg-slate-50">
                    {/* Refund # */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-medium text-cyan-400 text-xs">
                        {refund.refundNumber}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {new Date(refund.requestedAt || refund.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">
                        {refund.customerId?.fullName || 'N/A'}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center space-x-1.5 mt-0.5">
                        <span className="font-mono text-cyan-300">
                          {refund.customerId?.customerCode}
                        </span>
                        <span>•</span>
                        <span className="bg-slate-800 px-1.5 py-0.2 rounded text-[11px] text-slate-300 font-semibold">
                          Locker {refund.lockerId?.lockerNumber || 'N/A'}
                        </span>
                      </div>
                    </td>

                    {/* Requested Amount */}
                    <td className="py-3.5 px-4 text-right">
                      <span className="font-mono font-semibold text-slate-900">
                        ₹{refund.requestedAmount.toLocaleString('en-IN')}
                      </span>
                    </td>

                    {/* Approved Amount */}
                    <td className="py-3.5 px-4 text-right">
                      <span className="font-semibold font-mono text-emerald-400">
                        {refund.approvedAmount != null
                          ? `₹${refund.approvedAmount.toLocaleString('en-IN')}`
                          : '—'}
                      </span>
                    </td>

                    {/* Reason */}
                    <td className="py-3.5 px-4">
                      <div className="text-xs text-slate-300 max-w-xs truncate" title={refund.reason}>
                        {refund.reason}
                      </div>
                      {refund.rejectionReason && (
                        <div className="text-[11px] text-rose-400/90 truncate max-w-xs mt-0.5">
                          Reject Reason: {refund.rejectionReason}
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      <RefundStatusBadge status={refund.status} size="sm" />
                    </td>

                    {/* Workflow Actions */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        {/* Draft -> Submit */}
                        {canSubmit && refund.status === 'DRAFT' && (
                          <button
                            onClick={() => onSubmitDraft(refund)}
                            title="Submit for Approval"
                            className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-xs font-medium flex items-center space-x-1 transition-all"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Submit</span>
                          </button>
                        )}

                        {/* Pending Approval -> Review / Approve / Reject */}
                        {canReview && refund.status === 'PENDING_APPROVAL' && (
                          <button
                            onClick={() => onReviewRefund(refund)}
                            title="Review Refund (Maker-Checker)"
                            className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-medium flex items-center space-x-1 transition-all"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Review</span>
                          </button>
                        )}

                        {/* Approved -> Disburse Payment */}
                        {canPay && refund.status === 'APPROVED' && (
                          <button
                            onClick={() => onPayRefund(refund)}
                            title="Disburse Refund Payout"
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-medium flex items-center space-x-1 transition-all"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>Pay Refund</span>
                          </button>
                        )}

                        {/* Cancel */}
                        {canCancel && ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(refund.status) && (
                          <button
                            onClick={() => onCancelRefund(refund)}
                            title="Cancel refund request"
                            aria-label={`Cancel refund request ${refund.refundNumber}`}
                            className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 p-4 text-xs text-slate-500">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex space-x-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
