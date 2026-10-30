import React, { useEffect, useRef, useState } from 'react';
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
  const pending = useRef<Parameters<typeof depositApi.payRefund>[1] | null>(null);
  const submittingRef = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refundPaymentMethod, setRefundPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [transactionReference, setTransactionReference] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    pending.current = null;
    setUncertain(false);
    setErrorMessage(null);
    setRefundPaymentMethod('BANK_TRANSFER');
    setTransactionReference('');
    setNotes('');
  }, [isOpen, refund?._id]);
  if (!isOpen || !refund) return null;

  const payoutAmount = refund.approvedAmount || refund.requestedAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setErrorMessage(null);
    if (!pending.current && refundPaymentMethod !== 'CASH' && !transactionReference.trim()) { setErrorMessage('Enter a transaction reference before recording this payout.'); return; }
    submittingRef.current = true;
    try {
      setSubmitting(true);
      pending.current ??= { refundPaymentMethod, transactionReference: transactionReference.trim() || undefined, notes: notes.trim() || undefined };
      const res = await depositApi.payRefund(refund._id, pending.current, `refund-payout:${refund._id}`);

      onSuccess(res);
      onClose();
    } catch (err: any) {
      const ambiguous = !err.response || err.response.status >= 500;
      setUncertain(ambiguous);
      if (!ambiguous) pending.current = null;
      setErrorMessage(ambiguous ? 'Payout response not confirmed. Do not pay again. Retry to check this same payout.' : err?.response?.data?.message || 'Failed to disburse refund payment');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div role="dialog" aria-modal="true" aria-label="Refund payout" className="relative w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Disburse Refund Payout</h3>
              <p className="text-xs text-slate-600">
                Execute approved caution deposit payout to customer
              </p>
            </div>
          </div>
          <button
            disabled={submitting} onClick={onClose}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-800 flex items-center justify-between">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-slate-600 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Refund Details Banner */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block">Customer</span>
              <span className="font-semibold text-slate-900 truncate block">
                {refund.customerId?.fullName}
              </span>
              <span className="text-slate-600">Locker {refund.lockerId?.lockerNumber}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Approved Payout Amount</span>
              <span className="font-bold text-emerald-800 text-lg">
                ₹{payoutAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Payout Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Disbursement Method *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['BANK_TRANSFER', 'UPI', 'CASH', 'CHEQUE'] as PaymentMethod[]).map(
                (method) => (
                  <button
                    type="button"
                    key={method}
                    disabled={submitting || uncertain} onClick={() => setRefundPaymentMethod(method)}
                    className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      refundPaymentMethod === method
                        ? 'bg-emerald-100 border-emerald-500 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Reference / UTR / Cheque # *
            </label>
            <input
              type="text"
              required={refundPaymentMethod !== 'CASH'}
              disabled={submitting || uncertain}
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
              placeholder="Bank UTR # / Cheque Number / Transaction ID"
              className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 focus:border-cyan-500 text-xs text-slate-900 outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Disbursement Remarks (Optional)
            </label>
            <input
              type="text"
              disabled={submitting || uncertain}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Transferred to ICICI account ending 9081"
              className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 focus:border-cyan-500 text-xs text-slate-900 outline-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              disabled={submitting} onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-all"
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
                  <span>{uncertain ? 'Check & Retry Payout' : 'Confirm Payout & Update Ledger'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
