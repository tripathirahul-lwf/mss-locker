import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  KeyRound,
  Plus,
  AlertTriangle,
  LayoutGrid,
  List,
  CheckCircle2,
  ArrowUp,
  X,
  Search,
  RefreshCw,
  Eye,
  SlidersHorizontal,
  Layers,
  Inbox,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ChevronDown,
  Filter,
  ArrowUpDown,
  Building2,
  Maximize2,
} from 'lucide-react';
import { lockerApi } from '../features/lockers/api/lockerApi';
import {
  Locker,
  LockerQueryParams,
  CreateLockerInput,
  UpdateLockerInput,
} from '../features/lockers/types';
import { allocationApi } from '../features/allocations/api/allocationApi';
import { CreateAllocationInput, ReserveLockerInput } from '../features/allocations/types';
import { LockerModernCard } from '../features/lockers/components/LockerModernCard';
import { LockerTable } from '../features/lockers/components/LockerTable';
import { LockerVaultGrid } from '../features/lockers/components/LockerVaultGrid';
import { Button } from '../components/ui/button';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { usePermission } from '../hooks/usePermission';
import { LOCKER_SIZES } from '../features/lockers/constants';

const LockerFormModal = lazy(() =>
  import('../features/lockers/components/LockerFormModal').then((module) => ({
    default: module.LockerFormModal,
  }))
);
const LockerDetailModal = lazy(() =>
  import('../features/lockers/components/LockerDetailModal').then((module) => ({
    default: module.LockerDetailModal,
  }))
);
const LockerImportModal = lazy(() =>
  import('../features/lockers/components/LockerImportModal').then((module) => ({
    default: module.LockerImportModal,
  }))
);
const AllocationWizardModal = lazy(() =>
  import('../features/allocations/components/AllocationWizardModal').then((module) => ({
    default: module.AllocationWizardModal,
  }))
);

