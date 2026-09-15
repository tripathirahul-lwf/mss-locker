import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Search,
  RefreshCw,
  Receipt,
  Printer,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  Calendar,
  CheckCircle2,
  DollarSign,
  QrCode,
  Banknote,
  Building2,
} from 'lucide-react';
import { paymentApi } from '../../payments/api/paymentApi';
import { Payment, PaymentQueryParams, PaymentMethod } from '../../payments/types';
import { PaymentMethodBadge, PaymentStatusBadge } from '../../payments/components/PaymentMethodBadge';
import { formatDateSafe } from '../../renewals/utils/dateFormatter';
import { formatINR } from '../../lockers/utils/formatters';
import { Button } from '../../../components/ui/button';
import { usePermission } from '../../../hooks/usePermission';

interface DashboardPaymentsWorkspaceProps {
  onRecordPayment: () => void;
  onViewReceipt: (payment: Payment) => void;
}

export function DashboardPaymentsWorkspace({
  onRecordPayment,
  onViewReceipt,
}: DashboardPaymentsWorkspaceProps) {
  const navigate = useNavigate();
  const canCreate = usePermission('payments.create');

  const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'ALL'>('ALL');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(15);
  const [search, setSearch] = useState<string>('');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('paymentDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearch !== search) {
        setSearch(localSearch);
        setPage(1);
      }
    }, 350);
    return () => clearTimeout(handler);
  }, [localSearch, search]);

  // Payment stats
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['payment-stats'],
    queryFn: paymentApi.getPaymentStats,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const queryFilters: PaymentQueryParams = {
    page,
    limit,
    search: search || undefined,
    paymentMethod: methodFilter === 'ALL' ? undefined : methodFilter,
    sortBy,
    sortOrder,
  };

  const {
    data: listData,
    isLoading,
    isFetching,
    refetch: refetchPayments,
  } = useQuery({
    queryKey: ['payments', queryFilters],
    queryFn: () => paymentApi.getPayments(queryFilters),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const payments = listData?.payments || [];
  const pagination = listData?.pagination;
  const total = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;

  const refreshAll = () => {
    refetchPayments();
    refetchStats();
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Upper Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs">
        {/* Left: Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => {
              setMethodFilter('ALL');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none shrink-0 ${
              methodFilter === 'ALL'
                ? 'bg-emerald-800 text-white shadow-2xs font-bold'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <span>All Ledger</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                methodFilter === 'ALL' ? 'bg-emerald-900 text-white' : 'bg-white text-slate-700'
              }`}
            >
              {total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMethodFilter('CASH');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none shrink-0 ${
              methodFilter === 'CASH'
                ? 'bg-emerald-800 text-white shadow-2xs font-bold'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <Banknote className="w-3.5 h-3.5" />
            <span>Cash</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMethodFilter('UPI');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none shrink-0 ${
              methodFilter === 'UPI'
                ? 'bg-emerald-800 text-white shadow-2xs font-bold'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>UPI</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMethodFilter('BANK_TRANSFER');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none shrink-0 ${
              methodFilter === 'BANK_TRANSFER'
                ? 'bg-emerald-800 text-white shadow-2xs font-bold'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Bank Transfer</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMethodFilter('CHEQUE');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none shrink-0 ${
              methodFilter === 'CHEQUE'
                ? 'bg-emerald-800 text-white shadow-2xs font-bold'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <span>Cheque</span>
          </button>
        </div>

        {/* Right: Quick actions */}
        <div className="flex items-center gap-2 shrink-0">
          {canCreate && (
            <Button
              size="sm"
              onClick={onRecordPayment}
              className="h-8 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs px-3 shadow-2xs cursor-pointer gap-1"
            >
              <Receipt className="h-3.5 w-3.5" />
              <span>+ Record Payment</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={isFetching}
            className="h-8 rounded-xl border-slate-200 px-2.5 text-slate-600 hover:text-slate-900 cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-emerald-700' : ''}`} />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/payments')}
            className="h-8 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold gap-1 px-2.5 cursor-pointer"
          >
            <span>Full View</span>
            <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-2.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search by receipt #, customer name, transaction ref, or locker #..."
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split(':');
              setSortBy(sb);
              setSortOrder(so as 'asc' | 'desc');
              setPage(1);
            }}
            className="text-xs py-1.5 px-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 font-medium focus:outline-none cursor-pointer"
          >
            <option value="paymentDate:desc">Date (Newest First)</option>
            <option value="paymentDate:asc">Date (Oldest First)</option>
            <option value="amount:desc">Amount (High → Low)</option>
            <option value="receiptNumber:desc">Receipt Number</option>
          </select>

          <span className="text-[11px] font-semibold text-slate-400 px-1">
            {total} Transaction{total !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Payments Ledger Table */}
      {isLoading ? (
        <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-12 text-center text-slate-400 font-medium animate-pulse shadow-2xs text-xs">
          Loading collections and payment ledger...
        </div>
      ) : payments.length === 0 ? (
        <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-12 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto border border-emerald-200/80">
            <CreditCard className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No payment records found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {search ? 'No payments match your search query.' : 'There are no payments recorded under this filter.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Receipt #</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => {
                  const customerName = (p as any).customerId?.fullName || (p as any).customerName || 'Custody Client';
                  const receiptNum = p.receiptNumber || p.paymentNumber || `REC-${p._id.slice(-6).toUpperCase()}`;

                  return (
                    <tr key={p._id} className="hover:bg-slate-50/70 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {receiptNum}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-800">{customerName}</div>
                        {(p as any).lockerNumber && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Locker #{(p as any).lockerNumber}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {formatDateSafe(p.paymentDate)}
                      </td>
                      <td className="py-2.5 px-3">
                        <PaymentMethodBadge method={p.paymentMethod} />
                      </td>
                      <td className="py-2.5 px-3 text-right font-black font-mono text-slate-900">
                        {formatINR(p.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <PaymentStatusBadge status={p.paymentStatus} />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => onViewReceipt(p)}
                          className="inline-flex items-center gap-1 py-1 px-2.5 rounded-lg border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 text-slate-700 text-xs font-semibold transition cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-500" />
                          <span>Receipt</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200/90 text-xs">
          <span className="text-slate-500 font-medium">
            Page {page} of {totalPages} ({total} total transactions)
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
