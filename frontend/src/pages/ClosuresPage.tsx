import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { lockerApi } from '../features/lockers/api/lockerApi';
import { Locker } from '../features/lockers/types';
import { closureApi } from '../features/closures/api/closureApi';
import {
  LockerClosure,
  ClosureStats,
  ClosureQueryParams,
} from '../features/closures/types';
import { LockerModernCard } from '../features/lockers/components/LockerModernCard';
import { ClosureSummaryCards } from '../features/closures/components/ClosureSummaryCards';
import { ClosureTable } from '../features/closures/components/ClosureTable';
import { NewClosureWizard } from '../features/closures/components/NewClosureWizard';
import { ClosureDetailModal } from '../features/closures/components/ClosureDetailModal';
import { ClosureStatementModal } from '../features/closures/components/ClosureStatementModal';
import { Button } from '../components/ui/button';
import {
  Search,
  RefreshCw,
  Plus,
  LayoutGrid,
  ShieldCheck,
  AlertCircle,
  Inbox,
  X,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Lock,
  Clock,
  AlertTriangle,
  ThumbsUp,
  CheckCircle2,
  Filter,
  ArrowRight,
  FileCheck2,
  KeyRound,
  Banknote,
  Boxes,
} from 'lucide-react';

const LockerDetailModal = lazy(() =>
  import('../features/lockers/components/LockerDetailModal').then((module) => ({
    default: module.LockerDetailModal,
  }))
);

