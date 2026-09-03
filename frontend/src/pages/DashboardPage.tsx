import { useQuery } from '@tanstack/react-query';
import { Activity, AlertCircle, AlertOctagon, ArrowUpRight, CheckCircle, ChevronRight, Clock, IndianRupee, KeyRound, Layers, RefreshCw, ShieldAlert, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatCard } from '../components/common/StatCard';
import { SystemHealthCard } from '../components/common/SystemHealthCard';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { lockerApi } from '../features/lockers/api/lockerApi';
import { LOCKER_SIZES } from '../features/lockers/constants';
import { paymentApi } from '../features/payments/api/paymentApi';
import { renewalApi } from '../features/renewals/api/renewalApi';
import { useAuth } from '../hooks/useAuth';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const formatCurrency = (value: number) => currency.format(value);

function SizeInventoryCard({ stats, isLoading, canViewLockers }: { stats: any; isLoading: boolean; canViewLockers: boolean }) {
  const total = stats?.total ?? 0;
  const occupied = stats?.occupied ?? 0;
  const available = stats?.availableForAllocation ?? stats?.vacant ?? 0;

  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
      <CardHeader className="space-y-3.5 border-b border-slate-100 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle id="size-inventory-title" className="text-sm font-semibold text-slate-900 tracking-tight">
              Locker Size Inventory
            </CardTitle>
            <p id="size-inventory-summary" className="mt-0.5 text-xs text-slate-500 font-normal">
              Live capacity, allocation breakdown and physical occupancy across configured sizes (A to G2).
            </p>
          </div>
          {canViewLockers && (
            <Link
              to="/lockers"
              className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-emerald-800 bg-emerald-50/60 hover:bg-emerald-100/70 hover:border-emerald-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
            >
              <span>View Directory</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>

        {/* Quick KPI Bar for Sizes */}
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
        <div
          className="max-h-[430px] overflow-auto overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700"
          role="region"
          aria-labelledby="size-inventory-title"
          aria-describedby="size-inventory-summary"
          tabIndex={0}
        >
          <table className="w-full min-w-[580px] border-collapse text-left text-xs">
            <caption className="sr-only">
              Capacity, occupied lockers, available lockers and utilization for every configured locker size.
            </caption>
            <thead className="sticky top-0 z-10 bg-slate-50/95 shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur">
              <tr className="font-medium uppercase tracking-wider text-[10.5px] text-slate-500">
                <th scope="col" className="px-4 py-3 sm:px-5">Size</th>
                <th scope="col" className="px-3 py-3">Dimensions</th>
                <th scope="col" className="px-3 py-3 text-right">Total</th>
                <th scope="col" className="px-3 py-3 text-right">In Use</th>
                <th scope="col" className="px-3 py-3 text-right">Available</th>
                <th scope="col" className="w-32 px-4 py-3 text-right sm:px-5">Occupancy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-normal">
              {LOCKER_SIZES.map((item) => {
                const row = stats?.sizeBreakdown?.[item.code];
                const rowTotal = row?.total ?? 0;
                const rowOccupied = row?.occupied ?? 0;
                const rowVacant = row?.vacant ?? 0;
                const utilization = rowTotal ? Math.round((rowOccupied / rowTotal) * 100) : 0;
                const isFull = rowTotal > 0 && rowVacant === 0;

                return (
                  <tr
                    key={item.code}
                    className={`${
                      rowTotal === 0 ? 'bg-slate-50/40 text-slate-400' : 'hover:bg-emerald-50/30'
                    } group transition-colors`}
                  >
                    <th scope="row" className="px-4 py-3 text-left sm:px-5 font-medium text-slate-900">
                      {canViewLockers ? (
                        <Link
                          to={`/lockers?size=${encodeURIComponent(item.code)}`}
                          className="inline-flex items-center gap-1.5 font-sans font-medium text-slate-900 group-hover:text-emerald-800 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                        >
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-mono font-medium group-hover:bg-emerald-100 group-hover:text-emerald-900 transition-colors">
                            {item.code}
                          </span>
                          <span>{item.label}</span>
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 font-sans font-medium text-slate-900">
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-mono font-medium">
                            {item.code}
                          </span>
                          <span>{item.label}</span>
                        </span>
                      )}
                    </th>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-slate-500">
                      {item.dimensions}
                    </td>
                    <td className="px-3 py-3 text-right font-sans font-medium tabular-nums text-slate-900">
                      {isLoading ? '—' : rowTotal.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-right font-sans font-medium tabular-nums text-emerald-700">
                      {isLoading ? '—' : rowOccupied.toLocaleString('en-IN')}
                    </td>
                    <td
                      className={`px-3 py-3 text-right font-sans font-medium tabular-nums ${
                        isFull ? 'text-amber-700' : 'text-slate-700'
                      }`}
                    >
                      {isLoading ? '—' : rowVacant.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 sm:px-5">
                      {isLoading ? (
                        <span className="block text-right">—</span>
                      ) : rowTotal === 0 ? (
                        <span className="block text-right text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          Not stocked
                        </span>
                      ) : (
                        <div className="space-y-1.5" aria-label={`${utilization}% occupied`}>
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-[11px] font-mono font-medium ${
                                isFull ? 'text-amber-700' : 'text-slate-700'
                              }`}
                            >
                              {utilization}%
                            </span>
                            {isFull && (
                              <span className="rounded px-1.5 py-0.5 text-[9px] font-medium uppercase bg-amber-50 text-amber-800 border border-amber-200">
                                Full
                              </span>
                            )}
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isFull ? 'bg-amber-500' : 'bg-emerald-600'
                              }`}
                              style={{ width: `${utilization}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 text-[11px] text-slate-500 sm:px-5 font-normal">
          <span>Scroll table to review all 12 rack sizes</span>
          <span>
            <span className="font-medium text-emerald-800">Green</span> indicates active occupied units
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { hasPermission } = useAuth();
  const canViewLockers = hasPermission('lockers.view');
  const canCreateAllocation = hasPermission('allocations.create');
  const canViewRenewals = hasPermission('renewals.view');
  const canViewPayments = hasPermission('payments.view');

  const lockerQuery = useQuery({ queryKey: ['locker-stats'], queryFn: () => lockerApi.getLockerStats(), enabled: canViewLockers, refetchInterval: 60_000 });
  const renewalQuery = useQuery({ queryKey: ['renewal-stats'], queryFn: renewalApi.getRenewalStats, enabled: canViewRenewals, refetchInterval: 60_000 });
  const paymentQuery = useQuery({ queryKey: ['payment-stats'], queryFn: paymentApi.getPaymentStats, enabled: canViewPayments, refetchInterval: 60_000 });
  
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
  
  const isInitialLoading = (canViewLockers && lockerQuery.isLoading)
    || (canViewRenewals && renewalQuery.isLoading)
    || (canViewPayments && paymentQuery.isLoading);
  const isRefreshing = lockerQuery.isFetching || renewalQuery.isFetching || paymentQuery.isFetching;
  const latestUpdate = Math.max(lockerQuery.dataUpdatedAt, renewalQuery.dataUpdatedAt, paymentQuery.dataUpdatedAt);
  const failedSections = [lockerQuery.isError && 'locker inventory', renewalQuery.isError && 'renewal billing', paymentQuery.isError && 'payment collection'].filter(Boolean) as string[];
  
  const refreshDashboard = () => void Promise.all([
    canViewLockers ? lockerQuery.refetch() : Promise.resolve(),
    canViewRenewals ? renewalQuery.refetch() : Promise.resolve(),
    canViewPayments ? paymentQuery.refetch() : Promise.resolve(),
  ]);
  
  const metricValue = (value: number, unavailable: boolean) =>
    !canViewLockers || unavailable ? '—' : value.toLocaleString('en-IN');

  return (
    <div className="space-y-4 sm:space-y-5 lg:space-y-6">
      {/* Top Executive Header Card */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 lg:p-6 shadow-xs sm:flex sm:items-center sm:justify-between sm:gap-5">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-emerald-800" aria-hidden="true" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
              Operations Overview
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              {latestUpdate ? `Synced ${new Date(latestUpdate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
            Safe-Deposit Vault Operations
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-normal">
            Live locker inventory, customer tenure registers, billing status, and audited counter actions.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-0 sm:flex sm:items-center">
          {canViewLockers && (
            <Link
              to="/lockers"
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 cursor-pointer"
            >
              <Layers className="h-4 w-4 text-emerald-800" />
              <span>Lockers Master</span>
            </Link>
          )}
          {canCreateAllocation && (
            <Link
              to="/allocations"
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-800 px-4 text-xs font-medium text-white shadow-sm hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 cursor-pointer"
            >
              <KeyRound className="h-4 w-4 text-emerald-200" />
              <span>New Allocation</span>
            </Link>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refreshDashboard}
            disabled={isRefreshing}
            className="col-span-2 sm:col-span-1 h-10 rounded-xl border-slate-300 gap-1.5 cursor-pointer"
            aria-label="Refresh dashboard metrics"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-emerald-700' : 'text-slate-600'}`} />
            <span className="sm:sr-only">Refresh</span>
          </Button>
        </div>
      </section>

      {/* Connection & Data Status Alerts */}
      {failedSections.length > 0 && (
        <section role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <p className="text-xs sm:text-sm font-medium">
              <strong className="font-bold">Some operational metrics could not be loaded:</strong> {failedSections.join(', ')}.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refreshDashboard} disabled={isRefreshing} className="shrink-0 rounded-xl border-red-300 bg-white text-red-800 text-xs font-bold">
            Retry Connection
          </Button>
        </section>
      )}

      {/* 6 Key Operational KPI Cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3" aria-label="Vault metrics" aria-busy={isInitialLoading}>
        <StatCard
          title="Total Master Lockers"
          value={metricValue(total, lockerQuery.isLoading || lockerQuery.isError)}
          subtitle="Sizes A to G2 across physical racks"
          icon={Layers}
          iconBg="bg-slate-100"
          iconColor="text-slate-800"
          badge={{ text: 'Active Registry', variant: 'neutral' }}
          href={canViewLockers ? '/lockers' : undefined}
        />
        <StatCard
          title="Occupied Lockers"
          value={metricValue(occupied, lockerQuery.isLoading || lockerQuery.isError)}
          subtitle={`${occupancyRate}% vault occupancy rate`}
          icon={CheckCircle}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-800"
          badge={{ text: 'Allocated', variant: 'success' }}
          href={canViewLockers ? '/lockers?status=OCCUPIED' : undefined}
        />
        <StatCard
          title="Allocation Ready"
          value={metricValue(allocationReady, lockerQuery.isLoading || lockerQuery.isError)}
          subtitle="Vacant units available for customer allotment"
          icon={KeyRound}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-800"
          badge={{ text: 'Available', variant: 'success' }}
          href={canViewLockers ? '/lockers?status=VACANT&operationalStatus=ACTIVE' : undefined}
        />
        <StatCard
          title="Due This Month"
          value={!canViewRenewals || renewalQuery.isLoading || renewalQuery.isError ? '—' : String(renewalStats?.dueThisMonth.count ?? 0)}
          subtitle={`${formatCurrency(renewalStats?.dueThisMonth.amount ?? 0)} pending renewal rent`}
          icon={Clock}
          iconBg="bg-amber-50"
          iconColor="text-amber-800"
          badge={{ text: 'Due Soon', variant: 'warning' }}
          href={canViewRenewals ? '/renewals?dueStatus=UPCOMING' : undefined}
        />
        <StatCard
          title="Overdue Invoices"
          value={!canViewRenewals || renewalQuery.isLoading || renewalQuery.isError ? '—' : String(renewalStats?.overdue.count ?? 0)}
          subtitle={`${formatCurrency(renewalStats?.overdue.amount ?? 0)} balance past due`}
          icon={AlertOctagon}
          iconBg="bg-rose-50"
          iconColor="text-rose-800"
          badge={{ text: 'Action Req.', variant: 'destructive' }}
          href={canViewRenewals ? '/renewals?dueStatus=OVERDUE' : undefined}
        />
        <StatCard
          title="Today's Collection"
          value={!canViewPayments || paymentQuery.isLoading || paymentQuery.isError ? '—' : formatCurrency(paymentStats?.todayCollection.amount ?? 0)}
          subtitle={`${paymentStats?.todayCollection.count ?? 0} completed receipts (cash + digital)`}
          icon={IndianRupee}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-800"
          badge={{ text: 'Completed', variant: 'success' }}
          href={canViewPayments ? '/payments' : undefined}
        />
      </section>

      {/* Telemetry & System Status */}
      <SystemHealthCard />

      {/* Size Matrix & Operational Attention Panel */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:gap-6 xl:grid-cols-2">
        <SizeInventoryCard stats={stats} isLoading={lockerQuery.isLoading} canViewLockers={canViewLockers} />

        {/* Operational Attention Panel */}
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
            {/* Inventory Balance Card */}
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

            {/* Unavailable Units Card */}
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

            {/* Overdue Invoices Card */}
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
              {canViewRenewals && (
                <Link
                  to="/renewals?dueStatus=OVERDUE"
                  aria-label="Review overdue invoices"
                  className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-100 focus-visible:ring-2 focus-visible:ring-rose-600 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>

            {/* Today Collection Card */}
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="mt-0.5 rounded-lg bg-emerald-100 p-2 text-emerald-800">
                <Activity className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-medium text-slate-900">Today's completed collection</p>
                <p className="mt-0.5 text-[11px] text-slate-500 font-normal">
                  {formatCurrency(paymentStats?.todayCollection.amount ?? 0)} across {paymentStats?.todayCollection.count ?? 0} counter receipts
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
