import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Lock,
  FolderOpen,
  Calendar,
  CreditCard,
  TrendingUp,
  Users,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  X,
  RotateCcw,
  ExternalLink,
  Layers,
  UserPlus,
  Receipt,
  FileText,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { lockerApi } from '../features/lockers/api/lockerApi';
import { customerApi } from '../features/customers/api/customerApi';
import { renewalApi } from '../features/renewals/api/renewalApi';
import { paymentApi } from '../features/payments/api/paymentApi';
import { allocationApi } from '../features/allocations/api/allocationApi';
import { DashboardLockersSection, DashboardLockersSectionRef } from '../features/lockers/components/DashboardLockersSection';
import { DashboardRenewalsWorkspace } from '../features/dashboard/components/DashboardRenewalsWorkspace';
import { DashboardCustomersWorkspace } from '../features/dashboard/components/DashboardCustomersWorkspace';
import { DashboardPaymentsWorkspace } from '../features/dashboard/components/DashboardPaymentsWorkspace';
import { AllocationWizardModal } from '../features/allocations/components/AllocationWizardModal';
import { CustomerFormModal } from '../features/customers/components/CustomerFormModal';
import { CustomerQuickPreview } from '../features/customers/components/CustomerQuickPreview';
import { RecordPaymentModal } from '../features/payments/components/RecordPaymentModal';
import { PaymentReceiptModal } from '../features/payments/components/PaymentReceiptModal';
import { InvoiceDetailModal } from '../features/renewals/components/InvoiceDetailModal';
import { CreateAllocationInput, ReserveLockerInput } from '../features/allocations/types';
import { CreateCustomerInput, UpdateCustomerInput, Customer } from '../features/customers/types';
import { RecordPaymentInput, Payment } from '../features/payments/types';
import { LockerInvoice } from '../features/renewals/types';
import { useAuth } from '../hooks/useAuth';

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const formatCurrency = (val: number) => currencyFormatter.format(val || 0);

type WorkspaceTab = 'LOCKERS' | 'RENEWALS' | 'CUSTOMERS' | 'PAYMENTS';

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
  isActive?: boolean;
}

