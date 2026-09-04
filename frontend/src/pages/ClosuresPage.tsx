import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { closureApi } from '../features/closures/api/closureApi';
import {
  LockerClosure,
  ClosureStats,
  ClosureQueryParams,
} from '../features/closures/types';
import { ClosureSummaryCards } from '../features/closures/components/ClosureSummaryCards';
import { ClosureActionRibbon } from '../features/closures/components/ClosureActionRibbon';
import { ClosureTable } from '../features/closures/components/ClosureTable';
import { NewClosureWizard } from '../features/closures/components/NewClosureWizard';
import { ClosureDetailModal } from '../features/closures/components/ClosureDetailModal';
import { ClosureStatementModal } from '../features/closures/components/ClosureStatementModal';
import { ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';

export const ClosuresPage: React.FC = () => {
  const { user, permissions, hasPermission } = useAuth();
  const navigate = useNavigate();
  const userPermissions = permissions;
  const currentUserId = user?.id;

  const [closures, setClosures] = useState<LockerClosure[]>([]);
  const [stats, setStats] = useState<ClosureStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);

  // Filters & Pagination
  const [search, setSearch] = useState<string>('');
  const [status, setStatus] = useState<string>('ALL');
  const [closureType, setClosureType] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals
  const [wizardOpen, setWizardOpen] = useState<boolean>(false);
  const [selectedClosure, setSelectedClosure] = useState<LockerClosure | null>(
    null
  );
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [statementClosure, setStatementClosure] =
    useState<LockerClosure | null>(null);
  const [statementModalOpen, setStatementModalOpen] = useState<boolean>(false);

  const canCreate = hasPermission('closures.create');

  // Load closure list
  const fetchClosures = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params: ClosureQueryParams = {
        page,
        limit: 15,
        search: search.trim() || undefined,
        status: status !== 'ALL' ? (status as any) : undefined,
        closureType: closureType !== 'ALL' ? (closureType as any) : undefined,
      };
      const res = await closureApi.getClosures(params);
      setClosures(res.closures);
      setTotalPages(res.pagination.totalPages);
      setTotal(res.pagination.total);
    } catch (err) {
      console.error('Error loading closures:', err);
      setLoadError('Closure records could not be loaded. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, closureType]);

  // Load stats
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
    fetchClosures();
  }, [fetchClosures]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Search debounce
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatus(val);
    setPage(1);
  };

  const handleClosureTypeChange = (val: string) => {
    setClosureType(val);
    setPage(1);
  };

  const handleView = (c: LockerClosure) => {
    setSelectedClosure(c);
    setDetailModalOpen(true);
  };

  const handlePrint = (c: LockerClosure) => {
    setStatementClosure(c);
    setStatementModalOpen(true);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Top Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold tracking-tight text-slate-950">Surrender workflow</h3>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5" />
              Maker-Checker Controlled
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Manage customer locker surrenders, dues clearance, key inspection, and release lockers back to vacant.
          </p>
          <ol className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-4" aria-label="Closure workflow stages">
            {['Request', 'Review & settle', 'Approve', 'Release locker'].map((stage, index) => <li key={stage} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-slate-800 font-bold text-white">{index + 1}</span><span className="font-semibold">{stage}</span>{index < 3 && <ArrowRight className="ml-auto hidden h-3.5 w-3.5 text-slate-400 sm:block" />}</li>)}
          </ol>
      </div>

      {/* Summary KPI Cards */}
      <ClosureSummaryCards
        stats={stats}
        loading={statsLoading}
        selectedStatus={status}
        onSelectStatus={handleStatusChange}
      />

      {/* Action Ribbon: Search, Filter, New Closure */}
      <ClosureActionRibbon
        search={search}
        onSearchChange={handleSearchChange}
        status={status}
        onStatusChange={handleStatusChange}
        closureType={closureType}
        onClosureTypeChange={handleClosureTypeChange}
        onRefresh={() => {
          fetchClosures();
          fetchStats();
        }}
        onNewClosure={() => setWizardOpen(true)}
        canCreate={canCreate}
        loading={loading}
        onClearFilters={() => { setSearch(''); setStatus('ALL'); setClosureType('ALL'); setPage(1); }}
      />

      {/* Closures Data Table */}
      {loadError && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{loadError}</span><button type="button" onClick={fetchClosures} className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 font-semibold hover:bg-rose-100">Retry</button></div>}
      <ClosureTable
        closures={closures}
        loading={loading}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        onView={handleView}
        onReview={handleView}
        onApprove={handleView}
        onComplete={handleView}
        onPrint={handlePrint}
        userPermissions={userPermissions}
        currentUserId={currentUserId}
        hasActiveFilters={Boolean(search || status !== 'ALL' || closureType !== 'ALL')}
        onClearFilters={() => { setSearch(''); setStatus('ALL'); setClosureType('ALL'); setPage(1); }}
        onCreate={canCreate ? () => setWizardOpen(true) : undefined}
      />
      {!loading && !loadError && <p role="status" className="sr-only">{total} closure record{total === 1 ? '' : 's'} found.</p>}

      {/* New Closure Wizard Modal */}
      <NewClosureWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={() => {
          fetchClosures();
          fetchStats();
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
          fetchClosures();
          fetchStats();
        }}
        onPrint={handlePrint}
        userPermissions={userPermissions}
        currentUserId={currentUserId}
        onNavigateToPayments={(invoiceId) => {
          setDetailModalOpen(false);
          navigate('/#payments');
        }}
        onNavigateToDeposits={(allocationId) => {
          setDetailModalOpen(false);
          navigate('/#deposits-refunds');
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
    </div>
  );
};
