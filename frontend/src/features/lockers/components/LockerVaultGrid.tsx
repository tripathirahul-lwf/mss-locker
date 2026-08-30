import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Clock,
  KeyRound,
  Layers,
  Lock,
  Wrench,
  User,
  Sparkles,
  ShieldCheck,
  ArrowUpRight,
} from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Locker, LockerStatus } from '../types';
import { formatINR } from '../utils/formatters';

interface LockerVaultGridProps {
  lockers: Locker[];
  isLoading: boolean;
  onSelectLocker: (locker: Locker) => void;
}

type RackGroup = {
  rackNumber: string;
  section: string;
  floor: string;
  lockers: Locker[];
  total: number;
  vacant: number;
  occupied: number;
  reserved: number;
  blocked: number;
  maintenance: number;
};

export function LockerVaultGrid({ lockers, isLoading, onSelectLocker }: LockerVaultGridProps) {
  const [selectedRackFilter, setSelectedRackFilter] = useState('ALL');
  const [collapsedRacks, setCollapsedRacks] = useState<Set<string>>(new Set());

  const rackGroups = useMemo(() => {
    const groups: Record<string, RackGroup> = {};
    lockers.forEach((locker) => {
      const rack = locker.rackNumber || 'Unassigned Rack';
      if (!groups[rack]) {
        groups[rack] = {
          rackNumber: rack,
          section: locker.section || 'Main Vault',
          floor: locker.floor || 'Ground Floor',
          lockers: [],
          total: 0,
          vacant: 0,
          occupied: 0,
          reserved: 0,
          blocked: 0,
          maintenance: 0,
        };
      }
      const group = groups[rack];
      group.lockers.push(locker);
      group.total += 1;
      if (locker.status === 'VACANT') group.vacant += 1;
      else if (locker.status === 'OCCUPIED') group.occupied += 1;
      else if (locker.status === 'RESERVED') group.reserved += 1;
      else if (locker.status === 'BLOCKED') group.blocked += 1;
      if (locker.operationalStatus === 'MAINTENANCE' || locker.operationalStatus === 'DAMAGED') {
        group.maintenance += 1;
      }
    });
    return Object.values(groups).sort((a, b) =>
      a.rackNumber.localeCompare(b.rackNumber, undefined, { numeric: true })
    );
  }, [lockers]);

  const uniqueRacks = useMemo(() => rackGroups.map((group) => group.rackNumber), [rackGroups]);
  useEffect(() => {
    if (selectedRackFilter !== 'ALL' && !uniqueRacks.includes(selectedRackFilter)) {
      setSelectedRackFilter('ALL');
    }
  }, [selectedRackFilter, uniqueRacks]);
  const filteredGroups = useMemo(
    () =>
      selectedRackFilter === 'ALL'
        ? rackGroups
        : rackGroups.filter((group) => group.rackNumber === selectedRackFilter),
    [rackGroups, selectedRackFilter]
  );
  const allVisibleCollapsed =
    filteredGroups.length > 0 && filteredGroups.every((group) => collapsedRacks.has(group.rackNumber));

  const toggleRack = (rackNumber: string) =>
    setCollapsedRacks((current) => {
      const next = new Set(current);
      if (next.has(rackNumber)) next.delete(rackNumber);
      else next.add(rackNumber);
      return next;
    });

  const toggleAllVisible = () =>
    setCollapsedRacks((current) => {
      const next = new Set(current);
      const shouldExpand =
        filteredGroups.length > 0 && filteredGroups.every((group) => current.has(group.rackNumber));
      filteredGroups.forEach((group) =>
        shouldExpand ? next.delete(group.rackNumber) : next.add(group.rackNumber)
      );
      return next;
    });

  const getStatusTileStyle = (status: LockerStatus, opsStatus: string) => {
    if (opsStatus === 'MAINTENANCE' || opsStatus === 'DAMAGED') {
      return {
        bg: 'bg-orange-50/70 hover:bg-orange-100/90 border-orange-300 text-orange-950 shadow-2xs hover:border-orange-400',
        handleBg: 'bg-orange-300',
        icon: Wrench,
        iconColor: 'text-orange-600',
        badgeClass: 'bg-orange-100 text-orange-900 border-orange-200',
        statusLabel: 'Maintenance',
        statusColor: 'text-orange-700 font-bold',
      };
    }
    switch (status) {
      case 'VACANT':
        return {
          bg: 'bg-emerald-50/70 hover:bg-emerald-100/90 border-emerald-300 text-emerald-950 shadow-2xs hover:border-emerald-500 hover:shadow-emerald-500/10',
          handleBg: 'bg-emerald-300',
          icon: KeyRound,
          iconColor: 'text-emerald-600',
          badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-200',
          statusLabel: 'Vacant • Ready',
          statusColor: 'text-emerald-700 font-bold',
        };
      case 'OCCUPIED':
        return {
          bg: 'bg-blue-50/70 hover:bg-blue-100/90 border-blue-300 text-blue-950 shadow-2xs hover:border-blue-500 hover:shadow-blue-500/10',
          handleBg: 'bg-blue-300',
          icon: Lock,
          iconColor: 'text-blue-600',
          badgeClass: 'bg-blue-100 text-blue-900 border-blue-200',
          statusLabel: 'Occupied',
          statusColor: 'text-blue-700 font-bold',
        };
      case 'RESERVED':
        return {
          bg: 'bg-amber-50/70 hover:bg-amber-100/90 border-amber-300 text-amber-950 shadow-2xs hover:border-amber-500 hover:shadow-amber-500/10',
          handleBg: 'bg-amber-300',
          icon: Clock,
          iconColor: 'text-amber-600',
          badgeClass: 'bg-amber-100 text-amber-900 border-amber-200',
          statusLabel: 'On Hold (Reserved)',
          statusColor: 'text-amber-700 font-bold',
        };
      case 'BLOCKED':
        return {
          bg: 'bg-rose-50/70 hover:bg-rose-100/90 border-rose-300 text-rose-950 shadow-2xs hover:border-rose-400',
          handleBg: 'bg-rose-300',
          icon: Ban,
          iconColor: 'text-rose-600',
          badgeClass: 'bg-rose-100 text-rose-900 border-rose-200',
          statusLabel: 'Blocked Notice',
          statusColor: 'text-rose-700 font-bold',
        };
      default:
        return {
          bg: 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-800 shadow-2xs',
          handleBg: 'bg-slate-300',
          icon: KeyRound,
          iconColor: 'text-slate-500',
          badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
          statusLabel: 'Available',
          statusColor: 'text-slate-700 font-bold',
        };
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 animate-pulse" aria-label="Loading rack layout">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-72 rounded-3xl border border-slate-200 bg-white" />
        ))}
      </div>
    );
  }

  if (lockers.length === 0) {
    return (
      <div className="p-8 sm:p-12 text-center bg-white border border-slate-200 rounded-3xl space-y-3 shadow-2xs">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
          <Layers className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-slate-800">No physical lockers to display</p>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Try clearing your active size or rack filters to see available units.
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      {/* 1. Status Legend & Rack Controls Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-2xl sm:rounded-3xl shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700" aria-label="Locker status legend">
          <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 mr-1">
            Locker Status:
          </span>
          <LegendItem label="Vacant" className="bg-emerald-50 border-emerald-200 text-emerald-800 font-bold" dotClassName="bg-emerald-500" />
          <LegendItem label="Occupied" className="bg-blue-50 border-blue-200 text-blue-800 font-bold" dotClassName="bg-blue-500" />
          <LegendItem label="Reserved" className="bg-amber-50 border-amber-200 text-amber-800 font-bold" dotClassName="bg-amber-500" />
          <LegendItem label="Blocked" className="bg-rose-50 border-rose-200 text-rose-800 font-bold" dotClassName="bg-rose-500" />
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-orange-50 border-orange-200 text-orange-800 font-bold text-xs">
            <Wrench className="h-3.5 w-3.5" aria-hidden="true" /> Maintenance
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
          {uniqueRacks.length > 1 && (
            <label className="flex items-center gap-2">
              <span className="text-xs text-slate-600 font-bold whitespace-nowrap">Show rack:</span>
              <select
                value={selectedRackFilter}
                onChange={(event) => setSelectedRackFilter(event.target.value)}
                className="h-11 min-w-48 flex-1 px-3 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer"
              >
                <option value="ALL">All racks ({rackGroups.length})</option>
                {uniqueRacks.map((rack) => (
                  <option key={rack} value={rack}>
                    {rack}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={toggleAllVisible}
            className="h-11 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 shadow-2xs cursor-pointer"
          >
            {allVisibleCollapsed ? <ChevronsUpDown className="h-4 w-4" /> : <ChevronsDownUp className="h-4 w-4" />}
            <span>{allVisibleCollapsed ? 'Expand all' : 'Collapse all'}</span>
          </button>
        </div>
      </div>

      {/* 2. Scrollable Quick Rack Navigator Ribbon */}
      {uniqueRacks.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full text-xs font-bold scrollbar-thin">
          <button
            type="button"
            onClick={() => setSelectedRackFilter('ALL')}
            className={`px-3.5 py-2 rounded-xl shrink-0 transition-all cursor-pointer border ${
              selectedRackFilter === 'ALL'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Racks ({rackGroups.length})
          </button>
          {rackGroups.map((group) => {
            const isSelected = selectedRackFilter === group.rackNumber;
            const occupancyPct = group.total ? Math.round((group.occupied / group.total) * 100) : 0;

            return (
              <button
                key={group.rackNumber}
                type="button"
                onClick={() => setSelectedRackFilter(group.rackNumber)}
                className={`px-3 py-2 rounded-xl shrink-0 transition-all flex items-center gap-1.5 cursor-pointer border ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{group.rackNumber}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                    isSelected ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {group.total}
                </span>
                {occupancyPct > 0 && (
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded ${
                      isSelected ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {occupancyPct}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 3. Physical Racks Grid */}
      <div className={`grid min-w-0 grid-cols-1 gap-5 ${selectedRackFilter === 'ALL' ? 'xl:grid-cols-2' : ''}`}>
        {filteredGroups.map((group) => {
          const occupancyRate = group.total ? Math.round((group.occupied / group.total) * 100) : 0;
          const isCollapsed = collapsedRacks.has(group.rackNumber);
          const panelId = `rack-${group.rackNumber.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

          return (
            <section
              key={group.rackNumber}
              className="min-w-0 bg-white border border-slate-200 rounded-3xl shadow-2xs overflow-hidden self-start transition-all [content-visibility:auto] [contain-intrinsic-size:auto_520px]"
              aria-labelledby={`${panelId}-title`}
            >
              {/* Rack Header */}
              <div className={`flex items-center justify-between gap-3 p-4 sm:p-5 ${isCollapsed ? '' : 'border-b border-slate-100'}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-11 px-3.5 rounded-2xl bg-slate-950 text-white font-mono font-bold shadow-xs text-xs flex items-center shrink-0 tracking-wider">
                    {group.rackNumber}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h3 id={`${panelId}-title`} className="font-bold text-slate-900 text-sm truncate">
                        {group.section} <span aria-hidden="true">&bull;</span> {group.floor}
                      </h3>
                      <Badge variant="outline" className="text-[10px] font-bold bg-slate-50 border-slate-200">
                        {group.total} {group.total === 1 ? 'locker' : 'lockers'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 truncate font-medium">
                      <strong className="text-emerald-700">{group.vacant} vacant</strong>{' '}
                      <span aria-hidden="true">&bull;</span>{' '}
                      <strong className="text-blue-700">{group.occupied} occupied</strong>{' '}
                      <span aria-hidden="true">&bull;</span>{' '}
                      <strong className="text-amber-700">{group.reserved} reserved</strong>
                      {group.maintenance > 0 && (
                        <>
                          {' '}
                          <span aria-hidden="true">&bull;</span>{' '}
                          <strong className="text-orange-700">{group.maintenance} maintenance</strong>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <span className="text-xs font-black text-slate-900">{occupancyRate}%</span>
                    <span className="text-[10px] text-slate-500 block font-semibold">Occupied</span>
                  </div>
                  <div
                    className="hidden sm:block w-20 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200"
                    role="progressbar"
                    aria-label={`${group.rackNumber} occupancy`}
                    aria-valuenow={occupancyRate}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={`h-full rounded-full transition-all ${
                        occupancyRate > 70 ? 'bg-amber-600' : 'bg-slate-900'
                      }`}
                      style={{ width: `${occupancyRate}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleRack(group.rackNumber)}
                    className="h-10 w-10 inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                    aria-expanded={!isCollapsed}
                    aria-controls={panelId}
                    aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${group.rackNumber}`}
                  >
                    <ChevronDown
                      className={`h-5 w-5 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                    />
                  </button>
                </div>
              </div>

              {/* Physical Locker Compartment Cells */}
              <div
                id={panelId}
                className={`${isCollapsed ? 'hidden' : 'grid'} grid-cols-2 sm:grid-cols-3 gap-3.5 p-4 sm:p-5 ${
                  selectedRackFilter !== 'ALL'
                    ? 'lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
                    : 'lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3'
                }`}
              >
                {group.lockers.map((locker) => {
                  const style = getStatusTileStyle(locker.status, locker.operationalStatus);
                  const Icon = style.icon;

                  return (
                    <button
                      key={locker._id}
                      type="button"
                      onClick={() => onSelectLocker(locker)}
                      aria-label={`Open locker ${locker.lockerNumber}, size ${locker.size}, ${style.statusLabel}`}
                      className={`min-h-[148px] p-3.5 rounded-2xl border transition-all text-left overflow-hidden flex flex-col justify-between group hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer ${style.bg}`}
                    >
                      {/* Top Physical Compartment Slot Groove */}
                      <div className="w-12 h-1 bg-slate-300/80 rounded-full mx-auto shadow-2xs group-hover:bg-slate-400 transition-colors" aria-hidden="true" />

                      {/* Header Row: Locker Number + Status Icon Pill */}
                      <div className="flex items-center justify-between w-full mt-1.5 mb-1">
                        <span className="font-mono text-base font-black text-slate-900 tracking-tight">
                          #{locker.lockerNumber}
                        </span>
                        <div className="p-1.5 rounded-xl bg-white/90 shadow-2xs border border-slate-200/60 flex items-center justify-center">
                          <Icon className={`w-3.5 h-3.5 shrink-0 ${style.iconColor}`} aria-hidden="true" />
                        </div>
                      </div>

                      {/* Middle Row: Size & Annual Rent Snapshot */}
                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-extrabold text-slate-800 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/50 shadow-2xs">
                            Size {locker.size}
                          </span>
                          <span className="font-black text-slate-900 font-mono text-xs" title="Annual rent">
                            {formatINR(locker.annualRent)}
                            <span className="text-[9px] text-slate-500 font-sans font-normal">/yr</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                          <span>Deposit: ₹{locker.securityDeposit.toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      {/* Bottom Row: Status Badge + Inspect Action Indicator */}
                      <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                        <span className={style.statusColor}>
                          {style.statusLabel}
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-blue-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                          <span>Dossier</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function LegendItem({
  label,
  className,
  dotClassName,
}: {
  label: string;
  className: string;
  dotClassName: string;
}) {
  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${className}`}>
      <span className={`w-2 h-2 rounded-full ${dotClassName}`} aria-hidden="true" />
      {label}
    </span>
  );
}
