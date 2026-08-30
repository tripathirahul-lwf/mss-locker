import React, { useState, useEffect } from 'react';
import { depositApi } from '../api/depositApi';
import { RefundRequest, DepositSummary } from '../types';
import { useAuth } from '../../../context/AuthContext';
import { X, CheckCircle, XCircle, ShieldAlert, DollarSign, UserCheck, AlertTriangle } from 'lucide-react';

interface RefundApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  refundId: string | null;
  onSuccess: (updatedRefund: RefundRequest) => void;
}

export const RefundApprovalModal: React.FC<RefundApprovalModalProps> = ({
  isOpen,
  onClose,
  refundId,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [refund, setRefund] = useState<RefundRequest | null>(null);
  const [summary, setSummary] = useState<DepositSummary | null>(null);

  const [approvedAmount, setApprovedAmount] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (isOpen && refundId) {
      loadDetails(refundId);
    }
  }, [isOpen, refundId]);

  const loadDetails = async (id: string) => {
    try {
      setLoading(true);
      const res = await depositApi.getRefundById(id);
      setRefund(res.refund);
      setSummary(res.summary);
      setApprovedAmount(String(res.refund.approvedAmount || res.refund.requestedAmount));
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to load refund details');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentUserId = (user as any)?.id || (user as any)?._id;
  const isSelfRequester = refund && String(refund.requestedBy?._id) === String(currentUserId);
  const numApproved = Number(approvedAmount) || 0;

  const maxHeadroom = summary && refund
    ? summary.availableRefundableBalance + refund.requestedAmount
    : 0;

  const isExceedingHeadroom = numApproved > maxHeadroom;
  const isExceedingRequested = refund ? numApproved > refund.requestedAmount : false;

  const handleApprove = async () => {
    if (!refund) return;
    setErrorMessage(null);

    if (isSelfRequester) {
      setErrorMessage('Maker-Checker Violation: You cannot approve your own refund request.');
      return;
    }

    if (numApproved <= 0) {
      setErrorMessage('Approved amount must be greater than 0');
      return;
    }

    if (isExceedingRequested) {
      setErrorMessage('Approved amount cannot exceed requested amount');
      return;
    }

    if (isExceedingHeadroom) {
      setErrorMessage(`Approved amount cannot exceed available headroom of ₹${maxHeadroom.toLocaleString('en-IN')}`);
      return;
    }

    try {
      setSubmitting(true);
      const updated = await depositApi.approveRefund(refund._id, {
        approvedAmount: numApproved,
        notes: approvalNotes.trim() || undefined,
      });

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to approve refund');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!refund) return;
    setErrorMessage(null);

    if (!rejectionReason || rejectionReason.trim().length < 3) {
      setErrorMessage('Rejection reason is required');
      return;
    }

    try {
      setSubmitting(true);
      const updated = await depositApi.rejectRefund(refund._id, {
        rejectionReason: rejectionReason.trim(),
      });

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to reject refund');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Refund Authorization (Maker-Checker)</h3>
              <p className="text-xs text-slate-400">
                Review financial context and approve or reject refund claim
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading refund details...
          </div>
        ) : !refund || !summary ? (
          <div className="p-8 text-center text-rose-400">Failed to load refund request.</div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Error banner */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center justify-between">
                <span>{errorMessage}</span>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Maker-Checker self-approval warning */}
            {isSelfRequester && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start space-x-2.5">
                <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-rose-200">Maker-Checker Policy Restriction</div>
                  <div>
                    You created this refund request ({refund.requestedBy?.name}). Company policy prohibits self-approval. Another manager or administrator must approve.
                  </div>
                </div>
              </div>
            )}

            {/* Request Snapshot */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Refund #</span>
                <span className="font-mono font-semibold text-cyan-400">
                  {refund.refundNumber}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Requested by {refund.requestedBy?.name || 'Staff'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Customer & Locker</span>
                <span className="font-semibold text-white truncate block">
                  {refund.customerId?.fullName}
                </span>
                <span className="text-slate-400">Locker {refund.lockerId?.lockerNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Requested Amount</span>
                <span className="font-bold text-white text-sm">
                  ₹{refund.requestedAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Reason */}
            <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 text-xs">
              <span className="text-slate-400 font-semibold block mb-1">Reason for Claim:</span>
              <p className="text-slate-200">{refund.reason}</p>
            </div>

            {/* Reject Workflow vs Approve Workflow */}
            {isRejecting ? (
              <div className="space-y-3 p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                    Rejection Details
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsRejecting(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Back to Approval
                  </button>
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Mandatory Rejection Reason *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Provide reason for rejecting this refund claim..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-rose-500/40 text-xs text-white outline-none"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg transition-all"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Approved Amount */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Approved Amount (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="any"
                      required
                      min="1"
                      value={approvedAmount}
                      onChange={(e) => setApprovedAmount(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-500 text-base font-bold text-white outline-none"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    Max Allowable Headroom: ₹{maxHeadroom.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Approval Remarks / Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder="e.g. Approved per customer inspection report"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-xs text-white outline-none"
                  />
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setIsRejecting(true)}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-medium transition-all"
                  >
                    Reject Claim
                  </button>

                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={submitting || Boolean(isSelfRequester) || Boolean(isExceedingHeadroom)}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-2"
                    >
                      {submitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Authorizing...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Authorize & Approve</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