export function LockersPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const canCreate = usePermission('lockers.create');
  const canUpdate = usePermission('lockers.update');
  const canDelete = usePermission('lockers.delete');

  // Read URL query parameters
  const requestedPage = Number(searchParams.get('page'));
  const requestedLimit = Number(searchParams.get('limit'));
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = [12, 24, 48, 96].includes(requestedLimit) ? requestedLimit : 24;
  const search = searchParams.get('search') || '';
  const statusParam = searchParams.get('status') || 'ALL';
  const size = searchParams.get('size') || undefined;
  const rackNumber = searchParams.get('rackNumber') || undefined;
  const sortBy = searchParams.get('sortBy') || 'lockerNumber';
  const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc';

  const requestedView = searchParams.get('view');
  const viewMode: 'cards' | 'table' | 'by_rack' =
    requestedView === 'table' || requestedView === 'by_rack' ? requestedView : 'cards';

  // Check if any filter is active for Clear Filters button
  const hasActiveFilters = Boolean(
    search ||
      (statusParam && statusParam !== 'ALL') ||
      size ||
      rackNumber ||
      sortBy !== 'lockerNumber' ||
      sortOrder !== 'asc'
  );

  const handleClearFilters = () => {
    const updated = new URLSearchParams();
    if (viewMode !== 'cards') updated.set('view', viewMode);
    setLocalSearch('');
    setSearchParams(updated);
  };

  // Search input state with debounce
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearch !== search) {
        updateFilters({ search: localSearch || undefined, page: 1 });
      }
    }, 350);
    return () => clearTimeout(handler);
  }, [localSearch]);

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

  const updateFilters = (newFilters: Partial<Record<string, any>>) => {
    const updated = new URLSearchParams(searchParams);

    Object.entries(newFilters).forEach(([key, value]) => {
      if (value === undefined || value === '' || value === 'ALL') {
        updated.delete(key);
      } else {
        updated.set(key, String(value));
      }
    });

    setSearchParams(updated);
  };

  const setView = (v: 'cards' | 'table' | 'by_rack') => {
    const updated = new URLSearchParams(searchParams);
    if (v === 'cards') updated.delete('view');
    else updated.set('view', v);
    updated.delete('page');
    setSearchParams(updated);
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

  // Modal States
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingLocker, setEditingLocker] = useState<Locker | null>(null);
  const [viewingLocker, setViewingLocker] = useState<Locker | null>(null);
  const [allocatingLocker, setAllocatingLocker] = useState<Locker | null>(null);
  const [deactivatingLocker, setDeactivatingLocker] = useState<Locker | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showGoToTop, setShowGoToTop] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setShowGoToTop(window.scrollY > 500);
    window.addEventListener('scroll', updateVisibility, { passive: true });
    return () => window.removeEventListener('scroll', updateVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Mutations
  const allocateMutation = useMutation({
    mutationFn: (data: CreateAllocationInput | ReserveLockerInput) =>
      allocationApi.createAllocation(data as CreateAllocationInput),
    onSuccess: () => {
      setAllocatingLocker(null);
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      queryClient.invalidateQueries({ queryKey: ['locker-stats'] });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      setNotice('Locker tenancy allocated successfully.');
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateLockerInput) => lockerApi.createLocker(data),
    onSuccess: () => {
      setFormModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      queryClient.invalidateQueries({ queryKey: ['locker-stats'] });
      setNotice('Locker added successfully.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLockerInput }) =>
      lockerApi.updateLocker(id, data),
    onSuccess: () => {
      setFormModalOpen(false);
      setEditingLocker(null);
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      queryClient.invalidateQueries({ queryKey: ['locker-stats'] });
      setNotice('Locker updated successfully.');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => lockerApi.deactivateLocker(id),
    onSuccess: () => {
      setDeactivatingLocker(null);
      setDeactivateError(null);
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      queryClient.invalidateQueries({ queryKey: ['locker-stats'] });
      setNotice('Locker deactivated successfully.');
    },
    onError: (err: any) => {
      setDeactivateError(
        err.response?.data?.message || err.message || 'Failed to deactivate locker.'
      );
    },
  });

  const handleFormSubmit = async (data: CreateLockerInput | UpdateLockerInput) => {
    if (editingLocker) {
      await updateMutation.mutateAsync({
        id: editingLocker._id,
        data: data as UpdateLockerInput,
      });
    } else {
      await createMutation.mutateAsync(data as CreateLockerInput);
    }
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

  const handleAllocate = (locker: Locker) => {
    setAllocatingLocker(locker);
  };

  // Calculate item range for pagination label
  const startIndex = totalLockers === 0 ? 0 : (page - 1) * limit + 1;
  const endIndex = Math.min(page * limit, totalLockers);

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* Toast Notice */}
      {notice && (
        <div
          role="status"
          className="fixed right-4 top-20 z-[110] flex max-w-sm items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-3.5 text-xs font-semibold text-emerald-800 shadow-xl"
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

      {/* Modern Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Lockers Management
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
            {totalLockers.toLocaleString('en-IN')} physical compartments registered across vault racks
          </p>
        </div>

        {/* Top Actions: Refresh & Add Locker */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchList()}
            disabled={isFetching}
            className="h-9 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs gap-1.5 px-3 cursor-pointer shadow-2xs"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-emerald-700' : ''}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {canCreate && (
            <Button
              onClick={() => {
                setEditingLocker(null);
                setFormModalOpen(true);
              }}
              className="h-9 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs gap-1.5 px-3.5 shadow-2xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Locker</span>
            </Button>
          )}
        </div>
      </div>

      {/* Unified Vault Control Console */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Upper Tier: Segmented Status Tabs + View Switcher */}
        <div className="p-2 sm:p-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Status Tabs Segmented Group */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1 overflow-x-auto select-none gap-1">
            {[
              {
                key: 'ALL',
                label: 'All Lockers',
                count: lockerStats?.total ?? totalLockers,
                dotColor: 'bg-slate-400',
              },
              {
                key: 'VACANT',
                label: 'Available',
                count: lockerStats?.vacant ?? 0,
                dotColor: 'bg-emerald-500',
              },
              {
                key: 'OCCUPIED',
                label: 'Occupied',
                count: lockerStats?.occupied ?? 0,
                dotColor: 'bg-slate-600',
              },
              {
                key: 'RESERVED',
                label: 'Reserved',
                count: lockerStats?.reserved ?? 0,
                dotColor: 'bg-amber-500',
              },
              {
                key: 'MAINTENANCE',
                label: 'Under Maintenance',
                count: lockerStats?.maintenance ?? 0,
                dotColor: 'bg-rose-500',
              },
            ].map((item) => {
              const isSelected = (statusParam || 'ALL') === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    updateFilters({
                      status: item.key === 'ALL' ? undefined : item.key,
                      page: 1,
                    })
                  }
                  className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.dotColor}`} />
                  <span>{item.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold tabular-nums ${
                      isSelected
                        ? 'bg-slate-100 text-slate-800'
                        : 'bg-slate-200/60 text-slate-500'
                    }`}
                  >
                    {item.count.toLocaleString('en-IN')}
                  </span>
                </button>
              );
            })}
          </div>

          {/* View Switcher docked on the right of the same tier */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/80 p-1 shrink-0 self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setView('cards')}
              className={`h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition ${
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
              onClick={() => setView('table')}
              className={`h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition ${
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
              onClick={() => setView('by_rack')}
              className={`h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition ${
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

        {/* Lower Tier: Search, Size, Rack, Sort Filters + Page indicator */}
        <div className="border-t border-slate-100 bg-slate-50/50 p-2.5 sm:px-3 sm:py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Left: Result Summary */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">
              {viewMode === 'by_rack' ? (
                <>
                  Showing all <strong className="text-slate-900 font-semibold">{lockers.length.toLocaleString('en-IN')}</strong> lockers in vault matrix
                </>
              ) : (
                <>
                  Showing <strong className="text-slate-900 font-semibold">{startIndex}–{endIndex}</strong> of{' '}
                  <strong className="text-slate-900 font-semibold">{totalLockers.toLocaleString('en-IN')}</strong> lockers
                </>
              )}
            </span>
          </div>

          {/* Right: Filters & Quick Pagination */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Locker Size Filter */}
            <div className="relative flex items-center min-w-[130px] bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-2.5 transition focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600 shadow-2xs">
              <Maximize2 className="h-3.5 w-3.5 text-slate-400 shrink-0 pointer-events-none mr-1.5" />
              <select
                value={size || 'ALL'}
                onChange={(e) =>
                  updateFilters({
                    size: e.target.value === 'ALL' ? undefined : e.target.value,
                    page: 1,
                  })
                }
                className="w-full h-8 text-xs font-semibold text-slate-700 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 cursor-pointer appearance-none pr-5"
              >
                <option value="ALL">Size: All</option>
                {LOCKER_SIZES.map((s) => (
                  <option key={s.code} value={s.code}>
                    Size {s.code} ({s.label.replace(/^Size [A-Z0-9]+ /, '')})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none text-slate-400" />
            </div>

            {/* Cabinet Rack Filter */}
            <div className="relative flex items-center w-36 bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-2.5 transition focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600 shadow-2xs">
              <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0 pointer-events-none mr-1.5" />
              <input
                type="text"
                placeholder="Rack (e.g. R-01)"
                value={rackNumber}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) =>
                  updateFilters({
                    rackNumber: e.target.value || undefined,
                    page: 1,
                  })
                }
                className="w-full h-8 text-xs font-semibold text-slate-700 bg-transparent border-none outline-none focus:outline-none focus:ring-0 shadow-none ring-0 placeholder:font-normal placeholder:text-slate-400"
                style={{ border: 'none', outline: 'none', textDecoration: 'none', boxShadow: 'none' }}
              />
              {rackNumber && (
                <button
                  type="button"
                  onClick={() => updateFilters({ rackNumber: undefined, page: 1 })}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer ml-1"
                  title="Clear rack"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Sort By Dropdown */}
            <div className="relative flex items-center min-w-[160px] bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-2.5 transition focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600 shadow-2xs">
              <ArrowUpDown className="h-3.5 w-3.5 text-emerald-700 shrink-0 pointer-events-none mr-1.5" />
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [sb, so] = e.target.value.split('-');
                  updateFilters({ sortBy: sb, sortOrder: so, page: 1 });
                }}
                className="w-full h-8 text-xs font-semibold text-slate-700 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 cursor-pointer appearance-none pr-5"
              >
                <option value="lockerNumber-asc">Sort: Number (1 → 9)</option>
                <option value="lockerNumber-desc">Sort: Number (9 → 1)</option>
                <option value="rackNumber-asc">Sort: Rack (A → Z)</option>
                <option value="rackNumber-desc">Sort: Rack (Z → A)</option>
                <option value="status-asc">Sort: Status</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none text-slate-400" />
            </div>

            {/* Reset Filters Button */}
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="h-8 rounded-xl border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs font-semibold px-2.5 gap-1 cursor-pointer transition shadow-2xs"
                title="Reset all active filters"
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
                  onClick={() => updateFilters({ page: page - 1 })}
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
                  onClick={() => updateFilters({ page: page + 1 })}
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

      {/* Active Filter Chips Bar */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 px-1 text-xs -mt-2">
          <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
            Filters Active:
          </span>

          {statusParam && statusParam !== 'ALL' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 text-white font-semibold text-xs shadow-2xs">
              <span>Status: {statusParam}</span>
              <button
                type="button"
                onClick={() => updateFilters({ status: undefined, page: 1 })}
                className="hover:text-rose-300 cursor-pointer ml-0.5"
                title="Remove status filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {search && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200">
              <span>Search: "{search}"</span>
              <button
                type="button"
                onClick={() => {
                  setLocalSearch('');
                  updateFilters({ search: undefined, page: 1 });
                }}
                className="hover:text-rose-600 cursor-pointer ml-0.5"
                title="Remove search filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {size && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-900 font-semibold border border-blue-200">
              <span>Size: {size}</span>
              <button
                type="button"
                onClick={() => updateFilters({ size: undefined, page: 1 })}
                className="hover:text-rose-600 cursor-pointer ml-0.5"
                title="Remove size filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {rackNumber && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 font-semibold border border-amber-200">
              <span>Rack: {rackNumber}</span>
              <button
                type="button"
                onClick={() => updateFilters({ rackNumber: undefined, page: 1 })}
                className="hover:text-rose-600 cursor-pointer ml-0.5"
                title="Remove rack filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs font-semibold text-rose-600 hover:text-rose-800 cursor-pointer ml-1"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {isListError ? (
        <div
          role="alert"
          className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center"
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
        /* Skeletons */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-48 rounded-3xl bg-slate-100 animate-pulse border border-slate-200/80 p-5"
            />
          ))}
        </div>
      ) : viewMode === 'cards' ? (
        /* Modern Locker Cards Grid matching Screenshot 2 */
        lockers.length === 0 ? (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center shadow-xs">
            <Inbox className="h-10 w-10 text-slate-300 mx-auto" />
            <h3 className="mt-3 text-lg font-bold text-slate-800">No Lockers Found</h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
              No lockers matched your query. Try clearing or adjusting search filters.
            </p>
            {(search || statusParam !== 'ALL') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLocalSearch('');
                  updateFilters({ search: undefined, status: undefined, page: 1 });
                }}
                className="mt-4 rounded-xl cursor-pointer"
              >
                Reset Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {lockers.map((locker) => (
              <LockerModernCard
                key={locker._id}
                locker={locker}
                onView={handleViewLocker}
                onAllocate={handleAllocate}
                canAllocate={canCreate}
              />
            ))}
          </div>
        )
      ) : viewMode === 'by_rack' ? (
        <LockerVaultGrid
          lockers={lockers}
          isLoading={isListLoading}
          onSelectLocker={handleViewLocker}
        />
      ) : (
        <LockerTable
          lockers={lockers}
          pagination={pagination}
          isLoading={isListLoading}
          filters={queryFilters}
          onSortChange={(newSort) => updateFilters({ sortBy: newSort, page: 1 })}
          onPageChange={(p) => updateFilters({ page: p })}
          onLimitChange={(l) => updateFilters({ limit: l, page: 1 })}
          onView={handleViewLocker}
          onAllocate={handleAllocate}
          canAllocate={canCreate}
          onEdit={(l) => {
            setEditingLocker(l);
            setFormModalOpen(true);
          }}
          onDeactivate={(l) => setDeactivatingLocker(l)}
        />
      )}

      {/* Clean Pagination Bar matching Screenshot 2 */}
      {totalLockers > 0 && viewMode === 'cards' && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200/80">
          <p className="text-xs sm:text-sm font-semibold text-slate-500">
            Showing {startIndex} to {endIndex} of {totalLockers} lockers
          </p>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isFetching}
                onClick={() => updateFilters({ page: page - 1 })}
                className="h-8.5 rounded-xl border-slate-300 text-slate-700 text-xs gap-1 px-3 cursor-pointer disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Prev</span>
              </Button>

              <span className="px-3 text-xs font-bold text-slate-700">
                {page} / {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isFetching}
                onClick={() => updateFilters({ page: page + 1 })}
                className="h-8.5 rounded-xl border-slate-300 text-slate-700 text-xs gap-1 px-3 cursor-pointer disabled:opacity-40"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Locker Inspection Detail Modal */}
      {viewingLocker && (
        <Suspense fallback={null}>
          <LockerDetailModal
            locker={viewingLocker}
            onClose={() => setViewingLocker(null)}
            onEdit={(l) => {
              setViewingLocker(null);
              setEditingLocker(l);
              setFormModalOpen(true);
            }}
            onAllocate={(l) => {
              setViewingLocker(null);
              setAllocatingLocker(l);
            }}
          />
        </Suspense>
      )}

      {/* Allocation Wizard Modal */}
      {allocatingLocker && (
        <Suspense fallback={null}>
          <AllocationWizardModal
            mode="allocate"
            preSelectedLocker={allocatingLocker}
            onClose={() => setAllocatingLocker(null)}
            onSubmit={async (data) => {
              await allocateMutation.mutateAsync(data);
            }}
            isSubmitting={allocateMutation.isPending}
          />
        </Suspense>
      )}

      {/* Locker Form Modal (Add / Edit) */}
      {formModalOpen && (
        <Suspense fallback={null}>
          <LockerFormModal
            locker={editingLocker}
            onClose={() => {
              setFormModalOpen(false);
              setEditingLocker(null);
            }}
            onSubmit={handleFormSubmit}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
          />
        </Suspense>
      )}

      {/* Bulk CSV Import Modal */}
      {importModalOpen && (
        <Suspense fallback={null}>
          <LockerImportModal
            onClose={() => setImportModalOpen(false)}
            onSuccess={() => {
              setImportModalOpen(false);
              queryClient.invalidateQueries({ queryKey: ['lockers'] });
              queryClient.invalidateQueries({ queryKey: ['locker-stats'] });
            }}
          />
        </Suspense>
      )}

      {/* Deactivate Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(deactivatingLocker)}
        onClose={() => {
          if (!deactivateMutation.isPending) {
            setDeactivatingLocker(null);
            setDeactivateError(null);
          }
        }}
        onConfirm={async () => {
          if (deactivatingLocker) {
            await deactivateMutation.mutateAsync(deactivatingLocker._id);
          }
        }}
        title={deactivatingLocker ? `Deactivate Locker #${deactivatingLocker.lockerNumber}?` : 'Deactivate Locker'}
        message={
          deactivatingLocker ? (
            <div className="space-y-2 text-xs text-slate-600 font-normal">
              <p>
                This will soft-deactivate physical locker{' '}
                <strong className="font-semibold text-slate-900">
                  #{deactivatingLocker.lockerNumber}
                </strong>{' '}
                (Size {deactivatingLocker.size}, {deactivatingLocker.rackNumber}). Historical custody and billing records are permanently preserved.
              </p>
              {deactivateError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium">
                  {deactivateError}
                </div>
              )}
            </div>
          ) : undefined
        }
        confirmLabel="Confirm Deactivate"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deactivateMutation.isPending}
      />

      {/* Floating Go To Top */}
      {showGoToTop && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Go to the top"
          className="fixed bottom-6 right-6 z-30 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3.5 text-xs font-semibold text-white shadow-xl hover:bg-slate-800 cursor-pointer"
        >
          <ArrowUp className="h-4 w-4" />
          <span className="hidden sm:inline">Top</span>
        </button>
      )}
    </div>
  );
}
