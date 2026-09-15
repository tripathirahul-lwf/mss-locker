import React, { useMemo, useState, memo, useCallback } from 'react';
import {
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Clock,
  KeyRound,
  Layers,
  Lock,
  Wrench,
  ArrowUpRight,
  LayoutGrid,
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

// Fast status style lookup matching LockerModernCard banking aesthetic
const getStatusTileStyle = (status: LockerStatus, opsStatus: string, isRenewalDue: boolean = false) => {
  if (opsStatus === 'MAINTENANCE' || opsStatus === 'DAMAGED') {
    return {
      cardClass: 'bg-slate-100/90 border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-xs',
      icon: Wrench,
      statusLabel: 'Maintenance',
      badgeClass: 'bg-slate-200 text-slate-800 border-slate-300',
      dotClass: 'bg-slate-500',
      sizeBadgeClass: 'bg-white text-slate-800 border-slate-300',
      rentColor: 'text-slate-900',
      actionText: 'Inspect',
      actionColor: 'text-slate-700',
      subTextColor: 'text-slate-500',
      footerBorder: 'border-slate-200',
    };
  }
  if (isRenewalDue) {
    return {
      cardClass: 'bg-amber-50/90 border-amber-300 hover:border-amber-400 hover:bg-amber-100/70 shadow-2xs hover:shadow-xs ring-1 ring-amber-300/60',
      icon: Clock,
      statusLabel: 'Renewal Due',
      badgeClass: 'bg-amber-100 text-amber-950 border-amber-300 font-bold',
      dotClass: 'bg-amber-600 animate-ping',
      sizeBadgeClass: 'bg-white text-amber-950 border-amber-300',
      rentColor: 'text-amber-950 font-bold',
      actionText: 'Renew',
      actionColor: 'text-amber-900 font-bold',
      subTextColor: 'text-amber-800',
      footerBorder: 'border-amber-200',
    };
  }
  switch (status) {
    case 'VACANT':
      return {
        cardClass: 'bg-emerald-50/75 border-emerald-200/90 hover:border-emerald-300 hover:bg-emerald-100/60 shadow-2xs hover:shadow-xs',
        icon: KeyRound,
        statusLabel: 'Available',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200 font-bold',
        dotClass: 'bg-emerald-600 animate-pulse',
        sizeBadgeClass: 'bg-white/80 text-emerald-900 border-emerald-200/80',
        rentColor: 'text-emerald-950',
        actionText: '+ Allocate',
        actionColor: 'text-emerald-800',
        subTextColor: 'text-emerald-700/80',
        footerBorder: 'border-emerald-200/60',
      };
    case 'OCCUPIED':
      return {
        cardClass: 'bg-rose-50/80 border-rose-200/90 hover:border-rose-300 hover:bg-rose-100/70 shadow-2xs hover:shadow-xs',
        icon: Lock,
        statusLabel: 'Occupied',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-200 font-bold',
        dotClass: 'bg-rose-600',
        sizeBadgeClass: 'bg-white text-rose-800 border-rose-200',
        rentColor: 'text-rose-950',
        actionText: 'View Dossier',
        actionColor: 'text-rose-700 font-semibold',
        subTextColor: 'text-rose-700/80',
        footerBorder: 'border-rose-200/70',
      };
    case 'RESERVED':
      return {
        cardClass: 'bg-amber-50/75 border-amber-200/90 hover:border-amber-300 hover:bg-amber-100/60 shadow-2xs hover:shadow-xs',
        icon: Clock,
        statusLabel: 'Reserved',
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-200',
        dotClass: 'bg-amber-600',
        sizeBadgeClass: 'bg-white/80 text-amber-950 border-amber-200/80',
        rentColor: 'text-amber-950',
        actionText: 'Manage Hold',
        actionColor: 'text-amber-800',
        subTextColor: 'text-amber-700/80',
        footerBorder: 'border-amber-200/60',
      };
    case 'BLOCKED':
      return {
        cardClass: 'bg-orange-50/75 border-orange-200/90 hover:border-orange-300 hover:bg-orange-100/60 shadow-2xs hover:shadow-xs',
        icon: Lock,
        statusLabel: 'Blocked',
        badgeClass: 'bg-orange-100 text-orange-900 border-orange-200',
        dotClass: 'bg-orange-600',
        sizeBadgeClass: 'bg-white/80 text-orange-950 border-orange-200/80',
        rentColor: 'text-orange-950',
        actionText: 'Review',
        actionColor: 'text-orange-800',
        subTextColor: 'text-orange-700/80',
        footerBorder: 'border-orange-200/60',
      };
    default:
      return {
        cardClass: 'bg-slate-50 border-slate-200/90 hover:border-slate-300 hover:bg-slate-100',
        icon: KeyRound,
        statusLabel: 'Available',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        dotClass: 'bg-slate-400',
        sizeBadgeClass: 'bg-white text-slate-700 border-slate-200',
        rentColor: 'text-slate-900',
        actionText: 'View',
        actionColor: 'text-slate-700',
        subTextColor: 'text-slate-500',
        footerBorder: 'border-slate-200',
      };
  }
};

// Memoized individual locker tile component with real vault compartment appearance
const LockerTile = memo(function LockerTile({
  locker,
  onSelect,
  showRack = false,
}: {
  locker: Locker;
  onSelect: (locker: Locker) => void;
  showRack?: boolean;
}) {
  const style = getStatusTileStyle(locker.status, locker.operationalStatus, Boolean(locker.isRenewalDue));
  const isOccupied = locker.status === 'OCCUPIED' && !locker.isRenewalDue;

  // Subtitle: display rack if in continuous matrix, or section/position if available
  const subLocation = showRack
    ? (locker.rackNumber || 'Vault Matrix')
    : (locker.position ? `Pos: ${locker.position}` : (locker.section || ''));

  return (
    <button
      type="button"
      onClick={() => onSelect(locker)}
      aria-label={`Open locker ${locker.lockerNumber}, size ${locker.size}, ${style.statusLabel}`}
      className={`p-3.5 rounded-xl border transition-all text-left flex flex-col justify-between group cursor-pointer min-w-0 ${style.cardClass}`}
    >
      {/* Top Header: Locker Number + Status Badge */}
      <div className="flex items-center justify-between w-full gap-1.5">
        <span className="font-bold text-sm sm:text-base text-slate-900 tracking-tight">
          #{locker.lockerNumber}
        </span>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${style.badgeClass}`}
        >
          {isOccupied ? (
            <Lock className="w-2.5 h-2.5 text-slate-500 shrink-0" />
          ) : (
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dotClass}`} />
          )}
          <span>{style.statusLabel}</span>
        </span>
      </div>

      {/* Middle Specs: Size & Annual Rent */}
      <div className="my-2.5 space-y-1">
        <div className="flex items-center justify-between gap-1 text-xs">
          <span className={`font-semibold px-1.5 py-0.5 rounded text-[10.5px] shrink-0 border ${style.sizeBadgeClass}`}>
            Size {locker.size}
          </span>
          <span className={`font-bold text-xs tabular-nums text-right truncate ${style.rentColor}`}>
            {formatINR(locker.annualRent)}
            <span className="text-[10px] font-normal opacity-70">/yr</span>
          </span>
        </div>
        {subLocation ? (
          <div className={`text-[10.5px] font-medium truncate ${style.subTextColor}`}>
            {subLocation}
          </div>
        ) : null}
      </div>

      {/* Footer: Deposit & Action Indicator */}
      <div className={`pt-2 border-t flex items-center justify-between text-[11px] ${style.footerBorder}`}>
        <span className={`font-normal text-[10.5px] ${style.subTextColor}`}>
          ₹{locker.securityDeposit.toLocaleString('en-IN')} dep
        </span>
        <span
          className={`font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 text-xs ${style.actionColor}`}
        >
          <span>{style.actionText}</span>
          <ArrowUpRight className="w-3 h-3" />
        </span>
      </div>
    </button>
  );
});

