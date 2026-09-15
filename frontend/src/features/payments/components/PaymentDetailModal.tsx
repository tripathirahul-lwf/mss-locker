import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  IndianRupee,
  Receipt,
  User,
  KeyRound,
  FileText,
  Calendar,
  AlertTriangle,
  Ban,
  Printer,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Building2,
  Clock,
  QrCode,
  CreditCard,
  Banknote,
  CheckCircle2,
  ArrowRight,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import { Payment } from '../types';
import { PaymentMethodBadge, PaymentStatusBadge } from './PaymentMethodBadge';
import { Button } from '../../../components/ui/button';
import { usePermission } from '../../../hooks/usePermission';
import { Link } from 'react-router-dom';

interface PaymentDetailModalProps {
  payment: Payment;
  onClose: () => void;
  onPrintReceipt: (payment: Payment) => void;
  onCancelPayment: (payment: Payment, reason: string) => Promise<void>;
}

export function PaymentDetailModal({
  payment,
  onClose,
  onPrintReceipt,
  onCancelPayment,
}: PaymentDetailModalProps) {
  const canCancel = usePermission('payments.cancel');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const customer = payment.customerId;
  const locker = payment.lockerId;
  const invoice = payment.invoiceId;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const cancellationPresets = [
    'Counter entry error / incorrect amount',
    'Cheque dishonoured / payment bounced',
    'Customer requested cancellation / refund',
    'Duplicate transaction entry',
    'Wrong customer or locker tagged',
  ];

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) return;
    setIsCancelling(true);
    try {
      await onCancelPayment(payment, cancelReason.trim());
      setCancelModalOpen(false);
      onClose();
    } catch {
      // Handled by parent mutation
    } finally {
      setIsCancelling(false);
    }
  };

  const isCancelled = payment.paymentStatus === 'CANCELLED';

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-md select-none animate-in fade-in-0 duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200/80 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-slate-50/80 to-emerald-50/30 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-2xl text-white shadow-lg transition-transform ${
              isCancelled
                ? 'bg-gradient-to-tr from-slate-600 to-slate-700 shadow-slate-600/20'
                : 'bg-gradient-to-tr from-emerald-600 to-teal-600 shadow-emerald-600/25'
            }`}>
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight font-mono">
                  {payment.paymentNumber}
                </h2>
                <button
                  type="button"
                  onClick={() => copyToClipboard(payment.paymentNumber, 'payNum')}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
                  title="Copy Payment Number"
                >
                  {copiedKey === 'payNum' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                <span className="font-mono text-slate-600 font-semibold">
                  Receipt #{payment.receiptNumber}
                </span>
                <span>&bull;</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Audit Verified Entry
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-2xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Status & Method Integrated Bar */}
          <div className="p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex items-center justify-between flex-wrap gap-2.5 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Status:
              </span>
              <PaymentStatusBadge status={payment.paymentStatus} />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Method:
              </span>
              <PaymentMethodBadge method={payment.paymentMethod} />
            </div>

            {payment.source && (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-200/70 text-slate-700 text-[11px] font-semibold">
                <Building2 className="w-3 h-3 text-slate-500" />
                <span>{payment.source.replace('_', ' ')}</span>
              </div>
            )}
          </div>

          {/* Amount Hero Card (Light Theme) */}
          <div
            className={`p-5 rounded-2xl border transition-all relative overflow-hidden shadow-sm ${
              isCancelled
                ? 'bg-gradient-to-r from-rose-50/80 via-slate-50 to-rose-50/40 border-rose-200'
                : 'bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-slate-50/80 border-emerald-200/90'
            }`}
          >
            <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                    {isCancelled ? 'Cancelled Payment Amount' : 'Amount Collected'}
                  </span>
                  {invoice && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs">
                      Inv #{invoice.invoiceNumber}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mt-1.5">
                  <span
                    className={`text-3xl sm:text-4xl font-black font-mono tracking-tight ${
                      isCancelled ? 'text-slate-400 line-through' : 'text-emerald-700'
                    }`}
                  >
                    ₹{payment.amount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="text-right space-y-1">
                <span className="text-slate-400 font-sans block text-[10px] font-bold uppercase tracking-wider">
                  Payment Date & Time
                </span>
                <div className="text-slate-800 font-mono font-bold text-xs flex items-center gap-1.5 justify-end">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {new Date(payment.paymentDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                {payment.receivedAt && (
                  <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 justify-end">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>
                      {new Date(payment.receivedAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Recorded by Cashier Metadata footer */}
            <div className="relative z-10 mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  Recorded by <strong className="text-slate-900">{payment.recordedBy?.name || 'Vault Cashier'}</strong>
                </span>
              </div>
              <span className="font-mono text-[10px] text-slate-500">
                Created: {new Date(payment.createdAt).toLocaleDateString('en-IN')}
              </span>
            </div>
          </div>

          {/* Customer & Locker Dual Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Customer Dossier Card */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-2xs hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Payer Customer
                </span>
                {customer?._id && (
                  <Link
                    to={`/customers/${customer._id}`}
                    onClick={onClose}
                    className="text-emerald-700 hover:text-emerald-800 hover:underline font-bold text-[11px] flex items-center gap-0.5"
                  >
                    <span>View Profile</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-3">
                {customer?.photoUrl ? (
                  <img
                    src={customer.photoUrl}
                    alt={customer.fullName}
                    className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white font-bold flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/20 text-sm">
                    {(customer?.fullName || 'CU').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-black text-slate-900 text-sm truncate">
                    {customer?.fullName || 'Walk-in Customer'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono font-semibold text-slate-600 text-[11px]">
                      {customer?.customerCode}
                    </span>
                    {customer?.phone && (
                      <>
                        <span className="text-slate-300">&bull;</span>
                        <a
                          href={`tel:${customer.phone}`}
                          className="font-mono text-slate-500 hover:text-emerald-600 text-[11px]"
                        >
                          {customer.phone}
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Target Locker Coordinates Card */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-2xs hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Target Locker Unit
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono font-bold text-[11px] border border-blue-200/60">
                  Size {locker?.size || 'STD'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-black text-slate-900 text-sm">
                    Locker #{locker?.lockerNumber || 'N/A'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                    {locker?.rackNumber || 'Rack N/A'}
                    {locker?.section ? ` • ${locker.section}` : ''}
                    {locker?.floor ? ` (${locker.floor})` : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Reference & Settlement Details Card */}
          {(payment.upiReference ||
            payment.bankReference ||
            payment.transactionReference ||
            payment.chequeNumber ||
            invoice) && (
            <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-2.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Settlement & Channel References
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                {payment.upiReference && (
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-sans text-slate-400 block font-semibold">UPI UTR / REF</span>
                      <strong className="text-slate-800">{payment.upiReference}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(payment.upiReference!, 'upi')}
                      className="p-1 text-slate-400 hover:text-slate-700"
                    >
                      {copiedKey === 'upi' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}

                {payment.bankReference && (
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-sans text-slate-400 block font-semibold">BANK UTR REF</span>
                      <strong className="text-slate-800">{payment.bankReference}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(payment.bankReference!, 'bank')}
                      className="p-1 text-slate-400 hover:text-slate-700"
                    >
                      {copiedKey === 'bank' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}

                {payment.transactionReference && (
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-sans text-slate-400 block font-semibold">POS TXN / CARD REF</span>
                      <strong className="text-slate-800">{payment.transactionReference}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(payment.transactionReference!, 'pos')}
                      className="p-1 text-slate-400 hover:text-slate-700"
                    >
                      {copiedKey === 'pos' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}

                {payment.chequeNumber && (
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <span className="text-[10px] font-sans text-slate-400 block font-semibold">CHEQUE DETAILS</span>
                    <strong className="text-slate-800">
                      #{payment.chequeNumber} {payment.bankName ? `(${payment.bankName})` : ''}
                    </strong>
                    {payment.chequeDate && (
                      <span className="text-[10px] text-slate-400 block font-sans">
                        Cheque Date: {new Date(payment.chequeDate).toLocaleDateString('en-IN')}
                      </span>
                    )}
                  </div>
                )}

                {invoice && (
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 sm:col-span-2 flex items-center justify-between font-sans">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Linked Invoice Dues</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono font-bold text-slate-800">{invoice.invoiceNumber}</span>
                        <span className="text-slate-400">&bull;</span>
                        <span className="font-mono text-emerald-700 font-bold">
                          Total ₹{invoice.totalAmount?.toLocaleString('en-IN')}
                        </span>
                        {invoice.balanceAmount != null && (
                          <>
                            <span className="text-slate-400">&bull;</span>
                            <span className={`font-mono font-semibold ${
                              invoice.balanceAmount > 0 ? 'text-amber-700' : 'text-emerald-700'
                            }`}>
                              Balance: ₹{invoice.balanceAmount.toLocaleString('en-IN')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      {invoice.paymentStatus || 'INVOICED'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Attached Payment Proof Card */}
          {payment.proofUrl && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Attached Payment Proof / Voucher
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Proof Attached
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center shrink-0 shadow-xs">
                    {payment.proofDocumentName?.toLowerCase().endsWith('.pdf') ? (
                      <FileText className="w-5 h-5" />
                    ) : (
                      <Receipt className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-xs truncate">
                      {payment.proofDocumentName || 'Payment Transaction Proof'}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Uploaded during cashier collection &bull; Available for Audit
                    </p>
                  </div>
                </div>

                <a
                  href={payment.proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View Proof</span>
                </a>
              </div>
            </div>
          )}

          {/* Cashier Notes */}
          {payment.notes && (
            <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 text-xs">
              <strong className="text-amber-900 block font-semibold mb-0.5">
                Cashier Operational Remarks:
              </strong>
              <p className="text-amber-800 leading-relaxed font-sans">{payment.notes}</p>
            </div>
          )}

          {/* Cancellation Info Banner */}
          {isCancelled && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/90 text-rose-900 text-xs space-y-2 shadow-2xs">
              <div className="flex items-center gap-2 text-rose-700 font-bold">
                <Ban className="w-4 h-4" />
                <span>Transaction Reversed & Cancelled</span>
              </div>
              <div className="space-y-1 text-slate-700 font-sans">
                <p>
                  Cancelled by <strong className="text-slate-900">{payment.cancelledBy?.name || 'Administrator'}</strong>{' '}
                  on {payment.cancelledAt ? new Date(payment.cancelledAt).toLocaleString('en-IN') : 'N/A'}
                </p>
                <div className="p-2 rounded-xl bg-white border border-rose-200 text-rose-800 font-mono text-[11px]">
                  <strong>Reason:</strong> {payment.cancellationReason || 'Staff administrative cancellation'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl px-4 text-xs font-semibold cursor-pointer"
          >
            Close
          </Button>

          <div className="flex items-center gap-2">
            {!isCancelled && canCancel && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCancelModalOpen(true)}
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Cancel Payment</span>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={() => {
                onClose();
                onPrintReceipt(payment);
              }}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center gap-1.5 text-xs cursor-pointer shadow-md shadow-slate-900/10"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Official Receipt</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Sub-Modal with Presets */}
      {cancelModalOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
          onClick={() => setCancelModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 shrink-0 border border-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Cancel Payment {payment.paymentNumber}?
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Cancelling this payment will immediately reopen the unpaid balance on Invoice {invoice?.invoiceNumber || 'account'}. This transaction will remain in the immutable audit log as CANCELLED.
                </p>
              </div>
            </div>

            {/* Quick Reason Chips */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Quick Select Reason:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {cancellationPresets.map((preset) => (
                  <button
                    type="button"
                    key={preset}
                    onClick={() => setCancelReason(preset)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                      cancelReason === preset
                        ? 'bg-rose-100 border-rose-300 text-rose-800 font-bold'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Cancellation Justification *
              </label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Specific operational justification for audit log..."
                required
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelModalOpen(false)}
                disabled={isCancelling}
                className="rounded-xl cursor-pointer"
              >
                Go Back
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleConfirmCancel}
                disabled={isCancelling || !cancelReason.trim()}
                className="rounded-xl font-bold cursor-pointer"
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Reversal'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}

