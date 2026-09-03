import React, { useState, useEffect } from 'react';
import { depositApi } from '../features/deposits/api/depositApi';
import {
  DepositTransaction,
  RefundRequest,
  DepositStats,
  DepositTransactionType,
  RefundStatus,
} from '../features/deposits/types';
import { DepositSummaryCards } from '../features/deposits/components/DepositSummaryCards';
import { DepositLedgerTable } from '../features/deposits/components/DepositLedgerTable';
import { RefundTable } from '../features/deposits/components/RefundTable';
import { CollectDepositModal } from '../features/deposits/components/CollectDepositModal';
import { AdjustDepositModal } from '../features/deposits/components/AdjustDepositModal';
import { CreateRefundModal } from '../features/deposits/components/CreateRefundModal';
import { RefundApprovalModal } from '../features/deposits/components/RefundApprovalModal';
import { RefundPaymentModal } from '../features/deposits/components/RefundPaymentModal';
import { DepositReceiptModal } from '../features/deposits/components/DepositReceiptModal';
import {
  ShieldCheck,
  ArrowUpRight,
  SlidersHorizontal,
  PlusCircle,
  Clock,
  Layers,
  XCircle,
  FileCheck2,
  CheckCircle2,
  X,
} from 'lucide-react';

import { useDebounce } from '../hooks/useDebounce';

