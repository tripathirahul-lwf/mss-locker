import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar,
  AlertTriangle,
  Search,
  RefreshCw,
  Plus,
  CheckCircle2,
  X,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Eye,
  LayoutGrid,
  List,
  ArrowUpRight,
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
import { paymentApi } from '../features/payments/api/paymentApi';
import { Button } from '../components/ui/button';
import { usePermission } from '../hooks/usePermission';

export function RenewalsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const canCreate = usePermission('renewals.create');

  // Read URL query parameters
  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || 24;
  const search = searchParams.get('search') || '';
  const statusParam = searchParams.get('status') || 'ALL';
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
  let dueStatus: DueStatus | undefined = undefined;

  if (statusParam === 'OVERDUE') {
    dueStatus = 'OVERDUE';
  } else if (statusParam === 'UNPAID') {
    paymentStatus = 'UNPAID';
  } else if (statusParam === 'PARTIALLY_PAID') {
    paymentStatus = 'PARTIALLY_PAID';
  } else if (statusParam === 'PAID') {
    paymentStatus = 'PAID';
  }

  const queryFilters: InvoiceQueryParams = {
    page,
    limit,
    search: search || undefined,
    paymentStatus,
    dueStatus,
    sortBy: 'dueDate',
    sortOrder: 'asc',
  };

  const updateFilters = (newFilters: Record<string, any>) => {
    const updated = new URLSearchParams(searchParams);

    Object.entries(newFilters).forEach(([key, value]) => {
      if (value === undefined || value === '' || value === 'ALL') {
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

      {/* Header Warning Banner matching Screenshot 4 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-amber-500 shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-amber-600">
              Renewal Due Lockers
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
              {totalOutstandingCount} total • {dueSoonCount} due soon • {expiredCount} expired
            </p>
          </div>
        </div>

        {/* Top Operations */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/80 p-1">
            <button
              type="button"
              onClick={() => updateFilters({ view: 'cards' })}
              className={`p-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5 text-emerald-700" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => updateFilters({ view: 'table' })}
              className={`p-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="h-3.5 w-3.5 text-emerald-700" />
              <span>Table</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchList();
              refetchStats();
            }}
            disabled={isFetching}
            className="h-9 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs gap-1.5 px-3 cursor-pointer"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-emerald-700' : ''}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {canCreate && (
            <Button
              onClick={() => setGenerateModalOpen(true)}
              className="h-9 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs gap-1.5 px-3.5 shadow-2xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ Generate Renewal</span>
            </Button>
          )}
        </div>
      </div>

      {/* Clean Filter Strip matching Screenshot 4 */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-white rounded-2xl border border-slate-200/90 p-2.5 sm:p-3 shadow-xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search locker, customer, ID..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-transparent border-none focus:outline-hidden text-slate-900 placeholder:text-slate-400 font-medium"
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch('');
                updateFilters({ search: undefined, page: 1 });
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status Dropdown with Floating Border Label */}
        <div className="relative min-w-[150px]">
          <label className="absolute -top-2 left-3 bg-white px-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none pointer-events-none z-10">
            Status
          </label>
          <select
            value={statusParam}
            onChange={(e) => updateFilters({ status: e.target.value, page: 1 })}
            className="w-full h-10 px-3.5 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-emerald-600 cursor-pointer transition appearance-none pr-8"
          >
            <option value="ALL">All Status</option>
            <option value="OVERDUE">Overdue</option>
            <option value="UNPAID">Pending / Unpaid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Settled / Paid</option>
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            ▼
          </div>
        </div>

        {/* Per Page Dropdown with Floating Border Label */}
        <div className="relative min-w-[110px]">
          <label className="absolute -top-2 left-3 bg-white px-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none pointer-events-none z-10">
            Per Page
          </label>
          <select
            value={limit}
            onChange={(e) => updateFilters({ limit: Number(e.target.value), page: 1 })}
            className="w-full h-10 px-3.5 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-emerald-600 cursor-pointer transition appearance-none pr-8"
          >
            <option value="12">12</option>
            <option value="24">24</option>
            <option value="48">48</option>
            <option value="96">96</option>
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            ▼
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isListLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-48 rounded-3xl bg-slate-100 animate-pulse border border-slate-200/80 p-5"
            />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        /* Empty State Matching Screenshot 4 Reference */
        <div className="rounded-3xl border border-slate-200/80 bg-white py-20 px-6 sm:py-28 text-center shadow-xs">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
            All Clear!
          </h2>
          <p className="text-base sm:text-lg font-bold text-emerald-500 mt-2">
            No Renewal Due Lockers
          </p>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-2 max-w-md mx-auto">
            Excellent! All customers are up to date with their payments.
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        /* Renewal Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {invoices.map((inv) => {
            const isOverdue = inv.dueStatus === 'OVERDUE';
            const formattedBalance = new Intl.NumberFormat('en-IN', {
              style: 'currency',
              currency: 'INR',
              maximumFractionDigits: 0,
            }).format(inv.balanceAmount || 0);

            return (
              <div
                key={inv._id}
                className={`relative overflow-hidden rounded-2xl border p-5 sm:p-5.5 transition-all duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 flex flex-col justify-between ${
                  isOverdue
                    ? 'bg-rose-50/40 border-rose-200/90'
                    : 'bg-amber-50/40 border-amber-200/90'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 pt-0.5">
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                        {inv.lockerId?.lockerNumber || 'Locker Unit'}
                      </h3>
                      <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-0.5">
                        • Due: {formattedBalance}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setViewingInvoice(inv)}
                      className="h-9 w-9 shrink-0 rounded-xl bg-white shadow-xs border border-slate-200/80 flex items-center justify-center transition-all hover:scale-105 hover:border-slate-300 cursor-pointer"
                      title="View Invoice Dossier"
                    >
                      <Eye
                        className={`h-4 w-4 ${isOverdue ? 'text-rose-600' : 'text-amber-600'}`}
                      />
                    </button>
                  </div>

                  <div className="mt-4 space-y-1 bg-white/70 rounded-xl p-3 border border-slate-200/60">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {inv.customerId?.fullName || 'Customer'}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500">
                      Phone: {inv.customerId?.phone || 'N/A'}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500">
                      Due Date: {inv.dueDate?.slice(0, 10) || 'N/A'}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${
                        isOverdue
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {isOverdue ? 'Overdue' : 'Due Soon'}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">
                      Size: {inv.lockerId?.size || 'Standard'}
                    </span>
                  </div>
                </div>

                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => setPayingInvoice(inv)}
                    className="w-full py-2 px-3.5 rounded-xl font-semibold text-xs sm:text-sm tracking-wide transition-all bg-emerald-800 hover:bg-emerald-900 text-white shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CreditCard className="h-4 w-4" />
                    <span>Record Payment</span>
                  </button>
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
          onCancel={(inv) =>
            cancelMutation.mutate({ id: inv._id, reason: 'Staff cancellation' })
          }
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
    </div>
  );
}
