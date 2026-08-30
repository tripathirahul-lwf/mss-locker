import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Download,
  KeyRound,
  Users,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  FileCheck,
  FileX2,
  Loader2,
} from 'lucide-react';
import { importApi } from '../api/importApi';
import {
  ImportJob,
  UploadResponseData,
  ValidationResponseData,
  ImportRowResult,
} from '../types';

interface ImportWizardProps {
  onSuccess: () => void;
  userPermissions?: string[];
}

export const ImportWizard: React.FC<ImportWizardProps> = ({
  onSuccess,
  userPermissions = [],
}) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard Steps: 1: Upload, 2: Mapping, 3: Validate & Preview, 4: Commit, 5: Reconcile
  const [step, setStep] = useState<number>(1);

  // File & Upload State
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadData, setUploadData] = useState<UploadResponseData | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Mapping State
  const [columnMappings, setColumnMappings] = useState<
    Record<string, Record<string, string>>
  >({});
  const [selectedLockersSheet, setSelectedLockersSheet] = useState<string>('');
  const [selectedRenewalSheet, setSelectedRenewalSheet] = useState<string>('');

  // Validation State
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationData, setValidationData] =
    useState<ValidationResponseData | null>(null);
  const [previewFilter, setPreviewFilter] = useState<string>('ALL');

  // Commit State
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [committedJob, setCommittedJob] = useState<ImportJob | null>(null);
  const [importMode, setImportMode] = useState<'INSERT_ONLY' | 'UPSERT_SAFE'>(
    'INSERT_ONLY'
  );

  const canCommit = userPermissions.includes('imports.commit');

  // 1. Handle File Selection & Upload
  const uploadSelectedFile = async (selected: File) => {
    setOperationError(null);
    setUploadError(null);
    const extension = selected.name.split('.').pop()?.toLowerCase();
    if (!extension || !['xlsx', 'xls', 'csv'].includes(extension)) {
      setUploadError('Unsupported file type. Select an .xlsx, .xls, or .csv spreadsheet.');
      return;
    }
    if (selected.size > 25 * 1024 * 1024) {
      setUploadError('File is larger than 25 MB. Reduce its size and try again.');
      return;
    }
    if (selected.size === 0) {
      setUploadError('This file is empty. Select a spreadsheet containing migration data.');
      return;
    }

    setFile(selected);
    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', selected);
    formData.append('importType', 'FULL_MIGRATION');

    try {
      const res = await importApi.uploadFile(formData);
      setUploadData(res);
      setColumnMappings(res.job.columnMappings || {});
      setSelectedLockersSheet(
        res.detectedSheets.lockersSheet || res.job.sheetNames[0] || ''
      );
      setSelectedRenewalSheet(res.detectedSheets.renewalHistorySheet || '');
      setStep(2);
    } catch (err: any) {
      console.error('Error uploading file:', err);
      setUploadError(err.response?.data?.message || 'Failed to parse Excel file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) await uploadSelectedFile(selected);
    e.target.value = '';
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (isUploading) return;
    const selected = event.dataTransfer.files?.[0];
    if (selected) await uploadSelectedFile(selected);
  };

  // 2. Handle Validation
  const handleRunValidation = async () => {
    if (!uploadData?.job) return;
    setIsValidating(true);
    setOperationError(null);
    try {
      const res = await importApi.validateJob(uploadData.job._id, {
        columnMappings,
        lockersSheet: selectedLockersSheet,
        renewalSheet: selectedRenewalSheet,
      });
      setValidationData(res);
      setStep(3);
    } catch (err: any) {
      setOperationError(err.response?.data?.message || 'Validation could not be completed. Review the mappings and try again.');
    } finally {
      setIsValidating(false);
    }
  };

  // 3. Handle Commit
  const handleExecuteCommit = async () => {
    if (!uploadData?.job) return;
    setIsCommitting(true);
    setOperationError(null);
    try {
      const res = await importApi.commitJob(uploadData.job._id);
      setCommittedJob(res.job);
      setStep(5);
      onSuccess();
    } catch (err: any) {
      setOperationError(err.response?.data?.message || 'The migration could not be committed. No further changes were applied.');
    } finally {
      setIsCommitting(false);
    }
  };

  // 4. Download issues CSV
  const handleDownloadIssues = async () => {
    if (!uploadData?.job) return;
    await importApi.downloadErrorsCsv(
      uploadData.job._id,
      uploadData.job.jobNumber
    );
  };

  const currentJob = validationData?.job || uploadData?.job;
  const summary = validationData?.validationSummary;
  const rowResults = validationData?.rowResultsPreview || [];

  const filteredRows = rowResults.filter((r) => {
    if (previewFilter === 'ALL') return true;
    if (previewFilter === 'VALID') return r.status === 'VALID';
    if (previewFilter === 'WARNING') return r.status === 'WARNING';
    if (previewFilter === 'INVALID') return r.status === 'INVALID';
    return true;
  });

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
      <div className="border-b border-slate-100 bg-white px-4 py-3 sm:px-6" aria-label={`Import progress: step ${step} of 5`}>
        <ol className="grid grid-cols-5 gap-1.5">
          {['Upload', 'Map', 'Validate', 'Confirm', 'Complete'].map((label, index) => {
            const number = index + 1;
            const complete = number < step;
            const current = number === step;
            return <li key={label} className="min-w-0"><div className={`h-1.5 rounded-full transition-colors ${complete ? 'bg-emerald-500' : current ? 'bg-emerald-600' : 'bg-slate-200'}`} /><span className={`mt-1.5 hidden truncate text-[10px] font-semibold sm:block ${current ? 'text-emerald-700' : complete ? 'text-slate-700' : 'text-slate-400'}`}>{number}. {label}</span></li>;
          })}
        </ol>
      </div>
      {/* Wizard Step Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center font-bold">
            {step}
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
              {step === 1 && 'Step 1: Upload Excel/CSV Spreadsheet'}
              {step === 2 && 'Step 2: Review Sheet & Column Mappings'}
              {step === 3 && 'Step 3: Dry-Run Validation & Preview'}
              {step === 4 && 'Step 4: Confirm Data Migration Commit'}
              {step === 5 && 'Step 5: Migration Complete & Reconciliation'}
            </h2>
            <p className="text-xs text-slate-500">
              {step === 1 && 'Upload your .xlsx file containing Lockers and Renewal History.'}
              {step === 2 && 'Verify auto-detected columns match the MSS Locker system schema.'}
              {step === 3 && 'Inspect rows, detected duplicates, and potential warnings before commit.'}
              {step === 4 && 'Execute batch insert into production lockers and customer ledgers.'}
              {step === 5 && 'Review post-import reconciliation check and summary statistics.'}
            </p>
          </div>
        </div>

        {uploadData?.job && (
          <span className="hidden sm:inline-block font-mono text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
            {uploadData.job.jobNumber}
          </span>
        )}
      </div>

      {/* Wizard Body */}
      <div className="p-6">
        {operationError && <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span><strong className="block">Action could not be completed</strong>{operationError}</span></div>}
        {/* ======================================================== */}
        {/* STEP 1: UPLOAD FILE */}
        {/* ======================================================== */}
        {step === 1 && (
          <div className="space-y-6 max-w-xl mx-auto py-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInputRef.current?.click(); } }}
              onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false); }}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              aria-disabled={isUploading}
              aria-describedby="spreadsheet-upload-help"
              className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all space-y-3 outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 ${isUploading ? 'cursor-wait border-slate-300 bg-slate-50' : isDragging ? 'scale-[1.01] cursor-copy border-emerald-600 bg-emerald-100/70 shadow-lg' : 'cursor-pointer border-emerald-300 bg-emerald-50/30 hover:border-emerald-500 hover:bg-emerald-50/60'}`}
            >
              <div className="w-14 h-14 mx-auto rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                {isUploading ? <Loader2 className="w-7 h-7 animate-spin" /> : isDragging ? <FileCheck className="w-7 h-7" /> : <UploadCloud className="w-7 h-7" />}
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm sm:text-base">
                  {isUploading ? 'Uploading and inspecting spreadsheet…' : isDragging ? 'Drop spreadsheet to start upload' : 'Choose or drag and drop a spreadsheet'}
                </p>
                <p id="spreadsheet-upload-help" className="text-xs text-slate-500 mt-1">
                  Supported formats: <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.csv</strong> (Max 25 MB)
                </p>
                {file && <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm"><FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                disabled={isUploading}
                className="hidden"
              />
            </div>

            {isUploading && (
              <div role="status" aria-live="polite" className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-600 font-medium">
                Parsing workbook, detecting sheets, and reading column headers…
              </div>
            )}

            {uploadError && (
              <div role="alert" className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                <FileX2 className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span><strong className="block">Spreadsheet could not be uploaded</strong>{uploadError}</span>
              </div>
            )}

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-2">
              <span className="font-bold text-slate-800 block">
                Standard Migration Template Sheets:
              </span>
              <ul className="list-disc pl-5 space-y-1 text-slate-600 font-mono text-[11px]">
                <li>
                  <strong>Lockers</strong>: 1,484 physical lockers, sizes A-G2, rack #, active tenant names & phones.
                </li>
                <li>
                  <strong>Renewal History</strong>: Historical years billing records with dates and paid status.
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 2: SHEET & COLUMN MAPPING */}
        {/* ======================================================== */}
        {step === 2 && uploadData && (
          <div className="space-y-6">
            {uploadData.isDuplicateFile && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Duplicate File Warning:</strong> This exact spreadsheet checksum was already uploaded in job{' '}
                  <strong>{uploadData.duplicateJobNumber}</strong>. You may proceed if you wish to re-validate.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Lockers Sheet Selector */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Lockers Master Sheet:
                </label>
                <select
                  value={selectedLockersSheet}
                  onChange={(e) => setSelectedLockersSheet(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-emerald-600"
                >
                  {uploadData.job.sheetNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  Detected {uploadData.job.sheetData?.[selectedLockersSheet]?.length || 0} rows in this sheet.
                </p>
              </div>

              {/* Renewal History Sheet Selector */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Renewal History Sheet (Optional):
                </label>
                <select
                  value={selectedRenewalSheet}
                  onChange={(e) => setSelectedRenewalSheet(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-emerald-600"
                >
                  <option value="">-- None (Lockers Only) --</option>
                  {uploadData.job.sheetNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  {selectedRenewalSheet
                    ? `Detected ${uploadData.job.sheetData?.[selectedRenewalSheet]?.length || 0} billing rows.`
                    : 'No renewal history sheet selected.'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Change File
              </button>

              <button
                type="button"
                onClick={handleRunValidation}
                disabled={isValidating}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer transition-colors disabled:opacity-50"
              >
                {isValidating ? (
                  'Validating Data...'
                ) : (
                  <>
                    <span>Run Dry-Run Validation</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 3: DRY-RUN VALIDATION & PREVIEW */}
        {/* ======================================================== */}
        {step === 3 && summary && (
          <div className="space-y-6">
            {/* KPI Validation Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">
                  Total Rows
                </span>
                <span className="text-xl font-black font-mono text-slate-900">
                  {summary.totalRows}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">
                  Valid Clean Rows
                </span>
                <span className="text-xl font-black font-mono text-emerald-700">
                  {summary.validRows}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
                <span className="text-[10px] font-bold text-amber-700 uppercase block">
                  Warnings (Non-Fatal)
                </span>
                <span className="text-xl font-black font-mono text-amber-700">
                  {summary.warningRows}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200">
                <span className="text-[10px] font-bold text-rose-700 uppercase block">
                  Hard Errors (Skipped)
                </span>
                <span className="text-xl font-black font-mono text-rose-700">
                  {summary.invalidRows}
                </span>
              </div>
            </div>

            {/* Filter Tabs & Error Download */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                {['ALL', 'VALID', 'WARNING', 'INVALID'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setPreviewFilter(f)}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      previewFilter === f
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <button
                onClick={handleDownloadIssues}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                Download Validation Issues (.csv)
              </button>
            </div>

            {/* Preview Table */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Row #</th>
                      <th className="py-2.5 px-3">Sheet</th>
                      <th className="py-2.5 px-3">Locker #</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Issues / Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 font-mono font-bold text-slate-600">
                          {r.rowNumber}
                        </td>
                        <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                          {r.sheet}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900">
                          #{r.data?.lockerNumber || 'N/A'}
                        </td>
                        <td className="py-2 px-3 text-slate-800">
                          {r.data?.customerName || (
                            <span className="text-slate-400 font-mono">--</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.status === 'VALID'
                                ? 'bg-emerald-50 text-emerald-700'
                                : r.status === 'WARNING'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[11px] max-w-[250px] truncate text-slate-600">
                          {r.errors.length > 0
                            ? r.errors.join('; ')
                            : r.warnings.length > 0
                            ? r.warnings.join('; ')
                            : 'Passed validation'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Mappings
              </button>

              <button
                type="button"
                onClick={() => setStep(4)}
                disabled={summary.validRows === 0}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer transition-colors disabled:opacity-50"
              >
                <span>Proceed to Commit ({summary.validRows + summary.warningRows} rows)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 4: CONFIRM & COMMIT */}
        {/* ======================================================== */}
        {step === 4 && summary && (
          <div className="space-y-6 max-w-lg mx-auto py-2">
            <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Ready to Commit Migration Data
                  </h3>
                  <p className="text-xs text-slate-500">
                    Target database: MongoDB Atlas Production
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-700 pt-2 border-t border-slate-200">
                <div className="flex justify-between">
                  <span>Valid & Warning Rows to Import:</span>
                  <strong className="font-mono text-emerald-700">
                    {summary.validRows + summary.warningRows}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Invalid Rows to Skip:</span>
                  <strong className="font-mono text-rose-600">
                    {summary.invalidRows}
                  </strong>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="text-xs font-bold text-slate-700 block">
                  Import Mode:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label
                    className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 ${
                      importMode === 'INSERT_ONLY'
                        ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-bold'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="INSERT_ONLY"
                      checked={importMode === 'INSERT_ONLY'}
                      onChange={() => setImportMode('INSERT_ONLY')}
                      className="hidden"
                    />
                    <span>Insert Only</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      Skip existing lockers
                    </span>
                  </label>

                  <label
                    className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 ${
                      importMode === 'UPSERT_SAFE'
                        ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-bold'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="UPSERT_SAFE"
                      checked={importMode === 'UPSERT_SAFE'}
                      onChange={() => setImportMode('UPSERT_SAFE')}
                      className="hidden"
                    />
                    <span>Safe Upsert</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      Update tariffs & specs
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={isCommitting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Back to Preview
              </button>

              <button
                type="button"
                onClick={handleExecuteCommit}
                disabled={isCommitting || !canCommit}
                className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs disabled:opacity-50"
              >
                {isCommitting ? 'Importing Batch Records...' : 'Execute Database Commit'}
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 5: MIGRATION COMPLETE & RECONCILIATION */}
        {/* ======================================================== */}
        {step === 5 && committedJob && (
          <div className="space-y-6 max-w-xl mx-auto py-2">
            <div className="p-6 rounded-3xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                Migration Successfully Completed
              </h3>
              <p className="text-xs text-emerald-900">
                Job <strong>{committedJob.jobNumber}</strong> has finished importing records into the live database.
              </p>
            </div>

            {/* Reconciliation Report Box */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Post-Import Reconciliation Check
              </span>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Inserted Rows</span>
                  <span className="font-mono font-bold text-base text-slate-900">
                    {committedJob.commitSummary?.insertedRows || 0}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Updated Rows</span>
                  <span className="font-mono font-bold text-base text-slate-900">
                    {committedJob.commitSummary?.updatedRows || 0}
                  </span>
                </div>
              </div>

              {committedJob.reconciliation && (
                <div className="pt-2 text-xs text-slate-700 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{committedJob.reconciliation.notes}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Total Lockers in System: {committedJob.reconciliation.totalLockers} &bull; Total Active Allocations: {committedJob.reconciliation.totalActiveAllocations}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/lockers')}
                className="px-4 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                View Lockers Registry
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setFile(null);
                  setUploadData(null);
                  setValidationData(null);
                  setCommittedJob(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
              >
                Import Another File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