export const DepositsRefundsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'REFUNDS'>('LEDGER');
  const [notice, setNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState<DepositStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Ledger state
  const [transactions, setTransactions] = useState<DepositTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const debouncedLedgerSearch = useDebounce(ledgerSearch, 300);
  const [selectedType, setSelectedType] = useState<DepositTransactionType | ''>('');

  // Refunds state
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [loadingRefunds, setLoadingRefunds] = useState(false);
  const [refundsPage, setRefundsPage] = useState(1);
  const [refundsTotalPages, setRefundsTotalPages] = useState(1);
  const [refundsSearch, setRefundsSearch] = useState('');
  const debouncedRefundsSearch = useDebounce(refundsSearch, 300);
  const [selectedRefundStatus, setSelectedRefundStatus] = useState<RefundStatus | ''>('');

  // Modals state
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isCreateRefundModalOpen, setIsCreateRefundModalOpen] = useState(false);
  const [reviewingRefundId, setReviewingRefundId] = useState<string | null>(null);
  const [payingRefund, setPayingRefund] = useState<RefundRequest | null>(null);
  const [receiptTransaction, setReceiptTransaction] = useState<DepositTransaction | null>(null);

  // Cancel Transaction dialog state
  const [cancellingTx, setCancellingTx] = useState<DepositTransaction | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Load stats
  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await depositApi.getDepositStats();
      setStats(res);
    } catch (err: any) {
      console.error('Failed to fetch deposit stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Load transactions
  const fetchTransactions = async () => {
    try {
      setLoadingTransactions(true);
      const res = await depositApi.getDepositTransactions({
        page: ledgerPage,
        limit: 20,
        search: debouncedLedgerSearch.trim() || undefined,
        transactionType: selectedType || undefined,
      });
      setTransactions(res.transactions);
      setLedgerTotalPages(res.pagination.totalPages);
    } catch (err: any) {
      setErrorNotice('Failed to load deposit ledger');
    } finally {
      setLoadingTransactions(false);
    }
  };

  // Load refunds
  const fetchRefunds = async () => {
    try {
      setLoadingRefunds(true);
      const res = await depositApi.getRefunds({
        page: refundsPage,
        limit: 20,
        search: debouncedRefundsSearch.trim() || undefined,
        status: selectedRefundStatus || undefined,
      });
      setRefunds(res.refunds);
      setRefundsTotalPages(res.pagination.totalPages);
    } catch (err: any) {
      setErrorNotice('Failed to load refund requests');
    } finally {
      setLoadingRefunds(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    setLedgerPage(1);
  }, [debouncedLedgerSearch, selectedType]);

  useEffect(() => {
    setRefundsPage(1);
  }, [debouncedRefundsSearch, selectedRefundStatus]);

  useEffect(() => {
    if (activeTab === 'LEDGER') {
      fetchTransactions();
    }
  }, [activeTab, ledgerPage, debouncedLedgerSearch, selectedType]);

  useEffect(() => {
    if (activeTab === 'REFUNDS') {
      fetchRefunds();
    }
  }, [activeTab, refundsPage, debouncedRefundsSearch, selectedRefundStatus]);

  // Cancel deposit transaction execution
  const handleConfirmCancelTx = async () => {
    if (!cancellingTx) return;

    if (!cancelReason || cancelReason.trim().length < 3) {
      setErrorNotice('Cancellation reason is required');
      return;
    }

    try {
      setSubmittingCancel(true);
      await depositApi.cancelDepositTransaction(cancellingTx._id, cancelReason.trim());
      setNotice('Deposit transaction cancelled successfully');
      setCancellingTx(null);
      setCancelReason('');
      fetchTransactions();
      fetchStats();
    } catch (err: any) {
      setErrorNotice(err?.response?.data?.message || 'Failed to cancel deposit transaction');
    } finally {
      setSubmittingCancel(false);
    }
  };

  // Submit draft refund
  const handleSubmitDraft = async (refund: RefundRequest) => {
    try {
      await depositApi.submitRefund(refund._id);
      setNotice(`Refund request ${refund.refundNumber} submitted for approval`);
      fetchRefunds();
      fetchStats();
    } catch (err: any) {
      setErrorNotice(err?.response?.data?.message || 'Failed to submit refund');
    }
  };

  // Cancel refund request
  const handleCancelRefund = async (refund: RefundRequest) => {
    const reason = window.prompt('Enter reason for cancelling this refund request:');
    if (!reason || reason.trim().length < 3) return;

    try {
      await depositApi.cancelRefund(refund._id, { cancellationReason: reason.trim() });
      setNotice('Refund request cancelled');
      fetchRefunds();
      fetchStats();
    } catch (err: any) {
      setErrorNotice(err?.response?.data?.message || 'Failed to cancel refund request');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notice Banners */}
      {notice && (
        <div
          role="status"
          className="fixed right-4 top-20 z-[110] flex max-w-sm items-center gap-3 rounded-2xl border border-emerald-500/30 bg-slate-900 p-3 text-xs font-semibold text-emerald-300 shadow-2xl"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="grid h-7 w-7 place-items-center rounded-lg hover:bg-slate-800 cursor-pointer text-slate-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorNotice && (
        <div
          role="status"
          className="fixed right-4 top-20 z-[110] flex max-w-sm items-center gap-3 rounded-2xl border border-rose-500/30 bg-slate-900 p-3 text-xs font-semibold text-rose-300 shadow-2xl"
        >
          <XCircle className="h-5 w-5 shrink-0 text-rose-400" />
          <span className="flex-1">{errorNotice}</span>
          <button
            type="button"
            onClick={() => setErrorNotice(null)}
            className="grid h-7 w-7 place-items-center rounded-lg hover:bg-slate-800 cursor-pointer text-slate-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
            <span>Caution Money & Refund Desk</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Deposit ledger, damage adjustments, and Maker-Checker refund authorization
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setIsCollectModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Collect Deposit</span>
          </button>

          <button
            onClick={() => setIsAdjustModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all flex items-center space-x-1.5"
          >
            <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
            <span>Adjust Deposit</span>
          </button>

          <button
            onClick={() => setIsCreateRefundModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-semibold transition-all flex items-center space-x-1.5"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Request Refund</span>
          </button>
        </div>
      </div>

      {/* Top 4 Summary Cards */}
      <DepositSummaryCards
        stats={stats}
        isLoading={loadingStats}
        onFilterClick={(cardId) => {
          if (cardId === 'pendingRefunds') {
            setActiveTab('REFUNDS');
            setSelectedRefundStatus('PENDING_APPROVAL');
          }
        }}
      />

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-6">
        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`pb-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-all ${
            activeTab === 'LEDGER'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Security Deposit Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('REFUNDS')}
          className={`pb-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-all ${
            activeTab === 'REFUNDS'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Refund Requests (Maker-Checker)</span>
          {(stats?.pendingRefundCount ?? 0) > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 ml-1.5 animate-pulse">
              {stats?.pendingRefundCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'LEDGER' ? (
        <DepositLedgerTable
          transactions={transactions}
          isLoading={loadingTransactions}
          onRefresh={() => {
            fetchTransactions();
            fetchStats();
          }}
          onViewReceipt={(tx) => setReceiptTransaction(tx)}
          onCancelTransaction={(tx) => setCancellingTx(tx)}
          currentPage={ledgerPage}
          totalPages={ledgerTotalPages}
          onPageChange={setLedgerPage}
          search={ledgerSearch}
          onSearchChange={setLedgerSearch}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
        />
      ) : (
        <RefundTable
          refunds={refunds}
          isLoading={loadingRefunds}
          onRefresh={() => {
            fetchRefunds();
            fetchStats();
          }}
          onSubmitDraft={handleSubmitDraft}
          onReviewRefund={(refund) => setReviewingRefundId(refund._id)}
          onPayRefund={(refund) => setPayingRefund(refund)}
          onCancelRefund={handleCancelRefund}
          currentPage={refundsPage}
          totalPages={refundsTotalPages}
          onPageChange={setRefundsPage}
          search={refundsSearch}
          onSearchChange={setRefundsSearch}
          selectedStatus={selectedRefundStatus}
          onStatusChange={setSelectedRefundStatus}
        />
      )}

      {/* Collect Deposit Modal */}
      <CollectDepositModal
        isOpen={isCollectModalOpen}
        onClose={() => setIsCollectModalOpen(false)}
        allocationId={transactions[0]?.allocationId?._id}
        onSuccess={(result) => {
          fetchTransactions();
          fetchStats();
          if (result?.transaction) {
            setReceiptTransaction(result.transaction);
          }
        }}
      />

      {/* Adjust Deposit Modal */}
      <AdjustDepositModal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        allocationId={transactions[0]?.allocationId?._id}
        onSuccess={() => {
          fetchTransactions();
          fetchStats();
        }}
      />

      {/* Create Refund Modal */}
      <CreateRefundModal
        isOpen={isCreateRefundModalOpen}
        onClose={() => setIsCreateRefundModalOpen(false)}
        allocationId={transactions[0]?.allocationId?._id}
        onSuccess={() => {
          fetchRefunds();
          fetchStats();
          setActiveTab('REFUNDS');
        }}
      />

      {/* Refund Approval Modal (Maker-Checker) */}
      <RefundApprovalModal
        isOpen={Boolean(reviewingRefundId)}
        onClose={() => setReviewingRefundId(null)}
        refundId={reviewingRefundId}
        onSuccess={() => {
          fetchRefunds();
          fetchStats();
        }}
      />

      {/* Refund Payment Modal */}
      <RefundPaymentModal
        isOpen={Boolean(payingRefund)}
        onClose={() => setPayingRefund(null)}
        refund={payingRefund}
        onSuccess={(result) => {
          fetchRefunds();
          fetchStats();
          if (result?.transaction) {
            setReceiptTransaction(result.transaction);
          }
        }}
      />

      {/* Deposit Caution Receipt Modal */}
      <DepositReceiptModal
        isOpen={Boolean(receiptTransaction)}
        onClose={() => setReceiptTransaction(null)}
        transaction={receiptTransaction}
      />

      {/* Soft Cancel Transaction Modal Dialog */}
      {cancellingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <XCircle className="w-6 h-6" />
              <h3 className="text-base font-semibold text-white">Cancel Deposit Transaction</h3>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to cancel transaction{' '}
              <span className="font-mono text-cyan-400">{cancellingTx.depositTransactionNumber}</span>{' '}
              for ₹{cancellingTx.amount.toLocaleString('en-IN')}? This action is audited and cannot be undone.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mandatory Cancellation Reason *
              </label>
              <textarea
                rows={2}
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-rose-500/40 text-xs text-white outline-none"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCancellingTx(null);
                  setCancelReason('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelTx}
                disabled={submittingCancel}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default DepositsRefundsPage;
