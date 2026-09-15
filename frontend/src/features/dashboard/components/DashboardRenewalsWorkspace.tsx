import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Search,
  RefreshCw,
  LayoutGrid,
  List,
  Clock,
  IndianRupee,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  KeyRound,
  Phone,
  AlertTriangle,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import { renewalApi } from '../../renewals/api/renewalApi';
import { LockerInvoice, InvoiceQueryParams } from '../../renewals/types';
import { DueStatusBadge, PaymentStatusBadge } from '../../renewals/components/RenewalStatusBadge';
import { formatPhone } from '../../customers/utils/phoneFormatter';
import { formatDateSafe } from '../../renewals/utils/dateFormatter';
import { formatINR } from '../../lockers/utils/formatters';
import { Button } from '../../../components/ui/button';
import { usePermission } from '../../../hooks/usePermission';

function getRelativeDueInfo(dueDate: string | Date | undefined): { text: string; isOverdue: boolean } {
  if (!dueDate) return { text: 'No due date', isOverdue: false };
  const d = new Date(dueDate);
  if (isNaN(d.getTime())) return { text: 'Invalid date', isOverdue: false };

  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    if (overdueDays >= 365) {
      const years = Math.floor(overdueDays / 365);
      return { text: `${years}y overdue`, isOverdue: true };
    }
    if (overdueDays >= 30) {
      const months = Math.floor(overdueDays / 30);
      return { text: `${months}mo overdue`, isOverdue: true };
    }
    return { text: `${overdueDays}d overdue`, isOverdue: true };
  } else if (diffDays === 0) {
    return { text: 'Due today', isOverdue: false };
  } else {
    if (diffDays >= 365) {
      const years = Math.floor(diffDays / 365);
      return { text: `Due in ${years}y`, isOverdue: false };
    }
    if (diffDays >= 30) {
      const months = Math.floor(diffDays / 30);
      return { text: `Due in ${months}mo`, isOverdue: false };
    }
    return { text: `Due in ${diffDays}d`, isOverdue: false };
  }
}

interface DashboardRenewalsWorkspaceProps {
  initialStatus?: string;
  onRecordPayment: (invoice: LockerInvoice) => void;
  onViewInvoice: (invoice: LockerInvoice) => void;
}

