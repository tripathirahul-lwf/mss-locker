import React, { useRef } from 'react';
import { DepositTransaction } from '../types';
import { X, Printer, ShieldCheck, CheckCircle2, Building2 } from 'lucide-react';

interface DepositReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: DepositTransaction | null;
}

export const DepositReceiptModal: React.FC<DepositReceiptModalProps> = ({
  isOpen,
  onClose,
  transaction,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  const isDebit = ['DEPOSIT_ADJUSTMENT_DEDUCT', 'REFUND_ISSUED'].includes(
    transaction.transactionType
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white">
      <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden my-8 print:border-none print:shadow-none print:bg-white print:text-black">
        {/* Modal Controls (Hidden in Print) */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 print:hidden">
          <div className="flex items-center space-x-2 text-white text-sm font-semibold">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>Caution Deposit / Refund Receipt</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md shadow-cyan-600/20"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div ref={receiptRef} className="p-8 space-y-6 text-slate-200 print:text-black print:p-6">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-800 print:border-gray-300 pb-5">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-white print:text-black">
                <Building2 className="w-6 h-6 text-cyan-400 print:text-gray-800" />
                <h1 className="text-xl font-bold tracking-tight">MSS LOCKER</h1>
              </div>
              <p className="text-xs text-slate-400 print:text-gray-600">
                Safe Deposit Locker Systems & Financial Custody
              </p>
              <p className="text-[11px] text-slate-500 print:text-gray-500">
                Authorized Vault Operations Desk
              </p>
            </div>

            <div className="text-right space-y-1">
              <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 print:text-gray-800 print:border-gray-400 text-xs font-bold uppercase tracking-wider">
                {isDebit ? 'DEPOSIT REFUND VOUCHER' : 'CAUTION DEPOSIT RECEIPT'}
              </div>
              <div className="font-mono text-xs text-cyan-400 print:text-gray-800 font-semibold mt-1">
                {transaction.depositTransactionNumber}
              </div>
              <div className="text-[11px] text-slate-400 print:text-gray-600">
                Date: {new Date(transaction.transactionDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>

          {/* Customer & Locker Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/60 print:bg-gray-50 border border-slate-800 print:border-gray-200 text-xs">
            <div className="space-y-1">
              <span className="text-slate-500 print:text-gray-500 uppercase tracking-wider text-[10px] font-bold block">
                Customer Information
              </span>
              <div className="font-bold text-white print:text-black text-sm">
                {transaction.customerId?.fullName || 'N/A'}
              </div>
              <div className="font-mono text-cyan-300 print:text-gray-700">
                Code: {transaction.customerId?.customerCode}
              </div>
              <div className="text-slate-400 print:text-gray-600">
                Phone: {transaction.customerId?.phone}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-500 print:text-gray-500 uppercase tracking-wider text-[10px] font-bold block">
                Locker & Agreement
              </span>
              <div className="font-bold text-white print:text-black text-sm">
                Locker #{transaction.lockerId?.lockerNumber || 'N/A'} ({transaction.lockerId?.size || 'STD'})
              </div>
              <div className="font-mono text-slate-300 print:text-gray-700">
                Agreement: {transaction.allocationId?.allocationCode || 'N/A'}
              </div>
              {transaction.paymentId?.receiptNumber && (
                <div className="text-emerald-400 print:text-gray-700 font-mono text-[11px]">
                  Cashier Receipt #{transaction.paymentId.receiptNumber}
                </div>
              )}
            </div>
          </div>

          {/* Transaction Summary Line Items */}
          <div className="border border-slate-800 print:border-gray-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-950/80 print:bg-gray-100 text-slate-400 print:text-gray-700 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Transaction Description</th>
                  <th className="py-2.5 px-4">Payment Method</th>
                  <th className="py-2.5 px-4">Reference #</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 print:divide-gray-200">
                <tr>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-white print:text-black block">
                      {transaction.transactionType.replace(/_/g, ' ')}
                    </span>
                    {transaction.notes && (
                      <span className="text-[11px] text-slate-400 print:text-gray-600 block mt-0.5">
                        {transaction.notes}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-medium">{transaction.paymentMethod || 'COUNTER'}</td>
                  <td className="py-3 px-4 font-mono text-slate-400 print:text-gray-600">
                    {transaction.transactionReference || '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-sm text-emerald-400 print:text-black">
                    {isDebit ? '-' : '+'}₹{transaction.amount.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Total Amount Box */}
          <div className="p-4 rounded-xl bg-slate-950 print:bg-gray-100 border border-slate-800 print:border-gray-300 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 print:text-gray-700 uppercase tracking-wider">
              {isDebit ? 'Net Refund Amount Paid' : 'Total Caution Deposit Received'}
            </span>
            <span className="text-2xl font-bold font-mono text-white print:text-black">
              ₹{transaction.amount.toLocaleString('en-IN')}
            </span>
          </div>

          {/* Important Security Notice */}
          <div className="p-3 rounded-lg bg-slate-950/40 print:bg-transparent border border-slate-800/80 print:border-gray-200 text-[11px] text-slate-400 print:text-gray-600 space-y-1">
            <div className="font-semibold text-slate-300 print:text-black flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 print:text-black" />
              <span>Terms & Refundability Notice</span>
            </div>
            <p>
              This caution deposit is held in trust as financial security against the safe deposit locker. It is fully refundable upon locker surrender, subject to physical key return and clearance of all rental and incidental charges.
            </p>
          </div>

          {/* Signatures */}
          <div className="pt-10 grid grid-cols-2 gap-8 text-center text-xs text-slate-400 print:text-gray-700">
            <div className="space-y-1">
              <div className="border-b border-slate-700 print:border-gray-400 w-36 mx-auto mb-2" />
              <p className="font-semibold">Customer Signature</p>
            </div>
            <div className="space-y-1">
              <div className="border-b border-slate-700 print:border-gray-400 w-36 mx-auto mb-2" />
              <p className="font-semibold">Authorized Vault Cashier</p>
              <p className="text-[10px] text-slate-500 print:text-gray-500">
                {transaction.recordedBy?.name || 'Vault System'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
