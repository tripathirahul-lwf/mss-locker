import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  CheckCircle,
  Clock,
  IndianRupee,
  KeyRound,
  Layers,
  RefreshCw,
  ShieldAlert,
  Wrench,
  UserPlus,
  CreditCard,
  FileText,
  Search,
  Plus,
  Users,
  CalendarDays,
  Receipt,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { SystemHealthCard } from '../components/common/SystemHealthCard';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { lockerApi } from '../features/lockers/api/lockerApi';
import { LOCKER_SIZES } from '../features/lockers/constants';
import { Locker, LockerQueryParams } from '../features/lockers/types';
import { LockerVaultGrid } from '../features/lockers/components/LockerVaultGrid';
import { customerApi } from '../features/customers/api/customerApi';
import { Customer, CustomerQueryParams, AddKycDocumentInput } from '../features/customers/types';
import { CustomerTable } from '../features/customers/components/CustomerTable';
import { renewalApi } from '../features/renewals/api/renewalApi';
import { LockerInvoice, InvoiceQueryParams } from '../features/renewals/types';
import { RenewalTable } from '../features/renewals/components/RenewalTable';
import { paymentApi } from '../features/payments/api/paymentApi';
import { Payment, PaymentQueryParams } from '../features/payments/types';
import { PaymentTable } from '../features/payments/components/PaymentTable';
import { allocationApi } from '../features/allocations/api/allocationApi';
import { useAuth } from '../hooks/useAuth';
import { useDebounce } from '../hooks/useDebounce';

// Lazy load heavy interactive dialog modals to drastically reduce initial bundle size & parse time
const LockerDetailModal = React.lazy(() =>
  import('../features/lockers/components/LockerDetailModal').then((m) => ({
    default: m.LockerDetailModal,
  }))
);
const CustomerFormModal = React.lazy(() =>
  import('../features/customers/components/CustomerFormModal').then((m) => ({
    default: m.CustomerFormModal,
  }))
);
const CustomerQuickPreview = React.lazy(() =>
  import('../features/customers/components/CustomerQuickPreview').then((m) => ({
    default: m.CustomerQuickPreview,
  }))
);
const KycDocumentModal = React.lazy(() =>
  import('../features/customers/components/KycDocumentModal').then((m) => ({
    default: m.KycDocumentModal,
  }))
);
const GenerateRenewalModal = React.lazy(() =>
  import('../features/renewals/components/GenerateRenewalModal').then((m) => ({
    default: m.GenerateRenewalModal,
  }))
);
const InvoiceDetailModal = React.lazy(() =>
  import('../features/renewals/components/InvoiceDetailModal').then((m) => ({
    default: m.InvoiceDetailModal,
  }))
);
const RecordPaymentModal = React.lazy(() =>
  import('../features/payments/components/RecordPaymentModal').then((m) => ({
    default: m.RecordPaymentModal,
  }))
);
const PaymentReceiptModal = React.lazy(() =>
  import('../features/payments/components/PaymentReceiptModal').then((m) => ({
    default: m.PaymentReceiptModal,
  }))
);
const AllocationWizardModal = React.lazy(() =>
  import('../features/allocations/components/AllocationWizardModal').then((m) => ({
    default: m.AllocationWizardModal,
  }))
);

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const formatCurrency = (value: number) => currency.format(value);

type ConsoleView = 'VAULT_MATRIX' | 'CUSTOMERS' | 'RENEWALS' | 'PAYMENTS' | 'CAPACITY_TELEMETRY';

