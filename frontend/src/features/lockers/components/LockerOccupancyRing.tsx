import { Ban, CheckCircle2, Clock3, Layers3, LockKeyhole, Wrench } from 'lucide-react';
import { LockerStats } from '../types';

interface LockerOccupancyRingProps {
  stats?: LockerStats;
  isLoading?: boolean;
  selectedStatus?: string;
  selectedOpStatus?: string;
  onSelectStatus?: (status?: string) => void;
  onSelectOpStatus?: (status?: string) => void;
  onSelectFilters?: (filters: { status?: string; operationalStatus?: string }) => void;
}

export function LockerOccupancyRing({
  stats,
  isLoading = false,
  selectedStatus,
  selectedOpStatus,
  onSelectStatus,
  onSelectOpStatus,
  onSelectFilters,
}: LockerOccupancyRingProps) {
  const total = stats?.total ?? 0;
  const occupied = stats?.occupied ?? 0;
  const allocationReady = stats?.availableForAllocation ?? 0;
  const rate = total ? Math.round((occupied / total) * 100) : 0;

  const applyFilters = (next: { status?: string; operationalStatus?: string }) => {
    if (onSelectFilters) return onSelectFilters(next);
    onSelectStatus?.(next.status);
    onSelectOpStatus?.(next.operationalStatus);
  };

  const metrics = [
    {
      label: 'Total Units',
      value: total,
      sublabel: '100% Registry',
      icon: Layers3,
      tone: 'text-slate-700 bg-slate-100',
      activeTone: 'text-slate-900 bg-slate-200/80',
      active: !selectedStatus && !selectedOpStatus,
      action: () => applyFilters({}),
    },
    {
      label: 'Occupied',
      value: occupied,
      sublabel: `${rate}% Share`,
      icon: LockKeyhole,
      tone: 'text-emerald-800 bg-emerald-50',
      activeTone: 'text-emerald-900 bg-emerald-100',
      active: selectedStatus === 'OCCUPIED' && !selectedOpStatus,
      action: () =>
        applyFilters(
          selectedStatus === 'OCCUPIED' && !selectedOpStatus ? {} : { status: 'OCCUPIED' }
        ),
    },
    {
      label: 'Ready / Vacant',
      value: allocationReady,
      sublabel: `${total ? ((allocationReady / total) * 100).toFixed(1) : 0}% Available`,
      icon: CheckCircle2,
      tone: 'text-emerald-800 bg-emerald-50',
      activeTone: 'text-emerald-900 bg-emerald-100',
      active: selectedStatus === 'VACANT' && selectedOpStatus === 'ACTIVE',
      action: () =>
        applyFilters(
          selectedStatus === 'VACANT' && selectedOpStatus === 'ACTIVE'
            ? {}
            : { status: 'VACANT', operationalStatus: 'ACTIVE' }
        ),
    },
    {
      label: 'Reserved',
      value: stats?.reserved ?? 0,
      sublabel: `${total ? (((stats?.reserved ?? 0) / total) * 100).toFixed(1) : 0}% Hold`,
      icon: Clock3,
      tone: 'text-amber-800 bg-amber-50',
      activeTone: 'text-amber-900 bg-amber-100',
      active: selectedStatus === 'RESERVED' && !selectedOpStatus,
      action: () =>
        applyFilters(
          selectedStatus === 'RESERVED' && !selectedOpStatus ? {} : { status: 'RESERVED' }
        ),
    },
    {
      label: 'Blocked',
      value: stats?.blocked ?? 0,
      sublabel: `${total ? (((stats?.blocked ?? 0) / total) * 100).toFixed(1) : 0}% Frozen`,
      icon: Ban,
      tone: 'text-rose-800 bg-rose-50',
      activeTone: 'text-rose-900 bg-rose-100',
      active: selectedStatus === 'BLOCKED' && !selectedOpStatus,
      action: () =>
        applyFilters(
          selectedStatus === 'BLOCKED' && !selectedOpStatus ? {} : { status: 'BLOCKED' }
        ),
    },
    {
      label: 'Maintenance',
      value: stats?.maintenance ?? 0,
      sublabel: `${total ? (((stats?.maintenance ?? 0) / total) * 100).toFixed(1) : 0}% Offline`,
      icon: Wrench,
      tone: 'text-orange-800 bg-orange-50',
      activeTone: 'text-orange-900 bg-orange-100',
      active: selectedOpStatus === 'MAINTENANCE' && !selectedStatus,
      action: () =>
        applyFilters(
          selectedOpStatus === 'MAINTENANCE' && !selectedStatus
            ? {}
            : { operationalStatus: 'MAINTENANCE' }
        ),
    },
  ];

  // SVG Gauge Calculations
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (rate / 100) * circumference;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs"
      aria-labelledby="inventory-overview-title"
    >
      {/* Top Banner Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 border-b border-slate-100">
        <div className="flex items-center gap-4">
          {/* Precision SVG Ring Meter */}
          <div className="relative grid h-16 w-16 shrink-0 place-items-center">
            <svg className="h-16 w-16 -rotate-90 transform" viewBox="0 0 64 64">
              <circle
                cx="32"
                cy="32"
                r={radius}
                className="stroke-slate-100"
                strokeWidth="5"
                fill="none"
              />
              <circle
                cx="32"
                cy="32"
                r={radius}
                className="stroke-emerald-800 transition-all duration-700 ease-out"
                strokeWidth="5"
                strokeDasharray={circumference}
                strokeDashoffset={isLoading ? circumference : strokeDashoffset}
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-sans font-semibold text-sm text-slate-900 tabular-nums leading-none">
                {isLoading ? '—' : `${rate}%`}
              </span>
              <span className="text-[7.5px] font-medium uppercase tracking-wider text-slate-400 mt-0.5">
                Occupied
              </span>
            </div>
          </div>

          {/* Text & Status Details */}
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                Live Inventory
              </span>
              <span className="text-xs text-slate-500 font-normal">
                {rate}% Total Capacity Allocated
              </span>
            </div>
            <h2 id="inventory-overview-title" className="text-base sm:text-lg font-semibold tracking-tight text-slate-900">
              Safe-Deposit Vault Occupancy
            </h2>
            <p className="text-xs text-slate-500 font-normal">
              <span className="font-medium text-slate-900">{occupied.toLocaleString()}</span> occupied &bull;{' '}
              <span className="font-medium text-emerald-800">{allocationReady.toLocaleString()}</span> allocation ready &bull;{' '}
              {total.toLocaleString()} total units
            </p>
          </div>
        </div>

        {/* Capacity Distribution Bar */}
        <div className="sm:max-w-xs w-full space-y-1.5 self-center">
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Utilization Breakdown</span>
            <span className="font-semibold text-slate-900">{rate}% Allocated</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200/60 flex">
            <div
              className="h-full bg-emerald-800 transition-all duration-500"
              style={{ width: `${rate}%` }}
              title={`Occupied: ${occupied}`}
            />
            <div
              className="h-full bg-emerald-400 transition-all duration-500"
              style={{ width: `${total ? ((allocationReady / total) * 100) : 0}%` }}
              title={`Ready: ${allocationReady}`}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-normal">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-800" />
              Occupied ({occupied})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Ready ({allocationReady})
            </span>
          </div>
        </div>
      </div>

      {/* Inset Interactive Filter Strip */}
      <div className="p-3 bg-slate-50/70 border-t border-slate-100">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {metrics.map(({ label, value, sublabel, icon: Icon, tone, activeTone, active, action }) => (
            <button
              key={label}
              type="button"
              onClick={action}
              aria-pressed={active}
              title={`Filter lockers by ${label.toLowerCase()}`}
              className={`flex flex-col justify-between p-3 rounded-xl text-left transition-all cursor-pointer relative ${
                active
                  ? 'bg-white text-slate-900 shadow-sm border border-emerald-600/70 ring-2 ring-emerald-600/15'
                  : 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Card Header: Icon & Active Indicator */}
              <div className="flex items-center justify-between gap-1.5 w-full">
                <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${active ? activeTone : tone}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                {active ? (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-400 font-normal">
                    {sublabel}
                  </span>
                )}
              </div>

              {/* Card Body: Number & Label */}
              <div className="mt-2.5">
                <span className="block font-sans font-semibold text-lg sm:text-xl leading-none text-slate-900 tabular-nums">
                  {isLoading ? '—' : value.toLocaleString()}
                </span>
                <span className="mt-1 block truncate text-[10.5px] font-medium uppercase tracking-wider text-slate-500">
                  {label}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