export const ClosuresPage: React.FC = () => {
  const { user, permissions, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const userPermissions = permissions;
  const currentUserId = user?.id;

  const [activeTab, setActiveTab] = useState<'grid' | 'workflow'>('grid');
  const [closedLockers, setClosedLockers] = useState<Locker[]>([]);
  const [closedTotal, setClosedTotal] = useState<number>(0);
  const [closedPages, setClosedPages] = useState<number>(1);
  const [loadingLockers, setLoadingLockers] = useState<boolean>(true);

  // Surrender workflow state
  const [closures, setClosures] = useState<LockerClosure[]>([]);
  const [stats, setStats] = useState<ClosureStats | null>(null);
  const [loadingClosures, setLoadingClosures] = useState<boolean>(false);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);

  // Search & Filters & Pagination
  const [search, setSearch] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const [workflowStatus, setWorkflowStatus] = useState<string>('ALL');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal states
  const [wizardOpen, setWizardOpen] = useState<boolean>(false);
  const [selectedClosure, setSelectedClosure] = useState<LockerClosure | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [statementClosure, setStatementClosure] = useState<LockerClosure | null>(null);
  const [statementModalOpen, setStatementModalOpen] = useState<boolean>(false);
  const [viewingLocker, setViewingLocker] = useState<Locker | null>(null);

  const canCreate = hasPermission('closures.create');

  // 1. Fetch Closed Physical Lockers (for Card Grid)
  const fetchClosedLockers = useCallback(async () => {
    setLoadingLockers(true);
    setLoadError(null);
    try {
      const res = await lockerApi.getLockers({
        page,
        limit: 24,
        search: search.trim() || undefined,
        size: selectedSize !== 'ALL' ? selectedSize : undefined,
        isActive: false,
        compact: true,
      });
      setClosedLockers(res.lockers);
      setClosedTotal(res.pagination.total);
      setClosedPages(res.pagination.totalPages);
    } catch (err: any) {
      console.error('Error loading closed lockers:', err);
      setLoadError('Failed to load closed lockers records.');
    } finally {
      setLoadingLockers(false);
    }
  }, [page, search, selectedSize]);

  // 2. Fetch Workflow records (for Surrender Process / Maker-Checker)
  const fetchWorkflowClosures = useCallback(async () => {
    setLoadingClosures(true);
    try {
      const params: ClosureQueryParams = {
        page,
        limit: 15,
        search: search.trim() || undefined,
        status: workflowStatus !== 'ALL' ? (workflowStatus as any) : undefined,
      };
      const res = await closureApi.getClosures(params);
      setClosures(res.closures);
    } catch (err) {
      console.error('Error loading closure workflow:', err);
    } finally {
      setLoadingClosures(false);
    }
  }, [page, search, workflowStatus]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await closureApi.getClosureStats();
      setStats(data);
    } catch (err) {
      console.error('Error loading closure stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClosedLockers();
    fetchStats();
  }, [fetchClosedLockers, fetchStats]);

  useEffect(() => {
    if (activeTab === 'workflow') {
      fetchWorkflowClosures();
    }
  }, [activeTab, fetchWorkflowClosures]);

  const refreshAll = () => {
    fetchClosedLockers();
    fetchStats();
    if (activeTab === 'workflow') {
      fetchWorkflowClosures();
    }
  };

  const handleViewLocker = async (locker: Locker) => {
    try {
      const full = await lockerApi.getLockerById(locker._id);
      setViewingLocker(full);
    } catch {
      setViewingLocker(locker);
    }
  };

  const startIndex = closedTotal === 0 ? 0 : (page - 1) * 24 + 1;
  const endIndex = Math.min(page * 24, closedTotal);

  const hasGridFilters = Boolean(search || selectedSize !== 'ALL');
  const hasWorkflowFilters = Boolean(search || workflowStatus !== 'ALL');

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* 1. Clean Responsive Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
              Closed Lockers Management
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5 sm:mt-1">
            {activeTab === 'grid'
              ? `${closedTotal} decommissioned lockers • Page ${page} of ${closedPages || 1}`
              : `${stats?.totalCount ?? closures.length} surrender requests • Page ${page}`}
          </p>
        </div>

        {/* Action Controls: Tabs + Refresh + Action */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full md:w-auto">
          {/* Segmented Tab Switcher */}
          <div className="grid grid-cols-2 sm:flex items-center rounded-xl border border-slate-200 bg-slate-100/90 p-1 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('grid');
                setPage(1);
              }}
              className={`p-2 sm:p-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                activeTab === 'grid'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
              <span className="truncate">Closed Lockers</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-100 text-slate-700 font-bold shrink-0">
                {closedTotal}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('workflow');
                setPage(1);
              }}
              className={`p-2 sm:p-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                activeTab === 'workflow'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardList className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
              <span className="truncate">Surrender Workflow</span>
              {stats?.totalCount !== undefined && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-100 text-slate-700 font-bold shrink-0">
                  {stats.totalCount}
                </span>
              )}
            </button>
          </div>

          {/* Action Buttons: Refresh & New Surrender */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAll}
              disabled={loadingLockers || loadingClosures || statsLoading}
              className="h-9 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs gap-1.5 px-3 cursor-pointer shrink-0"
              title="Refresh closed lockers ledger"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  loadingLockers || loadingClosures || statsLoading ? 'animate-spin text-emerald-700' : ''
                }`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            {canCreate && (
              <Button
                onClick={() => setWizardOpen(true)}
                className="h-9 flex-1 sm:flex-initial rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs gap-1.5 px-3.5 shadow-2xs cursor-pointer active:scale-[0.98] transition justify-center"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span>New Surrender</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Unified Search & Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200/90 p-2.5 sm:p-3 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder={
              activeTab === 'grid'
                ? 'Search by locker number, customer, ID...'
                : 'Search by closure #, customer name, phone, locker #...'
            }
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-9 py-2 text-sm bg-transparent border-none focus:outline-hidden text-slate-900 placeholder:text-slate-400 font-medium"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Quick Size Pills for Grid Tab */}
        {activeTab === 'grid' && (
          <div className="flex items-center gap-1 text-xs shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
            {[
              { code: 'ALL', label: 'All Sizes' },
              { code: 'A', label: 'Small' },
              { code: 'B', label: 'Medium' },
              { code: 'C', label: 'Large' },
              { code: 'D', label: 'XL' },
            ].map((pill) => (
              <button
                key={pill.code}
                type="button"
                onClick={() => {
                  setSelectedSize(pill.code);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                  selectedSize === pill.code
                    ? 'bg-emerald-800 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        )}

        {/* Clear Filters button */}
        {((activeTab === 'grid' && hasGridFilters) || (activeTab === 'workflow' && hasWorkflowFilters)) && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setSelectedSize('ALL');
              setWorkflowStatus('ALL');
              setPage(1);
            }}
            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center gap-1 cursor-pointer shrink-0 transition"
          >
            <X className="h-3 w-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Error Banner */}
      {loadError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {loadError}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            className="rounded-xl border-rose-300 bg-white cursor-pointer"
          >
            Retry
          </Button>
        </div>
      )}

      {/* 3. Tab 1: Closed Lockers Catalog View */}
      {activeTab === 'grid' && (
        <>
          {loadingLockers ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-48 rounded-2xl bg-slate-100 animate-pulse border border-slate-200/80 p-5"
                />
              ))}
            </div>
          ) : closedLockers.length === 0 ? (
            /* Clean & Minimal Empty State */
            <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200/70 flex items-center justify-center mx-auto mb-3.5">
                <ShieldCheck className="w-6 h-6 text-emerald-700" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {hasGridFilters ? 'No Matching Closed Lockers' : 'No Closed Lockers'}
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
                {hasGridFilters
                  ? `No decommissioned lockers match your filter "${search || selectedSize}".`
                  : 'All registered lockers in the system are currently active in vault custody.'}
              </p>

              <div className="mt-5 flex items-center justify-center gap-2.5">
                {hasGridFilters ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setSelectedSize('ALL');
                    }}
                    className="rounded-xl border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Clear Filters
                  </Button>
                ) : (
                  <>
                    {canCreate && (
                      <Button
                        size="sm"
                        onClick={() => setWizardOpen(true)}
                        className="rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold px-4 gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Initiate Surrender</span>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/lockers')}
                      className="rounded-xl border-slate-300 text-slate-700 text-xs font-semibold px-3.5 cursor-pointer"
                    >
                      <span>View Active Lockers</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {closedLockers.map((locker) => (
                <LockerModernCard
                  key={locker._id}
                  locker={locker}
                  onView={handleViewLocker}
                  canAllocate={false}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {closedTotal > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200/80">
              <p className="text-xs sm:text-sm font-semibold text-slate-500">
                Showing {startIndex} to {endIndex} of {closedTotal} lockers
              </p>

              {closedPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loadingLockers}
                    onClick={() => setPage((p) => p - 1)}
                    className="h-8.5 rounded-xl border-slate-300 text-slate-700 text-xs gap-1 px-3 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Prev</span>
                  </Button>

                  <span className="px-3 text-xs font-bold text-slate-700">
                    {page} / {closedPages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= closedPages || loadingLockers}
                    onClick={() => setPage((p) => p + 1)}
                    className="h-8.5 rounded-xl border-slate-300 text-slate-700 text-xs gap-1 px-3 cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* 4. Tab 2: Full Surrender Process Workflow (Maker-Checker) */}
      {activeTab === 'workflow' && (
        <div className="space-y-4">
          <ClosureSummaryCards
            stats={stats}
            loading={statsLoading}
            selectedStatus={workflowStatus}
            onSelectStatus={(s) => {
              setWorkflowStatus(s);
              setPage(1);
            }}
          />

          <ClosureTable
            closures={closures}
            loading={loadingClosures}
            page={page}
            totalPages={closedPages}
            total={closedTotal}
            onPageChange={setPage}
            onView={(c) => {
              setSelectedClosure(c);
              setDetailModalOpen(true);
            }}
            onReview={(c) => {
              setSelectedClosure(c);
              setDetailModalOpen(true);
            }}
            onApprove={(c) => {
              setSelectedClosure(c);
              setDetailModalOpen(true);
            }}
            onComplete={(c) => {
              setSelectedClosure(c);
              setDetailModalOpen(true);
            }}
            onPrint={(c) => {
              setStatementClosure(c);
              setStatementModalOpen(true);
            }}
            userPermissions={userPermissions}
            currentUserId={currentUserId}
            hasActiveFilters={hasWorkflowFilters}
            onClearFilters={() => {
              setSearch('');
              setWorkflowStatus('ALL');
              setPage(1);
            }}
            onCreate={canCreate ? () => setWizardOpen(true) : undefined}
          />
        </div>
      )}

      {/* Clean Footer Matching System Design */}
      <footer className="pt-10 pb-4 text-center text-xs text-slate-400 font-medium select-none">
        © 2026 MSS Lockers • Secure. Simple. Smart.
      </footer>

      {/* New Closure Wizard Modal */}
      <NewClosureWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={() => {
          fetchClosedLockers();
          fetchStats();
          if (activeTab === 'workflow') fetchWorkflowClosures();
        }}
      />

      {/* Closure Dossier & Maker-Checker Action Modal */}
      <ClosureDetailModal
        closure={selectedClosure}
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedClosure(null);
        }}
        onRefresh={() => {
          fetchClosedLockers();
          fetchStats();
          if (activeTab === 'workflow') fetchWorkflowClosures();
        }}
        onPrint={(c) => {
          setStatementClosure(c);
          setStatementModalOpen(true);
        }}
        userPermissions={userPermissions}
        currentUserId={currentUserId}
        onNavigateToPayments={() => {
          setDetailModalOpen(false);
          navigate('/payments');
        }}
        onNavigateToDeposits={() => {
          setDetailModalOpen(false);
          navigate('/deposits-refunds');
        }}
      />

      {/* Print Statement Modal */}
      <ClosureStatementModal
        closure={statementClosure}
        isOpen={statementModalOpen}
        onClose={() => {
          setStatementModalOpen(false);
          setStatementClosure(null);
        }}
      />

      {/* Locker Inspection Detail Modal */}
      {viewingLocker && (
        <Suspense fallback={null}>
          <LockerDetailModal
            locker={viewingLocker}
            onClose={() => setViewingLocker(null)}
          />
        </Suspense>
      )}
    </div>
  );
};
