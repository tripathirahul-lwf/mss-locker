import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar,
  Search,
  RefreshCw,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  LayoutGrid,
  List,
  Clock,
  AlertCircle,
  IndianRupee,
} from 'lucide-react';
import { renewalApi } from '../features/renewals/api/renewalApi';
import {
  LockerInvoice,
  InvoiceQueryParams,
  PaymentStatus,
  DueStatus,
  GenerateRenewalInput,
} from '../features/renewals/types';
import { RenewalTable } from '../features/renewals/components/RenewalTable';
import { InvoiceDetailModal } from '../features/renewals/components/InvoiceDetailModal';
import { GenerateRenewalModal } from '../features/renewals/components/GenerateRenewalModal';
import { RecordPaymentModal } from '../features/payments/components/RecordPaymentModal';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { paymentApi } from '../features/payments/api/paymentApi';
import { Button } from '../components/ui/button';
import { usePermission } from '../hooks/usePermission';
import { formatPhone } from '../features/customers/utils/phoneFormatter';
import { formatDateSafe } from '../features/renewals/utils/dateFormatter';
import { formatINR } from '../features/lockers/utils/formatters';

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

export function RenewalsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const canCreate = usePermission('renewals.create');

  // Read URL query parameters - default to ACTIONABLE to only show active renewal dues
  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || 24;
  const search = searchParams.get('search') || '';
  const statusParam = searchParams.get('status') || 'ACTIONABLE';
  const sortBy = searchParams.get('sortBy') || 'dueDate';
  const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc';
  const viewMode = (searchParams.get('view') as 'cards' | 'table') || 'cards';

  // Search local state with debounce
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearch !== search) {
        updateFilters({ search: localSearch || undefined, page: 1 });
      }
    }, 350);
    return () => clearTimeout(handler);
  }, [localSearch]);

  let paymentStatus: PaymentStatus | undefined = undefined;
  let dueStatus: DueStatus | 'DUE_THIS_MONTH' | 'DUE_THIS_WEEK' | undefined = undefined;
  let onlyOutstanding: boolean | undefined = undefined;

  if (statusParam === 'ACTIONABLE') {
    dueStatus = 'ACTIONABLE' as any;
    onlyOutstanding = true;
  } else if (statusParam === 'DUE_SOON') {
    dueStatus = 'DUE_THIS_MONTH';
    onlyOutstanding = true;
  } else if (statusParam === 'OVERDUE') {
    dueStatus = 'OVERDUE';
    onlyOutstanding = true;
  } else if (statusParam === 'DUE_THIS_WEEK') {
    dueStatus = 'DUE_THIS_WEEK';
    onlyOutstanding = true;
  } else if (statusParam === 'UNPAID') {
    paymentStatus = 'UNPAID';
    onlyOutstanding = true;
  } else if (statusParam === 'PARTIALLY_PAID') {
    paymentStatus = 'PARTIALLY_PAID';
    onlyOutstanding = true;
  } else if (statusParam === 'PAID') {
    paymentStatus = 'PAID';
  } else if (statusParam === 'ALL') {
    onlyOutstanding = undefined;
  }

  const queryFilters: InvoiceQueryParams = {
    page,
    limit,
    search: search || undefined,
    paymentStatus,
    dueStatus,
    onlyOutstanding,
    sortBy,
    sortOrder,
  };

  const updateFilters = (newFilters: Record<string, any>) => {
    const updated = new URLSearchParams(searchParams);

    Object.entries(newFilters).forEach(([key, value]) => {
      if (value === undefined || value === '') {
        updated.delete(key);
      } else {
        updated.set(key, String(value));
      }
    });

    setSearchParams(updated);
  };

  // Queries
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['renewal-stats'],
    queryFn: () => renewalApi.getRenewalStats(),
  });

  const {
    data: listData,
    isLoading: isListLoading,
    isFetching,
    refetch: refetchList,
  } = useQuery({
    queryKey: ['renewals', queryFilters],
    queryFn: () => renewalApi.getInvoices(queryFilters),
  });

  const invoices = listData?.invoices || [];
  const pagination = listData?.pagination;
  const totalInvoices = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;

  // Modal States
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<LockerInvoice | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<LockerInvoice | null>(null);
  const [cancellingInvoice, setCancellingInvoice] = useState<LockerInvoice | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Mutations
  const generateMutation = useMutation({
    mutationFn: (data: GenerateRenewalInput) => renewalApi.generateRenewal(data),
    onSuccess: () => {
      setGenerateModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['renewals'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-stats'] });
      setNotice('Renewal invoice generated successfully.');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      renewalApi.cancelInvoice(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['renewals'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-stats'] });
      setNotice('Invoice cancelled successfully.');
    },
  });

  // Calculate stats banner values matching Screenshot 4
  const totalOutstandingCount =
    (stats?.overdue?.count ?? 0) + (stats?.dueThisMonth?.count ?? 0);
  const dueSoonCount = stats?.dueThisMonth?.count ?? 0;
  const expiredCount = stats?.overdue?.count ?? 0;

  const startIndex = totalInvoices === 0 ? 0 : (page - 1) * limit + 1;
  const endIndex = Math.min(page * limit, totalInvoices);

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* Toast Notice */}
      {notice && (
        <div
          role="status"
          className="fixed right-4 top-20 z-[110] flex max-w-sm items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-3.5 text-xs font-semibold text-emerald-800 shadow-xl"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100 ml-auto cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Modern Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Renewal Due Lockers
            </h1>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/80">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              {totalOutstandingCount} Actionable Dues
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
            Track active lease expiry, generate recurring billing notices, and collect renewal rentals
          </p>
        </div>

        {/* Top Operations: Refresh & Generate Renewal */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchList();
              refetchStats();
            }}
            disabled={isFetching}
            className="h-9 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs gap-1.5 px-3 cursor-pointer shadow-2xs"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-emerald-700' : ''}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {canCreate && (
            <Button
              onClick={() => setGenerateModalOpen(true)}
              className="h-9 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs px-3.5 shadow-2xs cursor-pointer"
            >
              <span>+ Generate Renewal</span>
            </Button>
          )}
        </div>
      </div>

      {/* 4 Interactive KPI Summary Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" aria-label="Renewal Metrics">
        {/* 1. Total Outstanding */}
        <div
          onClick={() => updateFilters({ status: 'ACTIONABLE', page: 1 })}
          className={`cursor-pointer rounded-2xl border p-4 sm:p-5 transition-all duration-200 bg-white hover:shadow-md ${
            statusParam === 'ACTIONABLE'
              ? 'border-emerald-600 ring-2 ring-emerald-600/25 shadow-xs'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Outstanding
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/70">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              ₹ {(stats?.totalOutstanding?.amount ?? 0).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {stats?.totalOutstanding?.count ?? 0} active unpaid leases
            </p>
          </div>
        </div>

        {/* 2. Overdue / Expired */}
        <div
          onClick={() => updateFilters({ status: 'OVERDUE', page: 1 })}
          className={`cursor-pointer rounded-2xl border p-4 sm:p-5 transition-all duration-200 bg-white hover:shadow-md ${
            statusParam === 'OVERDUE'
              ? 'border-rose-600 ring-2 ring-rose-600/25 shadow-xs'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-rose-600 uppercase tracking-wider">
              Overdue / Expired
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200/70">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-rose-900 tabular-nums">
              ₹ {(stats?.overdue?.amount ?? 0).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-rose-600 font-medium mt-0.5">
              {stats?.overdue?.count ?? 0} expired lockers
            </p>
          </div>
        </div>

        {/* 3. Due This Month */}
        <div
          onClick={() => updateFilters({ status: 'DUE_SOON', page: 1 })}
          className={`cursor-pointer rounded-2xl border p-4 sm:p-5 transition-all duration-200 bg-white hover:shadow-md ${
            statusParam === 'DUE_SOON'
              ? 'border-amber-500 ring-2 ring-amber-500/25 shadow-xs'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              Due This Month
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/70">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-amber-950 tabular-nums">
              ₹ {(stats?.dueThisMonth?.amount ?? 0).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-amber-700 font-medium mt-0.5">
              {stats?.dueThisMonth?.count ?? 0} lockers due soon
            </p>
          </div>
        </div>

        {/* 4. Due This Week */}
        <div
          onClick={() => updateFilters({ status: 'DUE_THIS_WEEK', page: 1 })}
          className={`cursor-pointer rounded-2xl border p-4 sm:p-5 transition-all duration-200 bg-white hover:shadow-md ${
            statusParam === 'DUE_THIS_WEEK'
              ? 'border-indigo-600 ring-2 ring-indigo-600/25 shadow-xs'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
              Due This Week
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200/70">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-indigo-950 tabular-nums">
              ₹ {(stats?.dueThisWeek?.amount ?? 0).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-indigo-600 font-medium mt-0.5">
              {stats?.dueThisWeek?.count ?? 0} immediate renewals
            </p>
          </div>
        </div>
      </section>

      {/* Unified Renewal Control Console */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Upper Tier: Segmented Status Tabs + View Switcher */}
        <div className="p-2 sm:p-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Status Tabs Segmented Group */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1 overflow-x-auto [scrollbar-width:none] select-none gap-1">
            {[
              {
                key: 'ACTIONABLE',
                label: 'Actionable Dues',
                count: totalOutstandingCount,
                dotColor: 'bg-emerald-500',
              },
              {
                key: 'OVERDUE',
                label: 'Overdue',
                count: expiredCount,
                dotColor: 'bg-rose-500',
              },
              {
                key: 'DUE_SOON',
                label: 'Due This Month',
                count: dueSoonCount,
                dotColor: 'bg-amber-500',
              },
              {
                key: 'DUE_THIS_WEEK',
                label: 'This Week',
                count: stats?.dueThisWeek?.count ?? 0,
                dotColor: 'bg-indigo-500',
              },
              {
                key: 'PAID',
                label: 'Settled / Paid',
                count: undefined,
                dotColor: 'bg-slate-400',
              },
              {
                key: 'ALL',
                label: 'All Invoices',
                count: stats?.totalInvoices ?? 0,
                dotColor: 'bg-slate-500',
              },
            ].map((tab) => {
              const isSelected = statusParam === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => updateFilters({ status: tab.key, page: 1 })}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tab.dotColor}`} />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                        isSelected
                          ? 'bg-slate-100 text-slate-800'
                          : 'bg-slate-200/70 text-slate-600'
                      }`}
                    >
                      {tab.count.toLocaleString('en-IN')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* View Switcher docked on the right */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/80 p-1 shrink-0 self-start lg:self-auto">
            <button
              type="button"
              onClick={() => updateFilters({ view: 'cards' })}
              className={`h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5 text-emerald-700" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => updateFilters({ view: 'table' })}
              className={`h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Table View"
            >
              <List className="h-3.5 w-3.5 text-emerald-700" />
              <span>Table</span>
            </button>
          </div>
        </div>

        {/* Lower Tier: Search, Sort By, Per Page + Result Count */}
        <div className="border-t border-slate-100 bg-slate-50/50 p-2.5 sm:px-3 sm:py-2.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {/* Left: Search Bar */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search locker #, customer name, phone, invoice ID..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm bg-white border border-slate-200 hover:border-slate-300 rounded-xl focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-slate-900 placeholder:text-slate-400 font-medium transition shadow-2xs"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => {
                  setLocalSearch('');
                  updateFilters({ search: undefined, page: 1 });
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Right: Controls & Counter */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Sort Filter */}
            <div className="relative flex items-center bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-2.5 transition focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1.5">Sort:</span>
              <select
                value={`${sortBy}:${sortOrder}`}
                onChange={(e) => {
                  const [sb, so] = e.target.value.split(':');
                  updateFilters({ sortBy: sb, sortOrder: so, page: 1 });
                }}
                className="h-8 text-xs font-semibold text-slate-700 bg-transparent border-none focus:outline-hidden cursor-pointer pr-5"
              >
                <option value="dueDate:asc">Due Date (Earliest)</option>
                <option value="dueDate:desc">Due Date (Latest)</option>
                <option value="balanceAmount:desc">Balance Due (Highest)</option>
                <option value="createdAt:desc">Created (Newest)</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>

            {/* Per Page */}
            <div className="relative flex items-center bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-2.5 transition focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1.5">Show:</span>
              <select
                value={limit}
                onChange={(e) => updateFilters({ limit: Number(e.target.value), page: 1 })}
                className="h-8 text-xs font-semibold text-slate-700 bg-transparent border-none focus:outline-hidden cursor-pointer pr-5"
              >
                <option value="12">12</option>
                <option value="24">24</option>
                <option value="48">48</option>
                <option value="96">96</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>

            {/* Records Summary */}
            <span className="text-xs text-slate-500 font-medium pl-1 hidden sm:inline">
              Showing <strong className="text-slate-900 font-semibold">{totalInvoices === 0 ? 0 : startIndex}–{endIndex}</strong> of{' '}
              <strong className="text-slate-900 font-semibold">{totalInvoices.toLocaleString('en-IN')}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isListLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-56 rounded-2xl bg-slate-100 animate-pulse border border-slate-200/80 p-5"
            />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        /* Empty State */
        <div className="rounded-3xl border border-slate-200/80 bg-white py-16 px-6 sm:py-24 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200/70 mb-3 shadow-2xs">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            All Clear!
          </h2>
          <p className="text-sm font-bold text-emerald-600 mt-1">
            No Renewal Dues Found
          </p>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1.5 max-w-md mx-auto">
            {search
              ? `No invoices match your search "${search}". Try clearing search filters.`
              : 'All customers in this category are completely settled and up to date.'}
          </p>
          {search && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch('');
                updateFilters({ search: undefined, page: 1 });
              }}
              className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              Clear Search
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        /* Modern Renewal Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {invoices.map((inv) => {
            const isOverdue = inv.dueStatus === 'OVERDUE';
            const isPaid = (inv.balanceAmount || 0) <= 0;
            const customer = inv.customerId;
            const locker = inv.lockerId;
            const formattedBalance = formatINR(inv.balanceAmount || 0);
            const urgency = getRelativeDueInfo(inv.dueDate);

            return (
              <div
                key={inv._id}
                onClick={() => setViewingInvoice(inv)}
                className={`group relative overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all duration-200 bg-white shadow-2xs hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between cursor-pointer ${
                  isOverdue
                    ? 'border-rose-200/90 hover:border-rose-400 ring-1 ring-rose-100/60'
                    : isPaid
                    ? 'border-emerald-200/90 hover:border-emerald-400 ring-1 ring-emerald-50'
                    : 'border-amber-200/90 hover:border-amber-400 ring-1 ring-amber-100/60'
                }`}
              >
                <div>
                  {/* Top Row: Locker number, size, and Urgency Pill */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 group-hover:text-emerald-800 transition-colors">
                          {locker?.lockerNumber ? `Locker ${locker.lockerNumber}` : 'Locker Unit'}
                        </h3>
                        {locker?.size && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                            Size {locker.size}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-slate-400 mt-0.5 uppercase tracking-wider">
                        {inv.billingCycle || 'Annual'} Lease
                      </p>
                    </div>

                    {/* Urgency Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shrink-0 ${
                        isPaid
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                          : isOverdue
                          ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                          : 'bg-amber-50 text-amber-800 border-amber-200/80'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isPaid ? 'bg-emerald-500' : isOverdue ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
                        }`}
                      />
                      {isPaid ? 'Settled' : urgency.text}
                    </span>
                  </div>

                  {/* Prominent Due Amount Section */}
                  <div className="mt-3.5 p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {isPaid ? 'Payment Status' : 'Outstanding Balance'}
                    </span>
                    <div className="flex items-baseline justify-between mt-0.5">
                      <span
                        className={`text-2xl font-bold font-mono tracking-tight ${
                          isPaid ? 'text-emerald-700' : isOverdue ? 'text-rose-900' : 'text-slate-900'
                        }`}
                      >
                        {isPaid ? '₹ 0' : formattedBalance}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Total: {formatINR(inv.totalAmount || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Customer & Lease Info */}
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {(customer?.fullName || 'CU').slice(0, 2).toUpperCase()}
                      </div>
                      <p className="text-xs font-bold text-slate-800 truncate" title={customer?.fullName}>
                        {customer?.fullName || 'Unknown Customer'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pt-1">
                      <span>Phone:</span>
                      <span className="font-semibold text-slate-700 tabular-nums">
                        {formatPhone(customer?.phone)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                      <span>Due Date:</span>
                      <span className="font-semibold text-slate-700 tabular-nums">
                        {formatDateSafe(inv.dueDate)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                  {inv.balanceAmount > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPayingInvoice(inv);
                        }}
                        className="flex-1 py-2 px-3 rounded-xl font-semibold text-xs tracking-wide transition-all bg-emerald-800 hover:bg-emerald-900 text-white shadow-2xs cursor-pointer flex items-center justify-center"
                      >
                        <span>Record Payment</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingInvoice(inv);
                        }}
                        className="h-8.5 w-8.5 shrink-0 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center transition-all cursor-pointer text-slate-600 hover:text-slate-900"
                        title="View Invoice Dossier"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingInvoice(inv);
                      }}
                      className="w-full py-2 px-3.5 rounded-xl font-semibold text-xs tracking-wide transition-all bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5 text-slate-500" />
                      <span>View Dossier</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <RenewalTable
          invoices={invoices}
          pagination={pagination}
          isLoading={isListLoading}
          filters={queryFilters}
          onPageChange={(p) => updateFilters({ page: p })}
          onView={(inv) => setViewingInvoice(inv)}
          onCancel={(inv) => setCancellingInvoice(inv)}
          onGenerateRenewal={() => setGenerateModalOpen(true)}
        />
      )}

      {/* Pagination */}
      {totalInvoices > 0 && viewMode === 'cards' && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200/80">
          <p className="text-xs sm:text-sm font-semibold text-slate-500">
            Showing {startIndex} to {endIndex} of {totalInvoices} invoices
          </p>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isFetching}
                onClick={() => updateFilters({ page: page - 1 })}
                className="h-8.5 rounded-xl border-slate-300 text-slate-700 text-xs gap-1 px-3 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Prev</span>
              </Button>

              <span className="px-3 text-xs font-bold text-slate-700">
                {page} / {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isFetching}
                onClick={() => updateFilters({ page: page + 1 })}
                className="h-8.5 rounded-xl border-slate-300 text-slate-700 text-xs gap-1 px-3 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Generate Renewal Modal */}
      {generateModalOpen && (
        <GenerateRenewalModal
          onClose={() => setGenerateModalOpen(false)}
          onSubmit={async (data) => {
            await generateMutation.mutateAsync(data);
          }}
          isSubmitting={generateMutation.isPending}
        />
      )}

      {/* Invoice Detail Dossier Modal */}
      {viewingInvoice && (
        <InvoiceDetailModal
          invoice={viewingInvoice}
          onClose={() => setViewingInvoice(null)}
          onCancelInvoice={async (inv, reason) => {
            await cancelMutation.mutateAsync({ id: inv._id, reason });
          }}
          onRecordPayment={(inv) => {
            setViewingInvoice(null);
            setPayingInvoice(inv);
          }}
        />
      )}

      {/* Record Payment Modal */}
      {payingInvoice && (
        <RecordPaymentModal
          initialInvoiceId={payingInvoice._id}
          onClose={() => setPayingInvoice(null)}
          onSubmit={async (data, idempotencyKey) => {
            const p = await paymentApi.recordPayment(data, idempotencyKey);
            refetchList();
            refetchStats();
            return p;
          }}
        />
      )}

      {/* Cancel Invoice Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(cancellingInvoice)}
        onClose={() => setCancellingInvoice(null)}
        onConfirm={() => {
          if (cancellingInvoice) {
            cancelMutation.mutate({
              id: cancellingInvoice._id,
              reason: 'Staff cancellation via renewals ledger',
            });
            setCancellingInvoice(null);
          }
        }}
        title="Cancel Renewal Invoice?"
        message={
          cancellingInvoice
            ? `Are you sure you want to cancel invoice #${cancellingInvoice.invoiceNumber} for ₹${cancellingInvoice.totalAmount?.toLocaleString('en-IN')} (Locker ${cancellingInvoice.lockerId?.lockerNumber || ''})? This will cancel the demand bill and close the renewal pending cycle.`
            : ''
        }
        confirmLabel="Cancel Invoice"
        variant="danger"
        isLoading={cancelMutation.isPending}
      />
    </div>
  );
}
