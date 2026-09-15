import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  List,
  Layers,
  Search,
  RefreshCw,
  X,
  ChevronDown,
  ArrowUpDown,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Inbox,
  Lock,
  KeyRound,
} from 'lucide-react';
import { lockerApi } from '../api/lockerApi';
import { Locker, LockerQueryParams } from '../types';
import { LOCKER_SIZES } from '../constants';
import { LockerModernCard } from './LockerModernCard';
import { LockerTable } from './LockerTable';
import { LockerVaultGrid } from './LockerVaultGrid';
import { LockerDetailModal } from './LockerDetailModal';
import { LockerFormModal } from './LockerFormModal';
import { AllocationWizardModal } from '../../allocations/components/AllocationWizardModal';
import { CreateAllocationInput, ReserveLockerInput } from '../../allocations/types';
import { CreateLockerInput, UpdateLockerInput } from '../types';
import { allocationApi } from '../../allocations/api/allocationApi';
import { Button } from '../../../components/ui/button';
import { usePermission } from '../../../hooks/usePermission';

export interface DashboardLockersSectionRef {
  setStatusFilter: (status: string) => void;
  scrollIntoView: () => void;
}

interface DashboardLockersSectionProps {
  initialStatus?: string;
  onAllocationSuccess?: () => void;
}

export const DashboardLockersSection = forwardRef<
  DashboardLockersSectionRef,
  DashboardLockersSectionProps
