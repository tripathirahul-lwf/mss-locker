import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { importApi } from '../features/imports/api/importApi';
import { ImportJob } from '../features/imports/types';
import { ImportWizard } from '../features/imports/components/ImportWizard';
import { ImportHistoryTable } from '../features/imports/components/ImportHistoryTable';
import { TemplateDownloadCards } from '../features/imports/components/TemplateDownloadCards';
import {
  FileSpreadsheet,
  UploadCloud,
  History,
  Download,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export const ImportExportPage: React.FC = () => {
  const { permissions: userPermissions } = useAuth();

  const [activeTab, setActiveTab] = useState<
    'wizard' | 'history' | 'templates'
  >('wizard');
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [error, setError] = useState('');
  const completedJobs = jobs.filter((job) => ['COMPLETED', 'COMPLETED_WITH_ERRORS'].includes(job.status)).length;
  const activeJobs = jobs.filter((job) => !['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'ROLLED_BACK'].includes(job.status)).length;

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await importApi.getImportJobs(page, 10);
      setJobs(res.jobs);
      setTotalPages(res.pagination.totalPages);
      setTotal(res.pagination.total);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Import history could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      {/* Page Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><FileSpreadsheet className="h-5 w-5" /></span>
          <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Excel Data Import & Historical Migration
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              1,484 Lockers + Renewals Ready
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Bulk import the physical locker registry, customer profiles, active allocations, and historical annual renewal bills.
          </p>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50 px-1 py-2 text-center sm:min-w-[280px]">
          <div className="px-2"><span className="block text-lg font-bold tabular-nums text-slate-900">{total}</span><span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">All jobs</span></div>
          <div className="px-2"><span className="block text-lg font-bold tabular-nums text-emerald-700">{completedJobs}</span><span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Recent done</span></div>
          <div className="px-2"><span className="block text-lg font-bold tabular-nums text-blue-700">{activeJobs}</span><span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Recent active</span></div>
        </div>
      </div>

      {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</span><button type="button" onClick={fetchJobs} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 font-semibold hover:bg-rose-100"><RefreshCw className="h-4 w-4" />Retry</button></div>}

      {/* Navigation Tabs */}
      <div role="tablist" aria-label="Import and export sections" className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100/80 p-1 text-xs font-semibold sm:text-sm">
        <button
          onClick={() => setActiveTab('wizard')}
          id="import-wizard-tab" role="tab" aria-selected={activeTab === 'wizard'} aria-controls="import-wizard-panel"
          className={`flex min-h-11 items-center gap-2 px-4 py-2.5 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'wizard'
              ? 'bg-white text-emerald-800 font-bold shadow-sm ring-1 ring-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <UploadCloud className="w-4 h-4 text-emerald-600" />
          <span>Import Data Wizard</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          id="import-history-tab" role="tab" aria-selected={activeTab === 'history'} aria-controls="import-history-panel"
          className={`flex min-h-11 items-center gap-2 px-4 py-2.5 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'history'
              ? 'bg-white text-emerald-800 font-bold shadow-sm ring-1 ring-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <History className="w-4 h-4 text-emerald-600" />
          <span>Import History & Jobs ({total})</span>
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          id="import-templates-tab" role="tab" aria-selected={activeTab === 'templates'} aria-controls="import-templates-panel"
          className={`flex min-h-11 items-center gap-2 px-4 py-2.5 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'templates'
              ? 'bg-white text-emerald-800 font-bold shadow-sm ring-1 ring-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Download className="w-4 h-4 text-emerald-600" />
          <span>Download Excel Templates</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'wizard' && (
        <div id="import-wizard-panel" role="tabpanel" aria-labelledby="import-wizard-tab"><ImportWizard
          onSuccess={() => {
            fetchJobs();
          }}
          userPermissions={userPermissions}
        /></div>
      )}

      {activeTab === 'history' && (
        <div id="import-history-panel" role="tabpanel" aria-labelledby="import-history-tab"><ImportHistoryTable
          jobs={jobs}
          loading={loading}
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={setPage}
          onRefresh={fetchJobs}
          userPermissions={userPermissions}
        /></div>
      )}

      {activeTab === 'templates' && <div id="import-templates-panel" role="tabpanel" aria-labelledby="import-templates-tab"><TemplateDownloadCards /></div>}
    </div>
  );
};