export function DashboardRenewalsWorkspace({
  initialStatus = 'ACTIONABLE',
  onRecordPayment,
  onViewInvoice,
}: DashboardRenewalsWorkspaceProps) {
  const navigate = useNavigate();
  const canCreatePayment = usePermission('payments.create');

  const [statusParam, setStatusParam] = useState<string>(initialStatus);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(12);
  const [search, setSearch] = useState<string>('');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('dueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Sync if parent updates initialStatus
  useEffect(() => {
    if (initialStatus) {
      setStatusParam(initialStatus);
      setPage(1);
    }
  }, [initialStatus]);

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

  // Renewal stats
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['renewal-stats'],
    queryFn: renewalApi.getRenewalStats,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const totalOutstandingCount = (stats?.overdue?.count ?? 0) + (stats?.dueThisMonth?.count ?? 0);
  const dueSoonCount = stats?.dueThisMonth?.count ?? 0;
  const expiredCount = stats?.overdue?.count ?? 0;

  // Query filters
  const queryFilters: InvoiceQueryParams = {
    page,
    limit,
    search: search || undefined,
    sortBy,
    sortOrder,
  };

  if (statusParam === 'ACTIONABLE') {
    queryFilters.dueStatus = 'ACTIONABLE' as any;
    queryFilters.onlyOutstanding = true;
  } else if (statusParam === 'DUE_SOON') {
    queryFilters.dueStatus = 'DUE_THIS_MONTH' as any;
    queryFilters.onlyOutstanding = true;
  } else if (statusParam === 'OVERDUE') {
    queryFilters.dueStatus = 'OVERDUE' as any;
    queryFilters.onlyOutstanding = true;
  } else if (statusParam === 'PAID') {
    queryFilters.paymentStatus = 'PAID';
  }

  const {
    data: listData,
    isLoading,
    isFetching,
    refetch: refetchInvoices,
  } = useQuery({
    queryKey: ['renewals', queryFilters],
    queryFn: () => renewalApi.getInvoices(queryFilters),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const invoices = listData?.invoices || [];
  const pagination = listData?.pagination;
  const totalInvoices = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;

  const refreshAll = () => {
    refetchInvoices();
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
              setStatusParam('ACTIONABLE');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none shrink-0 ${
              statusParam === 'ACTIONABLE'
                ? 'bg-amber-600 text-white shadow-2xs font-bold'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <span>Actionable Dues</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                statusParam === 'ACTIONABLE' ? 'bg-amber-700 text-white' : 'bg-white text-slate-700'
              }`}
            >
              {totalOutstandingCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusParam('DUE_SOON');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none shrink-0 ${
              statusParam === 'DUE_SOON'
                ? 'bg-amber-600 text-white shadow-2xs font-bold'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <span>Due This Month</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                statusParam === 'DUE_SOON' ? 'bg-amber-700 text-white' : 'bg-white text-slate-700'
              }`}
            >
              {dueSoonCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusParam('OVERDUE');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none shrink-0 ${
              statusParam === 'OVERDUE'
                ? 'bg-rose-700 text-white shadow-2xs font-bold'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <span>Overdue</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                statusParam === 'OVERDUE' ? 'bg-rose-800 text-white' : 'bg-white text-slate-700'
              }`}
            >
              {expiredCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusParam('ALL');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none shrink-0 ${
              statusParam === 'ALL'
                ? 'bg-slate-800 text-white shadow-2xs font-bold'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <span>All History</span>
          </button>
        </div>

        {/* Right: View mode & Full Screen Button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200/80">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === 'cards' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Cards view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Table view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={isFetching}
            className="h-8 rounded-xl border-slate-200 px-2.5 text-slate-600 hover:text-slate-900 cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-amber-700' : ''}`} />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/renewal-lockers')}
            className="h-8 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold gap-1 px-2.5 cursor-pointer"
          >
            <span>Full View</span>
            <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
          </Button>
        </div>
      </div>

      {/* Search and Sort Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-2.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search locker #, tenant name, phone, or invoice #..."
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
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
            <option value="dueDate:asc">Due Date (Earliest)</option>
            <option value="dueDate:desc">Due Date (Latest)</option>
            <option value="balanceAmount:desc">Balance Due (High → Low)</option>
            <option value="lockerNumber:asc">Locker Number (1 → 9)</option>
          </select>

          <span className="text-[11px] font-semibold text-slate-400 px-1">
            {totalInvoices} Record{totalInvoices !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* List / Cards Rendering */}
      {isLoading ? (
        <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-12 text-center text-slate-400 font-medium animate-pulse shadow-2xs text-xs">
          Loading renewals and due invoices...
        </div>
      ) : invoices.length === 0 ? (
        <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-12 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center mx-auto border border-amber-200/80">
            <RotateCcw className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No renewals found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {search ? 'No records match your search query.' : 'There are no active dues under this filter.'}
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {invoices.map((inv) => {
            const relative = getRelativeDueInfo(inv.dueDate);
            const lockerNum = (inv as any).lockerNumber || inv.lockerId?.lockerNumber || (inv.allocationId as any)?.lockerId?.lockerNumber || 'N/A';
            const lockerSize = (inv as any).lockerSize || inv.lockerId?.size || (inv.allocationId as any)?.lockerId?.size || 'Standard';
            const customerName = (inv as any).customerName || inv.customerId?.fullName || 'Valued Tenant';
            const customerPhone = (inv as any).customerPhone || inv.customerId?.phone;

            return (
              <div
                key={inv._id}
                className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs hover:shadow-md hover:border-amber-300 transition-all flex flex-col justify-between group"
              >
                {/* Header: Locker & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-slate-900 tracking-tight font-mono">
                      #{lockerNum}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600">
                      Size {lockerSize}
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      relative.isOverdue
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    {relative.text}
                  </span>
                </div>

                {/* Tenant Info */}
                <div className="mt-2.5 py-2 border-y border-slate-100 space-y-1">
                  <p className="text-xs font-bold text-slate-800 truncate" title={customerName}>
                    {customerName}
                  </p>
                  {customerPhone && (
                    <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      {formatPhone(customerPhone)}
                    </p>
                  )}
                </div>

                {/* Balance Due & Due Date */}
                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                      Balance Due
                    </span>
                    <span className="text-base font-black text-slate-900 font-mono">
                      {formatINR(inv.balanceAmount)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                      Due Date
                    </span>
                    <span className="text-[11px] font-semibold text-slate-600">
                      {formatDateSafe(inv.dueDate)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-2">
                  {canCreatePayment && inv.balanceAmount > 0 && (
                    <button
                      type="button"
                      onClick={() => onRecordPayment(inv)}
                      className="flex-1 py-1.5 px-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer text-center"
                    >
                      Collect Renewal →
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onViewInvoice(inv)}
                    className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                    title="View invoice details"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Locker #</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Due Date</th>
                  <th className="py-2.5 px-3 text-right">Balance Due</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => {
                  const relative = getRelativeDueInfo(inv.dueDate);
                  const lockerNum = (inv as any).lockerNumber || inv.lockerId?.lockerNumber || (inv.allocationId as any)?.lockerId?.lockerNumber || 'N/A';
                  const customerName = (inv as any).customerName || inv.customerId?.fullName || 'Valued Tenant';
                  const customerPhone = (inv as any).customerPhone || inv.customerId?.phone;

                  return (
                    <tr key={inv._id} className="hover:bg-slate-50/70 transition">
                      <td className="py-2.5 px-3 font-bold text-slate-900 font-mono">
                        #{lockerNum}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800 truncate max-w-[160px]">{customerName}</div>
                        {customerPhone && (
                          <div className="text-[10px] text-slate-400 font-mono">{formatPhone(customerPhone)}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-700">{formatDateSafe(inv.dueDate)}</div>
                        <div className={`text-[10px] font-bold ${relative.isOverdue ? 'text-rose-600' : 'text-amber-600'}`}>
                          {relative.text}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black font-mono text-slate-900">
                        {formatINR(inv.balanceAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <PaymentStatusBadge status={inv.paymentStatus} />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canCreatePayment && inv.balanceAmount > 0 && (
                            <button
                              type="button"
                              onClick={() => onRecordPayment(inv)}
                              className="py-1 px-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer"
                            >
                              Collect
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onViewInvoice(inv)}
                            className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                            title="View invoice"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
            Page {page} of {totalPages} ({totalInvoices} total dues)
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
