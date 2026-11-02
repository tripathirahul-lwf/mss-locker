import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package,Lock,FolderOpen,CalendarClock,AlertTriangle,ShieldCheck } from 'lucide-react';
import { lockerApi } from '../features/lockers/api/lockerApi';
import { DashboardLockersSection,DashboardLockersSectionRef } from '../features/lockers/components/DashboardLockersSection';
import { useAuth } from '../hooks/useAuth';

export function DashboardPage() {
  const { hasPermission } = useAuth();
  const directory = useRef<DashboardLockersSectionRef>(null);
  const canView = hasPermission('lockers.view');
  const stats = useQuery({
    queryKey: ['locker-stats'], queryFn: () => lockerApi.getLockerStats(),
    enabled: canView, staleTime: 60_000, refetchOnWindowFocus: false,
  });
  const data = stats.data;
  const metrics = [
    { label: 'Total Lockers', value: data?.total, filter: 'ALL', icon: Package, color: 'text-slate-800' },
    { label: 'Occupied', value: data?.occupied, filter: 'OCCUPIED', icon: Lock, color: 'text-emerald-700' },
    { label: 'Vacant', value: data?.availableForAllocation, filter: 'VACANT', icon: FolderOpen, color: 'text-slate-600' },
    { label: 'Due in 30 days', value: data?.dueSoon, filter: 'DUE_SOON', icon: CalendarClock, color: 'text-amber-700' },
    { label: 'Overdue', value: data?.overdue, filter: 'OVERDUE', icon: AlertTriangle, color: 'text-red-700' },
    { label: 'KYC pending', value: data?.kycPending, filter: 'KYC_PENDING', icon: ShieldCheck, color: 'text-amber-700' },
  ];
  if (!canView) return <p className="rounded-2xl border bg-white p-6">Your role does not have access to the locker ledger.</p>;
  return (
    <div className="vault-ledger space-y-5">
      {stats.isError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
        Ledger totals could not be loaded. <button className="underline" onClick={() => stats.refetch()}>Retry</button>
      </div>}
      <section aria-label="Vault overview" className="vault-kpis grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {metrics.map(({ label, value, filter, icon: Icon, color }) => <button
          key={filter} type="button" onClick={() => { directory.current?.setStatusFilter(filter); directory.current?.scrollIntoView(); }}
          className="vault-kpi rounded-[18px] border border-slate-200 bg-white p-4 text-left transition-colors hover:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600"
        >
          <Icon aria-hidden="true" className={`mb-2 h-6 w-6 ${color}`} />
          <strong className={`block text-3xl font-bold tabular-nums ${color}`}>{stats.isLoading ? '...' : value === undefined ? '-'  : value.toLocaleString('en-IN')}</strong>
          <span className="mt-1 block text-sm text-slate-500">{label}</span>
        </button>)}
      </section>
      <DashboardLockersSection ref={directory} initialStatus="ALL" />
      <footer className="py-5 text-center text-xs text-slate-500">Marudhar Safe &amp; Secure Pvt. Ltd. &middot; Vault Ledger</footer>
    </div>
  );
}
