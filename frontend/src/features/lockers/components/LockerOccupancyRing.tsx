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

export function LockerOccupancyRing({ stats, isLoading = false, selectedStatus, selectedOpStatus, onSelectStatus, onSelectOpStatus, onSelectFilters }: LockerOccupancyRingProps) {
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
    { label: 'Total', value: total, icon: Layers3, tone: 'text-slate-700 bg-slate-100', active: !selectedStatus && !selectedOpStatus, action: () => applyFilters({}) },
    { label: 'Occupied', value: occupied, icon: LockKeyhole, tone: 'text-blue-700 bg-blue-50', active: selectedStatus === 'OCCUPIED' && !selectedOpStatus, action: () => applyFilters(selectedStatus === 'OCCUPIED' && !selectedOpStatus ? {} : { status: 'OCCUPIED' }) },
    { label: 'Ready', value: allocationReady, icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50', active: selectedStatus === 'VACANT' && selectedOpStatus === 'ACTIVE', action: () => applyFilters(selectedStatus === 'VACANT' && selectedOpStatus === 'ACTIVE' ? {} : { status: 'VACANT', operationalStatus: 'ACTIVE' }) },
    { label: 'Reserved', value: stats?.reserved ?? 0, icon: Clock3, tone: 'text-amber-700 bg-amber-50', active: selectedStatus === 'RESERVED' && !selectedOpStatus, action: () => applyFilters(selectedStatus === 'RESERVED' && !selectedOpStatus ? {} : { status: 'RESERVED' }) },
    { label: 'Blocked', value: stats?.blocked ?? 0, icon: Ban, tone: 'text-rose-700 bg-rose-50', active: selectedStatus === 'BLOCKED' && !selectedOpStatus, action: () => applyFilters(selectedStatus === 'BLOCKED' && !selectedOpStatus ? {} : { status: 'BLOCKED' }) },
    { label: 'Maintenance', value: stats?.maintenance ?? 0, icon: Wrench, tone: 'text-orange-700 bg-orange-50', active: selectedOpStatus === 'MAINTENANCE' && !selectedStatus, action: () => applyFilters(selectedOpStatus === 'MAINTENANCE' && !selectedStatus ? {} : { operationalStatus: 'MAINTENANCE' }) },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="inventory-overview-title">
      <div className="flex items-center gap-3 border-b border-slate-100 p-3.5 sm:gap-4 sm:px-5 sm:py-4">
        <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full sm:h-[72px] sm:w-[72px]" style={{ background: `conic-gradient(#2563eb ${rate * 3.6}deg, #e2e8f0 0)` }}>
          <div className="grid h-14 w-14 place-items-center rounded-full bg-white sm:h-16 sm:w-16">
            <div className="text-center"><strong className="block font-mono text-lg text-slate-950 sm:text-xl">{isLoading ? '—' : `${rate}%`}</strong><span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Occupied</span></div>
          </div>
        </div>
        <div className="min-w-0">
          <p id="inventory-overview-title" className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Live inventory</p>
          <p className="mt-0.5 text-base font-black tracking-tight text-slate-950 sm:text-lg">Vault occupancy</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 sm:text-xs"><strong className="text-slate-800">{occupied.toLocaleString()}</strong> occupied · <strong className="text-emerald-700">{allocationReady.toLocaleString()}</strong> allocation ready · {total.toLocaleString()} total</p>
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
        {metrics.map(({ label, value, icon: Icon, tone, active, action }) => (
          <button key={label} type="button" onClick={action} aria-pressed={active} title={`Filter lockers by ${label.toLowerCase()}`} className={`flex min-h-[64px] cursor-pointer items-center gap-2.5 p-3 text-left transition-colors hover:bg-slate-50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${active ? 'bg-blue-50/60 ring-1 ring-inset ring-blue-200' : ''}`}>
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></span>
            <span className="min-w-0"><strong className="block font-mono text-lg leading-none text-slate-950">{isLoading ? '—' : value.toLocaleString()}</strong><span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span></span>
          </button>
        ))}
      </div>
    </section>
  );
}
