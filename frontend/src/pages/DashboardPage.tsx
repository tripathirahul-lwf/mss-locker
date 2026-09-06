import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Lock,
  FolderOpen,
  Calendar,
  CreditCard,
  TrendingUp,
  Receipt,
  Users,
  UserPlus,
  RefreshCw,
  KeyRound,
  ArrowUpRight,
  ShieldCheck,
  FileCheck,
  Layers,
  ChevronRight,
  AlertTriangle,
  Archive,
  CheckCircle2,
  Database,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { lockerApi } from '../features/lockers/api/lockerApi';
import { customerApi } from '../features/customers/api/customerApi';
import { renewalApi } from '../features/renewals/api/renewalApi';
import { paymentApi } from '../features/payments/api/paymentApi';
import { allocationApi } from '../features/allocations/api/allocationApi';
import { AllocationWizardModal } from '../features/allocations/components/AllocationWizardModal';
import { CustomerFormModal } from '../features/customers/components/CustomerFormModal';
import { RecordPaymentModal } from '../features/payments/components/RecordPaymentModal';
import { PaymentReceiptModal } from '../features/payments/components/PaymentReceiptModal';
import { CreateAllocationInput, ReserveLockerInput } from '../features/allocations/types';
import { CreateCustomerInput, UpdateCustomerInput } from '../features/customers/types';
import { RecordPaymentInput, Payment } from '../features/payments/types';
import { useAuth } from '../hooks/useAuth';
import { LOCKER_SIZES } from '../features/lockers/constants';

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const formatCurrency = (val: number) => currencyFormatter.format(val || 0);

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  onClick?: () => void;
  isLoading?: boolean;
}

