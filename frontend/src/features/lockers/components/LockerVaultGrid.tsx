import React, { useEffect, useMemo, useRef, useState, memo, useCallback } from 'react';
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
  ArrowUpRight,
  SlidersHorizontal,
  RotateCcw,
  LayoutGrid,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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

// Fast status style lookup
const getStatusTileStyle = (status: LockerStatus, opsStatus: string) => {
  if (opsStatus === 'MAINTENANCE' || opsStatus === 'DAMAGED') {
    return {
      bg: 'bg-orange-50/40 hover:bg-orange-50/80 border-orange-200/90 text-orange-950 shadow-2xs hover:border-orange-300',
      icon: Wrench,
      iconColor: 'text-orange-700',
      statusLabel: 'Maintenance',
      statusColor: 'text-orange-800 font-medium',
    };
  }
  switch (status) {
    case 'VACANT':
      return {
        bg: 'bg-emerald-50/40 hover:bg-emerald-50/80 border-emerald-200/80 text-emerald-950 shadow-2xs hover:border-emerald-300',
        icon: KeyRound,
        iconColor: 'text-emerald-700',
        statusLabel: 'Vacant • Ready',
        statusColor: 'text-emerald-800 font-medium',
      };
    case 'OCCUPIED':
      return {
        bg: 'bg-slate-50/80 hover:bg-slate-100 border-slate-200/90 text-slate-900 shadow-2xs hover:border-slate-300',
        icon: Lock,
        iconColor: 'text-slate-700',
        statusLabel: 'Occupied',
        statusColor: 'text-slate-700 font-medium',
      };
    case 'RESERVED':
      return {
        bg: 'bg-amber-50/40 hover:bg-amber-50/80 border-amber-200/90 text-amber-950 shadow-2xs hover:border-amber-300',
        icon: Clock,
        iconColor: 'text-amber-700',
        statusLabel: 'Reserved (Hold)',
        statusColor: 'text-amber-800 font-medium',
      };
    case 'BLOCKED':
      return {
        bg: 'bg-rose-50/40 hover:bg-rose-50/80 border-rose-200/90 text-rose-950 shadow-2xs hover:border-rose-300',
        icon: Ban,
        iconColor: 'text-rose-700',
        statusLabel: 'Blocked Notice',
        statusColor: 'text-rose-800 font-medium',
      };
    default:
      return {
        bg: 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800 shadow-2xs',
        icon: KeyRound,
        iconColor: 'text-slate-600',
        statusLabel: 'Available',
        statusColor: 'text-slate-700 font-medium',
      };
  }
};

