import React, { useState } from 'react';
import { DepositTransaction, DepositTransactionType } from '../types';
import { DepositTypeBadge, DepositTxStatusBadge } from './DepositStatusBadge';
import { Receipt, Search, Filter, RefreshCw, XCircle, ArrowUpDown } from 'lucide-react';

interface DepositLedgerTableProps {
  transactions: DepositTransaction[];
  isLoading: boolean;
  onRefresh: () => void;
  onViewReceipt: (transaction: DepositTransaction) => void;
  onCancelTransaction: (transaction: DepositTransaction) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  search: string;
  onSearchChange: (search: string) => void;
  selectedType: DepositTransactionType | '';
  onTypeChange: (type: DepositTransactionType | '') => void;
}

export const DepositLedgerTable: React.FC<DepositLedgerTableProps> = ({
  transactions,
  isLoading,
  onRefresh,
  onViewReceipt,
  onCancelTransaction,
  currentPage,
  totalPages,
  onPageChange,
  search,
  onSearchChange,
  selectedType,
  onTypeChange,
}) => {
  const [selectedTxForCancel, setSelectedTxForCancel] = useState<DepositTransaction | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const typeOptions: { value: DepositTransactionType | ''; label: string }[] = [
    { value: '', label: 'All Transactions' },
    { value: 'DEPOSIT_RECEIVED', label: 'Deposits Received' },
    { value: 'DEPOSIT_ADJUSTMENT_ADD', label: 'Additions (+)' },
    { value: 'DEPOSIT_ADJUSTMENT_DEDUCT', label: 'Damage Deductions (-)' },
    { value: 'REFUND_ISSUED', label: 'Refunds Disbursed' },
    { value: 'LEGACY_IMPORT', label: 'Legacy Imports' },
  ];

  return (
    <div className="space-y-4">
      {/* Controls Ribbon */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex-1 flex flex-col sm:flex-row gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Tx #, Receipt #, Customer, Locker..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 text-sm text-white placeholder:text-slate-500 outline-none transition-all"
            />
          </div>

          {/* Type filter */}
          <div className="relative min-w-[200px]">
            <select
              value={selectedType}
              onChange={(e) => onTypeChange(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 focus:border-cyan-500/50 text-sm text-slate-200 outline-none transition-all appearance-none cursor-pointer"
            >
              {typeOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
            <Filter className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Action button */}
        <button
          onClick={onRefresh}
          className="px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white flex items-center justify-center space-x-2 text-sm font-medium transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Table Container */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs uppercase font-semibold tracking-wider text-slate-400 border-b border-slate-800/80">
              <tr>
                <th className="py-3.5 px-4">Transaction Details</th>
                <th className="py-3.5 px-4">Customer & Locker</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4 text-right">Amount</th>
                <th className="py-3.5 px-4">Method / Ref</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" />
                    Loading deposit ledger transactions...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No deposit transactions found matching filters.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const isDebit = ['DEPOSIT_ADJUSTMENT_DEDUCT', 'REFUND_ISSUED'].includes(
                    tx.transactionType
                  );

                  return (
                    <tr key={tx._id} className="hover:bg-slate-800/30 transition-colors group">
                      {/* Tx Details */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-medium text-cyan-400 text-xs">
                          {tx.depositTransactionNumber}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {new Date(tx.transactionDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        {tx.notes && (
                          <div className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                            {tx.notes}
                          </div>
                        )}
                      </td>

                      {/* Customer & Locker */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-white">
                          {tx.customerId?.fullName || 'N/A'}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center space-x-1.5 mt-0.5">
                          <span className="font-mono text-cyan-300">
                            {tx.customerId?.customerCode}
                          </span>
                          <span>•</span>
                          <span className="bg-slate-800 px-1.5 py-0.2 rounded text-[11px] text-slate-300 font-semibold">
                            Locker {tx.lockerId?.lockerNumber || 'N/A'}
                          </span>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-4">
                        <DepositTypeBadge type={tx.transactionType} size="sm" />
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`font-semibold font-mono text-base ${
                            isDebit ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {isDebit ? '-' : '+'}₹{tx.amount.toLocaleString('en-IN')}
                        </span>
                      </td>

                      {/* Method / Ref */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-medium text-slate-300">
                          {tx.paymentMethod || 'N/A'}
                        </div>
                        {tx.transactionReference && (
                          <div className="text-[11px] font-mono text-slate-400 truncate max-w-[140px]">
                            {tx.transactionReference}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <DepositTxStatusBadge status={tx.status} />
                        {tx.status === 'CANCELLED' && tx.cancellationReason && (
                          <div className="text-[10px] text-rose-400/80 truncate max-w-[120px] mt-0.5">
                            {tx.cancellationReason}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          {/* Receipt */}
                          <button
                            onClick={() => onViewReceipt(tx)}
                            title="View Caution Deposit Receipt"
                            className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 transition-all"
                          >
                            <Receipt className="w-4 h-4" />
                          </button>

                          {/* Cancel if completed */}
                          {tx.status === 'COMPLETED' && (
                            <button
                              onClick={() => onCancelTransaction(tx)}
                              title="Soft Cancel Transaction"
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex space-x-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-all"
              >
                Previous
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
