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
import { Lock, ShieldCheck } from 'lucide-react';

export const ClosuresPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userPermissions = (user as any)?.role?.permissions || [];
  const currentUserId = (user as any)?._id;

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

  // Modals
  const [wizardOpen, setWizardOpen] = useState<boolean>(false);
  const [selectedClosure, setSelectedClosure] = useState<LockerClosure | null>(
    null
  );
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [statementClosure, setStatementClosure] =
    useState<LockerClosure | null>(null);
  const [statementModalOpen, setStatementModalOpen] = useState<boolean>(false);

  const canCreate = userPermissions.includes('closures.create');

  // Load closure list
  const fetchClosures = useCallback(async () => {
    setLoading(true);
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Locker Surrenders & Closures
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Maker-Checker Controlled
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage customer locker surrenders, dues clearance, key inspection, and release lockers back to vacant.
          </p>
        </div>
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
      />

      {/* Closures Data Table */}
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
      />

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
          navigate('/payments');
        }}
        onNavigateToDeposits={(allocationId) => {
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
    </div>
  );
};
