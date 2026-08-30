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
    <Card className="overflow-hidden border-slate-200">
      <CardHeader className="space-y-3 border-b border-slate-100 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div><CardTitle id="size-inventory-title" className="text-sm font-bold text-slate-900">Locker Size Inventory</CardTitle><p id="size-inventory-summary" className="mt-1 text-[11px] text-slate-500">Live capacity and occupancy across configured sizes A to G2.</p></div>
          {canViewLockers && <Link to="/lockers" className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-semibold text-sky-700 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">View directory<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50" aria-label="Size inventory summary">
          {[['Capacity', total, 'text-slate-900'], ['In use', occupied, 'text-emerald-700'], ['Available', available, 'text-sky-700']].map(([label, value, color]) => <div key={String(label)} className="px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-0.5 font-mono text-sm font-bold ${color}`}>{isLoading ? '—' : Number(value).toLocaleString('en-IN')}</p></div>)}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[430px] overflow-auto overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600" role="region" aria-labelledby="size-inventory-title" aria-describedby="size-inventory-summary" tabIndex={0}>
          <table className="w-full min-w-[580px] border-collapse text-left text-xs">
            <caption className="sr-only">Capacity, occupied lockers, available lockers and utilization for every configured locker size.</caption>
            <thead className="sticky top-0 z-10 bg-slate-50/95 shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur"><tr className="font-semibold uppercase tracking-wide text-slate-500"><th scope="col" className="px-4 py-3 sm:px-5">Size</th><th scope="col" className="px-3 py-3">Dimensions</th><th scope="col" className="px-3 py-3 text-right">Total</th><th scope="col" className="px-3 py-3 text-right">In use</th><th scope="col" className="px-3 py-3 text-right">Available</th><th scope="col" className="w-28 px-4 py-3 text-right sm:px-5">Utilization</th></tr></thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {LOCKER_SIZES.map((item) => {
                const row = stats?.sizeBreakdown?.[item.code];
                const rowTotal = row?.total ?? 0;
                const rowOccupied = row?.occupied ?? 0;
                const rowVacant = row?.vacant ?? 0;
                const utilization = rowTotal ? Math.round((rowOccupied / rowTotal) * 100) : 0;
                const isFull = rowTotal > 0 && rowVacant === 0;
                return <tr key={item.code} className={`${rowTotal === 0 ? 'bg-slate-50/60 text-slate-400' : 'hover:bg-blue-50/40'} group transition-colors`}>
                  <th scope="row" className="px-4 py-3 text-left sm:px-5">{canViewLockers ? <Link to={`/lockers?size=${encodeURIComponent(item.code)}`} className="font-sans font-bold text-slate-900 underline-offset-2 group-hover:text-blue-700 group-hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">{item.label}</Link> : <span className="font-sans font-bold text-slate-900">{item.label}</span>}</th>
                  <td className="whitespace-nowrap px-3 py-3 font-sans text-[11px] text-slate-500">{item.dimensions}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold tabular-nums">{isLoading ? '—' : rowTotal.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-emerald-700">{isLoading ? '—' : rowOccupied.toLocaleString('en-IN')}</td>
                  <td className={`px-3 py-3 text-right font-mono font-bold tabular-nums ${isFull ? 'text-amber-700' : 'text-sky-700'}`}>{isLoading ? '—' : rowVacant.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 sm:px-5">{isLoading ? <span className="block text-right">—</span> : rowTotal === 0 ? <span className="block text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Not stocked</span> : <div className="space-y-1" aria-label={`${utilization}% occupied`}><div className="flex items-center justify-between gap-2"><span className={`text-[10px] font-bold ${isFull ? 'text-amber-700' : 'text-slate-600'}`}>{utilization}%</span>{isFull && <span className="rounded bg-amber-50 px-1 py-0.5 text-[9px] font-bold uppercase text-amber-700">Full</span>}</div><div className="h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden="true"><div className={`h-full rounded-full ${isFull ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${utilization}%` }} /></div></div>}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-[10px] text-slate-500 sm:px-5"><span>Scroll to review all sizes</span><span><span className="font-semibold text-emerald-700">Green</span> indicates occupied capacity</span></div>
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
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-5">
        <div className="absolute inset-y-0 left-0 w-1 bg-blue-600" aria-hidden="true" />
        <div><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Operations overview</p><h1 className="text-lg font-bold tracking-tight text-slate-950 sm:text-xl">Safe-Deposit Vault Operations</h1><p className="mt-0.5 text-xs text-slate-500 sm:text-sm">Live locker inventory, billing status, and physical rack management.</p></div>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-0 sm:flex sm:items-center">
          {canViewLockers && <Link to="/lockers" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:min-h-10"><Layers className="h-4 w-4 text-sky-600" />Lockers Master</Link>}
          {canCreateAllocation && <Link to="/allocations" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-blue-700 px-3 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:min-h-10"><KeyRound className="h-4 w-4 text-sky-300" />New Allocation</Link>}
          <Button variant="outline" size="sm" onClick={refreshDashboard} disabled={isRefreshing} className="col-span-2 gap-1.5 sm:col-span-1" aria-label="Refresh all dashboard metrics"><RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /><span className="sm:sr-only">Refresh dashboard</span></Button>
        </div>
      </section>

      <div className="flex min-h-5 items-center justify-between gap-3 px-1 text-[11px] text-slate-500" role="status" aria-live="polite" aria-atomic="true"><span>{isInitialLoading ? 'Loading live operational metrics…' : latestUpdate ? `Live data updated ${new Date(latestUpdate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Live data unavailable'}</span>{isRefreshing && !isInitialLoading && <span>Refreshing…</span>}</div>
      {failedSections.length > 0 && <section role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p><span className="font-bold">Some metrics could not be loaded:</span> {failedSections.join(', ')}. Unavailable values are shown as dashes.</p></div><Button variant="outline" size="sm" onClick={refreshDashboard} disabled={isRefreshing} className="shrink-0 border-red-300 bg-white text-red-800">Try again</Button></section>}

      {canViewRenewals && <section className="grid grid-cols-1 gap-2.5 sm:hidden" aria-label="Priority actions"><Link to="/renewals?dueStatus=UPCOMING" className="flex min-h-[54px] items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-900"><Clock className="h-4 w-4" />{renewalQuery.isLoading ? 'Loading renewals…' : `${renewalStats?.dueThisMonth.count ?? 0} renewals due this month`}<ChevronRight className="ml-auto h-4 w-4" /></Link><Link to="/renewals?dueStatus=OVERDUE" className="flex min-h-[54px] items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-900"><AlertOctagon className="h-4 w-4" />{renewalQuery.isLoading ? 'Loading overdue invoices…' : `${renewalStats?.overdue.count ?? 0} overdue invoices`}<ChevronRight className="ml-auto h-4 w-4" /></Link></section>}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3" aria-label="Vault metrics" aria-busy={isInitialLoading}>
        <StatCard title="Total Master Lockers" value={metricValue(total, lockerQuery.isLoading || lockerQuery.isError)} subtitle="Sizes A to G2 across physical racks" icon={Layers} iconBg="bg-slate-100" iconColor="text-slate-800" badge={{ text: 'Active Registry', variant: 'neutral' }} href={canViewLockers ? '/lockers' : undefined} />
        <StatCard title="Occupied Lockers" value={metricValue(occupied, lockerQuery.isLoading || lockerQuery.isError)} subtitle={`${occupancyRate}% vault occupancy rate`} icon={CheckCircle} iconBg="bg-emerald-50" iconColor="text-emerald-700" badge={{ text: 'Allocated', variant: 'success' }} href={canViewLockers ? '/lockers?status=OCCUPIED' : undefined} />
        <StatCard title="Allocation Ready" value={metricValue(allocationReady, lockerQuery.isLoading || lockerQuery.isError)} subtitle="Vacant, active units ready for allotment" icon={KeyRound} iconBg="bg-sky-50" iconColor="text-sky-700" badge={{ text: 'Available', variant: 'neutral' }} href={canViewLockers ? '/lockers?status=VACANT&operationalStatus=ACTIVE' : undefined} />
        <StatCard title="Due This Month" value={!canViewRenewals || renewalQuery.isLoading || renewalQuery.isError ? '—' : String(renewalStats?.dueThisMonth.count ?? 0)} subtitle={`${formatCurrency(renewalStats?.dueThisMonth.amount ?? 0)} pending collection`} icon={Clock} iconBg="bg-amber-50" iconColor="text-amber-700" badge={{ text: 'Due Soon', variant: 'warning' }} href={canViewRenewals ? '/renewals?dueStatus=UPCOMING' : undefined} />
        <StatCard title="Overdue Invoices" value={!canViewRenewals || renewalQuery.isLoading || renewalQuery.isError ? '—' : String(renewalStats?.overdue.count ?? 0)} subtitle={`${formatCurrency(renewalStats?.overdue.amount ?? 0)} balance past due`} icon={AlertOctagon} iconBg="bg-red-50" iconColor="text-red-700" badge={{ text: 'Action Req.', variant: 'destructive' }} href={canViewRenewals ? '/renewals?dueStatus=OVERDUE' : undefined} />
        <StatCard title="Today's Collection" value={!canViewPayments || paymentQuery.isLoading || paymentQuery.isError ? '—' : formatCurrency(paymentStats?.todayCollection.amount ?? 0)} subtitle={`${paymentStats?.todayCollection.count ?? 0} completed receipts (cash + digital)`} icon={IndianRupee} iconBg="bg-emerald-50" iconColor="text-emerald-700" badge={{ text: 'Completed', variant: 'success' }} href={canViewPayments ? '/payments' : undefined} />
      </section>

      <SystemHealthCard />
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:gap-6 xl:grid-cols-2">
        <SizeInventoryCard stats={stats} isLoading={lockerQuery.isLoading} canViewLockers={canViewLockers} />

        <Card className="border-slate-200"><CardHeader className="flex flex-row items-center justify-between p-4 pb-2 sm:p-5 sm:pb-2"><CardTitle className="text-sm font-bold text-slate-900">Operational Attention</CardTitle><span className="text-[11px] font-mono text-slate-400">Live checks</span></CardHeader><CardContent className="space-y-2.5 p-4 pt-0 sm:space-y-3 sm:p-5 sm:pt-0">
          <div className={`flex items-start gap-3 rounded-xl border p-3 ${inventoryBalanced ? 'border-slate-200 bg-slate-50' : 'border-red-200 bg-red-50'}`}><div className={`mt-0.5 rounded-lg p-1.5 ${inventoryBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{inventoryBalanced ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}</div><div className="text-xs"><p className="font-bold text-slate-900">Inventory classification {inventoryBalanced ? 'reconciled' : 'needs review'}</p><p className="mt-0.5 text-[11px] text-slate-500">{lockerQuery.isLoading ? 'Checking live locker registry…' : `${classifiedTotal.toLocaleString('en-IN')} classified of ${total.toLocaleString('en-IN')} active records`}</p></div></div>
          <div className={`flex items-start gap-3 rounded-xl border p-3 ${unavailableUnits ? 'border-amber-200 bg-amber-50/70' : 'border-slate-200 bg-slate-50'}`}><div className={`mt-0.5 rounded-lg p-1.5 ${unavailableUnits ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{unavailableUnits ? <Wrench className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}</div><div className="text-xs"><p className="font-bold text-slate-900">{unavailableUnits.toLocaleString('en-IN')} units operationally unavailable</p><p className="mt-0.5 text-[11px] text-slate-500">Maintenance {stats?.maintenance ?? 0} · Damaged {stats?.damaged ?? 0} · Decommissioned {stats?.decommissioned ?? 0}</p></div></div>
          <div className={`flex items-start gap-3 rounded-xl border p-3 ${(renewalStats?.overdue.count ?? 0) ? 'border-red-200 bg-red-50/70' : 'border-slate-200 bg-slate-50'}`}><div className={`mt-0.5 rounded-lg p-1.5 ${(renewalStats?.overdue.count ?? 0) ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{(renewalStats?.overdue.count ?? 0) ? <ShieldAlert className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}</div><div className="min-w-0 flex-1 text-xs"><p className="font-bold text-slate-900">{renewalStats?.overdue.count ?? 0} overdue invoices require collection review</p><p className="mt-0.5 text-[11px] text-slate-500">Outstanding balance: {formatCurrency(renewalStats?.overdue.amount ?? 0)}</p></div>{canViewRenewals && <Link to="/renewals?dueStatus=OVERDUE" aria-label="Review overdue invoices" className="rounded p-1 text-red-700 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-600"><ChevronRight className="h-4 w-4" /></Link>}</div>
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="mt-0.5 rounded-lg bg-sky-100 p-1.5 text-sky-800"><Activity className="h-4 w-4" /></div><div className="text-xs"><p className="font-bold text-slate-900">Today's completed collection</p><p className="mt-0.5 text-[11px] text-slate-500">{formatCurrency(paymentStats?.todayCollection.amount ?? 0)} across {paymentStats?.todayCollection.count ?? 0} receipts</p></div></div>
        </CardContent></Card>
      </div>
    </div>
  );
}