function MetricCard({
  title,
  value,
  subtitle,
  badge,
  badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  icon: Icon,
  iconColor,
  iconBg,
  onClick,
  isLoading,
}: MetricCardProps) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className="group relative overflow-hidden rounded-2xl p-3.5 sm:p-5 transition-all duration-200 bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.04)] hover:border-slate-300 hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer select-none flex flex-col justify-between min-h-[128px] sm:min-h-[148px]"
    >
      {/* Top row: Label & Icon */}
      <div className="flex items-start justify-between gap-2 sm:gap-3 pt-0.5">
        <div className="space-y-1 min-w-0 flex-1">
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500 font-sans block truncate" title={title}>
            {title}
          </span>
          <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
            <h3 className="font-sans text-xl sm:text-2xl lg:text-[28px] font-bold tracking-tight text-slate-900 tabular-nums">
              {isLoading ? (
                <span className="inline-block h-7 sm:h-8 w-16 sm:w-20 bg-slate-200/60 rounded-lg animate-pulse" />
              ) : (
                value
              )}
            </h3>
            {badge && !isLoading && (
              <span
                className={`inline-flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-semibold border truncate max-w-full ${badgeColor}`}
              >
                {badge}
              </span>
            )}
          </div>
        </div>

        {/* Responsive tinted square icon button */}
        <div
          className={`grid h-8 w-8 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-105 border ${iconBg}`}
        >
          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${iconColor}`} />
        </div>
      </div>

      {/* Bottom row: Subtitle & link hint */}
      <div className="mt-2.5 sm:mt-4 flex items-center justify-between pt-2 sm:pt-2.5 border-t border-slate-100 text-[10.5px] sm:text-xs text-slate-500">
        <span className="truncate font-normal text-slate-500">{subtitle}</span>
        <ArrowUpRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400 group-hover:text-slate-700 transition-colors shrink-0 ml-1" />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();

  const canViewLockers = hasPermission('lockers.view');
  const canCreateAllocation = hasPermission('allocations.create');
  const canCreateCustomer = hasPermission('customers.create');
  const canCreatePayment = hasPermission('payments.create');

  // Modal visibility & submission states
  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false);
  const [isSubmittingAllocation, setIsSubmittingAllocation] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleAllocationSubmit = async (data: CreateAllocationInput | ReserveLockerInput) => {
    setIsSubmittingAllocation(true);
    try {
      await allocationApi.createAllocation(data as CreateAllocationInput);
      setIsAllocationModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['locker-stats'] });
      queryClient.invalidateQueries({ queryKey: ['customer-stats'] });
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      setNotice('Locker allocated successfully!');
    } finally {
      setIsSubmittingAllocation(false);
    }
  };

  const handleCustomerSubmit = async (data: CreateCustomerInput | UpdateCustomerInput) => {
    setIsSubmittingCustomer(true);
    try {
      await customerApi.createCustomer(data as CreateCustomerInput);
      setIsCustomerModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['customer-stats'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setNotice('Customer profile created successfully!');
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const handleRecordPaymentSubmit = async (data: RecordPaymentInput, idempotencyKey: string) => {
    const payment = await paymentApi.recordPayment(data, idempotencyKey);
    setIsPaymentModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
    queryClient.invalidateQueries({ queryKey: ['renewal-stats'] });
    queryClient.invalidateQueries({ queryKey: ['payments'] });
    queryClient.invalidateQueries({ queryKey: ['renewals'] });
    setNotice(`Payment ${payment.receiptNumber || payment.paymentNumber} recorded successfully!`);
    return payment;
  };

  // Queries for the 8 core operational metrics
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
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const renewalQuery = useQuery({
    queryKey: ['renewal-stats'],
    queryFn: renewalApi.getRenewalStats,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const paymentQuery = useQuery({
    queryKey: ['payment-stats'],
    queryFn: paymentApi.getPaymentStats,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const recentCustomersQuery = useQuery({
    queryKey: ['recent-customers'],
    queryFn: () => customerApi.getCustomers({ limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const lockerStats = lockerQuery.data;
  const renewalStats = renewalQuery.data;
  const paymentStats = paymentQuery.data;
  const customerStats = customerStatsQuery.data;
  const recentCustomers = recentCustomersQuery.data?.customers || [];

  // Calculated values
  const totalLockers = lockerStats?.total ?? 0;
  const occupiedLockers = lockerStats?.occupied ?? 0;
  const availableLockers = lockerStats?.availableForAllocation ?? lockerStats?.vacant ?? 0;
  const totalCustomers = customerStats?.total ?? 0;
  const activeCustomers = customerStats?.active ?? 0;
  const kycVerified = customerStats?.kycVerified ?? 0;
  const kycIncomplete = (customerStats?.kycPending ?? 0) + (customerStats?.kycPartial ?? 0);
  const kycComplianceRate =
    totalCustomers > 0 ? ((kycVerified / totalCustomers) * 100).toFixed(1) : '100';
  const renewalsDue = renewalStats?.dueThisMonth?.count ?? 0;

  const occupancyRate =
    totalLockers > 0 ? ((occupiedLockers / totalLockers) * 100).toFixed(1) : '0';
  const availableRate =
    totalLockers > 0 ? ((availableLockers / totalLockers) * 100).toFixed(1) : '0';

  const monthlyRevenue =
    paymentStats?.monthCollection?.amount ?? paymentStats?.todayCollection?.amount ?? 0;
  const yearlyRevenue = monthlyRevenue * 12 || (lockerStats ? occupiedLockers * 2000 : 0);
  const monthlyGst = Math.round(monthlyRevenue * 0.18);

  const isRefreshing =
    lockerQuery.isFetching ||
    renewalQuery.isFetching ||
    paymentQuery.isFetching ||
    customerStatsQuery.isFetching ||
    recentCustomersQuery.isFetching;

  const refreshAll = () => {
    queryClient.invalidateQueries();
  };

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* Top Header Banner */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pb-2 border-b border-slate-200/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Dashboard Overview
            </h1>
            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/70 font-sans">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Live Stream
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 font-normal">
            <span>Real-time vault intelligence & custody operations</span>
            <span className="text-slate-300 hidden md:inline">•</span>
            <span className="font-mono text-xs text-slate-400 hidden md:inline">
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        {/* Quick Operations Action Strip */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto [scrollbar-width:none] pb-1 sm:pb-0 w-full sm:w-auto">
          {canCreateAllocation && (
            <Button
              onClick={() => setIsAllocationModalOpen(true)}
              className="h-9 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs gap-1.5 px-3 sm:px-3.5 shadow-2xs cursor-pointer transition shrink-0"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>+ New Allocation</span>
            </Button>
          )}

          {canCreateCustomer && (
            <Button
              onClick={() => setIsCustomerModalOpen(true)}
              variant="outline"
              className="h-9 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs gap-1.5 px-2.5 sm:px-3 cursor-pointer transition shrink-0"
            >
              <UserPlus className="h-3.5 w-3.5 text-emerald-700" />
              <span>+ Customer</span>
            </Button>
          )}

          {canCreatePayment && (
            <Button
              onClick={() => setIsPaymentModalOpen(true)}
              variant="outline"
              className="h-9 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs gap-1.5 px-2.5 sm:px-3 cursor-pointer transition shrink-0"
            >
              <CreditCard className="h-3.5 w-3.5 text-emerald-700" />
              <span>Payment</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={isRefreshing}
            className="h-9 rounded-xl border-slate-300 px-2.5 cursor-pointer text-slate-600 hover:text-slate-900 shrink-0 ml-auto sm:ml-0"
            title="Refresh metrics"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-emerald-700' : ''}`}
            />
          </Button>
        </div>
      </section>

      {/* 8 Core Metric Cards Grid */}
      <section
        className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-2.5 sm:gap-4"
        aria-label="Overview Metrics"
      >
        {/* 1. TOTAL LOCKERS */}
        <MetricCard
          title="TOTAL LOCKERS"
          value={totalLockers.toLocaleString('en-IN')}
          subtitle="Total safe-deposit capacity"
          badge="100% Registry"
          badgeColor="bg-slate-100 text-slate-700 border-slate-200"
          icon={Package}
          iconColor="text-slate-700"
          iconBg="bg-slate-50 border-slate-200/80"
          onClick={() => navigate('/lockers')}
          isLoading={lockerQuery.isLoading}
        />

        {/* 2. OCCUPIED */}
        <MetricCard
          title="OCCUPIED"
          value={occupiedLockers.toLocaleString('en-IN')}
          subtitle="Active customer leases"
          badge={`${occupancyRate}% Occupancy`}
          badgeColor="bg-emerald-50 text-emerald-800 border-emerald-200/80"
          icon={Lock}
          iconColor="text-emerald-700"
          iconBg="bg-emerald-50 border-emerald-200/80"
          onClick={() => navigate('/lockers?status=OCCUPIED')}
          isLoading={lockerQuery.isLoading}
        />

        {/* 3. AVAILABLE */}
        <MetricCard
          title="AVAILABLE"
          value={availableLockers.toLocaleString('en-IN')}
          subtitle="Ready for rental allotment"
          badge={`${availableRate}% Ready`}
          badgeColor="bg-sky-50 text-sky-800 border-sky-200/80"
          icon={FolderOpen}
          iconColor="text-sky-700"
          iconBg="bg-sky-50 border-sky-200/80"
          onClick={() => navigate('/lockers?status=VACANT')}
          isLoading={lockerQuery.isLoading}
        />

        {/* 4. TOTAL CUSTOMERS */}
        <MetricCard
          title="TOTAL CUSTOMERS"
          value={totalCustomers.toLocaleString('en-IN')}
          subtitle="Registered custody clients"
          badge={`${activeCustomers} Active`}
          badgeColor="bg-emerald-50 text-emerald-800 border-emerald-200/80"
          icon={Users}
          iconColor="text-emerald-700"
          iconBg="bg-emerald-50 border-emerald-200/80"
          onClick={() => navigate('/customers')}
          isLoading={customerStatsQuery.isLoading}
        />

        {/* 5. KYC COMPLIANCE */}
        <MetricCard
          title="KYC COMPLIANCE"
          value={kycVerified.toLocaleString('en-IN')}
          subtitle={
            kycIncomplete > 0
              ? `${kycIncomplete} verification pending`
              : 'All identity proofs verified'
          }
          badge={
            kycIncomplete > 0
              ? `${kycIncomplete} Pending`
              : `${kycComplianceRate}% Verified`
          }
          badgeColor={
            kycIncomplete > 0
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }
          icon={ShieldCheck}
          iconColor={kycIncomplete > 0 ? 'text-amber-700' : 'text-emerald-700'}
          iconBg={
            kycIncomplete > 0
              ? 'bg-amber-50 border-amber-200'
              : 'bg-emerald-50 border-emerald-200'
          }
          onClick={() =>
            navigate(
              kycIncomplete > 0
                ? '/customers?kycStatus=PENDING,PARTIAL'
                : '/customers?kycStatus=VERIFIED'
            )
          }
          isLoading={customerStatsQuery.isLoading}
        />

        {/* 6. RENEWALS DUE */}
        <MetricCard
          title="RENEWALS DUE"
          value={renewalsDue}
          subtitle="Require renewal attention"
          badge={renewalsDue > 0 ? `${renewalsDue} Due Soon` : 'All Clear'}
          badgeColor={
            renewalsDue > 0
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }
          icon={Calendar}
          iconColor={renewalsDue > 0 ? 'text-amber-700' : 'text-emerald-700'}
          iconBg={renewalsDue > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}
          onClick={() => navigate(renewalsDue > 0 ? '/renewal-lockers?status=UNPAID' : '/renewal-lockers')}
          isLoading={renewalQuery.isLoading}
        />

        {/* 7. MONTHLY REVENUE */}
        <MetricCard
          title="MONTHLY REVENUE"
          value={formatCurrency(monthlyRevenue)}
          subtitle="Collections this month"
          icon={CreditCard}
          iconColor="text-teal-700"
          iconBg="bg-teal-50 border-teal-200/80"
          onClick={() => navigate('/payments')}
          isLoading={paymentQuery.isLoading}
        />

        {/* 8. YEARLY REVENUE */}
        <MetricCard
          title="YEARLY REVENUE"
          value={formatCurrency(yearlyRevenue)}
          subtitle="Annualized projected rent"
          icon={TrendingUp}
          iconColor="text-indigo-700"
          iconBg="bg-indigo-50 border-indigo-200/80"
          onClick={() => navigate('/reports')}
          isLoading={paymentQuery.isLoading}
        />
      </section>

      {/* Balanced Executive Operations Hub below the 8 Cards */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-1">
        {/* Left Card (7 Cols): Vault Health & Quick Size Inventory Matrix */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-slate-50 text-slate-700 border border-slate-200/80 flex items-center justify-center">
                  <Layers className="h-4.5 w-4.5 text-slate-700" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
                    Vault Capacity & Health Matrix
                  </h2>
                  <p className="text-xs text-slate-500 font-normal">
                    Real-time occupancy breakdown across storage inventory
                  </p>
                </div>
              </div>

              <span className="text-xs font-semibold text-slate-700 font-mono bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-lg">
                {totalLockers.toLocaleString('en-IN')} Total Units
              </span>
            </div>

            {/* Segmented Visual Capacity Progress Bar */}
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1.5 text-emerald-800">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  Occupied: {occupiedLockers} ({occupancyRate}%)
                </span>
                <span className="flex items-center gap-1.5 text-sky-800">
                  <span className="h-2 w-2 rounded-full bg-sky-600" />
                  Available: {availableLockers} ({availableRate}%)
                </span>
              </div>

              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden flex shadow-inner">
                <div
                  style={{ width: `${occupancyRate}%` }}
                  className="bg-emerald-600 transition-all duration-500"
                  title={`Occupied: ${occupiedLockers} (${occupancyRate}%)`}
                />
                <div
                  style={{ width: `${availableRate}%` }}
                  className="bg-sky-500 transition-all duration-500"
                  title={`Available: ${availableLockers} (${availableRate}%)`}
                />
              </div>
            </div>

            {/* Quick Walk-in Size Inventory Cards (Sizes A, B, C, D) */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Walk-In Size Availability
                </span>
                <span className="text-[11px] text-slate-400 font-normal">Instant counter assistance</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                {['A', 'B', 'C', 'D'].map((sizeCode) => {
                  const sizeStats = lockerStats?.sizeBreakdown?.[sizeCode];
                  const vacantCount = sizeStats?.vacant ?? 0;
                  const totalCount = sizeStats?.total ?? 0;
                  const sizeDef = LOCKER_SIZES.find((s) => s.code === sizeCode);
                  const availPercent = totalCount > 0 ? Math.round((vacantCount / totalCount) * 100) : 0;

                  return (
                    <button
                      key={sizeCode}
                      type="button"
                      onClick={() => navigate(`/lockers?size=${sizeCode}&status=VACANT`)}
                      className="p-3 sm:p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-emerald-300 active:scale-[0.98] text-left transition-all duration-150 group cursor-pointer shadow-2xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-800">
                            Size {sizeCode}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 text-[9.5px] font-semibold rounded ${
                              vacantCount > 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {availPercent}%
                          </span>
                        </div>
                        <p className="text-[9.5px] sm:text-[10px] text-slate-500 mt-0.5 truncate font-normal">
                          {sizeDef?.dimensions || 'Standard'}
                        </p>
                      </div>

                      <div className="mt-2.5 sm:mt-3 pt-2 border-t border-slate-200/60 flex items-baseline justify-between">
                        <span className="text-sm sm:text-base font-bold text-slate-900 tabular-nums">
                          {vacantCount}
                        </span>
                        <span className="text-[9.5px] sm:text-[10px] text-slate-500 font-normal">
                          / {totalCount} free
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="truncate mr-2">Filter lockers by physical size for new customer walk-ins</span>
            <button
              type="button"
              onClick={() => navigate('/lockers')}
              className="font-semibold text-emerald-800 hover:text-emerald-900 flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span>Explore Lockers</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Right Card (5 Cols): Fast Operations & Alerts Centre */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-slate-50 text-slate-700 border border-slate-200/80 flex items-center justify-center">
                  <AlertTriangle className="h-4.5 w-4.5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
                    Vault Action Centre
                  </h2>
                  <p className="text-xs text-slate-500 font-normal">
                    Operational alerts & daily operator shortcuts
                  </p>
                </div>
              </div>
            </div>

            {/* Operational Priority Notices */}
            <div className="mt-4 space-y-2">
              {renewalsDue > 0 && (
                <div
                  onClick={() => navigate('/renewal-lockers?status=UNPAID')}
                  role="button"
                  tabIndex={0}
                  className="p-3 sm:p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/50 hover:bg-amber-50 active:scale-[0.99] transition cursor-pointer flex items-start gap-3 select-none"
                >
                  <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-amber-950 flex items-center justify-between">
                      <span>{renewalsDue} Leases Due for Renewal</span>
                      <span className="text-[9.5px] font-mono font-bold bg-amber-200/60 text-amber-900 px-1.5 py-0.2 rounded">Action Req</span>
                    </h4>
                    <p className="text-[11px] text-amber-900/80 mt-0.5 leading-relaxed font-normal">
                      Invoices requiring billing collection or follow-up notices.
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-amber-700 shrink-0 self-center" />
                </div>
              )}

              {kycIncomplete > 0 && (
                <div
                  onClick={() => navigate('/customers?kycStatus=PENDING,PARTIAL')}
                  role="button"
                  tabIndex={0}
                  className="p-3 sm:p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/40 hover:bg-amber-50 active:scale-[0.99] transition cursor-pointer flex items-start gap-3 select-none"
                >
                  <ShieldCheck className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-amber-950 flex items-center justify-between">
                      <span>{kycIncomplete} Pending KYC Verification</span>
                      <span className="text-[9.5px] font-mono font-bold bg-amber-200/60 text-amber-900 px-1.5 py-0.2 rounded">Review</span>
                    </h4>
                    <p className="text-[11px] text-amber-900/80 mt-0.5 leading-relaxed font-normal">
                      Custody accounts waiting for document approval or uploads.
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-amber-700 shrink-0 self-center" />
                </div>
              )}

              {renewalsDue === 0 && kycIncomplete === 0 && (
                <div className="p-3 sm:p-3.5 rounded-xl border border-emerald-200/80 bg-emerald-50/50 flex items-center gap-2.5 text-xs text-emerald-900 font-medium">
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                  <span>All customer lease billing cycles & KYC records are up to date!</span>
                </div>
              )}
            </div>

            {/* Quick Operational Shortcuts */}
            <div className="mt-4 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                Direct Workflows
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/allocations')}
                  className="min-h-[44px] p-2.5 px-3 rounded-xl border border-slate-200/80 bg-slate-50/40 hover:bg-white hover:border-slate-300 active:scale-[0.99] text-left transition flex items-center justify-between text-xs font-semibold text-slate-800 cursor-pointer shadow-2xs"
                >
                  <span className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-emerald-700" />
                    Allocations
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/payments')}
                  className="min-h-[44px] p-2.5 px-3 rounded-xl border border-slate-200/80 bg-slate-50/40 hover:bg-white hover:border-slate-300 active:scale-[0.99] text-left transition flex items-center justify-between text-xs font-semibold text-slate-800 cursor-pointer shadow-2xs"
                >
                  <span className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-teal-700" />
                    Payments Ledger
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/closed-lockers')}
                  className="min-h-[44px] p-2.5 px-3 rounded-xl border border-slate-200/80 bg-slate-50/40 hover:bg-white hover:border-slate-300 active:scale-[0.99] text-left transition flex items-center justify-between text-xs font-semibold text-slate-800 cursor-pointer shadow-2xs"
                >
                  <span className="flex items-center gap-2">
                    <Archive className="h-4 w-4 text-slate-700" />
                    Closed Lockers
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/customers')}
                  className="min-h-[44px] p-2.5 px-3 rounded-xl border border-slate-200/80 bg-slate-50/40 hover:bg-white hover:border-slate-300 active:scale-[0.99] text-left transition flex items-center justify-between text-xs font-semibold text-slate-800 cursor-pointer shadow-2xs"
                >
                  <span className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-indigo-700" />
                    Customer Directory
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                    {totalCustomers}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* System Data Health Badge */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5 font-medium text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
              Atlas Database Live & Synchronized
            </span>
            <span className="font-mono text-slate-400">v1.0.0</span>
          </div>
        </div>
      </section>

      {/* Customer Custody Portfolio & Recent Allottees Section */}
      <section className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-slate-50 text-slate-700 border border-slate-200/80 flex items-center justify-center">
              <Users className="h-4.5 w-4.5 text-slate-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
                  Customer Custody Portfolio & Registry
                </h2>
                <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                  {totalCustomers.toLocaleString('en-IN')} Registered Clients
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal">
                Active safe-deposit allottees, identity verification compliance & quick client lookup
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canCreateCustomer && (
              <Button
                size="sm"
                onClick={() => setIsCustomerModalOpen(true)}
                className="h-8.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs px-3 shadow-2xs gap-1.5 cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>+ Add Customer</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/customers')}
              className="h-8.5 rounded-xl border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-semibold text-xs px-3 gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            </Button>
          </div>
        </div>

        {/* 4 Banking Metric Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            onClick={() => navigate('/customers')}
            className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer"
          >
            <span className="text-[11px] font-medium text-slate-500 block">Total Registered</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                {totalCustomers.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-500">clients</span>
            </div>
          </div>

          <div
            onClick={() => navigate('/lockers?status=OCCUPIED')}
            className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer"
          >
            <span className="text-[11px] font-medium text-slate-500 block">Active Locker Leases</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold font-mono text-emerald-800 tabular-nums">
                {occupiedLockers.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-emerald-700 font-medium">allotted units</span>
            </div>
          </div>

          <div
            onClick={() => navigate('/customers?kycStatus=VERIFIED')}
            className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer"
          >
            <span className="text-[11px] font-medium text-slate-500 block">KYC Verified Compliance</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold font-mono text-emerald-800 tabular-nums">
                {kycVerified.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-emerald-700 font-medium">({kycComplianceRate}%)</span>
            </div>
          </div>

          <div
            onClick={() => navigate(kycIncomplete > 0 ? '/customers?kycStatus=PENDING,PARTIAL' : '/customers')}
            className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer"
          >
            <span className="text-[11px] font-medium text-slate-500 block">Pending KYC Action</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span
                className={`text-xl font-bold font-mono tabular-nums ${
                  kycIncomplete > 0 ? 'text-amber-700' : 'text-slate-700'
                }`}
              >
                {kycIncomplete}
              </span>
              <span className="text-[10px] text-slate-500">
                {kycIncomplete > 0 ? 'require review' : 'all clean'}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Registered Customers List / Table */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Recent Customer Registrations
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              Showing latest 5 entries from ledger
            </span>
          </div>

          {recentCustomersQuery.isLoading ? (
            <div className="divide-y divide-slate-100 border border-slate-200/90 rounded-xl overflow-hidden bg-slate-50/30 p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-100/70 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : recentCustomers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-2">
              <Users className="h-8 w-8 mx-auto text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">No Customers Registered Yet</p>
              <p className="text-xs text-slate-500">
                Begin registering customers to allocate lockers and manage custody agreements.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile View: High-density touch card list (<sm) */}
              <div className="block sm:hidden space-y-2.5">
                {recentCustomers.map((cust) => {
                  const isKycOk = cust.kycStatus === 'VERIFIED';
                  return (
                    <div
                      key={cust._id}
                      onClick={() => navigate(`/customers/${cust._id}`)}
                      className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/40 active:bg-slate-100/80 active:scale-[0.99] transition cursor-pointer flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/70 flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                          {cust.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-xs truncate">
                            {cust.fullName}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10.5px] text-slate-500 font-mono">
                            <span>{cust.customerCode}</span>
                            {cust.phone && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span>{cust.phone}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isKycOk
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200/70'
                              : 'bg-amber-50 text-amber-800 border-amber-200/70'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isKycOk ? 'bg-emerald-600' : 'bg-amber-600'
                            }`}
                          />
                          <span>{cust.kycStatus}</span>
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tablet & Desktop View: Table (sm+) */}
              <div className="hidden sm:block border border-slate-200/90 rounded-xl overflow-hidden bg-white shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Customer</th>
                        <th className="py-2.5 px-4">Contact Phone</th>
                        <th className="py-2.5 px-4 hidden md:table-cell">Branch / City</th>
                        <th className="py-2.5 px-4">KYC Status</th>
                        <th className="py-2.5 px-4 hidden sm:table-cell">Registered Date</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentCustomers.map((cust) => {
                        const isKycOk = cust.kycStatus === 'VERIFIED';
                        return (
                          <tr
                            key={cust._id}
                            className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                            onClick={() => navigate(`/customers/${cust._id}`)}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/70 flex items-center justify-center font-bold text-xs shrink-0">
                                  {cust.fullName.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 group-hover:text-emerald-900 transition-colors truncate">
                                    {cust.fullName}
                                  </div>
                                  <div className="font-mono text-[10.5px] text-slate-400">
                                    {cust.customerCode}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4 text-slate-700 font-mono text-[11.5px]">
                              {cust.phone || '—'}
                            </td>

                            <td className="py-3 px-4 text-slate-600 hidden md:table-cell">
                              {cust.city || 'Main Branch'}
                            </td>

                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${
                                  isKycOk
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200/70'
                                    : 'bg-amber-50 text-amber-800 border-amber-200/70'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isKycOk ? 'bg-emerald-600' : 'bg-amber-600'
                                  }`}
                                />
                                <span>{cust.kycStatus}</span>
                              </span>
                            </td>

                            <td className="py-3 px-4 text-slate-500 text-[11px] hidden sm:table-cell">
                              {new Date(cust.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/customers/${cust._id}`);
                                }}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950 p-1 px-2 rounded-lg hover:bg-emerald-50 transition cursor-pointer"
                              >
                                <span>Profile</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Clean Footer Matching Reference */}
      <footer className="pt-10 pb-4 text-center text-xs text-slate-400 font-medium select-none">
        © 2026 MSS Lockers • Secure. Simple. Smart.
      </footer>

      {/* Floating Success Notice */}
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

      {/* 1. Add New Locker & Allocation Modal */}
      {isAllocationModalOpen && (
        <AllocationWizardModal
          mode="allocate"
          onClose={() => setIsAllocationModalOpen(false)}
          onSubmit={handleAllocationSubmit}
          isSubmitting={isSubmittingAllocation}
        />
      )}

      {/* 2. Add New Customer Modal */}
      {isCustomerModalOpen && (
        <CustomerFormModal
          onClose={() => setIsCustomerModalOpen(false)}
          onSubmit={handleCustomerSubmit}
          isSubmitting={isSubmittingCustomer}
        />
      )}

      {/* 3. Record Payment Modal */}
      {isPaymentModalOpen && (
        <RecordPaymentModal
          onClose={() => setIsPaymentModalOpen(false)}
          onSubmit={handleRecordPaymentSubmit}
          onSuccessViewReceipt={(p) => setReceiptPayment(p)}
        />
      )}

      {/* 4. Payment Receipt Modal */}
      {receiptPayment && (
        <PaymentReceiptModal
          payment={receiptPayment}
          onClose={() => setReceiptPayment(null)}
        />
      )}
    </div>
  );
}
