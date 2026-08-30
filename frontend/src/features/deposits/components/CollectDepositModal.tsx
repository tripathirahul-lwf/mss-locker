import React, { useState, useEffect } from 'react';
import { depositApi } from '../api/depositApi';
import { DepositSummary } from '../types';
import { PaymentMethod } from '../../payments/types';
import { X, ShieldCheck, AlertTriangle, CheckCircle2, Lock, ArrowRight, DollarSign } from 'lucide-react';

interface CollectDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  allocationId?: string;
  onSuccess: (result: any) => void;
}

export const CollectDepositModal: React.FC<CollectDepositModalProps> = ({
  isOpen,
  onClose,
  allocationId,
  onSuccess,
}) => {
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<DepositSummary | null>(null);

  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [transactionReference, setTransactionReference] = useState('');
  const [notes, setNotes] = useState('');
  const [allowOverride, setAllowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

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
      // Auto-fill outstanding deposit
      if (res.outstandingDeposit > 0) {
        setAmount(String(res.outstandingDeposit));
      }
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to load deposit details');
    } finally {
      setLoadingSummary(false);
    }
  };

  if (!isOpen) return null;

  const numAmount = Number(amount) || 0;
  const isOvercollecting = summary
    ? summary.totalDepositReceived + numAmount > summary.requiredDeposit
    : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!summary || !allocationId) return;

    if (numAmount <= 0) {
      setErrorMessage('Deposit amount must be greater than 0');
      return;
    }

    if (isOvercollecting && !allowOverride) {
      setErrorMessage('Deposit amount exceeds required deposit. Check override permission.');
      return;
    }

    if (isOvercollecting && allowOverride && (!overrideReason || overrideReason.trim().length < 3)) {
      setErrorMessage('Override reason is required for overcollection');
      return;
    }

    try {
      setSubmitting(true);
      const res = await depositApi.collectDeposit({
        allocationId,
        amount: numAmount,
        paymentMethod,
        transactionReference: transactionReference.trim() || undefined,
        notes: notes.trim() || undefined,
        allowOverride,
        overrideReason: allowOverride ? overrideReason.trim() : undefined,
      });

      onSuccess(res);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to collect deposit');
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
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Collect Caution Money / Deposit</h3>
              <p className="text-xs text-slate-400">
                Official refundable security deposit receipting
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
            Loading deposit configuration...
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

            {/* Agreement & Customer Bar */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Customer</span>
                <span className="font-semibold text-white truncate block">
                  {summary.customerName}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Locker</span>
                <span className="font-semibold text-cyan-300">
                  Locker {summary.lockerNumber}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Required Deposit</span>
                <span className="font-semibold text-slate-200">
                  ₹{summary.requiredDeposit.toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Outstanding</span>
                <span className="font-bold text-amber-400">
                  ₹{summary.outstandingDeposit.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Amount Field with Quick Set Buttons */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Deposit Amount (₹) *
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
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-500 text-lg font-bold text-white outline-none"
                  placeholder="0.00"
                />
              </div>

              {/* Quick helper buttons */}
              <div className="flex gap-2 mt-2">
                {summary.outstandingDeposit > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(summary.outstandingDeposit))}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-cyan-400 hover:bg-slate-700 font-medium"
                  >
                    Pay Outstanding (₹{summary.outstandingDeposit.toLocaleString('en-IN')})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAmount(String(summary.requiredDeposit))}
                  className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium"
                >
                  Full Snapshot (₹{summary.requiredDeposit.toLocaleString('en-IN')})
                </button>
              </div>
            </div>

            {/* Overcollection Warning / Override Toggle */}
            {isOvercollecting && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-3">
                <div className="flex items-center space-x-2 text-amber-400 font-semibold">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Amount exceeds required deposit by ₹
                    {(
                      summary.totalDepositReceived +
                      numAmount -
                      summary.requiredDeposit
                    ).toLocaleString('en-IN')}
                  </span>
                </div>
                <label className="flex items-center space-x-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowOverride}
                    onChange={(e) => setAllowOverride(e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-500 bg-slate-900 border-slate-700"
                  />
                  <span>Authorize overcollection override</span>
                </label>
                {allowOverride && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Override Justification *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Higher locker valuation / special security caution agreement"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-amber-500/40 text-xs text-white outline-none"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Payment Method *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE'] as PaymentMethod[]).map(
                  (method) => (
                    <button
                      type="button"
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        paymentMethod === method
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {method.replace('_', ' ')}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Reference Number */}
            {paymentMethod !== 'CASH' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Transaction / UTR / Reference #
                </label>
                <input
                  type="text"
                  value={transactionReference}
                  onChange={(e) => setTransactionReference(e.target.value)}
                  placeholder="UPI Tx ID / Cheque # / Bank Ref"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-sm text-white outline-none"
                />
              </div>
            )}

            {/* Internal Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Internal Remarks / Caution Deposit Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional cashier remarks"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-sm text-white outline-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || (isOvercollecting && !allowOverride)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Issue Caution Receipt</span>
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
