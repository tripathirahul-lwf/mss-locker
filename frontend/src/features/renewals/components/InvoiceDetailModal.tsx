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
  Phone,
  ExternalLink,
} from 'lucide-react';
import { LockerInvoice } from '../types';
import { PaymentStatusBadge, DueStatusBadge } from './RenewalStatusBadge';
import { Button } from '../../../components/ui/button';
import { usePermission } from '../../../hooks/usePermission';
import { Link } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';
import { paymentApi } from '../../payments/api/paymentApi';
import { PaymentMethodBadge, PaymentStatusBadge as TransactionStatusBadge } from '../../payments/components/PaymentMethodBadge';
import { renewalApi } from '../api/renewalApi';
import { formatPhone } from '../../customers/utils/phoneFormatter';

function formatInvoiceDate(dateInput?: string | Date): string {
  if (!dateInput) return 'N/A';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const year = d.getFullYear();
  if (year > 100 && year < 1000) {
    d.setFullYear(2000 + (year % 100));
  }
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

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
    try {
      await renewalApi.printInvoicePdf(invoice._id, invoice.invoiceNumber);
    } catch (err: any) {
      console.error('Print invoice error:', err);
      window.alert('Failed to open invoice PDF. Please ensure server is running.');
    } finally {
      setIsPrinting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[120] w-screen h-screen flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs select-none animate-in fade-in-0 duration-150">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200/90 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-slate-100 bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs">
              <FileText className="w-5 h-5 text-emerald-800" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-semibold text-slate-900 tracking-tight font-sans">
                  {invoice.invoiceNumber}
                </h2>
                <button
                  type="button"
                  onClick={handleCopyInvoiceNumber}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
                  title="Copy Invoice Number"
                >
                  {copiedNumber ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                {invoice.invoiceType === 'LEGACY_IMPORT'
                  ? 'Historical Ledger Renewal Bill'
                  : 'Locker Tenancy Periodic Billing Statement'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs font-normal">
          {/* Status Bar */}
          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Payment State:
              </span>
              <PaymentStatusBadge status={invoice.paymentStatus} />
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Due Status:
              </span>
              <DueStatusBadge status={invoice.dueStatus} dueDate={invoice.dueDate} />
            </div>
          </div>

          {/* Customer & Locker Coordinates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Customer Box */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                  Billed Tenant Customer
                </span>
                {customer?._id && (
                  <Link
                    to={`/customers/${customer._id}`}
                    onClick={onClose}
                    className="text-emerald-800 hover:text-emerald-900 font-medium text-[11px] flex items-center gap-0.5"
                  >
                    <span>Profile</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-semibold font-sans text-xs flex items-center justify-center shrink-0 shadow-2xs">
                  {(customer?.fullName || 'CU').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-xs truncate font-sans">
                    {customer?.fullName || 'Customer Not Populated'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-sans tabular-nums truncate">
                    {customer?.customerCode} &bull; {formatPhone(customer?.phone || '')}
                  </p>
                </div>
              </div>
            </div>

            {/* Locker Box */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                  Physical Locker Unit
                </span>
                {locker?._id && (
                  <Link
                    to={`/lockers?search=${locker.lockerNumber}`}
                    onClick={onClose}
                    className="text-emerald-800 hover:text-emerald-900 font-medium text-[11px] flex items-center gap-0.5"
                  >
                    <span>Matrix</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 shrink-0 shadow-2xs">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-xs font-sans">
                    Locker #{locker?.lockerNumber} (Size {locker?.size})
                  </p>
                  <p className="text-[11px] text-slate-500 font-normal font-sans">
                    {locker?.rackNumber || 'Standard Rack'} &bull; {locker?.section || 'Main Vault'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Billing Dates & Cycle */}
          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center font-sans">
            <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[9.5px] text-slate-500 block uppercase font-medium">ISSUE DATE</span>
              <strong className="text-slate-900 text-xs font-medium tabular-nums">
                {formatInvoiceDate(invoice.issueDate)}
              </strong>
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[9.5px] text-slate-500 block uppercase font-medium">DUE DATE</span>
              <strong className="text-rose-700 text-xs font-medium tabular-nums">
                {formatInvoiceDate(invoice.dueDate)}
              </strong>
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[9.5px] text-slate-500 block uppercase font-medium">BILLING CYCLE</span>
              <strong className="text-slate-900 text-xs font-medium uppercase">{invoice.billingCycle}</strong>
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[9.5px] text-slate-500 block uppercase font-medium">AGREEMENT</span>
              {allocation?.allocationCode ? (
                <Link
                  to={`/allocations?search=${allocation.allocationCode}`}
                  onClick={onClose}
                  className="text-emerald-800 hover:text-emerald-950 text-xs font-medium tabular-nums block truncate"
                >
                  {allocation.allocationCode}
                </Link>
              ) : (
                <strong className="text-emerald-800 text-xs font-medium tabular-nums">
                  ALC-DIRECT
                </strong>
              )}
            </div>
          </div>

          {/* Financial Breakdown Table */}
          <div className="p-4 rounded-xl border border-slate-200/90 bg-white space-y-2.5 shadow-2xs font-sans">
            <h3 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] pb-2 border-b border-slate-100 flex items-center justify-between">
              <span>Financial Tariff Breakdown</span>
              <span className="text-slate-400 font-normal normal-case text-[10.5px]">Frozen Tariff Snapshot</span>
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Base Locker Rent (Annual)</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  ₹{invoice.baseRent.toLocaleString('en-IN')}
                </span>
              </div>

              {invoice.lateFee > 0 && (
                <div className="flex items-center justify-between text-rose-700">
                  <span>Late Penalty Fee</span>
                  <span className="font-semibold tabular-nums">
                    +₹{invoice.lateFee.toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              {invoice.discount > 0 && (
                <div className="flex items-center justify-between text-emerald-700">
                  <span>Tariff Discount</span>
                  <span className="font-semibold tabular-nums">
                    -₹{invoice.discount.toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              {invoice.otherCharges > 0 && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>Miscellaneous Charges</span>
                  <span className="font-semibold tabular-nums">
                    +₹{invoice.otherCharges.toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              {invoice.taxAmount > 0 && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>GST / Tax Amount</span>
                  <span className="font-semibold tabular-nums">
                    +₹{invoice.taxAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-semibold text-slate-900">
                <span>Total Invoiced Amount</span>
                <span className="text-base text-slate-900 tabular-nums">
                  ₹{invoice.totalAmount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-emerald-800 font-medium">Paid to Date:</span>
                <span className="font-semibold text-emerald-800 tabular-nums">
                  ₹{invoice.paidAmount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-rose-700 font-medium">Balance Outstanding:</span>
                <span className="font-semibold text-rose-700 text-sm tabular-nums">
                  ₹{invoice.balanceAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Recorded Payment Settlements */}
          {invoicePayments && invoicePayments.length > 0 && (
            <div className="p-4 rounded-xl bg-white border border-slate-200/90 space-y-2.5 shadow-2xs font-sans">
              <h3 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] pb-1.5 border-b border-slate-100 flex items-center justify-between">
                <span>Recorded Payment Receipts ({invoicePayments.length})</span>
                <span className="text-emerald-800 font-semibold tabular-nums">
                  Total Paid: ₹{invoice.paidAmount.toLocaleString('en-IN')}
                </span>
              </h3>

              <div className="divide-y divide-slate-100">
                {invoicePayments.map((p) => (
                  <div key={p._id} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="font-medium text-slate-900 tabular-nums">{p.receiptNumber}</strong>
                        <PaymentMethodBadge method={p.paymentMethod} />
                      </div>
                      <span className="text-[10.5px] text-slate-400 tabular-nums block font-normal">
                        {formatInvoiceDate(p.paymentDate)} &bull; Pay #{p.paymentNumber} &bull; By {p.recordedBy?.name || 'Staff'}
                      </span>
                    </div>

                    <div className="text-right">
                      <strong className="text-emerald-800 text-xs font-semibold tabular-nums block">
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
            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 text-slate-600 leading-relaxed text-xs">
              <strong className="text-slate-800 block mb-0.5 font-medium">Notes & Legacy Ledger Reference:</strong>
              <span className="font-normal">{invoice.notes}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-4.5 bg-slate-50/80 border-t border-slate-200/90 flex items-center justify-between gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl border-slate-300 font-medium text-xs h-9 px-3.5 hover:bg-slate-50 cursor-pointer"
          >
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
                className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium rounded-xl text-xs h-9 px-3.5 flex items-center gap-1.5 cursor-pointer shadow-xs"
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
                className="text-rose-700 hover:bg-rose-50 border-rose-200 rounded-xl text-xs h-9 px-3.5 font-medium flex items-center gap-1 cursor-pointer"
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
              className="bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl flex items-center gap-1.5 text-xs h-9 px-3.5 cursor-pointer shadow-xs"
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
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200 font-sans">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 shrink-0 border border-rose-200">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-900">
                  Cancel Invoice {invoice.invoiceNumber}?
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-normal">
                  This will cancel the unpaid statement. It cannot be reversed without issuing a new renewal cycle.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Cancellation Reason</label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Agreement restructured / Duplicate entry"
                className="w-full h-10 px-3 text-xs bg-slate-50/80 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-700 font-normal"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelModalOpen(false)}
                disabled={isCancelling}
                className="rounded-xl border-slate-300 font-medium text-xs h-9 px-3.5"
              >
                Go Back
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="rounded-xl font-medium text-xs h-9 px-3.5"
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
