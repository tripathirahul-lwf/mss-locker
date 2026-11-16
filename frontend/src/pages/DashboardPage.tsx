import { useRef, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Package,
  Lock,
  FolderOpen,
  CalendarClock,
  AlertTriangle,
  ShieldCheck,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { lockerApi } from '../features/lockers/api/lockerApi';
import {
  DashboardLockersSection,
  DashboardLockersSectionRef,
} from '../features/lockers/components/DashboardLockersSection';
import { useAuth } from '../hooks/useAuth';

export function DashboardPage() {
  const { hasPermission } = useAuth();
  const directory = useRef<DashboardLockersSectionRef>(null);
  const canView = hasPermission('lockers.view');

  // Persistence for Hide Data & Collapse Cards
  const [hideData, setHideData] = useState<boolean>(() => {
    try {
      return localStorage.getItem('vault_kpi_hide_data') === 'true';
    } catch {
      return false;
    }
  });

  const [showCards, setShowCards] = useState<boolean>(() => {
    try {
      return localStorage.getItem('vault_kpi_show_cards') !== 'false';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('vault_kpi_hide_data', String(hideData));
    } catch {
      // storage unavailable
    }
  }, [hideData]);

  useEffect(() => {
    try {
      localStorage.setItem('vault_kpi_show_cards', String(showCards));
    } catch {
      // storage unavailable
    }
  }, [showCards]);

  const stats = useQuery({
    queryKey: ['locker-stats'],
    queryFn: () => lockerApi.getLockerStats(),
    enabled: canView,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
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

  if (!canView)
    return (
      <p className="rounded-2xl border bg-white p-6">
        Your role does not have access to the locker ledger.
      </p>
    );

  return (
    <div className="vault-ledger space-y-4">
      {stats.isError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          Ledger totals could not be loaded.{' '}
          <button className="underline" onClick={() => stats.refetch()}>
            Retry
          </button>
        </div>
      )}

      {/* KPI Controls Header with Show/Hide Data & Show/Hide Cards */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Vault Overview
          </span>
          {!showCards && (
            <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              Cards Hidden
            </span>
          )}
          {showCards && hideData && (
            <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              Data Masked
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Button to Show / Hide KPI Data Numbers */}
          <button
            type="button"
            onClick={() => setHideData((prev) => !prev)}
            aria-label={hideData ? 'Show KPI data' : 'Hide KPI data'}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
            title={hideData ? 'Show KPI numbers' : 'Hide KPI numbers (privacy mode)'}
          >
            {hideData ? (
              <Eye className="h-3.5 w-3.5 text-emerald-700" />
            ) : (
              <EyeOff className="h-3.5 w-3.5 text-slate-500" />
            )}
            <span>{hideData ? 'Show Data' : 'Hide Data'}</span>
          </button>

          {/* Button to Show / Hide KPI Cards Section */}
          <button
            type="button"
            onClick={() => setShowCards((prev) => !prev)}
            aria-expanded={showCards}
            aria-label={showCards ? 'Hide KPI cards' : 'Show KPI cards'}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
            title={showCards ? 'Hide KPI cards section' : 'Show KPI cards section'}
          >
            {showCards ? (
              <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
            )}
            <span>{showCards ? 'Hide Cards' : 'Show Cards'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      {showCards && (
        <section
          aria-label="Vault overview"
          className="vault-kpis grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 transition-all duration-200"
        >
          {metrics.map(({ label, value, filter, icon: Icon, color }) => (
            <button
              key={filter}
              type="button"
              onClick={() => {
                directory.current?.setStatusFilter(filter);
                directory.current?.scrollIntoView();
              }}
              className="vault-kpi rounded-[18px] border border-slate-200 bg-white p-4 text-left transition-colors hover:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600 cursor-pointer"
            >
              <Icon aria-hidden="true" className={`mb-2 h-6 w-6 ${color}`} />
              <strong className={`block text-3xl font-bold tabular-nums ${color}`}>
                {stats.isLoading
                  ? '...'
                  : hideData
                  ? '••••'
                  : value === undefined
                  ? '-'
                  : value.toLocaleString('en-IN')}
              </strong>
              <span className="mt-1 block text-sm text-slate-500">{label}</span>
            </button>
          ))}
        </section>
      )}

      <DashboardLockersSection ref={directory} initialStatus="ALL" />
      <footer className="py-5 text-center text-xs text-slate-500">
        Marudhar Safe &amp; Secure Pvt. Ltd. &middot; Vault Ledger
      </footer>
    </div>
  );
}
