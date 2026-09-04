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
  XCircle,
  FileCheck2,
  CheckCircle2,
  X,
} from 'lucide-react';

import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../context/AuthContext';
import { allocationApi } from '../features/allocations/api/allocationApi';
import { LockerAllocation } from '../features/allocations/types';

export const DepositsRefundsPage: React.FC = () => {
  const { hasPermission } = useAuth();
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
  const [cancellingRefund, setCancellingRefund] = useState<RefundRequest | null>(null);
  const [refundCancelReason, setRefundCancelReason] = useState('');
  const [submittingRefundCancel, setSubmittingRefundCancel] = useState(false);
  const [activeAllocations, setActiveAllocations] = useState<LockerAllocation[]>([]);
  const [selectedAllocationId, setSelectedAllocationId] = useState('');
  const [loadingAllocations, setLoadingAllocations] = useState(false);

  const canCollect = hasPermission('deposits.collect');
  const canAdjust = hasPermission('deposits.adjust');
  const canCreateRefund = hasPermission('refunds.create');
  const canReviewRefund = hasPermission('refunds.approve') || hasPermission('refunds.reject');
  const canPayRefund = hasPermission('refunds.pay');
  const canCancelRefund = hasPermission('refunds.cancel');
  const hasAccountAction = canCollect || canAdjust || canCreateRefund;

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
    if (!hasAccountAction) return;
    let active = true;
    setLoadingAllocations(true);
    allocationApi.getAllocations({ status: 'ACTIVE', page: 1, limit: 100 })
      .then((result) => {
        if (active) setActiveAllocations(result.allocations);
      })
      .catch(() => {
        if (active) setErrorNotice('Active customer-locker accounts could not be loaded');
      })
      .finally(() => {
        if (active) setLoadingAllocations(false);
      });
    return () => { active = false; };
  }, [hasAccountAction]);

  const openForSelectedAccount = (open: () => void) => {
    if (!selectedAllocationId) {
      setErrorNotice('Select a customer-locker account before starting this action');
      return;
    }
    open();
  };

  useEffect(() => {
    setLedgerPage(1);
  }, [debouncedLedgerSearch, selectedType]);

  useEffect(() => {
    setRefundsPage(1);
  }, [debouncedRefundsSearch, selectedRefundStatus]);

  useEffect(() => {
    fetchTransactions();
  }, [ledgerPage, debouncedLedgerSearch, selectedType]);

  useEffect(() => {
    fetchRefunds();
  }, [refundsPage, debouncedRefundsSearch, selectedRefundStatus]);

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
  const handleConfirmCancelRefund = async () => {
    if (!cancellingRefund || refundCancelReason.trim().length < 3) {
      setErrorNotice('Cancellation reason must contain at least 3 characters');
      return;
    }
    try {
      setSubmittingRefundCancel(true);
      await depositApi.cancelRefund(cancellingRefund._id, { cancellationReason: refundCancelReason.trim() });
      setNotice('Refund request cancelled');
      setCancellingRefund(null);
      setRefundCancelReason('');
      fetchRefunds();
      fetchStats();
    } catch (err: any) {
      setErrorNotice(err?.response?.data?.message || 'Failed to cancel refund request');
    } finally {
      setSubmittingRefundCancel(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notice Banners */}
      {notice && (
        <div
          role="status"
          className="fixed right-4 top-20 z-[110] flex max-w-sm items-center gap-3 rounded-xl border border-emerald-200 bg-white p-3 text-xs font-semibold text-emerald-800 shadow-xl"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss success message"
            className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorNotice && (
        <div
          role="alert"
          className="fixed right-4 top-20 z-[110] flex max-w-sm items-center gap-3 rounded-xl border border-rose-200 bg-white p-3 text-xs font-semibold text-rose-800 shadow-xl"
        >
          <XCircle className="h-5 w-5 shrink-0 text-rose-400" />
          <span className="flex-1">{errorNotice}</span>
          <button
            type="button"
            onClick={() => setErrorNotice(null)}
            aria-label="Dismiss error message"
            className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h3 className="flex items-center space-x-2 text-lg font-bold tracking-tight text-slate-950">
            <ShieldCheck className="h-6 w-6 text-emerald-700" />
            <span>Caution Money & Refund Desk</span>
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Deposit ledger, damage adjustments, and Maker-Checker refund authorization
          </p>
        </div>

        {hasAccountAction && (
          <div className="min-w-0 flex-1 xl:max-w-lg">
            <label htmlFor="deposit-allocation" className="mb-1 block text-xs font-semibold text-slate-700">
              Customer-locker account <span className="text-rose-600">*</span>
            </label>
            <select id="deposit-allocation" value={selectedAllocationId} onChange={(event) => setSelectedAllocationId(event.target.value)} disabled={loadingAllocations}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100">
              <option value="">{loadingAllocations ? 'Loading active accounts…' : 'Select an active account'}</option>
              {activeAllocations.map((allocation) => (
                <option key={allocation._id} value={allocation._id}>
                  {allocation.customerId.fullName} · Locker {allocation.lockerId.lockerNumber} · {allocation.allocationCode}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap gap-2.5">
          {canCollect && <button
            onClick={() => openForSelectedAccount(() => setIsCollectModalOpen(true))}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Collect Deposit</span>
          </button>}

          {canAdjust && <button
            onClick={() => openForSelectedAccount(() => setIsAdjustModalOpen(true))}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
            <span>Adjust Deposit</span>
          </button>}

          {canCreateRefund && <button
            onClick={() => openForSelectedAccount(() => setIsCreateRefundModalOpen(true))}
            className="flex items-center space-x-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-2.5 text-xs font-semibold text-purple-700 transition hover:bg-purple-100"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Request Refund</span>
          </button>}
        </div>
        </div>
      </div>

      {/* Top 4 Summary Cards */}
      <DepositSummaryCards
        stats={stats}
        isLoading={loadingStats}
        onFilterClick={(cardId) => {
          if (cardId === 'pendingRefunds') {
            setSelectedRefundStatus('PENDING_APPROVAL');
            document.getElementById('refund-requests')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }}
      />

      <section id="deposit-ledger" aria-labelledby="deposit-ledger-heading" className="scroll-mt-24 space-y-3">
        <h3 id="deposit-ledger-heading" className="text-base font-semibold text-slate-900">Security deposit ledger</h3>
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
          canCancel={canAdjust}
        />
      </section>

      <section id="refund-requests" aria-labelledby="refund-requests-heading" className="scroll-mt-24 space-y-3 border-t border-slate-200 pt-5">
        <div className="flex items-center gap-2">
          <h3 id="refund-requests-heading" className="text-base font-semibold text-slate-900">Refund requests (maker-checker)</h3>
          {(stats?.pendingRefundCount ?? 0) > 0 && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-slate-950">{stats?.pendingRefundCount} pending</span>}
        </div>
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
          onCancelRefund={setCancellingRefund}
          currentPage={refundsPage}
          totalPages={refundsTotalPages}
          onPageChange={setRefundsPage}
          search={refundsSearch}
          onSearchChange={setRefundsSearch}
          selectedStatus={selectedRefundStatus}
          onStatusChange={setSelectedRefundStatus}
          canSubmit={canCreateRefund}
          canReview={canReviewRefund}
          canPay={canPayRefund}
          canCancel={canCancelRefund}
        />
      </section>

      {/* Collect Deposit Modal */}
      <CollectDepositModal
        isOpen={isCollectModalOpen}
        onClose={() => setIsCollectModalOpen(false)}
        allocationId={selectedAllocationId || undefined}
        canOverride={hasPermission('deposits.override')}
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
        allocationId={selectedAllocationId || undefined}
        onSuccess={() => {
          fetchTransactions();
          fetchStats();
        }}
      />

      {/* Create Refund Modal */}
      <CreateRefundModal
        isOpen={isCreateRefundModalOpen}
        onClose={() => setIsCreateRefundModalOpen(false)}
        allocationId={selectedAllocationId || undefined}
        onSuccess={() => {
          fetchRefunds();
          fetchStats();
          document.getElementById('refund-requests')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="cancel-transaction-title" className="relative w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-700">
              <XCircle className="w-6 h-6" />
              <h3 id="cancel-transaction-title" className="text-base font-semibold text-slate-950">Cancel deposit transaction?</h3>
            </div>
            <p className="text-sm text-slate-600">
              Are you sure you want to cancel transaction{' '}
              <span className="font-mono text-cyan-400">{cancellingTx.depositTransactionNumber}</span>{' '}
              for ₹{cancellingTx.amount.toLocaleString('en-IN')}? This action is audited and cannot be undone.
            </p>
            <div>
              <label htmlFor="deposit-cancel-reason" className="mb-1 block text-xs font-semibold text-slate-700">
                Mandatory Cancellation Reason *
              </label>
              <textarea
                id="deposit-cancel-reason" rows={3}
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCancellingTx(null);
                  setCancelReason('');
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
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

      {cancellingRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="cancel-refund-title" className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-700">
              <XCircle className="h-6 w-6" />
              <h3 id="cancel-refund-title" className="font-semibold text-slate-950">Cancel refund request?</h3>
            </div>
            <p className="text-sm text-slate-600">
              <span className="font-mono font-semibold text-slate-900">{cancellingRefund.refundNumber}</span> will leave the active approval workflow. This action is audited.
            </p>
            <div>
              <label htmlFor="refund-cancel-reason" className="mb-1 block text-xs font-semibold text-slate-700">Cancellation reason *</label>
              <textarea id="refund-cancel-reason" rows={3} autoFocus value={refundCancelReason} onChange={(event) => setRefundCancelReason(event.target.value)}
                placeholder="Explain why this request is being cancelled"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100" />
              <p className="mt-1 text-xs text-slate-500">Minimum 3 characters. Saved in the audit trail.</p>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => { setCancellingRefund(null); setRefundCancelReason(''); }} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Keep request</button>
              <button type="button" onClick={handleConfirmCancelRefund} disabled={submittingRefundCancel || refundCancelReason.trim().length < 3}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">
                {submittingRefundCancel ? 'Cancelling…' : 'Cancel refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default DepositsRefundsPage;
