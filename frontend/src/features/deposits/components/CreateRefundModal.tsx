import React, { useState, useEffect } from 'react';
import { depositApi } from '../api/depositApi';
import { DepositSummary } from '../types';
import { X, ArrowUpRight, AlertCircle, ArrowRight, FileEdit, Send } from 'lucide-react';

interface CreateRefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  allocationId?: string;
  onSuccess: (result: any) => void;
}

export const CreateRefundModal: React.FC<CreateRefundModalProps> = ({
  isOpen,
  onClose,
  allocationId,
  onSuccess,
}) => {
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<DepositSummary | null>(null);

  const [requestedAmount, setRequestedAmount] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isDraft, setIsDraft] = useState(false);

  useEffect(() => {
    if (isOpen && allocationId) {
      loadSummary(allocationId);
    }
  }, [isOpen, allocationId]);

  const loadSummary = async (allocId: string) => {
    try {
      setLoadingSummary(true);
      const res = await depositApi.getDepositSummary(allocId);
      setSummary(res);
      // Auto-populate available balance
      if (res.availableRefundableBalance > 0) {
        setRequestedAmount(String(res.availableRefundableBalance));
      }
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to load deposit details');
    } finally {
      setLoadingSummary(false);
    }
  };

  if (!isOpen) return null;

  const numAmount = Number(requestedAmount) || 0;
  const isExceeding = summary && numAmount > summary.availableRefundableBalance;

  const handleSubmit = async (submitAsDraft: boolean) => {
    setErrorMessage(null);
    if (!summary || !allocationId) return;

    if (numAmount <= 0) {
      setErrorMessage('Requested refund amount must be greater than 0');
      return;
    }

    if (!reason || reason.trim().length < 3) {
      setErrorMessage('Reason for refund request is required');
      return;
    }

    if (isExceeding) {
      setErrorMessage(
        `Requested amount exceeds available balance (₹${summary.availableRefundableBalance.toLocaleString('en-IN')})`
      );
      return;
    }

    try {
      setSubmitting(true);
      const res = await depositApi.createRefund({
        allocationId,
        requestedAmount: numAmount,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
        isDraft: submitAsDraft,
      });

      onSuccess(res);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to create refund request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Create Refund Request</h3>
              <p className="text-xs text-slate-400">
                Initiate caution deposit refund with Maker-Checker controls
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
        {loadingSummary ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading deposit context...
          </div>
        ) : !summary ? (
          <div className="p-8 text-center text-rose-400">Failed to load allocation data.</div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Error Message */}
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

            {/* Live Financial Context Bar */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Customer</span>
                <span className="font-semibold text-white truncate block">
                  {summary.customerName}
                </span>
                <span className="text-slate-400">Locker {summary.lockerNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Net Deposit Held</span>
                <span className="font-semibold text-slate-200">
                  ₹{summary.netDepositHeld.toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Available Headroom</span>
                <span className="font-bold text-emerald-400 text-sm">
                  ₹{summary.availableRefundableBalance.toLocaleString('en-IN')}
                </span>
                {summary.pendingRefundAmount > 0 && (
                  <span className="text-[10px] text-amber-400 block">
                    (₹{summary.pendingRefundAmount.toLocaleString('en-IN')} pending in other requests)
                  </span>
                )}
              </div>
            </div>

            {/* Requested Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Requested Refund Amount (₹) *
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
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-500 text-lg font-bold text-white outline-none"
                />
              </div>

              {/* Helper */}
              {summary.availableRefundableBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setRequestedAmount(String(summary.availableRefundableBalance))}
                  className="mt-2 text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-purple-300 hover:bg-slate-700 font-medium"
                >
                  Refund Full Available (₹{summary.availableRefundableBalance.toLocaleString('en-IN')})
                </button>
              )}
            </div>

            {/* Exceeding Warning */}
            {isExceeding && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>
                  Requested amount cannot exceed available refundable balance of ₹
                  {summary.availableRefundableBalance.toLocaleString('en-IN')}.
                </span>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Reason for Refund Request *
              </label>
              <textarea
                required
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Deposit downsize, customer requested partial withdrawal, or agreement surrender"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-xs text-white outline-none"
              />
            </div>

            {/* Additional notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Additional Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Remarks for manager review"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-xs text-white outline-none"
              />
            </div>

            {/* Action Buttons (Draft vs Submit) */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={submitting || Boolean(isExceeding)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-all"
              >
                <FileEdit className="w-3.5 h-3.5" />
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={submitting || Boolean(isExceeding)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-lg shadow-purple-500/20 transition-all flex items-center space-x-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit for Approval</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
