import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Shield,
  CheckCircle2,
  Receipt,
  Download,
  Building2,
  QrCode,
  Copy,
  Check,
  Ban,
  FileText,
  KeyRound,
  UserCheck,
  Calendar,
  Lock,
} from 'lucide-react';
import { Payment } from '../types';
import { Button } from '../../../components/ui/button';

import { paymentApi } from '../api/paymentApi';

interface PaymentReceiptModalProps {
  payment: Payment;
  onClose: () => void;
}

// Convert amount to Indian currency words
function numberToWordsINR(amount: number): string {
  const a = [
    '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ',
    'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ',
    'Seventeen ', 'Eighteen ', 'Nineteen '
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const num = Math.floor(amount);
  if (num === 0) return 'Zero Rupees Only';

  const inWords = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : ' ');
    if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + (n % 100 !== 0 ? inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 !== 0 ? inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 !== 0 ? inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 !== 0 ? inWords(n % 10000000) : '');
  };

  return `Rupees ${inWords(num).trim()} Only`;
}

export function PaymentReceiptModal({
  payment,
  onClose,
}: PaymentReceiptModalProps) {
  const customer = payment.customerId;
  const locker = payment.lockerId;
  const invoice = payment.invoiceId;
  const allocation = payment.allocationId;
  const [copied, setCopied] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const isCancelled = payment.paymentStatus === 'CANCELLED';

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      // 1. Fetch clean backend-generated bank receipt HTML
      const receiptHtml = await paymentApi.getReceiptHtml(payment._id);

      // 2. Print via isolated iframe to guarantee no surrounding UI artifacts
      let iframe = document.getElementById('receipt-print-iframe') as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'receipt-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
      }

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(receiptHtml);
        doc.close();
        iframe.contentWindow?.focus();
        setTimeout(() => {
          iframe.contentWindow?.print();
          setIsPrinting(false);
        }, 300);
      } else {
        window.print();
        setIsPrinting(false);
      }
    } catch {
      window.print();
      setIsPrinting(false);
    }
  };

  const handleCopyReceipt = () => {
    const summary = `MSS LOCKER OFFICIAL RECEIPT\nReceipt #: ${payment.receiptNumber}\nPayment Ref: ${payment.paymentNumber}\nCustomer: ${customer?.fullName || 'N/A'} (${customer?.customerCode || 'N/A'})\nLocker: #${locker?.lockerNumber || 'N/A'} (Size ${locker?.size || 'N/A'})\nAmount Paid: INR ${payment.amount.toLocaleString('en-IN')}\nDate: ${new Date(payment.paymentDate).toLocaleDateString('en-IN')}\nMode: ${payment.paymentMethod}`;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[120] w-screen h-screen flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md select-none animate-in fade-in-0 duration-150 print:p-0 print:bg-white"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-slate-200 print:border-none print:shadow-none print:max-h-full print:rounded-none animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Screen only */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/90 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
              <Receipt className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  Official Payment Receipt
                </h2>
                {isCancelled && (
                  <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold text-[10px] uppercase">
                    Cancelled
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-mono">
                {payment.receiptNumber} &bull; {payment.paymentNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyReceipt}
              className="rounded-xl h-9 px-3 text-xs font-semibold gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </Button>

            <Button
              size="sm"
              onClick={handlePrint}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center gap-1.5 text-xs h-9 px-4 cursor-pointer shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </Button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Canvas */}
        <div className="p-6 sm:p-8 space-y-5 overflow-y-auto flex-1 text-xs text-slate-950 bg-white font-sans relative">
          {/* Cancellation Watermark if applicable */}
          {isCancelled && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <div className="text-rose-600/15 font-black text-5xl sm:text-6xl -rotate-12 border-8 border-rose-600/15 px-8 py-4 rounded-2xl uppercase tracking-widest select-none">
                CANCELLED / VOID
              </div>
            </div>
          )}

          {/* Business Header with Trust Badges */}
          <div className="flex items-start justify-between border-b-2 border-slate-950 pb-4">
            <div className="space-y-1">
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-950">
                  MSS LOCKER
                </h1>
                <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Safe-Deposit Locker Vault & Custody Services
                </p>
              </div>
              <div className="text-[10px] text-slate-600 pt-0.5 space-y-0.5">
                <p>Main Branch Vault &bull; 24x7 Armed Security Custody</p>
                <p className="font-mono text-[9.5px] text-slate-500">
                  Branch Code: VL-MUM-01 &bull; GSTIN: 27AAAAA0000A1Z5
                </p>
              </div>
            </div>

            <div className="text-right space-y-1">
              <div
                className={`inline-block px-3 py-1 font-bold text-xs uppercase tracking-wider border ${
                  isCancelled
                    ? 'border-rose-600 bg-rose-50 text-rose-800'
                    : 'border-slate-950 bg-slate-100 text-slate-950'
                }`}
              >
                {isCancelled ? 'CANCELLED RECEIPT' : 'OFFICIAL PAYMENT RECEIPT'}
              </div>
              <p className="font-mono text-base font-black text-slate-950">
                {payment.receiptNumber}
              </p>
              <div className="text-[11px] font-mono text-slate-700">
                <span>Date: </span>
                <strong>
                  {new Date(payment.paymentDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </strong>
              </div>
            </div>
          </div>

          {/* Customer & Locker Dual Column */}
          <div className="grid grid-cols-2 gap-0 border border-slate-950 divide-x divide-slate-950">
            <div className="p-3 space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                Verified Tenant Information
              </span>
              <p className="font-black text-sm text-slate-950">
                {customer?.fullName || 'Customer Record'}
              </p>
              <p className="text-xs text-slate-800 font-mono">
                Code: <strong>{customer?.customerCode}</strong> &bull; Phone: {customer?.phone}
              </p>
              {customer?.address && (
                <p className="text-[11px] text-slate-600 truncate">
                  {customer.address}, {customer.city}
                </p>
              )}
            </div>

            <div className="p-3 space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                Allocated Locker Coordinates
              </span>
              <p className="font-black text-sm text-slate-950">
                Locker #{locker?.lockerNumber} (Size {locker?.size || 'STD'})
              </p>
              <p className="text-xs text-slate-800">
                {locker?.rackNumber} &bull; {locker?.section || 'Main Vault'}
              </p>
              <p className="text-[11px] text-slate-600 font-mono">
                Agreement: {allocation?.allocationCode || 'N/A'}
              </p>
            </div>
          </div>

          {/* Transaction Line Items Table */}
          <div className="border border-slate-950 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-[10px] text-slate-800 font-bold border-b border-slate-950 uppercase">
                <tr>
                  <th className="p-2.5 border-r border-slate-950">Particulars / Description</th>
                  <th className="p-2.5 border-r border-slate-950">Reference / Mode</th>
                  <th className="p-2.5 text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-950 font-medium text-xs">
                <tr>
                  <td className="p-2.5 border-r border-slate-950">
                    <strong className="text-slate-950 block text-xs">
                      Safe-Deposit Locker Periodic Tenancy / Renewal Rent
                    </strong>
                    <span className="text-[10px] text-slate-600 block mt-0.5 font-sans">
                      Invoice Ref: <strong className="font-mono">{invoice?.invoiceNumber || 'INV-DIRECT'}</strong>
                    </span>
                  </td>
                  <td className="p-2.5 border-r border-slate-950 font-mono text-[11px]">
                    <strong className="text-slate-950 block">{payment.paymentMethod}</strong>
                    {payment.upiReference && <span className="text-[10px] text-slate-600 block">UPI: {payment.upiReference}</span>}
                    {payment.bankReference && <span className="text-[10px] text-slate-600 block">UTR: {payment.bankReference}</span>}
                    {payment.transactionReference && <span className="text-[10px] text-slate-600 block">Txn: {payment.transactionReference}</span>}
                    {payment.chequeNumber && <span className="text-[10px] text-slate-600 block">Cheque #{payment.chequeNumber}</span>}
                  </td>
                  <td className="p-2.5 text-right font-black font-mono text-base text-slate-950">
                    ₹{payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Financial Totals & Words Box */}
          <div className="p-3.5 border border-slate-950 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider block">
                  Amount in Words:
                </span>
                <p className="font-bold text-slate-950 text-xs italic">
                  {numberToWordsINR(payment.amount)}
                </p>
              </div>

              <div className="text-right font-mono">
                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider block">
                  Net Amount Received
                </span>
                <span className="text-2xl font-black text-slate-950">
                  ₹{payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Reconciliation metadata row */}
            <div className="pt-2 border-t border-dashed border-slate-400 flex items-center justify-between text-[10.5px] text-slate-700 font-mono flex-wrap gap-2">
              <div>
                <span>Payment Ref: </span>
                <strong className="text-slate-950">{payment.paymentNumber}</strong>
              </div>

              {invoice?.balanceAmount !== undefined && (
                <div>
                  <span>Remaining Balance: </span>
                  <strong className="text-slate-950">
                    ₹{Number(invoice.balanceAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              )}

              <div>
                <span>Cashier: </span>
                <strong className="text-slate-950">{payment.recordedBy?.name || 'Vault Cashier'}</strong>
              </div>
            </div>
          </div>

          {/* Cancellation Notice if cancelled */}
          {isCancelled && (
            <div className="p-2.5 border border-rose-600 bg-rose-50 text-rose-900 text-xs flex items-start gap-2">
              <Ban className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Audit Reversal Notice</strong>
                <p className="text-[11px]">
                  This transaction was cancelled on{' '}
                  {payment.cancelledAt ? new Date(payment.cancelledAt).toLocaleString('en-IN') : 'N/A'}. Reason: {payment.cancellationReason || 'Administrative cancellation'}.
                </p>
              </div>
            </div>
          )}

          {/* Custody Terms */}
          <div className="p-2.5 border border-slate-300 text-[10px] text-slate-600 space-y-0.5">
            <strong className="text-slate-800 block text-[10.5px]">Terms & Conditions:</strong>
            <p>1. Official receipt acknowledging payment towards safe deposit locker rental and custodial maintenance.</p>
            <p>2. Locker access requires active KYC and biometric/key verification during vault operating hours.</p>
          </div>

          {/* Signatures */}
          <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
            <div className="space-y-1">
              <div className="border-b border-slate-950 h-8 w-40 mx-auto" />
              <span className="text-[9.5px] text-slate-700 uppercase font-bold tracking-wider block">
                Customer Signature
              </span>
            </div>

            <div className="space-y-1">
              <div className="border-b border-slate-950 h-8 flex items-center justify-center">
                <span className="text-[9.5px] text-slate-900 font-bold uppercase tracking-wider border border-dashed border-slate-950 px-2 py-0.5">
                  [ DIGITALLY VERIFIED & RECORDED ]
                </span>
              </div>
              <span className="text-[9.5px] text-slate-700 uppercase font-bold tracking-wider block">
                Authorized Vault Cashier
              </span>
            </div>
          </div>

          {/* Legal Compliance Footer */}
          <div className="pt-2 border-t border-slate-200 text-center space-y-0.5 text-[9.5px] text-slate-500">
            <p>
              This is a computer-generated official receipt issued by MSS Locker safe deposit locker system.
            </p>
            <p className="font-mono">
              Receipt Hash: {payment._id?.slice(-12).toUpperCase()} &bull; Generated: {new Date(payment.createdAt).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
