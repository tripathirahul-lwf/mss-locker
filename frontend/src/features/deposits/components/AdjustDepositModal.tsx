import React, { useState, useEffect } from 'react';
import { depositApi } from '../api/depositApi';
import { DepositSummary } from '../types';
import { X, SlidersHorizontal, AlertTriangle, ArrowRight } from 'lucide-react';

interface AdjustDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  allocationId?: string;
  onSuccess: (result: any) => void;
}

export const AdjustDepositModal: React.FC<AdjustDepositModalProps> = ({
  isOpen,
  onClose,
  allocationId,
  onSuccess,
}) => {
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<DepositSummary | null>(null);

  const [transactionType, setTransactionType] = useState<
    'DEPOSIT_ADJUSTMENT_ADD' | 'DEPOSIT_ADJUSTMENT_DEDUCT'
  >('DEPOSIT_ADJUSTMENT_DEDUCT');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [notes, setNotes] = useState('');

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
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to load deposit details');
    } finally {
      setLoadingSummary(false);
    }
  };

  if (!isOpen) return null;

  const numAmount = Number(amount) || 0;
  const isDeductionExceeding =
    transactionType === 'DEPOSIT_ADJUSTMENT_DEDUCT' &&
    summary &&
    numAmount > summary.availableRefundableBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!summary || !allocationId) return;

    if (numAmount <= 0) {
      setErrorMessage('Adjustment amount must be greater than 0');
      return;
    }

    if (!reason || reason.trim().length < 3) {
      setErrorMessage('Detailed justification reason is required');
      return;
    }

    if (isDeductionExceeding) {
      setErrorMessage(
        `Deduction amount cannot exceed available balance (₹${summary.availableRefundableBalance.toLocaleString('en-IN')})`
      );
      return;
    }

    try {
      setSubmitting(true);
      const res = await depositApi.adjustDeposit({
        allocationId,
        transactionType,
        amount: numAmount,
        reason: reason.trim(),
        transactionReference: transactionReference.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      onSuccess(res);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to adjust deposit');
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
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Deposit Balance Adjustment</h3>
              <p className="text-xs text-slate-400">
                Damage deductions, key replacement charges, or manual additions
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
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
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

            {/* Live Context Banner */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Locker / Agreement</span>
                <span className="font-semibold text-white">
                  Locker {summary.lockerNumber} ({summary.allocationCode})
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Available Refundable Balance</span>
                <span className="font-bold text-emerald-400 text-sm">
                  ₹{summary.availableRefundableBalance.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Adjustment Type Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Adjustment Direction *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTransactionType('DEPOSIT_ADJUSTMENT_DEDUCT')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    transactionType === 'DEPOSIT_ADJUSTMENT_DEDUCT'
                      ? 'bg-rose-500/15 border-rose-500 text-rose-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold">Deduct from Deposit (-)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Damage fee, lost key penalty, incidental arrears
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTransactionType('DEPOSIT_ADJUSTMENT_ADD')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    transactionType === 'DEPOSIT_ADJUSTMENT_ADD'
                      ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold">Add to Deposit (+)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Credit increment, bonus deposit addition
                  </div>
                </button>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Amount (₹) *
              </label>
              <input
                type="number"
                step="any"
                required
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-500 text-lg font-bold text-white outline-none"
              />
            </div>

            {/* Deduction warning */}
            {isDeductionExceeding && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>
                  Deduction cannot exceed available refundable balance of ₹
                  {summary.availableRefundableBalance.toLocaleString('en-IN')}.
                </span>
              </div>
            )}

            {/* Mandatory Reason */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Justification / Audit Reason *
              </label>
              <textarea
                required
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Detailed explanation for audit log (e.g. Lost key replacement fee receipt #124)"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-xs text-white outline-none"
              />
            </div>

            {/* Reference */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Incident / Work Order Reference (Optional)
              </label>
              <input
                type="text"
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                placeholder="e.g. WO-2026-089"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-xs text-white outline-none"
              />
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || Boolean(isDeductionExceeding)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 transition-all flex items-center space-x-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Adjustment</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
