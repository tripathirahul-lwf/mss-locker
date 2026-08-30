import React from 'react';
import { RefundRequest, RefundStatus } from '../types';
import { RefundStatusBadge } from './RefundStatusBadge';
import { Search, Filter, RefreshCw, CheckCircle, XCircle, DollarSign, Send, Ban } from 'lucide-react';

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
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 text-sm text-white placeholder:text-slate-500 outline-none transition-all"
            />
          </div>

          {/* Status Dropdown */}
          <div className="relative min-w-[200px]">
            <select
              value={selectedStatus}
              onChange={(e) => onStatusChange(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 focus:border-cyan-500/50 text-sm text-slate-200 outline-none transition-all appearance-none cursor-pointer"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
            <Filter className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <button
          onClick={onRefresh}
          className="px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white flex items-center justify-center space-x-2 text-sm font-medium transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Table Container */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs uppercase font-semibold tracking-wider text-slate-400 border-b border-slate-800/80">
              <tr>
                <th className="py-3.5 px-4">Refund #</th>
                <th className="py-3.5 px-4">Customer & Locker</th>
                <th className="py-3.5 px-4 text-right">Requested</th>
                <th className="py-3.5 px-4 text-right">Approved</th>
                <th className="py-3.5 px-4">Reason</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" />
                    Loading refund requests...
                  </td>
                </tr>
              ) : refunds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No refund requests found.
                  </td>
                </tr>
              ) : (
                refunds.map((refund) => (
                  <tr key={refund._id} className="hover:bg-slate-800/30 transition-colors">
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
                      <div className="font-medium text-white">
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
                      <span className="font-semibold font-mono text-white">
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
                        {refund.status === 'DRAFT' && (
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
                        {refund.status === 'PENDING_APPROVAL' && (
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
                        {refund.status === 'APPROVED' && (
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
                        {['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(refund.status) && (
                          <button
                            onClick={() => onCancelRefund(refund)}
                            title="Cancel Refund Request"
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
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex space-x-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-all"
              >
                Previous
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-all"
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