>(({ initialStatus = 'ALL', onAllocationSuccess }, ref) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sectionRef = useRef<HTMLDivElement>(null);

  const canCreate = usePermission('lockers.create');
  const canUpdate = usePermission('lockers.update');
  const canDelete = usePermission('lockers.delete');
  const canAllocate = usePermission('allocations.create');

  // Filter & Pagination State
  const [statusParam, setStatusParam] = useState<string>(initialStatus);
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'by_rack'>('cards');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(12);
  const [search, setSearch] = useState<string>('');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [size, setSize] = useState<string | undefined>(undefined);
  const [rackNumber, setRackNumber] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<string>('lockerNumber');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Notice toast
  const [notice, setNotice] = useState<string | null>(null);

  // Modals state
  const [viewingLocker, setViewingLocker] = useState<Locker | null>(null);
  const [allocatingLocker, setAllocatingLocker] = useState<Locker | null>(null);
  const [editingLocker, setEditingLocker] = useState<Locker | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    setStatusFilter: (newStatus: string) => {
      setStatusParam(newStatus);
      setPage(1);
    },
    scrollIntoView: () => {
      if (sectionRef.current) {
        sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
  }));

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearch !== search) {
        setSearch(localSearch);
        setPage(1);
      }
    }, 350);
    return () => clearTimeout(handler);
  }, [localSearch, search]);

  // Translate status selection into API query
  let apiStatus: string | undefined = undefined;
  let apiOpStatus: string | undefined = undefined;
  let apiIsActive: boolean | undefined = undefined;

  if (statusParam === 'CLOSED') {
    apiIsActive = false;
  } else if (statusParam === 'MAINTENANCE') {
    apiOpStatus = 'MAINTENANCE';
    apiIsActive = true;
  } else if (statusParam !== 'ALL') {
    apiStatus = statusParam;
    apiIsActive = true;
  }

  const queryFilters: LockerQueryParams = {
    page,
    limit: viewMode === 'by_rack' ? 2000 : limit,
    search: search || undefined,
    size,
    status: apiStatus,
    operationalStatus: apiOpStatus,
    rackNumber,
    isActive: apiIsActive,
    compact: true,
    sortBy,
    sortOrder,
  };

  // Queries
  const {
    data: listData,
    isLoading: isListLoading,
    isFetching,
    isError: isListError,
    error: listError,
    refetch: refetchList,
  } = useQuery({
    queryKey: ['lockers', queryFilters],
    queryFn: async ({ signal }) => {
      if (viewMode !== 'by_rack') return lockerApi.getLockers(queryFilters, signal);
      const allLockers = await lockerApi.getAllLockers(queryFilters, signal);
      return {
        lockers: allLockers,
        pagination: { page: 1, limit: allLockers.length, total: allLockers.length, totalPages: 1 },
      };
    },
    placeholderData: keepPreviousData,
  });

  const lockers = listData?.lockers || [];
  const pagination = listData?.pagination;
  const totalLockers = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;

  const { data: lockerStats } = useQuery({
    queryKey: ['locker-stats'],
    queryFn: () => lockerApi.getLockerStats(),
    staleTime: 60_000,
  });

  const hasActiveFilters = Boolean(
    search ||
      (statusParam && statusParam !== 'ALL') ||
      size ||
      rackNumber ||
      sortBy !== 'lockerNumber' ||
      sortOrder !== 'asc'
  );

  const handleClearFilters = () => {
    setStatusParam('ALL');
    setSearch('');
    setLocalSearch('');
    setSize(undefined);
    setRackNumber(undefined);
    setSortBy('lockerNumber');
    setSortOrder('asc');
    setPage(1);
  };

  const loadLockerDetail = async (locker: Locker): Promise<Locker> =>
    queryClient.fetchQuery({
      queryKey: ['locker', locker._id],
      queryFn: () => lockerApi.getLockerById(locker._id),
      staleTime: 60_000,
    });

  const handleViewLocker = async (locker: Locker) => {
    setViewingLocker(await loadLockerDetail(locker));
  };

  const handleAllocateLocker = (locker: Locker) => {
    setAllocatingLocker(locker);
  };

  const handleAllocationSubmit = async (data: CreateAllocationInput | ReserveLockerInput) => {
    setIsSubmittingAction(true);
    try {
      await allocationApi.createAllocation(data as CreateAllocationInput);
      setAllocatingLocker(null);
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      queryClient.invalidateQueries({ queryKey: ['locker-stats'] });
      queryClient.invalidateQueries({ queryKey: ['customer-stats'] });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      setNotice('Locker allocated successfully!');
      if (onAllocationSuccess) onAllocationSuccess();
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleFormSubmit = async (data: CreateLockerInput | UpdateLockerInput) => {
    setIsSubmittingAction(true);
    try {
      if (editingLocker) {
        await lockerApi.updateLocker(editingLocker._id, data as UpdateLockerInput);
        setNotice('Locker updated successfully!');
      } else {
        await lockerApi.createLocker(data as CreateLockerInput);
        setNotice('Locker added successfully!');
      }
      setEditingLocker(null);
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      queryClient.invalidateQueries({ queryKey: ['locker-stats'] });
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Calculate item range for pagination label
  const startIndex = totalLockers === 0 ? 0 : (page - 1) * limit + 1;
  const endIndex = Math.min(page * limit, totalLockers);

  return (
    <section ref={sectionRef} className="space-y-4 pt-2">
      {/* Floating Notice Toast */}
      {notice && (
        <div
          role="status"
          className="fixed right-4 top-20 z-[110] flex max-w-sm items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-3.5 text-xs font-semibold text-emerald-800 shadow-xl animate-in fade-in slide-in-from-top-2"
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

      {/* Main Section Header Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Vault Lockers Directory
          </h2>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            {totalLockers.toLocaleString('en-IN')} Units
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchList()}
            disabled={isFetching}
            className="h-8 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold gap-1.5 px-3 cursor-pointer shadow-2xs"
            title="Refresh lockers data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-emerald-700' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            onClick={() => navigate('/lockers')}
            className="h-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold gap-1.5 px-3 sm:px-3.5 cursor-pointer shadow-2xs transition"
          >
            <span>Full View</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Integrated Filter & View Control Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        {/* Upper Tier: Status Filter Pills + View Switcher */}
        <div className="p-3 sm:px-4 sm:py-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Status Selection Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] pb-1 lg:pb-0">
            {[
              {
                key: 'ALL',
                label: 'All Lockers',
                count: lockerStats?.total ?? 0,
                dotColor: 'bg-slate-400',
              },
              {
                key: 'VACANT',
                label: 'Available',
                count: lockerStats?.availableForAllocation ?? lockerStats?.vacant ?? 0,
                dotColor: 'bg-emerald-500',
              },
              {
                key: 'OCCUPIED',
                label: 'Occupied',
                count: lockerStats?.occupied ?? 0,
                dotColor: 'bg-rose-500',
              },
              {
                key: 'RENEWAL_DUE',
                label: 'Renewal Due',
                count: lockerStats?.renewalDue ?? 0,
                dotColor: 'bg-amber-500',
                show: (lockerStats?.renewalDue ?? 0) > 0,
              },
              {
                key: 'RESERVED',
                label: 'Reserved',
                count: lockerStats?.reserved ?? 0,
                dotColor: 'bg-indigo-400',
                show: (lockerStats?.reserved ?? 0) > 0,
              },
              {
                key: 'MAINTENANCE',
                label: 'Maintenance',
                count: lockerStats?.maintenance ?? 0,
                dotColor: 'bg-slate-500',
                show: (lockerStats?.maintenance ?? 0) > 0,
              },
            ]
              .filter((item) => item.show !== false)
              .map((item) => {
                const isSelected = statusParam === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setStatusParam(item.key);
                      setPage(1);
                    }}
                    className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isSelected ? 'bg-white' : item.dotColor
                      }`}
                    />
                    <span>{item.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10.5px] font-bold tabular-nums ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.count.toLocaleString('en-IN')}
                    </span>
                  </button>
                );
              })}
          </div>

          {/* View Switcher: Cards, Table, Racks */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/80 p-1 shrink-0 self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5 text-emerald-700" />
              <span>Cards</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Table View"
            >
              <List className="h-3.5 w-3.5 text-emerald-700" />
              <span>Table</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('by_rack')}
              className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition ${
                viewMode === 'by_rack'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Rack Vault Matrix"
            >
              <Layers className="h-3.5 w-3.5 text-emerald-700" />
              <span>Racks</span>
            </button>
          </div>
        </div>

        {/* Lower Tier: Search, Size, Sort, and Pagination */}
        <div className="border-t border-slate-100 bg-slate-50/50 p-2.5 sm:px-4 sm:py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search locker #, rack, or tenant..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-7 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-2xs"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => {
                  setLocalSearch('');
                  setSearch('');
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sub-Filters & Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Size Dropdown */}
            <div className="relative flex items-center min-w-[120px] bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-2.5 transition focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600 shadow-2xs">
              <Maximize2 className="h-3.5 w-3.5 text-slate-400 shrink-0 pointer-events-none mr-1.5" />
              <select
                value={size || 'ALL'}
                onChange={(e) => {
                  setSize(e.target.value === 'ALL' ? undefined : e.target.value);
                  setPage(1);
                }}
                className="w-full h-8 text-xs font-semibold text-slate-700 bg-transparent border-0 outline-none focus:outline-none cursor-pointer appearance-none pr-5"
              >
                <option value="ALL">Size: All</option>
                {LOCKER_SIZES.map((s) => (
                  <option key={s.code} value={s.code}>
                    Size {s.code}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none text-slate-400" />
            </div>

            {/* Sort Dropdown */}
            <div className="relative flex items-center min-w-[145px] bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-2.5 transition focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600 shadow-2xs">
              <ArrowUpDown className="h-3.5 w-3.5 text-emerald-700 shrink-0 pointer-events-none mr-1.5" />
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [sb, so] = e.target.value.split('-');
                  setSortBy(sb);
                  setSortOrder(so as 'asc' | 'desc');
                  setPage(1);
                }}
                className="w-full h-8 text-xs font-semibold text-slate-700 bg-transparent border-0 outline-none focus:outline-none cursor-pointer appearance-none pr-5"
              >
                <option value="lockerNumber-asc">Number (1 → 9)</option>
                <option value="lockerNumber-desc">Number (9 → 1)</option>
                <option value="rackNumber-asc">Rack (A → Z)</option>
                <option value="status-asc">Status</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none text-slate-400" />
            </div>

            {/* Reset Button */}
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="h-8 rounded-xl border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs font-semibold px-2.5 gap-1 cursor-pointer transition shadow-2xs"
                title="Reset all filters"
              >
                <RotateCcw className="h-3 w-3 text-rose-600" />
                <span>Reset</span>
              </Button>
            )}

            {/* Mini Pagination Controls */}
            {viewMode !== 'by_rack' && totalPages > 1 && (
              <div className="flex items-center gap-1 pl-1 border-l border-slate-200 ml-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 w-8 p-0 rounded-lg border-slate-200 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer disabled:opacity-30 shadow-2xs"
                  title="Previous page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs font-bold px-1.5 text-slate-700 tabular-nums">
                  {page}/{totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || isFetching}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 w-8 p-0 rounded-lg border-slate-200 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer disabled:opacity-30 shadow-2xs"
                  title="Next page"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Lockers Content Display */}
      {isListError ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center"
        >
          <AlertTriangle className="mx-auto h-8 w-8 text-rose-600" />
          <p className="mt-3 text-base font-bold text-rose-900">
            Locker records could not be loaded
          </p>
          <p className="mt-1 text-xs text-rose-700">
            {listError instanceof Error ? listError.message : 'Please check connection and retry.'}
          </p>
          <Button
            variant="outline"
            onClick={() => refetchList()}
            className="mt-4 rounded-xl cursor-pointer"
          >
            Try again
          </Button>
        </div>
      ) : isListLoading ? (
        /* Loading Skeletons */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-44 rounded-2xl bg-white animate-pulse border border-slate-200/80 p-5 shadow-xs"
            />
          ))}
        </div>
      ) : viewMode === 'cards' ? (
        /* Modern Locker Cards Grid */
        lockers.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-xs">
            <Inbox className="h-10 w-10 text-slate-300 mx-auto" />
            <h3 className="mt-3 text-lg font-bold text-slate-800">No Lockers Found</h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
              No lockers match the current filter criteria.
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="mt-4 rounded-xl cursor-pointer text-xs"
              >
                Clear all filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {lockers.map((locker) => (
                <LockerModernCard
                  key={locker._id}
                  locker={locker}
                  onView={handleViewLocker}
                  onAllocate={handleAllocateLocker}
                  canAllocate={canAllocate}
                />
              ))}
            </div>

            {/* Bottom Pagination Bar for Cards */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-2xl p-3 sm:px-5 shadow-xs">
                <span className="text-xs text-slate-500 font-medium">
                  Showing <strong className="text-slate-800">{startIndex}–{endIndex}</strong> of{' '}
                  <strong className="text-slate-800">{totalLockers.toLocaleString('en-IN')}</strong> lockers
                </span>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || isFetching}
                    onClick={() => setPage(1)}
                    className="h-8 px-2.5 rounded-xl border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-40"
                  >
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || isFetching}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-8 px-3 rounded-xl border-slate-200 text-xs font-semibold text-slate-700 disabled:opacity-40"
                  >
                    Previous
                  </Button>
                  <span className="text-xs font-bold px-2 text-slate-800 tabular-nums">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || isFetching}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 px-3 rounded-xl border-slate-200 text-xs font-semibold text-slate-700 disabled:opacity-40"
                  >
                    Next
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || isFetching}
                    onClick={() => setPage(totalPages)}
                    className="h-8 px-2.5 rounded-xl border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-40"
                  >
                    Last
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
      ) : viewMode === 'table' ? (
        /* Full Tabular Representation */
        <LockerTable
          lockers={lockers}
          pagination={pagination}
          isLoading={isListLoading}
          filters={queryFilters}
          onSortChange={(sb) => {
            if (sortBy === sb) {
              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
            } else {
              setSortBy(sb);
              setSortOrder('asc');
            }
            setPage(1);
          }}
          onPageChange={(p) => setPage(p)}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
          onView={handleViewLocker}
          onEdit={(locker) => {
            setEditingLocker(locker);
          }}
          onDeactivate={() => {}}
          onAllocate={handleAllocateLocker}
          canAllocate={canAllocate}
        />
      ) : (
        /* Vault Matrix Rack View */
        <LockerVaultGrid
          lockers={lockers}
          isLoading={isListLoading}
          onSelectLocker={handleViewLocker}
        />
      )}

      {/* Locker Detail Dossier Modal */}
      {viewingLocker && (
        <LockerDetailModal
          locker={viewingLocker}
          onClose={() => setViewingLocker(null)}
          onEdit={(locker) => {
            setEditingLocker(locker);
            setViewingLocker(null);
          }}
          onAllocate={(locker) => {
            setAllocatingLocker(locker);
            setViewingLocker(null);
          }}
        />
      )}

      {/* Allocate Locker Wizard Modal */}
      {allocatingLocker && (
        <AllocationWizardModal
          mode="allocate"
          preSelectedLocker={allocatingLocker}
          onClose={() => setAllocatingLocker(null)}
          onSubmit={handleAllocationSubmit}
          isSubmitting={isSubmittingAction}
        />
      )}

      {/* Edit Locker Form Modal */}
      {editingLocker && (
        <LockerFormModal
          locker={editingLocker}
          onClose={() => setEditingLocker(null)}
          onSubmit={handleFormSubmit}
          isSubmitting={isSubmittingAction}
        />
      )}
    </section>
  );
});

DashboardLockersSection.displayName = 'DashboardLockersSection';
