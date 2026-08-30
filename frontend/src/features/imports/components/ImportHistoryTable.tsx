import React, { useState } from 'react';
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
  const [rollbackModalJob, setRollbackModalJob] = useState<ImportJob | null>(null);
  const [rollbackReason, setRollbackReason] = useState('');
  const [isRollingBack, setIsRollingBack] = useState(false);

  const canRollback = userPermissions.includes('imports.rollback');

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">
            Historical Import & Migration Jobs
          </h3>
          <p className="text-xs text-slate-500">
            Audit history of all uploaded spreadsheets, commit results, and error logs.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
        >
          Refresh List
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-3" />
            <p className="font-medium">Loading historical import records...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-1">
            <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-bold text-slate-700 text-sm">No Import Jobs Found</p>
            <p>Upload a new Excel file to start your first migration job.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Job Number</th>
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Valid / Total</th>
                  <th className="py-3 px-4 text-center">Inserted</th>
                  <th className="py-3 px-4">Started By & Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((job) => {
                  const hasIssues =
                    (job.validationSummary?.invalidRows || 0) > 0 ||
                    (job.validationSummary?.warningRows || 0) > 0;

                  return (
                    <tr key={job._id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {job.jobNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-800 max-w-[200px] truncate font-medium">
                        {job.fileName}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px]">
                          {job.importType}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            job.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : job.status === 'COMPLETED_WITH_ERRORS'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : job.status === 'ROLLED_BACK'
                              ? 'bg-purple-50 text-purple-800 border border-purple-200'
                              : job.status === 'FAILED'
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-semibold">
                        {job.validationSummary?.validRows || 0} /{' '}
                        {job.validationSummary?.totalRows || 0}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-emerald-700">
                        {job.commitSummary?.insertedRows || 0}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-[11px]">
                        <div>{job.startedBy?.name || 'Staff User'}</div>
                        <div className="text-slate-400 font-mono">
                          {new Date(job.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {hasIssues && (
                            <button
                              onClick={() => handleDownloadErrors(job)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                              title="Download Error / Warning CSV"
                            >
                              <Download className="w-3 h-3 text-slate-500" />
                              Error CSV
                            </button>
                          )}

                          {canRollback &&
                            ['COMPLETED', 'COMPLETED_WITH_ERRORS'].includes(
                              job.status
                            ) && (
                              <button
                                onClick={() => setRollbackModalJob(job)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer transition-colors"
                                title="Rollback Imported Records"
                              >
                                <RotateCcw className="w-3 h-3 text-rose-600" />
                                Rollback
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
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing page {page} of {totalPages} ({total} total jobs)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 font-medium"
              >
                Previous
              </button>
              <button
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 font-medium"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rollback Confirmation Modal */}
      {rollbackModalJob && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs select-none">
          <div role="alertdialog" aria-modal="true" aria-labelledby="rollback-dialog-title" aria-describedby="rollback-dialog-description" className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 id="rollback-dialog-title" className="font-bold text-slate-900 text-sm">
                  Rollback Import Job: {rollbackModalJob.jobNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  {rollbackModalJob.fileName}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
              <p className="font-bold">Caution: High Risk Operation</p>
              <p id="rollback-dialog-description" className="text-rose-800">
                This will delete all lockers, customers, allocations, and
                historical invoices created by this specific import job.
              </p>
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-700 block">
                Reason for Rollback (Mandatory)
              </label>
              <textarea
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                placeholder="e.g. Uploaded incorrect test batch from previous vendor..."
                rows={2}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-emerald-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRollbackModalJob(null)}
                disabled={isRollingBack}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRollback}
                disabled={isRollingBack || !rollbackReason.trim()}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs disabled:opacity-50"
              >
                {isRollingBack ? 'Rolling back...' : 'Confirm Rollback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