// Memoized individual locker tile component
const LockerTile = memo(function LockerTile({
  locker,
  onSelect,
  showRack = false,
}: {
  locker: Locker;
  onSelect: (locker: Locker) => void;
  showRack?: boolean;
}) {
  const style = getStatusTileStyle(locker.status, locker.operationalStatus);
  const Icon = style.icon;

  return (
    <button
      type="button"
      onClick={() => onSelect(locker)}
      aria-label={`Open locker ${locker.lockerNumber}, size ${locker.size}, ${style.statusLabel}`}
      className={`min-h-[128px] sm:min-h-[136px] p-2.5 sm:p-3 rounded-xl border transition-all text-left overflow-hidden flex flex-col justify-between group hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 cursor-pointer ${style.bg}`}
    >
      {/* Header Row: Locker Number + Status Icon Pill */}
      <div className="flex items-center justify-between w-full">
        <span className="font-sans text-xs sm:text-base font-semibold text-slate-900 tracking-tight truncate">
          #{locker.lockerNumber}
        </span>
        <div className="h-5.5 w-5.5 sm:h-6 sm:w-6 rounded-lg bg-white/90 shadow-2xs border border-slate-200/80 flex items-center justify-center shrink-0">
          <Icon className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${style.iconColor}`} aria-hidden="true" />
        </div>
      </div>

      {/* Middle Row: Size & Annual Rent Snapshot */}
      <div className="space-y-1 text-[10.5px] sm:text-[11px] my-1">
        <div className="flex items-center justify-between gap-1">
          <span className="font-medium text-slate-700 bg-white/90 px-1.5 py-0.5 rounded-md border border-slate-200/60 shadow-2xs text-[10px] sm:text-[10.5px] shrink-0">
            Size {locker.size}
          </span>
          <span className="font-semibold text-slate-900 font-sans text-[11px] sm:text-xs tabular-nums truncate text-right" title="Annual rent">
            {formatINR(locker.annualRent)}
            <span className="text-[9px] sm:text-[9.5px] text-slate-500 font-normal">/yr</span>
          </span>
        </div>
        {showRack ? (
          <div className="flex items-center justify-between text-[9.5px] sm:text-[10px] text-slate-500 font-normal truncate">
            <span className="truncate font-medium text-slate-600 bg-white/80 px-1.5 py-0.2 rounded border border-slate-200/60 shadow-2xs">
              {locker.rackNumber ? `Rack ${locker.rackNumber.replace(/^rack\s+/i, '')}` : 'Vault'}
            </span>
            <span className="shrink-0">₹{locker.securityDeposit.toLocaleString('en-IN')} dep</span>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[9.5px] sm:text-[10px] text-slate-500 font-normal">
            <span>Deposit: ₹{locker.securityDeposit.toLocaleString('en-IN')}</span>
          </div>
        )}
      </div>

      {/* Bottom Row: Status Badge + Inspect Action Indicator */}
      <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[9.5px] sm:text-[10px]">
        <span className={`truncate ${style.statusColor}`}>{style.statusLabel}</span>
        <span className="inline-flex items-center gap-0.5 text-emerald-800 font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <span>View</span>
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
  selectedRackFilter,
  onToggle,
  onSelectLocker,
}: {
  group: RackGroup;
  isCollapsed: boolean;
  selectedRackFilter: string;
  onToggle: (rackNumber: string) => void;
  onSelectLocker: (locker: Locker) => void;
}) {
  const occupancyRate = group.total ? Math.round((group.occupied / group.total) * 100) : 0;
  const panelId = `rack-${group.rackNumber.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  return (
    <section
      className="min-w-0 bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden self-start transition-all [content-visibility:auto] [contain-intrinsic-size:auto_520px]"
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
        className={`flex items-center justify-between gap-3 p-4 sm:p-4.5 cursor-pointer select-none hover:bg-slate-50/70 transition-colors ${
          isCollapsed ? '' : 'border-b border-slate-100'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 px-3 rounded-xl bg-slate-900 text-white font-mono font-medium shadow-2xs text-xs flex items-center shrink-0 tracking-wide">
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
              <span className="font-medium text-emerald-800">{group.vacant} vacant</span>{' '}
              <span aria-hidden="true">&bull;</span>{' '}
              <span className="font-medium text-slate-800">{group.occupied} occupied</span>{' '}
              <span aria-hidden="true">&bull;</span>{' '}
              <span className="font-medium text-amber-800">{group.reserved} reserved</span>
              {group.maintenance > 0 && (
                <>
                  {' '}
                  <span aria-hidden="true">&bull;</span>{' '}
                  <span className="font-medium text-orange-800">{group.maintenance} maintenance</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <div className="text-right">
            <span className="text-xs font-semibold text-slate-900 tabular-nums">{occupancyRate}%</span>
            <span className="text-[10px] text-slate-400 block font-normal">Occupied</span>
          </div>
          <div
            className="hidden sm:block w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200"
            role="progressbar"
            aria-label={`${group.rackNumber} occupancy`}
            aria-valuenow={occupancyRate}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full transition-all bg-emerald-800"
              style={{ width: `${occupancyRate}%` }}
            />
          </div>
          <button
            type="button"
            onClick={() => onToggle(group.rackNumber)}
            className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            aria-expanded={!isCollapsed}
            aria-controls={panelId}
            aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${group.rackNumber}`}
          >
            <ChevronDown
              className={`h-4.5 w-4.5 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Lazy Rendered Locker Compartment Cells */}
      {!isCollapsed && (
        <div
          id={panelId}
          className={`grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 sm:p-4.5 ${
            selectedRackFilter !== 'ALL'
              ? 'lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
              : 'lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3'
          }`}
        >
          {group.lockers.map((locker) => (
            <LockerTile key={locker._id} locker={locker} onSelect={onSelectLocker} showRack={false} />
          ))}
        </div>
      )}
    </section>
  );
});

type FilterStatus = 'ALL' | LockerStatus | 'MAINTENANCE';
type ViewMode = 'sequential' | 'rack';
type SortOption = 'num_asc' | 'num_desc' | 'size_asc' | 'rent_desc' | 'rent_asc';

export function LockerVaultGrid({ lockers, isLoading, onSelectLocker }: LockerVaultGridProps) {
  // View mode: default to 'sequential' (1 by 1)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('mss_vault_view_mode');
    return saved === 'rack' ? 'rack' : 'sequential';
  });

  const [sortOption, setSortOption] = useState<SortOption>('num_asc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(100);

  const [selectedRackFilter, setSelectedRackFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [sizeFilter, setSizeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [collapsedRacks, setCollapsedRacks] = useState<Set<string>>(new Set());
  const knownRacksRef = useRef<Set<string>>(new Set());

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('mss_vault_view_mode', mode);
  };

  // Global counts for all lockers
  const statusCounts = useMemo(() => {
    let vacant = 0;
    let occupied = 0;
    let reserved = 0;
    let blocked = 0;
    let maintenance = 0;

    lockers.forEach((l) => {
      if (l.operationalStatus === 'MAINTENANCE' || l.operationalStatus === 'DAMAGED') {
        maintenance += 1;
      }
      if (l.status === 'VACANT') vacant += 1;
      else if (l.status === 'OCCUPIED') occupied += 1;
      else if (l.status === 'RESERVED') reserved += 1;
      else if (l.status === 'BLOCKED') blocked += 1;
    });

    return { total: lockers.length, vacant, occupied, reserved, blocked, maintenance };
  }, [lockers]);

  // Unique sizes across lockers
  const uniqueSizes = useMemo(() => {
    const set = new Set<string>();
    lockers.forEach((l) => {
      if (l.size) set.add(l.size);
    });
    return Array.from(set).sort();
  }, [lockers]);

  // Filtered lockers based on Search, Status, and Size
  const filteredLockers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return lockers.filter((l) => {
      // Status filter
      if (statusFilter === 'MAINTENANCE') {
        if (l.operationalStatus !== 'MAINTENANCE' && l.operationalStatus !== 'DAMAGED') {
          return false;
        }
      } else if (statusFilter !== 'ALL') {
        if (l.status !== statusFilter) return false;
      }

      // Size filter
      if (sizeFilter !== 'ALL' && l.size !== sizeFilter) {
        return false;
      }

      // Rack filter
      if (selectedRackFilter !== 'ALL' && l.rackNumber !== selectedRackFilter) {
        return false;
      }

      // Search query (number, code, rack, section, floor)
      if (query) {
        const matchesNum = (l.lockerNumber || '').toLowerCase().includes(query);
        const matchesCode = (l.lockerCode || '').toLowerCase().includes(query);
        const matchesRack = (l.rackNumber || '').toLowerCase().includes(query);
        const matchesSection = (l.section || '').toLowerCase().includes(query);
        const matchesFloor = (l.floor || '').toLowerCase().includes(query);
        if (!matchesNum && !matchesCode && !matchesRack && !matchesSection && !matchesFloor) {
          return false;
        }
      }

      return true;
    });
  }, [lockers, statusFilter, sizeFilter, selectedRackFilter, searchQuery]);

  // Sequential sorted lockers
  const sortedSequentialLockers = useMemo(() => {
    const list = [...filteredLockers];
    switch (sortOption) {
      case 'num_asc':
        return list.sort((a, b) => {
          const numA = parseInt(a.lockerNumber.replace(/\D/g, ''), 10);
          const numB = parseInt(b.lockerNumber.replace(/\D/g, ''), 10);
          if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
            return numA - numB;
          }
          return a.lockerNumber.localeCompare(b.lockerNumber, undefined, { numeric: true, sensitivity: 'base' });
        });
      case 'num_desc':
        return list.sort((a, b) => {
          const numA = parseInt(a.lockerNumber.replace(/\D/g, ''), 10);
          const numB = parseInt(b.lockerNumber.replace(/\D/g, ''), 10);
          if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
            return numB - numA;
          }
          return b.lockerNumber.localeCompare(a.lockerNumber, undefined, { numeric: true, sensitivity: 'base' });
        });
      case 'size_asc':
        return list.sort((a, b) => (a.size || '').localeCompare(b.size || '') || a.lockerNumber.localeCompare(b.lockerNumber, undefined, { numeric: true }));
      case 'rent_desc':
        return list.sort((a, b) => b.annualRent - a.annualRent);
      case 'rent_asc':
        return list.sort((a, b) => a.annualRent - b.annualRent);
      default:
        return list;
    }
  }, [filteredLockers, sortOption]);

  // Pagination for sequential mode
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sizeFilter, selectedRackFilter, sortOption, pageSize]);

  const totalPages = pageSize === 0 ? 1 : Math.ceil(sortedSequentialLockers.length / pageSize);
  const safePage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));

  const paginatedLockers = useMemo(() => {
    if (pageSize === 0) return sortedSequentialLockers;
    const start = (safePage - 1) * pageSize;
    return sortedSequentialLockers.slice(start, start + pageSize);
  }, [sortedSequentialLockers, safePage, pageSize]);

  // Group filtered lockers by Rack
  const rackGroups = useMemo(() => {
    const groups: Record<string, RackGroup> = {};
    filteredLockers.forEach((locker) => {
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
  }, [filteredLockers]);

  // All rack numbers present in the entire dataset (for rack selector)
  const allUniqueRacks = useMemo(() => {
    const set = new Set<string>();
    lockers.forEach((l) => {
      if (l.rackNumber) set.add(l.rackNumber);
    });
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
  }, [lockers]);

  // Auto-expand racks when searching or filtering
  useEffect(() => {
    if (searchQuery.trim().length > 0 || statusFilter !== 'ALL' || sizeFilter !== 'ALL') {
      setCollapsedRacks(new Set());
    }
  }, [searchQuery, statusFilter, sizeFilter]);

  // Initialize newly seen racks as collapsed
  useEffect(() => {
    const newRacks = allUniqueRacks.filter((rack) => !knownRacksRef.current.has(rack));
    if (newRacks.length) {
      setCollapsedRacks((current) => new Set([...current, ...newRacks]));
      newRacks.forEach((rack) => knownRacksRef.current.add(rack));
    }
  }, [allUniqueRacks]);

  useEffect(() => {
    if (selectedRackFilter !== 'ALL' && !allUniqueRacks.includes(selectedRackFilter)) {
      setSelectedRackFilter('ALL');
    }
  }, [selectedRackFilter, allUniqueRacks]);

  const filteredGroups = useMemo(
    () =>
      selectedRackFilter === 'ALL'
        ? rackGroups
        : rackGroups.filter((group) => group.rackNumber === selectedRackFilter),
    [rackGroups, selectedRackFilter]
  );

  const allVisibleCollapsed =
    filteredGroups.length > 0 && filteredGroups.every((group) => collapsedRacks.has(group.rackNumber));

  const toggleRack = useCallback((rackNumber: string) => {
    setCollapsedRacks((current) => {
      const next = new Set(current);
      if (next.has(rackNumber)) next.delete(rackNumber);
      else next.add(rackNumber);
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback(() => {
    setCollapsedRacks((current) => {
      const next = new Set(current);
      const shouldExpand =
        filteredGroups.length > 0 && filteredGroups.every((group) => current.has(group.rackNumber));
      filteredGroups.forEach((group) =>
        shouldExpand ? next.delete(group.rackNumber) : next.add(group.rackNumber)
      );
      return next;
    });
  }, [filteredGroups]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3.5 animate-pulse" aria-label="Loading locker units">
        {Array.from({ length: 16 }).map((_, index) => (
          <div key={index} className="h-36 rounded-xl border border-slate-200 bg-white" />
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
        <p className="text-sm font-semibold text-slate-800">No physical lockers to display</p>
        <p className="text-xs text-slate-500 font-normal max-w-sm mx-auto">
          No lockers exist in the system yet.
        </p>
      </div>
    );
  }

  const isFiltering =
    searchQuery.trim().length > 0 || statusFilter !== 'ALL' || sizeFilter !== 'ALL' || selectedRackFilter !== 'ALL';

  const activeFilterCount =
    (statusFilter !== 'ALL' ? 1 : 0) +
    (sizeFilter !== 'ALL' ? 1 : 0) +
    (selectedRackFilter !== 'ALL' ? 1 : 0) +
    (searchQuery.trim().length > 0 ? 1 : 0);

  return (
    <div className="min-w-0 space-y-4">
      {/* 1. Streamlined Vault Control Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3">
        {/* Top Row: Search Input + Status Segmented Controls */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Instant Locker Search */}
          <div className="relative flex-1 min-w-0 md:max-w-xs lg:max-w-sm xl:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <KeyRound className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search locker #, code, rack, section..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50/80 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Clear search"
              >
                <span className="text-xs font-bold bg-slate-200 text-slate-600 rounded-full w-4 h-4 flex items-center justify-center">
                  &times;
                </span>
              </button>
            )}
          </div>

          {/* Clean Segmented Status Tabs (Smooth scrollable on mobile, never wraps into clumsy rows) */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 overflow-x-auto scrollbar-none max-w-full shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                statusFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>All Units</span>
              <span className="text-[10.5px] px-1.5 py-0.2 rounded-md font-mono bg-slate-200/70 text-slate-700">
                {statusCounts.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'VACANT' ? 'ALL' : 'VACANT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                statusFilter === 'VACANT'
                  ? 'bg-emerald-800 text-white shadow-2xs font-semibold'
                  : 'text-emerald-800 hover:bg-emerald-50/60'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${statusFilter === 'VACANT' ? 'bg-white' : 'bg-emerald-600'}`} />
              <span>Vacant</span>
              <span
                className={`text-[10.5px] px-1.5 py-0.2 rounded-md font-mono ${
                  statusFilter === 'VACANT' ? 'bg-emerald-900 text-white' : 'bg-emerald-100/80 text-emerald-900'
                }`}
              >
                {statusCounts.vacant}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'OCCUPIED' ? 'ALL' : 'OCCUPIED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                statusFilter === 'OCCUPIED'
                  ? 'bg-slate-900 text-white shadow-2xs font-semibold'
                  : 'text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${statusFilter === 'OCCUPIED' ? 'bg-white' : 'bg-slate-500'}`} />
              <span>Occupied</span>
              <span
                className={`text-[10.5px] px-1.5 py-0.2 rounded-md font-mono ${
                  statusFilter === 'OCCUPIED' ? 'bg-slate-800 text-white' : 'bg-slate-200/80 text-slate-800'
                }`}
              >
                {statusCounts.occupied}
              </span>
            </button>

            {statusCounts.reserved > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'RESERVED' ? 'ALL' : 'RESERVED')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  statusFilter === 'RESERVED'
                    ? 'bg-amber-800 text-white shadow-2xs font-semibold'
                    : 'text-amber-800 hover:bg-amber-50/60'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${statusFilter === 'RESERVED' ? 'bg-white' : 'bg-amber-600'}`} />
                <span>Reserved</span>
                <span
                  className={`text-[10.5px] px-1.5 py-0.2 rounded-md font-mono ${
                    statusFilter === 'RESERVED' ? 'bg-amber-900 text-white' : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {statusCounts.reserved}
                </span>
              </button>
            )}

            {statusCounts.blocked > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'BLOCKED' ? 'ALL' : 'BLOCKED')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  statusFilter === 'BLOCKED'
                    ? 'bg-rose-800 text-white shadow-2xs font-semibold'
                    : 'text-rose-800 hover:bg-rose-50/60'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${statusFilter === 'BLOCKED' ? 'bg-white' : 'bg-rose-600'}`} />
                <span>Blocked</span>
                <span
                  className={`text-[10.5px] px-1.5 py-0.2 rounded-md font-mono ${
                    statusFilter === 'BLOCKED' ? 'bg-rose-900 text-white' : 'bg-rose-100 text-rose-900'
                  }`}
                >
                  {statusCounts.blocked}
                </span>
              </button>
            )}

            {statusCounts.maintenance > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'MAINTENANCE' ? 'ALL' : 'MAINTENANCE')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  statusFilter === 'MAINTENANCE'
                    ? 'bg-orange-800 text-white shadow-2xs font-semibold'
                    : 'text-orange-800 hover:bg-orange-50/60'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Maintenance</span>
                <span
                  className={`text-[10.5px] px-1.5 py-0.2 rounded-md font-mono ${
                    statusFilter === 'MAINTENANCE' ? 'bg-orange-900 text-white' : 'bg-orange-100 text-orange-900'
                  }`}
                >
                  {statusCounts.maintenance}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Middle Row: View Mode Switcher + Live Units Context & Density Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* View Mode Switcher: Sequential (1 by 1) vs Rack-wise */}
          <div className="inline-flex items-center h-10 p-1 rounded-xl border border-slate-200 bg-slate-100/90 shadow-2xs self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => handleViewModeChange('sequential')}
              className={`h-8 px-3.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                viewMode === 'sequential'
                  ? 'bg-white text-emerald-950 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="View all lockers sequentially 1 by 1"
            >
              <LayoutGrid className={`w-3.5 h-3.5 ${viewMode === 'sequential' ? 'text-emerald-800' : 'text-slate-500'}`} />
              <span className="hidden xs:inline sm:inline">Sequential (1 by 1)</span>
              <span className="inline xs:hidden sm:hidden">1 by 1</span>
            </button>

            <button
              type="button"
              onClick={() => handleViewModeChange('rack')}
              className={`h-8 px-3.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                viewMode === 'rack'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="View lockers grouped by physical racks"
            >
              <Layers className={`w-3.5 h-3.5 ${viewMode === 'rack' ? 'text-slate-900' : 'text-slate-500'}`} />
              <span>Rack-wise</span>
            </button>
          </div>

          {/* Right: Units Counter & Page Size / Expand Control */}
          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0">
            <span className="text-xs text-slate-500 font-medium">
              Showing <strong className="text-slate-900 font-semibold">{filteredLockers.length.toLocaleString('en-IN')}</strong> units
              {viewMode === 'rack' && (
                <>
                  {' '}in <strong className="text-slate-900 font-semibold">{filteredGroups.length}</strong> racks
                </>
              )}
            </span>

            {/* Expand / Collapse All Toggle Button (Rack Mode only) */}
            {viewMode === 'rack' && (
              <button
                type="button"
                onClick={toggleAllVisible}
                className={`h-9 sm:h-10 px-3.5 sm:px-4 inline-flex items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs active:scale-[0.98] ${
                  allVisibleCollapsed
                    ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs border border-slate-900'
                    : 'bg-white hover:bg-emerald-50/60 text-slate-800 hover:text-emerald-900 border border-slate-200 hover:border-emerald-300 shadow-2xs'
                }`}
                aria-label={allVisibleCollapsed ? 'Expand all racks' : 'Collapse all racks'}
              >
                <div
                  className={`h-5 w-5 rounded-lg flex items-center justify-center transition-colors ${
                    allVisibleCollapsed ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {allVisibleCollapsed ? (
                    <ChevronsUpDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronsDownUp className="h-3.5 w-3.5 text-emerald-800" />
                  )}
                </div>
                <span>{allVisibleCollapsed ? 'Expand All' : 'Collapse All'}</span>
              </button>
            )}

            {/* Items Per Page (Sequential Mode) */}
            {viewMode === 'sequential' && (
              <div className="relative inline-flex items-center h-9 sm:h-10 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 shadow-2xs transition-all">
                <div className="pl-3 sm:pl-3.5 pr-1.5 flex items-center gap-1.5 pointer-events-none text-slate-500">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Page:</span>
                </div>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-9 sm:h-10 pl-1 pr-7 sm:pr-8 text-xs bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer appearance-none"
                  aria-label="Lockers per page"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                  <option value={0}>All ({sortedSequentialLockers.length})</option>
                </select>
                <div className="absolute right-2 sm:right-2.5 pointer-events-none text-slate-400">
                  <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dedicated Filter & Refinement Ribbon */}
        <div className="flex items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100">
          <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto scrollbar-none py-0.5 max-w-full">
            {/* Filter Label / Icon */}
            <div className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-0.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-800" />
              <span>Refine:</span>
            </div>

            {/* Sort Selector (Sequential Mode) */}
            {viewMode === 'sequential' && (
              <div
                className={`relative inline-flex items-center h-9 sm:h-10 rounded-xl border transition-all shadow-2xs group shrink-0 ${
                  sortOption !== 'num_asc'
                    ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-semibold ring-1 ring-emerald-600/30'
                    : 'border-slate-200/90 bg-white hover:border-slate-300'
                }`}
              >
                <div className="pl-3 sm:pl-3.5 pr-1.5 flex items-center gap-1.5 pointer-events-none text-slate-500 group-hover:text-slate-700">
                  <ArrowUpDown className={`h-3.5 w-3.5 ${sortOption !== 'num_asc' ? 'text-emerald-800' : 'text-slate-500'}`} />
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Sort:</span>
                </div>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="h-9 sm:h-10 pl-1 pr-7 sm:pr-8 text-xs bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer appearance-none"
                  aria-label="Sort lockers"
                >
                  <option value="num_asc">Locker # (1 → 1484)</option>
                  <option value="num_desc">Locker # (1484 → 1)</option>
                  <option value="size_asc">Size (A → G2)</option>
                  <option value="rent_desc">Rent (Highest First)</option>
                  <option value="rent_asc">Rent (Lowest First)</option>
                </select>
                <div className="absolute right-2 sm:right-2.5 pointer-events-none text-slate-400 group-hover:text-slate-600">
                  <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
              </div>
            )}

            {/* Enhanced Rack Dropdown Pill */}
            {allUniqueRacks.length > 1 && (
              <div
                className={`relative inline-flex items-center h-9 sm:h-10 rounded-xl border transition-all shadow-2xs group shrink-0 ${
                  selectedRackFilter !== 'ALL'
                    ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-semibold ring-1 ring-emerald-600/30'
                    : 'border-slate-200/90 bg-white hover:border-slate-300'
                }`}
              >
                <div className="pl-3 sm:pl-3.5 pr-1.5 flex items-center gap-1.5 pointer-events-none text-slate-500 group-hover:text-slate-700">
                  <Layers className={`h-3.5 w-3.5 ${selectedRackFilter !== 'ALL' ? 'text-emerald-800' : 'text-slate-500'}`} />
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Rack:</span>
                </div>
                <select
                  value={selectedRackFilter}
                  onChange={(e) => setSelectedRackFilter(e.target.value)}
                  className="h-9 sm:h-10 pl-1 pr-7 sm:pr-8 text-xs bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer appearance-none"
                  aria-label="Filter by rack"
                >
                  <option value="ALL">All Racks ({allUniqueRacks.length})</option>
                  {allUniqueRacks.map((rack) => (
                    <option key={rack} value={rack}>
                      {rack}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2 sm:right-2.5 pointer-events-none text-slate-400 group-hover:text-slate-600">
                  <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
              </div>
            )}

            {/* Enhanced Size Dropdown Pill */}
            {uniqueSizes.length > 0 && (
              <div
                className={`relative inline-flex items-center h-9 sm:h-10 rounded-xl border transition-all shadow-2xs group shrink-0 ${
                  sizeFilter !== 'ALL'
                    ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-semibold ring-1 ring-emerald-600/30'
                    : 'border-slate-200/90 bg-white hover:border-slate-300'
                }`}
              >
                <div className="pl-3 sm:pl-3.5 pr-1.5 flex items-center gap-1.5 pointer-events-none text-slate-500 group-hover:text-slate-700">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Size:</span>
                </div>
                <select
                  value={sizeFilter}
                  onChange={(e) => setSizeFilter(e.target.value)}
                  className="h-9 sm:h-10 pl-1 pr-7 sm:pr-8 text-xs bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer appearance-none"
                  aria-label="Filter by size"
                >
                  <option value="ALL">All Sizes ({uniqueSizes.length})</option>
                  {uniqueSizes.map((sz) => (
                    <option key={sz} value={sz}>
                      Size {sz}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2 sm:right-2.5 pointer-events-none text-slate-400 group-hover:text-slate-600">
                  <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
              </div>
            )}

            {/* Active Filter Clear Tag */}
            {isFiltering && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setSizeFilter('ALL');
                  setSelectedRackFilter('ALL');
                }}
                className="inline-flex items-center gap-1.5 h-9 sm:h-10 px-3.5 rounded-xl text-xs font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 transition-all cursor-pointer shadow-2xs shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset ({activeFilterCount})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Empty Search/Filter Result State */}
      {filteredLockers.length === 0 ? (
        <div className="p-8 sm:p-12 text-center bg-white border border-slate-200/90 rounded-2xl space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto text-amber-700">
            <KeyRound className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-800">No lockers match the active filters</p>
          <p className="text-xs text-slate-500 font-normal max-w-sm mx-auto">
            {searchQuery
              ? `No lockers found matching "${searchQuery}".`
              : 'Try changing status, rack, or size filter.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('ALL');
              setSizeFilter('ALL');
              setSelectedRackFilter('ALL');
            }}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Clear All Filters
          </button>
        </div>
      ) : viewMode === 'sequential' ? (
        /* 3. SEQUENTIAL 1-BY-1 CONTINUOUS GRID */
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2.5 sm:gap-3">
            {paginatedLockers.map((locker) => (
              <LockerTile
                key={locker._id}
                locker={locker}
                onSelect={onSelectLocker}
                showRack={true}
              />
            ))}
          </div>

          {/* Sequential Pagination Bar */}
          {pageSize > 0 && totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
              <div className="text-xs text-slate-500 font-medium">
                Showing <strong className="text-slate-900 font-semibold">{((safePage - 1) * pageSize) + 1}</strong> to{' '}
                <strong className="text-slate-900 font-semibold">{Math.min(safePage * pageSize, sortedSequentialLockers.length)}</strong> of{' '}
                <strong className="text-slate-900 font-semibold">{sortedSequentialLockers.length}</strong> lockers
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={safePage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  title="First page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="px-3 py-1 text-xs font-semibold text-slate-800 bg-slate-100 rounded-lg">
                  Page {safePage} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safePage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  title="Last page"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 4. PHYSICAL RACKS GROUPED GRID */
        <div className={`grid min-w-0 grid-cols-1 gap-5 ${selectedRackFilter === 'ALL' ? 'xl:grid-cols-2' : ''}`}>
          {filteredGroups.map((group) => (
            <RackSection
              key={group.rackNumber}
              group={group}
              isCollapsed={collapsedRacks.has(group.rackNumber)}
              selectedRackFilter={selectedRackFilter}
              onToggle={toggleRack}
              onSelectLocker={onSelectLocker}
            />
          ))}
        </div>
      )}
    </div>
  );
}
