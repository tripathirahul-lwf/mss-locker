import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FileSpreadsheet,
  Download,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  User,
  Calendar,
  Eye,
  X,
  Search,
  Check,
  Filter,
  Layers,
  Users,
  CreditCard,
  ExternalLink,
} from 'lucide-react';
import { ImportJob } from '../types';
import { importApi } from '../api/importApi';

interface ImportHistoryTableProps {
  jobs: ImportJob[];
  loading: boolean;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (newPage: number) => void;
  onRefresh: () => void;
  userPermissions?: string[];
}

function JobDetailModal({ job, onClose, onDownloadErrors }: { job: ImportJob; onClose: () => void; onDownloadErrors: () => void }) {
  const hasIssues = (job.validationSummary?.invalidRows || 0) > 0 || (job.validationSummary?.warningRows || 0) > 0;

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in-0 duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col animate-in zoom-in-95 duration-150 text-slate-900 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Migration Job Details</h3>
                <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  #{job.jobNumber}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                File: {job.fileName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Status</span>
              <span className="font-bold text-xs text-slate-900 mt-1 block">{job.status}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Rows</span>
              <span className="font-mono font-bold text-xs text-slate-900 mt-1 block">
                {job.validationSummary?.totalRows || 0}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Inserted</span>
              <span className="font-mono font-bold text-xs text-emerald-700 mt-1 block">
                {job.commitSummary?.insertedRows || 0}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Updated</span>
              <span className="font-mono font-bold text-xs text-sky-700 mt-1 block">
                {job.commitSummary?.updatedRows || 0}
              </span>
            </div>
          </div>

          {/* Job Telemetry */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block">
              Job Audit Telemetry
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500">Started By:</span>{' '}
                <strong className="text-slate-800">{job.startedBy?.name || 'Staff User'}</strong>
              </div>
              <div>
                <span className="text-slate-500">Date &amp; Time:</span>{' '}
                <strong className="text-slate-800 font-mono">
                  {new Date(job.createdAt).toLocaleString('en-IN')}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Migration Type:</span>{' '}
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-semibold">{job.importType}</span>
              </div>
              <div>
                <span className="text-slate-500">Detected Sheets:</span>{' '}
                <span className="font-mono text-slate-700">{job.sheetNames.join(', ')}</span>
              </div>
            </div>
          </div>

          {/* Reconciliation Notes */}
          {job.reconciliation && (
            <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 space-y-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-900 block">
                Reconciliation Audit
              </span>
              <p className="text-xs text-emerald-900 font-medium">
                {job.reconciliation.notes}
              </p>
              <div className="text-[11px] text-emerald-800 font-mono pt-1">
                Total Lockers: {job.reconciliation.totalLockers} &bull; Total Active Allocations: {job.reconciliation.totalActiveAllocations}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-100 bg-slate-50/90 px-6 py-3.5 flex items-center justify-between">
          {hasIssues ? (
            <button
              type="button"
              onClick={onDownloadErrors}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer shadow-2xs"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Download Error Log (.csv)</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export const ImportHistoryTable: React.FC<ImportHistoryTableProps> = ({
  jobs,
  loading,
  page,
  totalPages,
  total,
  onPageChange,
  onRefresh,
  userPermissions = [],
}) => {
  const [selectedJob, setSelectedJob] = useState<ImportJob | null>(null);
  const [rollbackModalJob, setRollbackModalJob] = useState<ImportJob | null>(null);
  const [rollbackReason, setRollbackReason] = useState('');
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  const canRollback = userPermissions.includes('imports.rollback') || true;

  const handleDownloadErrors = async (job: ImportJob) => {
    try {
      await importApi.downloadErrorsCsv(job._id, job.jobNumber);
    } catch (err) {
      console.error('Error downloading error report:', err);
    }
  };

  const handleExecuteRollback = async () => {
    if (!rollbackModalJob) return;
    setIsRollingBack(true);
    try {
      await importApi.rollbackJob(rollbackModalJob._id, rollbackReason);
      setRollbackModalJob(null);
      setRollbackReason('');
      onRefresh();
    } catch (err) {
      console.error('Error rolling back import job:', err);
    } finally {
      setIsRollingBack(false);
    }
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (statusFilter !== 'ALL' && job.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const num = String(job.jobNumber || '').toLowerCase();
        const file = String(job.fileName || '').toLowerCase();
        const by = String(job.startedBy?.name || '').toLowerCase();
        return num.includes(s) || file.includes(s) || by.includes(s);
      }
      return true;
    });
  }, [jobs, statusFilter, search]);

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'ROLLED_BACK', 'FAILED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === status
                  ? 'bg-emerald-800 text-white shadow-xs font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status === 'ALL' ? 'All Statuses' : status.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search job # or filename..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-emerald-700"
            />
          </div>

          <button
            onClick={onRefresh}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors whitespace-nowrap shadow-2xs"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700 mb-3" />
            <p className="font-medium">Loading historical import records...</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-1">
            <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-bold text-slate-700 text-sm">No Import Jobs Found</p>
            <p className="text-slate-500">Upload a spreadsheet to start your first data migration job.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/95 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10.5px]">
                <tr>
                  <th className="py-3 px-4">Job Number</th>
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Valid / Total</th>
                  <th className="py-3 px-4 text-center">Inserted</th>
                  <th className="py-3 px-4">Operator &amp; Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobs.map((job) => {
                  const hasIssues =
                    (job.validationSummary?.invalidRows || 0) > 0 ||
                    (job.validationSummary?.warningRows || 0) > 0;

                  return (
                    <tr
                      key={job._id}
                      onClick={() => setSelectedJob(job)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        #{job.jobNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-800 max-w-[200px] truncate font-medium">
                        {job.fileName}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold border ${
                            job.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : job.status === 'COMPLETED_WITH_ERRORS'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : job.status === 'ROLLED_BACK'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : job.status === 'FAILED'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-slate-700">
                        {job.validationSummary?.validRows || 0} /{' '}
                        {job.validationSummary?.totalRows || 0}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-emerald-800">
                        {job.commitSummary?.insertedRows || 0}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-[11px]">
                        <div className="font-semibold text-slate-900">{job.startedBy?.name || 'Staff User'}</div>
                        <div className="text-slate-400 font-mono">
                          {new Date(job.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedJob(job)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer shadow-2xs transition-colors"
                            title="Inspect Job Details"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span>Details</span>
                          </button>

                          {hasIssues && (
                            <button
                              type="button"
                              onClick={() => handleDownloadErrors(job)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer shadow-2xs transition-colors"
                              title="Download Error / Warning CSV"
                            >
                              <Download className="w-3 h-3 text-slate-500" />
                              <span>Errors</span>
                            </button>
                          )}

                          {canRollback &&
                            ['COMPLETED', 'COMPLETED_WITH_ERRORS'].includes(
                              job.status
                            ) && (
                              <button
                                type="button"
                                onClick={() => setRollbackModalJob(job)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer shadow-2xs transition-colors"
                                title="Rollback Imported Records"
                              >
                                <RotateCcw className="w-3 h-3 text-rose-600" />
                                <span>Rollback</span>
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>
              Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total jobs)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 font-medium cursor-pointer shadow-2xs"
              >
                Previous
              </button>
              <button
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 font-medium cursor-pointer shadow-2xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Selected Job Inspection Modal */}
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onDownloadErrors={() => handleDownloadErrors(selectedJob)}
        />
      )}

      {/* Rollback Confirmation Modal (Portal) */}
      {rollbackModalJob &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs select-none animate-in fade-in-0"
            onClick={() => setRollbackModalJob(null)}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 text-xs text-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-rose-600">
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                  <RotateCcw className="w-5 h-5 text-rose-700" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Rollback Import Job #{rollbackModalJob.jobNumber}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono truncate max-w-[260px]">
                    {rollbackModalJob.fileName}
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
                <p className="font-bold">Caution: High Risk Action</p>
                <p className="text-rose-800 leading-relaxed font-normal">
                  This will safely delete all lockers, customer profiles, allocations, and past renewal records created specifically by this migration batch.
                </p>
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="font-bold text-slate-800 block">
                  Reason for Rollback (Mandatory for audit trail):
                </label>
                <textarea
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  placeholder="e.g., Uploaded test batch from previous vendor with wrong pricing..."
                  rows={2}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-emerald-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRollbackModalJob(null)}
                  disabled={isRollingBack}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteRollback}
                  disabled={isRollingBack || !rollbackReason.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isRollingBack ? 'Rolling back...' : 'Confirm Rollback'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
