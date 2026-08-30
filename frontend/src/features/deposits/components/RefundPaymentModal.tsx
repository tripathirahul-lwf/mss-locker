import React, { useState } from 'react';
import { depositApi } from '../api/depositApi';
import { RefundRequest } from '../types';
import { PaymentMethod } from '../../payments/types';
import { X, DollarSign, ArrowRight, CheckCircle2 } from 'lucide-react';

interface RefundPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  refund: RefundRequest | null;
  onSuccess: (result: any) => void;
}

export const RefundPaymentModal: React.FC<RefundPaymentModalProps> = ({
  isOpen,
  onClose,
  refund,
  onSuccess,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refundPaymentMethod, setRefundPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [transactionReference, setTransactionReference] = useState('');
  const [notes, setNotes] = useState('');

  if (!isOpen || !refund) return null;

  const payoutAmount = refund.approvedAmount || refund.requestedAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    try {
      setSubmitting(true);
      const res = await depositApi.payRefund(refund._id, {
        refundPaymentMethod,
        transactionReference: transactionReference.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      onSuccess(res);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to disburse refund payment');
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
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Disburse Refund Payout</h3>
              <p className="text-xs text-slate-400">
                Execute approved caution deposit payout to customer
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

          {/* Refund Details Banner */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block">Customer</span>
              <span className="font-semibold text-white truncate block">
                {refund.customerId?.fullName}
              </span>
              <span className="text-slate-400">Locker {refund.lockerId?.lockerNumber}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Approved Payout Amount</span>
              <span className="font-bold text-emerald-400 text-lg">
                ₹{payoutAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Payout Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Disbursement Method *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['BANK_TRANSFER', 'UPI', 'CASH', 'CHEQUE'] as PaymentMethod[]).map(
                (method) => (
                  <button
                    type="button"
                    key={method}
                    onClick={() => setRefundPaymentMethod(method)}
                    className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      refundPaymentMethod === method
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {method.replace('_', ' ')}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Reference # */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Payment Reference / UTR / Cheque # *
            </label>
            <input
              type="text"
              required={refundPaymentMethod !== 'CASH'}
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
              placeholder="Bank UTR # / Cheque Number / Transaction ID"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-xs text-white outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Disbursement Remarks (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Transferred to ICICI account ending 9081"
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
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Recording Payout...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Payout & Update Ledger</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
