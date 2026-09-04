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
  Archive,
  CheckCircle2,
  ArrowUp,
  X,
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
import { LockerOccupancyRing } from '../features/lockers/components/LockerOccupancyRing';
import { LockerActionRibbon } from '../features/lockers/components/LockerActionRibbon';
import { LockerFilters } from '../features/lockers/components/LockerFilters';
import { LockerTable } from '../features/lockers/components/LockerTable';
import { LockerVaultGrid } from '../features/lockers/components/LockerVaultGrid';
import { Button } from '../components/ui/button';
import { usePermission } from '../hooks/usePermission';

const LockerFormModal = lazy(() => import('../features/lockers/components/LockerFormModal').then((module) => ({ default: module.LockerFormModal })));
const LockerDetailModal = lazy(() => import('../features/lockers/components/LockerDetailModal').then((module) => ({ default: module.LockerDetailModal })));
const LockerImportModal = lazy(() => import('../features/lockers/components/LockerImportModal').then((module) => ({ default: module.LockerImportModal })));
const AllocationWizardModal = lazy(() => import('../features/allocations/components/AllocationWizardModal').then((module) => ({ default: module.AllocationWizardModal })));

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
  const limit = [15, 25, 50, 100].includes(requestedLimit) ? requestedLimit : 25;
  const search = searchParams.get('search') || undefined;
  const size = searchParams.get('size') || undefined;
  const status = searchParams.get('status') || undefined;
  const operationalStatus = searchParams.get('operationalStatus') || undefined;
  const rackNumber = searchParams.get('rackNumber') || undefined;
  const section = searchParams.get('section') || undefined;
  const allowedSortFields = ['lockerNumber', 'size', 'rackNumber', 'status', 'operationalStatus', 'annualRent', 'createdAt'];
  const requestedSort = searchParams.get('sortBy');
  const sortBy = requestedSort && allowedSortFields.includes(requestedSort) ? requestedSort : 'lockerNumber';
  const sortOrder = searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc';
  const requestedView = searchParams.get('view');
  const segmentedTab: 'directory' | 'by_rack' | 'closed' =
    requestedView === 'by_rack' || requestedView === 'closed' ? requestedView : 'directory';

  const queryFilters: LockerQueryParams = {
    page,
    limit: segmentedTab === 'by_rack' ? 2000 : limit,
    search,
    size,
    status,
    operationalStatus,
    rackNumber,
    section,
    sortBy,
    sortOrder,
    isActive: segmentedTab === 'closed' ? false : true,
    compact: true,
  };
  const statsFilters: LockerQueryParams = {
    search, size, status, operationalStatus, rackNumber, section,
    isActive: segmentedTab === 'closed' ? false : true,
  };

  const updateFilters = (newFilters: Partial<LockerQueryParams>) => {
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

  const setSegmentedTab = (view: 'directory' | 'by_rack' | 'closed') => {
    const updated = new URLSearchParams(searchParams);
    if (view === 'directory') updated.delete('view');
    else updated.set('view', view);
    updated.delete('page');
    setSearchParams(updated);
  };

  // Queries
  const { data: stats, isLoading: isStatsLoading, isError: isStatsError, refetch: refetchStats } = useQuery({
    queryKey: ['locker-stats', statsFilters],
    queryFn: ({ signal }) => lockerApi.getLockerStats(statsFilters, signal),
  });

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
      if (segmentedTab !== 'by_rack') return lockerApi.getLockers(queryFilters, signal);
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

  // Modal States
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingLocker, setEditingLocker] = useState<Locker | null>(null);
  const [viewingLocker, setViewingLocker] = useState<Locker | null>(null);
  const [allocatingLocker, setAllocatingLocker] = useState<Locker | null>(null);
  const [deactivatingLocker, setDeactivatingLocker] = useState<Locker | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showGoToTop, setShowGoToTop] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setShowGoToTop(window.scrollY > 600);
    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    return () => window.removeEventListener('scroll', updateVisibility);
  }, []);

  const scrollToTop = () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
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
      queryClient.invalidateQueries({ queryKey: ['allocation-stats'] });
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
      setNotice('Locker deactivated successfully. Historical records are preserved.');
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

  const handleSortChange = (newSortBy: string) => {
    const newOrder = sortBy === newSortBy && sortOrder === 'asc' ? 'desc' : 'asc';
    updateFilters({ sortBy: newSortBy, sortOrder: newOrder, page: 1 });
  };

  const loadLockerDetail = async (locker: Locker): Promise<Locker> =>
    queryClient.fetchQuery({
      queryKey: ['locker', locker._id],
      queryFn: () => lockerApi.getLockerById(locker._id),
      staleTime: 60_000,
    });

  const handleViewLocker = async (locker: Locker) => setViewingLocker(await loadLockerDetail(locker));
  const handleEditLocker = async (locker: Locker) => {
    setEditingLocker(await loadLockerDetail(locker));
    setFormModalOpen(true);
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const exportFilters = { ...queryFilters };
      delete exportFilters.page;
      delete exportFilters.limit;
      const exportLockers = await lockerApi.getAllLockers(exportFilters);
      if (exportLockers.length === 0) {
        setExportError('There are no locker records matching the current filters.');
        return;
      }

    const headers = [
      'Locker Number',
      'Locker Code',
      'Size',
      'Rack Number',
      'Section',
      'Floor',
      'Occupancy Status',
      'Ops Status',
      'Annual Rent',
      'Security Deposit',
    ];

      const safeCsvCell = (value: string | number) => {
        let text = String(value ?? '');
        if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
        return `"${text.replace(/"/g, '""')}"`;
      };
      const rows = exportLockers.map((locker) => [
        locker.lockerNumber, locker.lockerCode, locker.size, locker.rackNumber,
        locker.section || '', locker.floor || '', locker.status, locker.operationalStatus,
        locker.annualRent, locker.securityDeposit,
      ].map(safeCsvCell));
      const csv = `\uFEFF${[headers.map(safeCsvCell).join(','), ...rows.map((row) => row.join(','))].join('\r\n')}`;
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Lockers_Export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice(`${exportLockers.length.toLocaleString('en-IN')} filtered locker records exported.`);
    } catch (error: any) {
      setExportError(error.response?.data?.message || error.message || 'Locker export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 lg:space-y-6">
      {notice && (
        <div role="status" className="fixed right-4 top-20 z-[110] flex max-w-sm items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-3 text-xs font-semibold text-emerald-800 shadow-xl">
          <CheckCircle2 className="h-5 w-5 shrink-0" /><span>{notice}</span><button type="button" onClick={() => setNotice(null)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100" aria-label="Dismiss notification"><X className="h-4 w-4" /></button>
        </div>
      )}
      {exportError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
          <span>{exportError}</span><button type="button" onClick={() => setExportError(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-rose-100" aria-label="Dismiss export error"><X className="h-4 w-4" /></button>
        </div>
      )}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 sm:flex shadow-2xs">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
                Locker Register
              </h1>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-normal">
                Search, inspect and manage the physical safe-deposit vault inventory.
              </p>
            </div>
          </div>
        </div>
        {canCreate && (
          <Button
            onClick={() => { setEditingLocker(null); setFormModalOpen(true); }}
            className="hidden shrink-0 gap-2 rounded-xl bg-emerald-800 font-medium text-xs hover:bg-emerald-900 text-white shadow-sm sm:inline-flex h-10 px-4 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Locker</span>
          </Button>
        )}
      </header>

      {/* 1. Circular Occupancy Donut Meter & Top Summary Widgets */}
      <LockerOccupancyRing
        stats={stats}
        isLoading={isStatsLoading}
        selectedStatus={status}
        selectedOpStatus={operationalStatus}
        onSelectStatus={(value) => updateFilters({ status: value, page: 1 })}
        onSelectOpStatus={(value) => updateFilters({ operationalStatus: value, page: 1 })}
        onSelectFilters={(values) => updateFilters({ status: values.status, operationalStatus: values.operationalStatus, page: 1 })}
      />
      {isStatsError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <span><strong>Inventory summary unavailable.</strong> The register list can still be used.</span>
          <Button variant="outline" size="sm" onClick={() => refetchStats()} className="shrink-0 border-amber-300 bg-white">Retry</Button>
        </div>
      )}

      {/* 2. Filters & Actions Ribbon */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4.5 shadow-xs" aria-label="Find and manage lockers">
        <LockerFilters
          filters={queryFilters}
          onFilterChange={updateFilters}
          onClearFilters={() => updateFilters({ search: undefined, size: undefined, status: undefined, operationalStatus: undefined, rackNumber: undefined, section: undefined, page: 1 })}
        />
        <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500 font-normal" role="status" aria-live="polite" aria-atomic="true">
            <span className="font-semibold text-slate-900">{pagination?.total ?? 0}</span> lockers match the current view
          </p>
          <LockerActionRibbon
            searchQuery={search}
            onSearchChange={(q) => updateFilters({ search: q, page: 1 })}
            onAddLocker={() => { setEditingLocker(null); setFormModalOpen(true); }}
            onImportCSV={() => setImportModalOpen(true)}
            onExportCSV={handleExportCSV}
            onRefresh={() => { refetchList(); refetchStats(); }}
            isRefreshing={isFetching}
            canCreate={canCreate}
            canImport={canCreate}
            isExporting={isExporting}
            showSearch={false}
            showPrimaryAction={false}
          />
        </div>
      </section>
      {isFetching && !isListLoading && (
        <div role="status" aria-live="polite" className="-mt-2 flex items-center gap-2 px-1 text-[11px] font-medium text-emerald-800">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-600" />
          Updating locker results…
        </div>
      )}

      {/* 3. Segmented Navigation Tabs */}
      <div className="grid grid-cols-3 items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/90 p-1 shadow-2xs" role="tablist" aria-label="Locker register views">
        <button
          type="button"
          onClick={() => setSegmentedTab('directory')}
          role="tab"
          aria-selected={segmentedTab === 'directory'}
          className={`min-h-[42px] rounded-lg px-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
            segmentedTab === 'directory'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/90 font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <List className="w-4 h-4 text-emerald-800" />
          <span>Lockers <span className="hidden sm:inline">({stats?.total ?? 0})</span></span>
        </button>

        <button
          type="button"
          onClick={() => setSegmentedTab('by_rack')}
          role="tab"
          aria-selected={segmentedTab === 'by_rack'}
          className={`min-h-[42px] rounded-lg px-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
            segmentedTab === 'by_rack'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/90 font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <LayoutGrid className="w-4 h-4 text-emerald-800" />
          <span><span className="sm:hidden">Racks</span><span className="hidden sm:inline">By Rack</span></span>
        </button>

        <button
          type="button"
          onClick={() => setSegmentedTab('closed')}
          role="tab"
          aria-selected={segmentedTab === 'closed'}
          className={`min-h-[42px] rounded-lg px-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
            segmentedTab === 'closed'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/90 font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Archive className="w-4 h-4 text-slate-600" />
          <span><span className="sm:hidden">Closed</span><span className="hidden sm:inline">Closed / Surrendered</span></span>
        </button>
      </div>

      {/* 5. Main Content Area according to Segmented Tab */}
      {isListError ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center"><AlertTriangle className="mx-auto h-7 w-7 text-rose-600" /><p className="mt-3 text-sm font-bold text-rose-900">Locker registry could not be loaded</p><p className="mt-1 text-xs text-rose-700">{listError instanceof Error ? listError.message : 'Check the connection and try again.'}</p><Button variant="outline" onClick={() => refetchList()} className="mt-4">Try again</Button></div>
      ) : segmentedTab === 'by_rack' ? (
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
          onSortChange={handleSortChange}
          onPageChange={(p) => updateFilters({ page: p })}
          onLimitChange={(l) => updateFilters({ limit: l, page: 1 })}
          onView={handleViewLocker}
          onEdit={handleEditLocker}
          onDeactivate={(l) => setDeactivatingLocker(l)}
        />
      )}

      {/* Create / Edit Locker Modal */}
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

      {/* Allocation Wizard Modal when allocating directly from Locker Detail */}
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

      {/* Deactivate Confirmation Modal */}
      {deactivatingLocker &&
        createPortal(
          <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[2px] select-none animate-in fade-in-0 duration-150">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="deactivate-locker-title"
              className="w-full max-w-md bg-white rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-700 shrink-0 border border-rose-200/80 flex items-center justify-center shadow-2xs">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 id="deactivate-locker-title" className="text-base font-semibold text-slate-900 tracking-tight">
                    Deactivate Locker #{deactivatingLocker.lockerNumber}?
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-normal">
                    This will soft-deactivate physical locker{' '}
                    <strong className="font-semibold text-slate-700">#{deactivatingLocker.lockerNumber}</strong> (Size {deactivatingLocker.size}, {deactivatingLocker.rackNumber}). It will no longer be available for customer allocations while historical records are preserved.
                  </p>
                </div>
              </div>

              {deactivateError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-normal">
                  {deactivateError}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDeactivatingLocker(null);
                    setDeactivateError(null);
                  }}
                  disabled={deactivateMutation.isPending}
                  className="rounded-xl border-slate-300 text-slate-700 font-medium text-xs h-9.5 px-4 cursor-pointer hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deactivateMutation.mutate(deactivatingLocker._id)}
                  disabled={deactivateMutation.isPending}
                  className="rounded-xl font-medium text-xs h-9.5 px-4 cursor-pointer"
                >
                  {deactivateMutation.isPending ? 'Deactivating...' : 'Confirm Deactivate'}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {canCreate && (
        <button type="button" onClick={() => { setEditingLocker(null); setFormModalOpen(true); }} className="fixed bottom-[4.6rem] right-4 z-30 flex min-h-[48px] items-center gap-2 rounded-full bg-emerald-800 hover:bg-emerald-900 px-5 text-sm font-medium text-white shadow-xl shadow-emerald-950/25 active:bg-emerald-950 sm:hidden cursor-pointer">
          <Plus className="h-5 w-5" /> Add Locker
        </button>
      )}

      {showGoToTop && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Go to the top of the locker register"
          className={`fixed right-4 z-30 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 text-xs font-medium text-white shadow-xl shadow-slate-950/25 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 cursor-pointer ${canCreate ? 'bottom-[8.5rem] sm:bottom-6 sm:right-6' : 'bottom-6 sm:right-6'}`}
        >
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Go to top</span>
        </button>
      )}
    </div>
  );
}
