import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { importApi } from '../features/imports/api/importApi';
import { ImportJob } from '../features/imports/types';
import { ImportWizard } from '../features/imports/components/ImportWizard';
import { ImportHistoryTable } from '../features/imports/components/ImportHistoryTable';
import { TemplateDownloadCards } from '../features/imports/components/TemplateDownloadCards';
import {
  FileSpreadsheet,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  History,
  Download,
  Layers,
  Sparkles,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

type TabView = 'WIZARD' | 'HISTORY' | 'TEMPLATES';

export const ImportExportPage: React.FC = () => {
  const { permissions: userPermissions } = useAuth();

  const [activeTab, setActiveTab] = useState<TabView>('WIZARD');
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [error, setError] = useState('');

  const completedJobs = jobs.filter((job) => ['COMPLETED', 'COMPLETED_WITH_ERRORS'].includes(job.status)).length;
  const activeJobs = jobs.filter((job) => !['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'ROLLED_BACK'].includes(job.status)).length;
  const totalInsertedRows = jobs.reduce((acc, job) => acc + (job.commitSummary?.insertedRows || 0), 0);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await importApi.getImportJobs(page, 15);
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
    <div className="space-y-5 font-sans">
      {/* Top Header Card */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 lg:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-emerald-800" aria-hidden="true" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
              Data Migration Engine
            </span>
            <span className="text-[11px] text-slate-400 font-normal">1,484 Lockers + Historical Renewals</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
            Excel Data Import &amp; Historical Migration
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-normal">
            Bulk import physical safe-deposit lockers, customer KYC profiles, active allocations, and multi-year renewal ledgers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={fetchJobs}
            disabled={loading}
            variant="outline"
            className="h-10 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-xs gap-1.5 px-3.5 shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-800' : 'text-slate-600'}`} />
            <span>Sync History</span>
          </Button>
        </div>
      </section>

      {/* 4 KPI Summary Cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          onClick={() => setActiveTab('HISTORY')}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-emerald-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">All Migration Jobs</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {total}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Executed batch runs</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-100">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card
          onClick={() => setActiveTab('HISTORY')}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-emerald-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Completed Batches</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-700 font-mono">
                {completedJobs}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Committed to database</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-100">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card
          onClick={() => setActiveTab('WIZARD')}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-sky-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Records Inserted</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-sky-700 font-mono">
                {totalInsertedRows.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Physical lockers &amp; KYC</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-sky-700 border border-sky-100">
              <Layers className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card
          onClick={() => setActiveTab('TEMPLATES')}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-indigo-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Excel Templates</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-indigo-700 font-mono">
                3
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Pre-formatted workbooks</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100">
              <Download className="h-6 w-6" />
            </div>
          </div>
        </Card>
      </section>

      {/* Primary Section Switcher Tabs */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('WIZARD')}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'WIZARD'
              ? 'bg-emerald-800 text-white shadow-xs font-bold'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>1. Active Migration Wizard</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('HISTORY')}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'HISTORY'
              ? 'bg-emerald-800 text-white shadow-xs font-bold'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <History className="h-4 w-4" />
          <span>2. Job History &amp; Audit ({total})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TEMPLATES')}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'TEMPLATES'
              ? 'bg-emerald-800 text-white shadow-xs font-bold'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Download className="h-4 w-4" />
          <span>3. Excel Templates &amp; Schemas</span>
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 shadow-2xs">
          <span className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4 text-rose-700 shrink-0" />
            {error}
          </span>
          <button
            type="button"
            onClick={fetchJobs}
            className="inline-flex items-center gap-1 px-3 py-1 font-bold bg-white text-rose-800 border border-rose-200 rounded-lg hover:bg-rose-100 cursor-pointer text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Main Tab Content */}
      {activeTab === 'WIZARD' && (
        <section aria-labelledby="import-wizard-heading" className="space-y-4">
          <ImportWizard
            onSuccess={() => {
              fetchJobs();
              setActiveTab('HISTORY');
            }}
            userPermissions={userPermissions}
          />
        </section>
      )}

      {activeTab === 'HISTORY' && (
        <section aria-labelledby="import-history-heading" className="space-y-4">
          <ImportHistoryTable
            jobs={jobs}
            loading={loading}
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
            onRefresh={fetchJobs}
            userPermissions={userPermissions}
          />
        </section>
      )}

      {activeTab === 'TEMPLATES' && (
        <section aria-labelledby="import-templates-heading" className="space-y-4">
          <TemplateDownloadCards />
        </section>
      )}
    </div>
  );
};
