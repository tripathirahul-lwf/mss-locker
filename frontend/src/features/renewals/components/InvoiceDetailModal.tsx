import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FileText,
  KeyRound,
  User,
  Calendar,
  IndianRupee,
  Clock,
  ShieldCheck,
  Ban,
  Printer,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { LockerInvoice } from '../types';
import { PaymentStatusBadge, DueStatusBadge } from './RenewalStatusBadge';
import { Button } from '../../../components/ui/button';
import { usePermission } from '../../../hooks/usePermission';

import { useQuery } from '@tanstack/react-query';
import { paymentApi } from '../../payments/api/paymentApi';
import { PaymentMethodBadge, PaymentStatusBadge as TransactionStatusBadge } from '../../payments/components/PaymentMethodBadge';
import { renewalApi } from '../api/renewalApi';

interface InvoiceDetailModalProps {
  invoice: LockerInvoice;
  onClose: () => void;
  onCancelInvoice?: (invoice: LockerInvoice, reason: string) => Promise<void>;
  onRecordPayment?: (invoice: LockerInvoice) => void;
}

export function InvoiceDetailModal({
  invoice,
  onClose,
  onCancelInvoice,
  onRecordPayment,
}: InvoiceDetailModalProps) {
  const canCreate = usePermission('renewals.create');
  const canPay = usePermission('payments.create');
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Fetch payments recorded against this invoice
  const { data: invoicePayments } = useQuery({
    queryKey: ['invoice-payments', invoice._id],
    queryFn: () => paymentApi.getInvoicePayments(invoice._id),
  });

  const customer = invoice.customerId;
  const locker = invoice.lockerId;
  const allocation = invoice.allocationId;

  const handleCopyInvoiceNumber = () => {
    navigator.clipboard.writeText(invoice.invoiceNumber);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  const handleConfirmCancel = async () => {
    if (!onCancelInvoice) return;
    setIsCancelling(true);
    try {
      await onCancelInvoice(invoice, cancelReason);
      setCancelModalOpen(false);
      onClose();
    } catch {
      // Error handled by parent mutation
    } finally {
      setIsCancelling(false);
    }
  };

  const handlePrintInvoice = async () => {
    setIsPrinting(true);
    try { await renewalApi.printInvoicePdf(invoice._id, invoice.invoiceNumber); }
    catch { window.alert('Print dialog could not be opened. Please allow printing and try again.'); }
    finally { setIsPrinting(false); }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-sm select-none animate-in fade-in-0 duration-150">
      <div
        className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  {invoice.invoiceNumber}
                </h2>
                <button
                  type="button"
                  onClick={handleCopyInvoiceNumber}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors"
                  title="Copy Invoice Number"
                >
                  {copiedNumber ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {invoice.invoiceType === 'LEGACY_IMPORT'
                  ? 'Historical Ledger Renewal Bill'
                  : 'Locker Tenancy Periodic Billing Statement'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Status Bar */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Payment State:
              </span>
              <PaymentStatusBadge status={invoice.paymentStatus} />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Due Status:
              </span>
              <DueStatusBadge status={invoice.dueStatus} dueDate={invoice.dueDate} />
            </div>
          </div>

          {/* Customer & Locker Coordinates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Customer Box */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Billed Tenant Customer
              </span>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center shrink-0">
                  {(customer?.fullName || 'CU').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-black text-slate-900 text-sm">
                    {customer?.fullName || 'Customer Not Populated'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {customer?.customerCode} &bull; {customer?.phone}
                  </p>
                </div>
              </div>
            </div>

            {/* Locker Box */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Physical Locker Unit
              </span>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-black text-slate-900 text-sm">
                    Locker #{locker?.lockerNumber} (Size {locker?.size})
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {locker?.rackNumber} &bull; {locker?.section || 'Main Vault'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Billing Dates & Cycle */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono">
            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
              <span className="text-[9px] font-sans text-slate-500 block font-bold">ISSUE DATE</span>
              <strong className="text-slate-900 text-xs">
                {new Date(invoice.issueDate).toLocaleDateString('en-IN')}
              </strong>
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
              <span className="text-[9px] font-sans text-slate-500 block font-bold">DUE DATE</span>
              <strong className="text-rose-600 text-xs">
                {new Date(invoice.dueDate).toLocaleDateString('en-IN')}
              </strong>
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
              <span className="text-[9px] font-sans text-slate-500 block font-bold">BILLING CYCLE</span>
              <strong className="text-slate-900 text-xs">{invoice.billingCycle}</strong>
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
              <span className="text-[9px] font-sans text-slate-500 block font-bold">AGREEMENT</span>
              <strong className="text-blue-700 text-xs">
                {allocation?.allocationCode || 'ALC-DIRECT'}
              </strong>
            </div>
          </div>

          {/* Financial Breakdown Table */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-2xs">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-2 border-b border-slate-100 flex items-center justify-between">
              <span>Financial Tariff Breakdown</span>
              <span className="text-slate-400 font-normal lowercase">Frozen Tariff Snapshot</span>
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Base Locker Rent (Annual)</span>
                <span className="font-mono font-bold text-slate-900">
                  ₹{invoice.baseRent.toLocaleString('en-IN')}
                </span>
              </div>

              {invoice.lateFee > 0 && (
                <div className="flex items-center justify-between text-rose-600">
                  <span>Late Penalty Fee</span>
                  <span className="font-mono font-bold">
                    +₹{invoice.lateFee.toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              {invoice.discount > 0 && (
                <div className="flex items-center justify-between text-emerald-600">
                  <span>Tariff Discount</span>
                  <span className="font-mono font-bold">
                    -₹{invoice.discount.toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              {invoice.otherCharges > 0 && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>Miscellaneous Charges</span>
                  <span className="font-mono font-bold">
                    +₹{invoice.otherCharges.toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              {invoice.taxAmount > 0 && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>GST / Tax Amount</span>
                  <span className="font-mono font-bold">
                    +₹{invoice.taxAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-black text-slate-900">
                <span>Total Invoiced Amount</span>
                <span className="font-mono text-base text-blue-700">
                  ₹{invoice.totalAmount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-emerald-700 font-bold">Paid to Date:</span>
                <span className="font-mono font-bold text-emerald-700">
                  ₹{invoice.paidAmount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-rose-600 font-bold">Balance Outstanding:</span>
                <span className="font-mono font-black text-rose-600 text-sm">
                  ₹{invoice.balanceAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Recorded Payment Settlements */}
          {invoicePayments && invoicePayments.length > 0 && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2.5 shadow-2xs">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-1.5 border-b border-slate-100 flex items-center justify-between">
                <span>Recorded Payment Receipts ({invoicePayments.length})</span>
                <span className="text-emerald-700 font-mono font-bold">
                  Total Paid: ₹{invoice.paidAmount.toLocaleString('en-IN')}
                </span>
              </h3>

              <div className="divide-y divide-slate-100">
                {invoicePayments.map((p) => (
                  <div key={p._id} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="font-mono text-slate-900">{p.receiptNumber}</strong>
                        <PaymentMethodBadge method={p.paymentMethod} />
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {new Date(p.paymentDate).toLocaleDateString('en-IN')} &bull; Pay #{p.paymentNumber} &bull; By {p.recordedBy?.name || 'Staff'}
                      </span>
                    </div>

                    <div className="text-right">
                      <strong className="font-mono text-emerald-700 text-sm block">
                        ₹{p.amount.toLocaleString('en-IN')}
                      </strong>
                      <TransactionStatusBadge status={p.paymentStatus} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes / Remarks */}
          {invoice.notes && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 leading-relaxed text-xs">
              <strong className="text-slate-800 block mb-0.5">Notes & Legacy Ledger Reference:</strong>
              <span>{invoice.notes}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl cursor-pointer">
            Close
          </Button>

          <div className="flex items-center gap-2">
            {invoice.balanceAmount > 0 && invoice.status !== 'CANCELLED' && canPay && onRecordPayment && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onClose();
                  onRecordPayment(invoice);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
              >
                <IndianRupee className="w-3.5 h-3.5" />
                <span>Record Payment</span>
              </Button>
            )}

            {invoice.paymentStatus === 'UNPAID' && invoice.status !== 'CANCELLED' && canCreate && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCancelModalOpen(true)}
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Cancel Invoice</span>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handlePrintInvoice}
              disabled={isPrinting}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center gap-1.5 text-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isPrinting ? 'Opening Print...' : 'Print Invoice'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Sub-Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 shrink-0 border border-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Cancel Invoice {invoice.invoiceNumber}?
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  This will cancel the unpaid statement. It cannot be reversed without issuing a new renewal cycle.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Cancellation Reason</label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Agreement restructured / Duplicate entry"
                className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelModalOpen(false)}
                disabled={isCancelling}
                className="rounded-xl"
              >
                Go Back
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="rounded-xl font-bold"
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}