function MetricCard({
  title,
  value,
  subtitle,
  badge,
  badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200/60',
  icon: Icon,
  iconColor,
  iconBg,
  onClick,
  isLoading,
  isActive = false,
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
      className={`group relative overflow-hidden rounded-2xl p-4 sm:p-5 transition-all duration-200 bg-white border cursor-pointer select-none flex flex-col justify-between min-h-[132px] sm:min-h-[142px] ${
        isActive
          ? 'border-emerald-600 ring-2 ring-emerald-500/25 shadow-md bg-gradient-to-b from-emerald-50/40 via-white to-white'
          : 'border-slate-200/80 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 shadow-2xs'
      }`}
    >
      {/* Top row: Category Title & Stylized Icon */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 font-sans truncate"
          title={title}
        >
          {title}
        </span>
        <div
          className={`grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-105 border shadow-2xs ${iconBg}`}
        >
          <Icon className={`h-4 w-4 sm:h-4.5 sm:w-4.5 ${iconColor}`} />
        </div>
      </div>

      {/* Middle row: Big Metric & Context Badge */}
      <div className="my-1.5 flex items-baseline justify-between gap-2 flex-wrap">
        <h3 className="font-sans text-2xl sm:text-3xl font-black tracking-tight text-slate-900 tabular-nums">
          {isLoading ? (
            <span className="inline-block h-8 w-20 bg-slate-200/60 rounded-lg animate-pulse" />
          ) : (
            value
          )}
        </h3>
        {badge && !isLoading && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border truncate shrink-0 shadow-2xs ${badgeColor}`}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Bottom row: Clean Context Subtitle & Active Indicator */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span className="truncate font-medium text-slate-500">{subtitle}</span>
        {isActive && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 shrink-0 ml-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
            Active
          </span>
        )}
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

  // Multi-Workspace Active Tab State
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceTab>('LOCKERS');
  const [activeMetricCard, setActiveMetricCard] = useState<string>('LOCKERS_ALL');
  const [initialRenewalFilter, setInitialRenewalFilter] = useState<string>('ACTIONABLE');
  const [initialKycFilter, setInitialKycFilter] = useState<string>('ALL');

  const workspaceRef = useRef<HTMLDivElement>(null);
  const lockersSectionRef = useRef<DashboardLockersSectionRef>(null);

  // Modal visibility & submission states
  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false);
  const [isSubmittingAllocation, setIsSubmittingAllocation] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [preselectedInvoiceId, setPreselectedInvoiceId] = useState<string | undefined>(undefined);
  const [viewingInvoice, setViewingInvoice] = useState<LockerInvoice | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  const lockerStats = lockerQuery.data;
  const renewalStats = renewalQuery.data;
  const paymentStats = paymentQuery.data;
  const customerStats = customerStatsQuery.data;

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

  const isRefreshing =
    lockerQuery.isFetching ||
    renewalQuery.isFetching ||
    paymentQuery.isFetching ||
    customerStatsQuery.isFetching;

  const refreshAll = () => {
    queryClient.invalidateQueries();
  };

  // KPI Click Handlers - Instant workspace activation & in-place smooth scroll
  const handleLockerMetricClick = (status: string) => {
    setActiveWorkspace('LOCKERS');
    setActiveMetricCard(`LOCKERS_${status}`);
    setTimeout(() => {
      lockersSectionRef.current?.setStatusFilter(status);
      workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleCustomerMetricClick = (kycStatus: string = 'ALL') => {
    setActiveWorkspace('CUSTOMERS');
    setActiveMetricCard(kycStatus === 'ALL' ? 'CUSTOMERS_ALL' : 'CUSTOMERS_KYC');
    setInitialKycFilter(kycStatus);
    setTimeout(() => {
      workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleRenewalMetricClick = (status: string = 'ACTIONABLE') => {
    setActiveWorkspace('RENEWALS');
    setActiveMetricCard('RENEWALS_DUE');
    setInitialRenewalFilter(status);
    setTimeout(() => {
      workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handlePaymentMetricClick = (metricType: 'MONTHLY' | 'YEARLY' = 'MONTHLY') => {
    setActiveWorkspace('PAYMENTS');
    setActiveMetricCard(`PAYMENTS_${metricType}`);
    setTimeout(() => {
      workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  // Modal Handlers
  const handleAllocationSubmit = async (data: CreateAllocationInput | ReserveLockerInput) => {
    setIsSubmittingAllocation(true);
    try {
      await allocationApi.createAllocation(data as CreateAllocationInput);
      setIsAllocationModalOpen(false);
      refreshAll();
      setNotice('Locker allocated successfully!');
    } finally {
      setIsSubmittingAllocation(false);
    }
  };

  const handleCustomerSubmit = async (data: CreateCustomerInput | UpdateCustomerInput) => {
    setIsSubmittingCustomer(true);
    try {
      if (editingCustomer) {
        await customerApi.updateCustomer(editingCustomer._id, data as UpdateCustomerInput);
        setNotice('Customer profile updated successfully!');
      } else {
        await customerApi.createCustomer(data as CreateCustomerInput);
        setNotice('Customer profile created successfully!');
      }
      setIsCustomerModalOpen(false);
      setEditingCustomer(null);
      refreshAll();
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const handleRecordPaymentSubmit = async (data: RecordPaymentInput, idempotencyKey: string) => {
    const payment = await paymentApi.recordPayment(data, idempotencyKey);
    setIsPaymentModalOpen(false);
    setPreselectedInvoiceId(undefined);
    refreshAll();
    setNotice(`Payment ${payment.receiptNumber || payment.paymentNumber} recorded successfully!`);
    return payment;
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
              className="h-9 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs px-3 sm:px-3.5 shadow-2xs cursor-pointer transition shrink-0"
            >
              <span>+ New Allocation</span>
            </Button>
          )}

          {canCreateCustomer && (
            <Button
              onClick={() => {
                setEditingCustomer(null);
                setIsCustomerModalOpen(true);
              }}
              variant="outline"
              className="h-9 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs px-2.5 sm:px-3 cursor-pointer transition shrink-0"
            >
              <span>+ Customer</span>
            </Button>
          )}

          {canCreatePayment && (
            <Button
              onClick={() => {
                setPreselectedInvoiceId(undefined);
                setIsPaymentModalOpen(true);
              }}
              variant="outline"
              className="h-9 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs px-2.5 sm:px-3 cursor-pointer transition shrink-0"
            >
              <span>+ Record Payment</span>
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

      {/* 8 Core Metric Cards Grid with Interactive Workspace Linkage */}
      <section
        className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-2.5 sm:gap-4"
        aria-label="Overview Metrics"
      >
        {/* 1. TOTAL LOCKERS */}
        <MetricCard
          title="TOTAL LOCKERS"
          value={totalLockers.toLocaleString('en-IN')}
          subtitle="Total safe-deposit inventory"
          badge="Vault Total"
          badgeColor="bg-slate-100 text-slate-700 border-slate-200"
          icon={Package}
          iconColor="text-slate-700"
          iconBg="bg-slate-50 border-slate-200/80"
          onClick={() => handleLockerMetricClick('ALL')}
          isLoading={lockerQuery.isLoading}
          isActive={activeWorkspace === 'LOCKERS' && activeMetricCard === 'LOCKERS_ALL'}
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
          onClick={() => handleLockerMetricClick('OCCUPIED')}
          isLoading={lockerQuery.isLoading}
          isActive={activeWorkspace === 'LOCKERS' && activeMetricCard === 'LOCKERS_OCCUPIED'}
        />

        {/* 3. AVAILABLE */}
        <MetricCard
          title="AVAILABLE"
          value={availableLockers.toLocaleString('en-IN')}
          subtitle="Ready for allotment"
          badge={`${availableRate}% Vacant`}
          badgeColor="bg-sky-50 text-sky-800 border-sky-200/80"
          icon={FolderOpen}
          iconColor="text-sky-700"
          iconBg="bg-sky-50 border-sky-200/80"
          onClick={() => handleLockerMetricClick('VACANT')}
          isLoading={lockerQuery.isLoading}
          isActive={activeWorkspace === 'LOCKERS' && activeMetricCard === 'LOCKERS_VACANT'}
        />

        {/* 4. TOTAL CUSTOMERS */}
        <MetricCard
          title="TOTAL CUSTOMERS"
          value={totalCustomers.toLocaleString('en-IN')}
          subtitle="Registered custody clients"
          badge={`${activeCustomers} Active`}
          badgeColor="bg-indigo-50 text-indigo-800 border-indigo-200/80"
          icon={Users}
          iconColor="text-indigo-700"
          iconBg="bg-indigo-50 border-indigo-200/80"
          onClick={() => handleCustomerMetricClick('ALL')}
          isLoading={customerStatsQuery.isLoading}
          isActive={activeWorkspace === 'CUSTOMERS' && activeMetricCard === 'CUSTOMERS_ALL'}
        />

        {/* 5. KYC COMPLIANCE */}
        <MetricCard
          title="KYC COMPLIANCE"
          value={kycVerified.toLocaleString('en-IN')}
          subtitle={
            kycIncomplete > 0
              ? `${kycIncomplete} verification pending`
              : '100% Identity verified'
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
          onClick={() => handleCustomerMetricClick(kycIncomplete > 0 ? 'PENDING_KYC' : 'VERIFIED')}
          isLoading={customerStatsQuery.isLoading}
          isActive={activeWorkspace === 'CUSTOMERS' && activeMetricCard === 'CUSTOMERS_KYC'}
        />

        {/* 6. RENEWALS DUE */}
        <MetricCard
          title="RENEWALS DUE"
          value={renewalsDue}
          subtitle={renewalsDue > 0 ? 'Requires renewal attention' : 'No overdue leases'}
          badge={renewalsDue > 0 ? `${renewalsDue} Due Soon` : 'All Clear'}
          badgeColor={
            renewalsDue > 0
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }
          icon={Calendar}
          iconColor={renewalsDue > 0 ? 'text-amber-700' : 'text-emerald-700'}
          iconBg={renewalsDue > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}
          onClick={() => handleRenewalMetricClick('ACTIONABLE')}
          isLoading={renewalQuery.isLoading}
          isActive={activeWorkspace === 'RENEWALS' && activeMetricCard === 'RENEWALS_DUE'}
        />

        {/* 7. MONTHLY REVENUE */}
        <MetricCard
          title="MONTHLY REVENUE"
          value={formatCurrency(monthlyRevenue)}
          subtitle="Collections this month"
          badge="This Month"
          badgeColor="bg-teal-50 text-teal-800 border-teal-200/80"
          icon={CreditCard}
          iconColor="text-teal-700"
          iconBg="bg-teal-50 border-teal-200/80"
          onClick={() => handlePaymentMetricClick('MONTHLY')}
          isLoading={paymentQuery.isLoading}
          isActive={activeWorkspace === 'PAYMENTS' && activeMetricCard === 'PAYMENTS_MONTHLY'}
        />

        {/* 8. YEARLY REVENUE */}
        <MetricCard
          title="YEARLY REVENUE"
          value={formatCurrency(yearlyRevenue)}
          subtitle="Annualized rental estimate"
          badge="Projected ARR"
          badgeColor="bg-violet-50 text-violet-800 border-violet-200/80"
          icon={TrendingUp}
          iconColor="text-violet-700"
          iconBg="bg-violet-50 border-violet-200/80"
          onClick={() => handlePaymentMetricClick('YEARLY')}
          isLoading={paymentQuery.isLoading}
          isActive={activeWorkspace === 'PAYMENTS' && activeMetricCard === 'PAYMENTS_YEARLY'}
        />
      </section>

      {/* Unified Operational Multi-Workspace Command Center */}
      <section ref={workspaceRef} className="space-y-4 pt-1">
        {/* Workspace Body 1: Lockers Directory */}
        {activeWorkspace === 'LOCKERS' && canViewLockers && (
          <DashboardLockersSection
            ref={lockersSectionRef}
            initialStatus="ALL"
            onAllocationSuccess={refreshAll}
          />
        )}

        {/* Workspace Body 2: Renewals & Overdues */}
        {activeWorkspace === 'RENEWALS' && (
          <DashboardRenewalsWorkspace
            initialStatus={initialRenewalFilter}
            onRecordPayment={(invoice) => {
              setPreselectedInvoiceId(invoice._id);
              setIsPaymentModalOpen(true);
            }}
            onViewInvoice={(invoice) => setViewingInvoice(invoice)}
          />
        )}

        {/* Workspace Body 3: Customers & KYC Directory */}
        {activeWorkspace === 'CUSTOMERS' && (
          <DashboardCustomersWorkspace
            initialKycStatus={initialKycFilter}
            onViewCustomer={(customer) => setViewingCustomer(customer)}
            onAddCustomer={() => {
              setEditingCustomer(null);
              setIsCustomerModalOpen(true);
            }}
            onEditCustomer={(customer) => {
              setEditingCustomer(customer);
              setIsCustomerModalOpen(true);
            }}
          />
        )}

        {/* Workspace Body 4: Collections & Payments Ledger */}
        {activeWorkspace === 'PAYMENTS' && (
          <DashboardPaymentsWorkspace
            onRecordPayment={() => {
              setPreselectedInvoiceId(undefined);
              setIsPaymentModalOpen(true);
            }}
            onViewReceipt={(payment) => setReceiptPayment(payment)}
          />
        )}
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

      {/* 2. Customer Create / Edit Form Modal */}
      {isCustomerModalOpen && (
        <CustomerFormModal
          customer={editingCustomer}
          onClose={() => {
            setIsCustomerModalOpen(false);
            setEditingCustomer(null);
          }}
          onSubmit={handleCustomerSubmit}
          isSubmitting={isSubmittingCustomer}
        />
      )}

      {/* 3. Walk-in Customer Quick Dossier Preview Modal */}
      {viewingCustomer && (
        <CustomerQuickPreview
          customer={viewingCustomer}
          onClose={() => setViewingCustomer(null)}
          onEdit={(c) => {
            setViewingCustomer(null);
            setEditingCustomer(c);
            setIsCustomerModalOpen(true);
          }}
        />
      )}

      {/* 4. Record Payment Modal (In-place) */}
      {isPaymentModalOpen && (
        <RecordPaymentModal
          initialInvoiceId={preselectedInvoiceId}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setPreselectedInvoiceId(undefined);
          }}
          onSubmit={handleRecordPaymentSubmit}
          onSuccessViewReceipt={(p) => setReceiptPayment(p)}
        />
      )}

      {/* 5. Payment Receipt Modal */}
      {receiptPayment && (
        <PaymentReceiptModal
          payment={receiptPayment}
          onClose={() => setReceiptPayment(null)}
        />
      )}

      {/* 6. Invoice Detail Modal */}
      {viewingInvoice && (
        <InvoiceDetailModal
          invoice={viewingInvoice}
          onClose={() => setViewingInvoice(null)}
          onRecordPayment={(inv) => {
            setViewingInvoice(null);
            setPreselectedInvoiceId(inv._id);
            setIsPaymentModalOpen(true);
          }}
        />
      )}
    </div>
  );
}