function SizeInventoryCard({ stats, isLoading }: { stats: any; isLoading: boolean }) {
  const total = stats?.total ?? 0;
  const occupied = stats?.occupied ?? 0;
  const available = stats?.availableForAllocation ?? stats?.vacant ?? 0;

  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
      <CardHeader className="space-y-3.5 border-b border-slate-100 p-4 sm:p-5">
        <div>
          <CardTitle id="size-inventory-title" className="text-sm font-semibold text-slate-900 tracking-tight">
            Locker Size Inventory
          </CardTitle>
          <p id="size-inventory-summary" className="mt-0.5 text-xs text-slate-500 font-normal">
            Live capacity, allocation breakdown and physical occupancy across configured sizes (A to G2).
          </p>
        </div>

        <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50/70" aria-label="Size inventory summary">
          <div className="px-3.5 py-2.5">
            <p className="text-[10.5px] font-medium uppercase tracking-wider text-slate-500">Total Capacity</p>
            <p className="mt-0.5 font-sans text-base sm:text-lg font-semibold tracking-tight text-slate-900 tabular-nums">
              {isLoading ? '—' : Number(total).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="px-3.5 py-2.5">
            <p className="text-[10.5px] font-medium uppercase tracking-wider text-slate-500">In Use</p>
            <p className="mt-0.5 font-sans text-base sm:text-lg font-semibold tracking-tight text-emerald-700 tabular-nums">
              {isLoading ? '—' : Number(occupied).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="px-3.5 py-2.5">
            <p className="text-[10.5px] font-medium uppercase tracking-wider text-slate-500">Available</p>
            <p className="mt-0.5 font-sans text-base sm:text-lg font-semibold tracking-tight text-emerald-800 tabular-nums">
              {isLoading ? '—' : Number(available).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="max-h-[430px] overflow-auto overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700" role="region">
          <table className="w-full min-w-[580px] border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50/95 shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur">
              <tr className="font-medium uppercase tracking-wider text-[10.5px] text-slate-500">
                <th scope="col" className="px-4 py-3 sm:px-5">Size</th>
                <th scope="col" className="px-3 py-3">Dimensions</th>
                <th scope="col" className="px-3 py-3 text-right">Total</th>
                <th scope="col" className="px-3 py-3 text-right">In Use</th>
                <th scope="col" className="px-3 py-3 text-right">Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-normal">
              {LOCKER_SIZES.map((item) => {
                const row = stats?.sizeBreakdown?.[item.code];
                const rowTotal = row?.total ?? 0;
                const rowOccupied = row?.occupied ?? 0;
                const rowVacant = row?.vacant ?? 0;
                return (
                  <tr key={item.code} className="hover:bg-emerald-50/30 transition-colors">
                    <th scope="row" className="px-4 py-3 sm:px-5 font-medium text-slate-900">{item.code} - {item.label}</th>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-slate-500">{item.dimensions}</td>
                    <td className="px-3 py-3 text-right font-sans font-medium tabular-nums text-slate-900">{isLoading ? '—' : rowTotal.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-3 text-right font-sans font-medium tabular-nums text-emerald-700">{isLoading ? '—' : rowOccupied.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-3 text-right font-sans font-medium tabular-nums text-slate-700">{isLoading ? '—' : rowVacant.toLocaleString('en-IN')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();

  const canViewLockers = hasPermission('lockers.view');
  const canCreateAllocation = hasPermission('allocations.create');
  const canCreateCustomer = hasPermission('customers.create');
  const canViewRenewals = hasPermission('renewals.view');
  const canCreateRenewal = hasPermission('renewals.create');
  const canViewPayments = hasPermission('payments.view');
  const canCreatePayment = hasPermission('payments.create');
  const canViewCustomers = hasPermission('customers.view');

  const [activeView, setActiveView] = useState<ConsoleView>('VAULT_MATRIX');

  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [showGenerateRenewalModal, setShowGenerateRenewalModal] = useState(false);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | undefined>(undefined);

  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const [selectedLocker, setSelectedLocker] = useState<Locker | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToArchive, setCustomerToArchive] = useState<Customer | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<LockerInvoice | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [kycCustomer, setKycCustomer] = useState<Customer | null>(null);

  const lockerQuery = useQuery({
    queryKey: ['locker-stats'],
    queryFn: () => lockerApi.getLockerStats(),
    enabled: canViewLockers,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const customerStatsQuery = useQuery({
    queryKey: ['customer-stats'],
    queryFn: () => customerApi.getCustomerStats(),
    enabled: canViewCustomers,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const renewalQuery = useQuery({
    queryKey: ['renewal-stats'],
    queryFn: renewalApi.getRenewalStats,
    enabled: canViewRenewals,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const paymentQuery = useQuery({
    queryKey: ['payment-stats'],
    queryFn: paymentApi.getPaymentStats,
    enabled: canViewPayments,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const [lockerFilters, setLockerFilters] = useState<LockerQueryParams>({ limit: 1500 });
  const lockersListQuery = useQuery({
    queryKey: ['lockers-all', lockerFilters],
    queryFn: () => lockerApi.getLockers(lockerFilters),
    enabled: canViewLockers,
    staleTime: 180_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
  });

  const [customerSearch, setCustomerSearch] = useState('');
  const debouncedCustomerSearch = useDebounce(customerSearch.trim(), 300);
  const [customerFilters, setCustomerFilters] = useState<CustomerQueryParams>({ page: 1, limit: 10, search: '' });

  useEffect(() => {
    setCustomerFilters((prev) => (prev.search === debouncedCustomerSearch ? prev : { ...prev, search: debouncedCustomerSearch, page: 1 }));
  }, [debouncedCustomerSearch]);

  const customersListQuery = useQuery({
    queryKey: ['customers-all', customerFilters],
    queryFn: () => customerApi.getCustomers(customerFilters),
    enabled: canViewCustomers && activeView === 'CUSTOMERS',
    staleTime: 180_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
  });

  const [renewalFilters, setRenewalFilters] = useState<InvoiceQueryParams>({ page: 1, limit: 10, paymentStatus: undefined });
  const renewalsListQuery = useQuery({
    queryKey: ['renewals-all', renewalFilters],
    queryFn: () => renewalApi.getInvoices(renewalFilters),
    enabled: canViewRenewals && activeView === 'RENEWALS',
    staleTime: 180_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
  });

  const [paymentFilters, setPaymentFilters] = useState<PaymentQueryParams>({ page: 1, limit: 10 });
  const paymentsListQuery = useQuery({
    queryKey: ['payments-all', paymentFilters],
    queryFn: () => paymentApi.getPayments(paymentFilters),
    enabled: canViewPayments && activeView === 'PAYMENTS',
    staleTime: 180_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
  });

  const stats = lockerQuery.data;
  const renewalStats = renewalQuery.data;
  const paymentStats = paymentQuery.data;

  const total = stats?.total ?? 0;
  const occupied = stats?.occupied ?? 0;
  const allocationReady = stats?.availableForAllocation ?? 0;
  const occupancyRate = total ? ((occupied / total) * 100).toFixed(1) : '0.0';
  const unavailableUnits = (stats?.maintenance ?? 0) + (stats?.damaged ?? 0) + (stats?.decommissioned ?? 0);
  const classifiedTotal = (stats?.vacant ?? 0) + occupied + (stats?.reserved ?? 0) + (stats?.blocked ?? 0);
  const inventoryBalanced = Boolean(stats) && classifiedTotal === total;

  const isRefreshing = lockerQuery.isFetching || renewalQuery.isFetching || paymentQuery.isFetching || lockersListQuery.isFetching;
  const latestUpdate = Math.max(lockerQuery.dataUpdatedAt, renewalQuery.dataUpdatedAt, paymentQuery.dataUpdatedAt);

  const refreshAll = () => {
    queryClient.invalidateQueries();
  };

  const metricValue = (value: number, unavailable: boolean) =>
    !canViewLockers || unavailable ? '—' : value.toLocaleString('en-IN');

  return (
    <div className="space-y-4 sm:space-y-6 font-sans">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 lg:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-5">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-emerald-800" aria-hidden="true" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
              Single-Page Unified Operations
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              {latestUpdate ? `Live Synced ${new Date(latestUpdate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
            Safe-Deposit Vault Operations Cockpit
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-normal">
            All-in-one locker inventory, customer directory, billing ledger, and counter execution without switching tabs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          {canCreateAllocation && (
            <Button
              onClick={() => setShowAllocationModal(true)}
              className="h-10 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-xs gap-1.5 px-3.5 shadow-sm cursor-pointer flex-1 sm:flex-initial justify-center"
            >
              <KeyRound className="h-4 w-4 text-emerald-200" />
              <span>+ New Allocation</span>
            </Button>
          )}
          {canCreateCustomer && (
            <Button
              onClick={() => setShowCustomerModal(true)}
              variant="outline"
              className="h-10 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-xs gap-1.5 px-3 cursor-pointer flex-1 sm:flex-initial justify-center"
            >
              <UserPlus className="h-4 w-4 text-emerald-700" />
              <span>+ Add Customer</span>
            </Button>
          )}
          {canCreatePayment && (
            <Button
              onClick={() => {
                setPaymentInvoiceId(undefined);
                setShowRecordPaymentModal(true);
              }}
              variant="outline"
              className="h-10 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-xs gap-1.5 px-3 cursor-pointer flex-1 sm:flex-initial justify-center"
            >
              <CreditCard className="h-4 w-4 text-emerald-700" />
              <span>Record Payment</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={isRefreshing}
            className="h-10 rounded-xl border-slate-300 px-3 cursor-pointer shrink-0"
            aria-label="Refresh live data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-emerald-700' : 'text-slate-600'}`} />
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3.5 lg:grid-cols-6 lg:gap-4" aria-label="Vault metrics">
        <button
          type="button"
          onClick={() => {
            setActiveView('VAULT_MATRIX');
            setLockerFilters({ limit: 1500 });
          }}
          className="w-full text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 cursor-pointer"
        >
          <StatCard
            title="Total Lockers"
            value={metricValue(total, lockerQuery.isLoading)}
            subtitle="Sizes A to G2"
            icon={Layers}
            iconBg="bg-slate-100"
            iconColor="text-slate-800"
            badge={{ text: 'Master', variant: 'neutral' }}
          />
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveView('VAULT_MATRIX');
            setLockerFilters({ limit: 1500, status: 'OCCUPIED' });
          }}
          className="w-full text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 cursor-pointer"
        >
          <StatCard
            title="Occupied"
            value={metricValue(occupied, lockerQuery.isLoading)}
            subtitle={`${occupancyRate}% occupancy`}
            icon={CheckCircle}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-800"
            badge={{ text: 'Allocated', variant: 'success' }}
          />
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveView('VAULT_MATRIX');
            setLockerFilters({ limit: 1500, status: 'VACANT' });
          }}
          className="w-full text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 cursor-pointer"
        >
          <StatCard
            title="Allocation Ready"
            value={metricValue(allocationReady, lockerQuery.isLoading)}
            subtitle="Available units"
            icon={KeyRound}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-800"
            badge={{ text: 'Available', variant: 'success' }}
          />
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveView('RENEWALS');
            setRenewalFilters({ page: 1, limit: 10, paymentStatus: 'UNPAID' });
          }}
          className="w-full text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 cursor-pointer"
        >
          <StatCard
            title="Due This Month"
            value={!canViewRenewals || renewalQuery.isLoading ? '—' : String(renewalStats?.dueThisMonth.count ?? 0)}
            subtitle={`${formatCurrency(renewalStats?.dueThisMonth.amount ?? 0)} rent`}
            icon={Clock}
            iconBg="bg-amber-50"
            iconColor="text-amber-800"
            badge={{ text: 'Due Soon', variant: 'warning' }}
          />
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveView('RENEWALS');
            setRenewalFilters({ page: 1, limit: 10, paymentStatus: 'UNPAID' });
          }}
          className="w-full text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 cursor-pointer"
        >
          <StatCard
            title="Overdue Invoices"
            value={!canViewRenewals || renewalQuery.isLoading ? '—' : String(renewalStats?.overdue.count ?? 0)}
            subtitle={`${formatCurrency(renewalStats?.overdue.amount ?? 0)} due`}
            icon={AlertOctagon}
            iconBg="bg-rose-50"
            iconColor="text-rose-800"
            badge={{ text: 'Action Req.', variant: 'destructive' }}
          />
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveView('PAYMENTS');
            setPaymentFilters({ page: 1, limit: 10 });
          }}
          className="w-full text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 cursor-pointer"
        >
          <StatCard
            title="Today's Collection"
            value={!canViewPayments || paymentQuery.isLoading ? '—' : formatCurrency(paymentStats?.todayCollection.amount ?? 0)}
            subtitle={`${paymentStats?.todayCollection.count ?? 0} receipts`}
            icon={IndianRupee}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-800"
            badge={{ text: 'Completed', variant: 'success' }}
          />
        </button>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-start gap-3 overflow-x-auto border-b border-slate-200 pb-2.5 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-none">
          <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-100/90 p-1 sm:p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs shrink-0">
            {canViewLockers && (
              <button
                type="button"
                onClick={() => setActiveView('VAULT_MATRIX')}
                className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeView === 'VAULT_MATRIX'
                    ? 'bg-white text-emerald-900 shadow-sm border border-slate-200/90'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Layers className="h-4 w-4 text-emerald-800 shrink-0" />
                <span>Vault Matrix ({total.toLocaleString('en-IN')})</span>
              </button>
            )}

            {canViewCustomers && (
              <button
                type="button"
                onClick={() => setActiveView('CUSTOMERS')}
                className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeView === 'CUSTOMERS'
                    ? 'bg-white text-emerald-900 shadow-sm border border-slate-200/90'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Users className="h-4 w-4 text-emerald-800 shrink-0" />
                <span>
                  Customer Directory ({((customerStatsQuery.data?.total ?? customersListQuery.data?.pagination?.total ?? 372)).toLocaleString('en-IN')})
                </span>
              </button>
            )}

            {canViewRenewals && (
              <button
                type="button"
                onClick={() => setActiveView('RENEWALS')}
                className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeView === 'RENEWALS'
                    ? 'bg-white text-emerald-900 shadow-sm border border-slate-200/90'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <CalendarDays className="h-4 w-4 text-amber-700 shrink-0" />
                <span>
                  Renewals &amp; Invoices ({renewalsListQuery.data?.pagination?.total ? renewalsListQuery.data.pagination.total.toLocaleString('en-IN') : '2,647'})
                </span>
              </button>
            )}

            {canViewPayments && (
              <button
                type="button"
                onClick={() => setActiveView('PAYMENTS')}
                className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeView === 'PAYMENTS'
                    ? 'bg-white text-emerald-900 shadow-sm border border-slate-200/90'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Receipt className="h-4 w-4 text-emerald-700 shrink-0" />
                <span>
                  Receipts &amp; Payments ({paymentStats?.totalTransactions ? paymentStats.totalTransactions.toLocaleString('en-IN') : paymentsListQuery.data?.pagination?.total ? paymentsListQuery.data.pagination.total.toLocaleString('en-IN') : 'Live'})
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveView('CAPACITY_TELEMETRY')}
              className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeView === 'CAPACITY_TELEMETRY'
                  ? 'bg-white text-emerald-900 shadow-sm border border-slate-200/90'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Activity className="h-4 w-4 text-sky-700 shrink-0" />
              <span>Capacity & Telemetry</span>
            </button>
          </div>
        </div>

        {activeView === 'VAULT_MATRIX' && canViewLockers && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-semibold text-slate-900 block sm:inline">Interactive Vault Matrix</span>
                <span className="hidden md:inline text-xs text-slate-500 font-normal ml-2">
                  Click any locker unit to view details, inspect customer tenancy, or allocate immediately.
                </span>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0">
                {lockerFilters.status && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setLockerFilters({ limit: 1500 })}
                    className="h-8 text-xs text-slate-500 hover:text-slate-900 px-2"
                  >
                    Clear Filter ({lockerFilters.status})
                  </Button>
                )}
                {canCreateAllocation && (
                  <Button
                    onClick={() => setShowAllocationModal(true)}
                    size="sm"
                    className="h-8 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium gap-1.5 px-3 shadow-2xs cursor-pointer ml-auto sm:ml-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Allocate Locker</span>
                  </Button>
                )}
              </div>
            </div>

            <LockerVaultGrid
              lockers={lockersListQuery.data?.lockers ?? []}
              isLoading={lockersListQuery.isLoading}
              onSelectLocker={(locker) => setSelectedLocker(locker)}
            />
          </div>
        )}

        {activeView === 'CUSTOMERS' && canViewCustomers && (
          <div className="space-y-4">
            {/* Enhanced Customer Directory Toolbar */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3">
              {/* Row 1: Search + Add Customer (Inline and responsive) */}
              <div className="flex items-center justify-between gap-2.5">
                <div className="relative flex-1 min-w-0 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name, phone (+91), code (CUS-...)..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50/80 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs transition-all"
                  />
                  {customerSearch && (
                    <button
                      type="button"
                      onClick={() => setCustomerSearch('')}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      aria-label="Clear customer search"
                    >
                      <span className="text-xs font-bold bg-slate-200 text-slate-600 rounded-full w-4 h-4 flex items-center justify-center">
                        &times;
                      </span>
                    </button>
                  )}
                </div>

                {canCreateCustomer && (
                  <Button
                    onClick={() => setShowCustomerModal(true)}
                    size="sm"
                    className="h-9 px-3 sm:px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold gap-1.5 shadow-2xs cursor-pointer active:scale-[0.98] transition-all shrink-0"
                  >
                    <UserPlus className="h-4 w-4 shrink-0" />
                    <span className="hidden xs:inline">+ Add Customer</span>
                    <span className="inline xs:hidden">+ Add</span>
                  </Button>
                )}
              </div>

              {/* Row 2: KYC Compliance Filter Tabs + Account Status Dropdown + Reset */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 overflow-x-auto scrollbar-none max-w-full shrink-0">
                  <button
                    type="button"
                    onClick={() => setCustomerFilters((prev) => ({ ...prev, kycStatus: undefined, page: 1 }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      customerFilters.kycStatus === undefined
                        ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>All KYC</span>
                    <span className="text-[10.5px] px-1.5 py-0.2 rounded-md font-mono bg-slate-200/70 text-slate-700">
                      {customerStatsQuery.data?.total ?? customersListQuery.data?.pagination?.total ?? 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setCustomerFilters((prev) => ({
                        ...prev,
                        kycStatus: prev.kycStatus === 'VERIFIED' ? undefined : 'VERIFIED',
                        page: 1,
                      }))
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      customerFilters.kycStatus === 'VERIFIED'
                        ? 'bg-emerald-800 text-white shadow-2xs font-semibold'
                        : 'text-emerald-800 hover:bg-emerald-50/60'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${customerFilters.kycStatus === 'VERIFIED' ? 'bg-white' : 'bg-emerald-600'}`} />
                    <span>KYC Verified</span>
                    {customerStatsQuery.data?.kycVerified !== undefined && (
                      <span
                        className={`text-[10.5px] px-1.5 py-0.2 rounded-md font-mono ${
                          customerFilters.kycStatus === 'VERIFIED' ? 'bg-emerald-900 text-white' : 'bg-emerald-100/80 text-emerald-900'
                        }`}
                      >
                        {customerStatsQuery.data.kycVerified}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setCustomerFilters((prev) => ({
                        ...prev,
                        kycStatus: prev.kycStatus === 'PENDING' ? undefined : 'PENDING',
                        page: 1,
                      }))
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      customerFilters.kycStatus === 'PENDING'
                        ? 'bg-amber-800 text-white shadow-2xs font-semibold'
                        : 'text-amber-800 hover:bg-amber-50/60'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${customerFilters.kycStatus === 'PENDING' ? 'bg-white' : 'bg-amber-600'}`} />
                    <span>KYC Pending</span>
                    {customerStatsQuery.data?.kycPending !== undefined && (
                      <span
                        className={`text-[10.5px] px-1.5 py-0.2 rounded-md font-mono ${
                          customerFilters.kycStatus === 'PENDING' ? 'bg-amber-900 text-white' : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {customerStatsQuery.data.kycPending}
                      </span>
                    )}
                  </button>

                  {customerStatsQuery.data?.kycRejected ? (
                    <button
                      type="button"
                      onClick={() =>
                        setCustomerFilters((prev) => ({
                          ...prev,
                          kycStatus: prev.kycStatus === 'REJECTED' ? undefined : 'REJECTED',
                          page: 1,
                        }))
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                        customerFilters.kycStatus === 'REJECTED'
                          ? 'bg-rose-800 text-white shadow-2xs font-semibold'
                          : 'text-rose-800 hover:bg-rose-50/60'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${customerFilters.kycStatus === 'REJECTED' ? 'bg-white' : 'bg-rose-600'}`} />
                      <span>Rejected</span>
                      <span
                        className={`text-[10.5px] px-1.5 py-0.2 rounded-md font-mono ${
                          customerFilters.kycStatus === 'REJECTED' ? 'bg-rose-900 text-white' : 'bg-rose-100 text-rose-900'
                        }`}
                      >
                        {customerStatsQuery.data.kycRejected}
                      </span>
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  {/* Account Status Filter Dropdown */}
                  <div className="relative inline-flex items-center h-9 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 transition-all shadow-2xs group focus-within:ring-2 focus-within:ring-emerald-700/20 focus-within:border-emerald-700">
                    <div className="pl-3 pr-1.5 flex items-center gap-1 pointer-events-none text-slate-500">
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Status:</span>
                    </div>
                    <select
                      value={customerFilters.status || 'ALL'}
                      onChange={(e) =>
                        setCustomerFilters((prev) => ({
                          ...prev,
                          status: e.target.value === 'ALL' ? undefined : e.target.value,
                          page: 1,
                        }))
                      }
                      className="h-9 pl-1 pr-7 text-xs bg-transparent font-medium text-slate-900 focus:outline-none cursor-pointer appearance-none"
                      aria-label="Filter customer status"
                    >
                      <option value="ALL">All Account States</option>
                      <option value="ACTIVE">Active Accounts</option>
                      <option value="INACTIVE">Inactive Accounts</option>
                      <option value="BLOCKED">Blocked Accounts</option>
                    </select>
                    <div className="absolute right-2.5 pointer-events-none text-slate-400 group-hover:text-slate-600">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </div>
                  </div>

                  {/* Reset Filters */}
                  {(customerSearch || customerFilters.kycStatus || customerFilters.status) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerSearch('');
                        setCustomerFilters({ page: 1, limit: 10, search: '' });
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-950 px-3 h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 transition-all cursor-pointer shadow-2xs shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <CustomerTable
              customers={customersListQuery.data?.customers ?? []}
              pagination={customersListQuery.data?.pagination}
              isLoading={customersListQuery.isLoading}
              filters={customerFilters}
              onSortChange={(sort) => setCustomerFilters((prev) => ({ ...prev, sortBy: sort }))}
              onPageChange={(page) => setCustomerFilters((prev) => ({ ...prev, page }))}
              onLimitChange={(limit) => setCustomerFilters((prev) => ({ ...prev, limit, page: 1 }))}
              onView={(customer) => setSelectedCustomer(customer)}
              onEdit={(customer) => setEditingCustomer(customer)}
              onManageKyc={(customer) => setKycCustomer(customer)}
              onQuickPreview={(customer) => setSelectedCustomer(customer)}
              onDeactivate={(customer) => setCustomerToArchive(customer)}
            />
          </div>
        )}

        {activeView === 'RENEWALS' && canViewRenewals && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none shrink-0 pb-0.5 sm:pb-0">
                <Button
                  size="sm"
                  variant={renewalFilters.paymentStatus === undefined ? 'default' : 'outline'}
                  onClick={() => setRenewalFilters((prev) => ({ ...prev, paymentStatus: undefined, page: 1 }))}
                  className={`h-7.5 px-3 text-xs rounded-lg whitespace-nowrap shrink-0 ${renewalFilters.paymentStatus === undefined ? 'bg-emerald-800 text-white' : ''}`}
                >
                  All Invoices
                </Button>
                <Button
                  size="sm"
                  variant={renewalFilters.paymentStatus === 'UNPAID' ? 'default' : 'outline'}
                  onClick={() => setRenewalFilters((prev) => ({ ...prev, paymentStatus: 'UNPAID', page: 1 }))}
                  className={`h-7.5 px-3 text-xs rounded-lg whitespace-nowrap shrink-0 ${renewalFilters.paymentStatus === 'UNPAID' ? 'bg-amber-800 text-white' : ''}`}
                >
                  Pending / Unpaid
                </Button>
                <Button
                  size="sm"
                  variant={renewalFilters.paymentStatus === 'PAID' ? 'default' : 'outline'}
                  onClick={() => setRenewalFilters((prev) => ({ ...prev, paymentStatus: 'PAID', page: 1 }))}
                  className={`h-7.5 px-3 text-xs rounded-lg whitespace-nowrap shrink-0 ${renewalFilters.paymentStatus === 'PAID' ? 'bg-emerald-800 text-white' : ''}`}
                >
                  Paid
                </Button>
              </div>
              {canCreateRenewal && (
                <Button
                  onClick={() => setShowGenerateRenewalModal(true)}
                  size="sm"
                  className="h-8 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Generate Renewal</span>
                </Button>
              )}
            </div>

            <RenewalTable
              invoices={renewalsListQuery.data?.invoices ?? []}
              pagination={renewalsListQuery.data?.pagination}
              isLoading={renewalsListQuery.isLoading}
              filters={renewalFilters}
              onPageChange={(page) => setRenewalFilters((prev) => ({ ...prev, page }))}
              onView={(invoice) => setSelectedInvoice(invoice)}
              onCancel={() => {}}
              onGenerateRenewal={() => setShowGenerateRenewalModal(true)}
            />
          </div>
        )}

        {activeView === 'PAYMENTS' && canViewPayments && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
              <span className="text-xs font-semibold text-slate-900">Payment Collection Register & In-Page Print</span>
              {canCreatePayment && (
                <Button
                  onClick={() => {
                    setPaymentInvoiceId(undefined);
                    setShowRecordPaymentModal(true);
                  }}
                  size="sm"
                  className="h-8 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>Record Payment</span>
                </Button>
              )}
            </div>

            <PaymentTable
              payments={paymentsListQuery.data?.payments ?? []}
              pagination={paymentsListQuery.data?.pagination}
              isLoading={paymentsListQuery.isLoading}
              filters={paymentFilters}
              onPageChange={(page) => setPaymentFilters((prev) => ({ ...prev, page }))}
              onView={(payment) => setSelectedPayment(payment)}
              onPrintReceipt={(payment) => setSelectedPayment(payment)}
              onCancel={() => {}}
              onRecordPayment={() => {
                setPaymentInvoiceId(undefined);
                setShowRecordPaymentModal(true);
              }}
            />
          </div>
        )}

        {activeView === 'CAPACITY_TELEMETRY' && (
          <div className="space-y-5">
            <SystemHealthCard />
            <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:gap-6 xl:grid-cols-2">
              <SizeInventoryCard stats={stats} isLoading={lockerQuery.isLoading} />

              <Card className="rounded-2xl border border-slate-200/90 bg-white shadow-xs">
                <CardHeader className="flex flex-row items-center justify-between p-4 pb-2 sm:p-5 sm:pb-2 border-b border-slate-100">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900 tracking-tight">
                      Operational Attention
                    </CardTitle>
                    <p className="text-xs text-slate-500 font-normal">Real-time custody alerts and reconciliation status</p>
                  </div>
                  <span className="text-[10.5px] font-mono font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Live checks
                  </span>
                </CardHeader>
                
                <CardContent className="space-y-3 p-4 sm:p-5">
                  <div className={`flex items-start gap-3 rounded-xl border p-3.5 ${inventoryBalanced ? 'border-slate-200 bg-slate-50/70' : 'border-red-200 bg-red-50'}`}>
                    <div className={`mt-0.5 rounded-lg p-2 ${inventoryBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      {inventoryBalanced ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    </div>
                    <div className="text-xs">
                      <p className="font-medium text-slate-900">
                        Inventory classification {inventoryBalanced ? 'reconciled' : 'needs review'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500 font-normal">
                        {lockerQuery.isLoading ? 'Checking live locker registry…' : `${classifiedTotal.toLocaleString('en-IN')} classified of ${total.toLocaleString('en-IN')} active records`}
                      </p>
                    </div>
                  </div>

                  <div className={`flex items-start gap-3 rounded-xl border p-3.5 ${unavailableUnits ? 'border-amber-200 bg-amber-50/70' : 'border-slate-200 bg-slate-50/70'}`}>
                    <div className={`mt-0.5 rounded-lg p-2 ${unavailableUnits ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {unavailableUnits ? <Wrench className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    </div>
                    <div className="text-xs">
                      <p className="font-medium text-slate-900">
                        {unavailableUnits.toLocaleString('en-IN')} units operationally unavailable
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500 font-normal">
                        Maintenance {stats?.maintenance ?? 0} &bull; Damaged {stats?.damaged ?? 0} &bull; Decommissioned {stats?.decommissioned ?? 0}
                      </p>
                    </div>
                  </div>

                  <div className={`flex items-start gap-3 rounded-xl border p-3.5 ${(renewalStats?.overdue.count ?? 0) ? 'border-rose-200 bg-rose-50/70' : 'border-slate-200 bg-slate-50/70'}`}>
                    <div className={`mt-0.5 rounded-lg p-2 ${(renewalStats?.overdue.count ?? 0) ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {(renewalStats?.overdue.count ?? 0) ? <ShieldAlert className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="font-medium text-slate-900">
                        {renewalStats?.overdue.count ?? 0} overdue invoices require collection review
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-600 font-normal">
                        Outstanding balance: <span className="font-semibold text-slate-900">{formatCurrency(renewalStats?.overdue.amount ?? 0)}</span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </section>

      <React.Suspense fallback={null}>
        {showAllocationModal && (
          <AllocationWizardModal
            onClose={() => setShowAllocationModal(false)}
            onSubmit={async (data) => {
              try {
                setIsSubmittingAction(true);
                await allocationApi.createAllocation(data as any);
                setShowAllocationModal(false);
                refreshAll();
              } finally {
                setIsSubmittingAction(false);
              }
            }}
            isSubmitting={isSubmittingAction}
          />
        )}

        {(showCustomerModal || editingCustomer) && (
          <CustomerFormModal
            customer={editingCustomer}
            onClose={() => {
              setShowCustomerModal(false);
              setEditingCustomer(null);
            }}
            onSubmit={async (data) => {
              try {
                setIsSubmittingAction(true);
                if (editingCustomer) {
                  await customerApi.updateCustomer(editingCustomer._id, data as any);
                } else {
                  await customerApi.createCustomer(data as any);
                }
                setShowCustomerModal(false);
                setEditingCustomer(null);
                refreshAll();
              } finally {
                setIsSubmittingAction(false);
              }
            }}
            isSubmitting={isSubmittingAction}
          />
        )}

        {showRecordPaymentModal && (
          <RecordPaymentModal
            initialInvoiceId={paymentInvoiceId}
            onClose={() => {
              setShowRecordPaymentModal(false);
              setPaymentInvoiceId(undefined);
            }}
            onSubmit={async (data, idempotencyKey) => {
              const payment = await paymentApi.recordPayment(data, idempotencyKey);
              setShowRecordPaymentModal(false);
              setPaymentInvoiceId(undefined);
              refreshAll();
              return payment;
            }}
            onSuccessViewReceipt={(payment) => {
              setSelectedPayment(payment);
            }}
          />
        )}

        {showGenerateRenewalModal && (
          <GenerateRenewalModal
            onClose={() => setShowGenerateRenewalModal(false)}
            onSubmit={async (data) => {
              try {
                setIsSubmittingAction(true);
                await renewalApi.generateRenewal(data);
                setShowGenerateRenewalModal(false);
                refreshAll();
              } finally {
                setIsSubmittingAction(false);
              }
            }}
            isSubmitting={isSubmittingAction}
          />
        )}

        {selectedLocker && (
          <LockerDetailModal
            locker={selectedLocker}
            onClose={() => setSelectedLocker(null)}
            onEdit={() => {}}
          />
        )}

        {selectedCustomer && (
          <CustomerQuickPreview
            customer={selectedCustomer}
            onClose={() => setSelectedCustomer(null)}
            onEdit={(customer) => {
              setSelectedCustomer(null);
              setEditingCustomer(customer);
            }}
            onManageKyc={(customer) => {
              setSelectedCustomer(null);
              setKycCustomer(customer);
            }}
          />
        )}

        {kycCustomer && (
          <KycDocumentModal
            customerId={kycCustomer._id}
            onClose={() => setKycCustomer(null)}
            onSubmit={async (data) => {
              await customerApi.addKycDocument(kycCustomer._id, data as AddKycDocumentInput);
              setKycCustomer(null);
              queryClient.invalidateQueries({ queryKey: ['customers-all'] });
            }}
            isSubmitting={false}
          />
        )}

        {/* Customer Archive Confirmation Popup Modal */}
        {customerToArchive && (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in-0 duration-150"
            onClick={() => setCustomerToArchive(null)}
          >
            <div
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0">
                  <AlertOctagon className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Archive Customer Account</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Are you sure you want to archive <strong>{customerToArchive.fullName}</strong> ({customerToArchive.customerCode})? This will deactivate the customer record in-place.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomerToArchive(null)}
                  disabled={isSubmittingAction}
                  className="h-9 px-4 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={isSubmittingAction}
                  onClick={async () => {
                    try {
                      setIsSubmittingAction(true);
                      await customerApi.deactivateCustomer(customerToArchive._id);
                      setCustomerToArchive(null);
                      refreshAll();
                    } finally {
                      setIsSubmittingAction(false);
                    }
                  }}
                  className="h-9 px-4 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {isSubmittingAction ? 'Archiving...' : 'Archive Customer'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 8. Invoice Dossier Modal with In-Page Direct Print */}
        {selectedInvoice && (
          <InvoiceDetailModal
            invoice={selectedInvoice}
            onClose={() => setSelectedInvoice(null)}
            onRecordPayment={() => {
              setPaymentInvoiceId(selectedInvoice._id);
              setShowRecordPaymentModal(true);
              setSelectedInvoice(null);
            }}
          />
        )}

        {/* 9. Payment Receipt Modal with In-Page Direct Print */}
        {selectedPayment && (
          <PaymentReceiptModal
            payment={selectedPayment}
            onClose={() => setSelectedPayment(null)}
          />
        )}
      </React.Suspense>
    </div>
  );
}