// Memoized Rack Section Component
const RackSection = memo(function RackSection({
  group,
  isCollapsed,
  onToggle,
  onSelectLocker,
}: {
  group: RackGroup;
  isCollapsed: boolean;
  onToggle: (rackNumber: string) => void;
  onSelectLocker: (locker: Locker) => void;
}) {
  const occupancyRate = group.total ? Math.round((group.occupied / group.total) * 100) : 0;
  const panelId = `rack-${group.rackNumber.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  return (
    <section
      className="min-w-0 bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden self-start transition-all"
      aria-labelledby={`${panelId}-title`}
    >
      {/* Clickable Rack Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onToggle(group.rackNumber)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle(group.rackNumber);
          }
        }}
        className={`flex items-center justify-between gap-3 p-3.5 sm:p-4 cursor-pointer select-none hover:bg-slate-50/70 transition-colors ${
          isCollapsed ? '' : 'border-b border-slate-100'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 px-2.5 rounded-xl bg-slate-900 text-white font-mono font-medium shadow-2xs text-xs flex items-center shrink-0 tracking-wide">
            {group.rackNumber}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 id={`${panelId}-title`} className="font-semibold text-slate-900 text-sm truncate">
                {group.section} <span aria-hidden="true">&bull;</span> {group.floor}
              </h3>
              <Badge variant="outline" className="text-[10px] font-medium bg-slate-50 border-slate-200 text-slate-600">
                {group.total} {group.total === 1 ? 'locker' : 'lockers'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate font-normal">
              <span className="font-semibold text-emerald-800">{group.vacant} available</span>{' '}
              <span aria-hidden="true">&bull;</span>{' '}
              <span className="font-semibold text-slate-800">{group.occupied} occupied</span>
              {group.reserved > 0 && (
                <>
                  {' '}<span aria-hidden="true">&bull;</span>{' '}
                  <span className="font-medium text-amber-800">{group.reserved} reserved</span>
                </>
              )}
              {group.maintenance > 0 && (
                <>
                  {' '}<span aria-hidden="true">&bull;</span>{' '}
                  <span className="font-medium text-rose-800">{group.maintenance} maintenance</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
          <div className="text-right">
            <span className="text-xs font-semibold text-slate-900 tabular-nums">{occupancyRate}%</span>
            <span className="text-[10px] text-slate-400 block font-normal">Occupied</span>
          </div>
          <div
            className="hidden sm:block w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200"
            role="progressbar"
            aria-label={`${group.rackNumber} occupancy`}
            aria-valuenow={occupancyRate}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full transition-all bg-[#164e43]"
              style={{ width: `${occupancyRate}%` }}
            />
          </div>
          <button
            type="button"
            onClick={() => onToggle(group.rackNumber)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            aria-expanded={!isCollapsed}
            aria-controls={panelId}
            aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${group.rackNumber}`}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Compartment Cells: Spacious auto-flow grid with min 160px width */}
      {!isCollapsed && (
        <div
          id={panelId}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 p-3.5 sm:p-4 bg-slate-50/40"
        >
          {group.lockers.map((locker) => (
            <LockerTile key={locker._id} locker={locker} onSelect={onSelectLocker} showRack={false} />
          ))}
        </div>
      )}
    </section>
  );
});

type ViewMode = 'sequential' | 'rack';

export function LockerVaultGrid({ lockers, isLoading, onSelectLocker }: LockerVaultGridProps) {
  // View mode: default to 'rack' drawers
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('mss_vault_view_mode');
    return saved === 'sequential' ? 'sequential' : 'rack';
  });

  const [collapsedRacks, setCollapsedRacks] = useState<Set<string>>(new Set());

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('mss_vault_view_mode', mode);
  };

  // Group filtered lockers by Rack
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

  const toggleRack = useCallback((rackNumber: string) => {
    setCollapsedRacks((current) => {
      const next = new Set(current);
      if (next.has(rackNumber)) next.delete(rackNumber);
      else next.add(rackNumber);
      return next;
    });
  }, []);

  const allVisibleCollapsed =
    rackGroups.length > 0 && rackGroups.every((g) => collapsedRacks.has(g.rackNumber));

  const toggleAllVisible = useCallback(() => {
    setCollapsedRacks((current) => {
      const next = new Set(current);
      const shouldExpand =
        rackGroups.length > 0 && rackGroups.every((group) => current.has(group.rackNumber));
      rackGroups.forEach((group) =>
        shouldExpand ? next.delete(group.rackNumber) : next.add(group.rackNumber)
      );
      return next;
    });
  }, [rackGroups]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 animate-pulse">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="h-32 rounded-2xl border border-slate-200 bg-white" />
        ))}
      </div>
    );
  }

  if (lockers.length === 0) {
    return (
      <div className="p-8 sm:p-12 text-center bg-white border border-slate-200/90 rounded-2xl space-y-3 shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
          <Layers className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-slate-800">No physical lockers found</p>
        <p className="text-xs text-slate-500 font-normal max-w-sm mx-auto">
          No lockers match your current filter settings. Try changing or clearing filters above.
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3.5">
      {/* Vault Visualization Mode Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 shadow-xs">
        {/* View Mode Toggle: Rack Drawers vs Continuous Matrix */}
        <div className="inline-flex items-center h-9 p-1 rounded-xl border border-slate-200 bg-slate-100/90">
          <button
            type="button"
            onClick={() => handleViewModeChange('rack')}
            className={`h-7 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'rack'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-700" />
            <span>Rack Drawers ({rackGroups.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleViewModeChange('sequential')}
            className={`h-7 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'sequential'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5 text-emerald-700" />
            <span>Continuous Matrix ({lockers.length})</span>
          </button>
        </div>

        {/* Right: Expand/Collapse All (when in rack mode) */}
        {viewMode === 'rack' && rackGroups.length > 0 && (
          <button
            type="button"
            onClick={toggleAllVisible}
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-2xs transition"
          >
            {allVisibleCollapsed ? (
              <>
                <ChevronsUpDown className="h-3.5 w-3.5 text-slate-500" />
                <span>Expand All Racks</span>
              </>
            ) : (
              <>
                <ChevronsDownUp className="h-3.5 w-3.5 text-slate-500" />
                <span>Collapse All Racks</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Grid Content */}
      {viewMode === 'sequential' ? (
        /* Continuous Matrix Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3">
          {lockers.map((locker) => (
            <LockerTile
              key={locker._id}
              locker={locker}
              onSelect={onSelectLocker}
              showRack={true}
            />
          ))}
        </div>
      ) : (
        /* Physical Racks Grouped Drawers */
        <div className="space-y-4">
          {rackGroups.map((group) => (
            <RackSection
              key={group.rackNumber}
              group={group}
              isCollapsed={collapsedRacks.has(group.rackNumber)}
              onToggle={toggleRack}
              onSelectLocker={onSelectLocker}
            />
          ))}
        </div>
      )}
    </div>
  );
}
