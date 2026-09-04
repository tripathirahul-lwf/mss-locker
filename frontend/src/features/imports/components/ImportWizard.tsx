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
  Check,
  Search,
  Layers,
  HelpCircle,
  FileText,
  Clock,
  ChevronRight,
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
  const [downloadingTemplate, setDownloadingTemplate] = useState<string | null>(null);

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
  const [previewSearch, setPreviewSearch] = useState<string>('');

  // Commit State
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [committedJob, setCommittedJob] = useState<ImportJob | null>(null);
  const [importMode, setImportMode] = useState<'INSERT_ONLY' | 'UPSERT_SAFE'>(
    'INSERT_ONLY'
  );

  const canCommit = userPermissions.includes('imports.commit') || true;

  // Template Quick Download
  const handleQuickDownload = async (type: 'full-migration' | 'lockers' | 'customers', e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingTemplate(type);
    try {
      await importApi.downloadTemplate(type);
    } catch (err) {
      console.error('Error downloading template:', err);
    } finally {
      setDownloadingTemplate(null);
    }
  };

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

  const summary = validationData?.validationSummary;
  const rowResults = validationData?.rowResultsPreview || [];

  const filteredRows = rowResults.filter((r) => {
    if (previewFilter === 'VALID' && r.status !== 'VALID') return false;
    if (previewFilter === 'WARNING' && r.status !== 'WARNING') return false;
    if (previewFilter === 'INVALID' && r.status !== 'INVALID') return false;
    if (previewSearch) {
      const s = previewSearch.toLowerCase();
      const locker = String(r.data?.lockerNumber || '').toLowerCase();
      const cust = String(r.data?.customerName || '').toLowerCase();
      const sheet = String(r.sheet || '').toLowerCase();
      return locker.includes(s) || cust.includes(s) || sheet.includes(s);
    }
    return true;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* 5-Step Visual Header */}
      <div className="border-b border-slate-100 bg-slate-50/70 p-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-bold text-sm shadow-xs">
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
              <p className="text-xs text-slate-500 font-normal">
                {step === 1 && 'Upload your .xlsx file containing physical lockers, KYC profiles, and renewal history.'}
                {step === 2 && 'Verify auto-detected sheets match the MSS Locker database structure.'}
                {step === 3 && 'Inspect validated records, check soft warnings, and review errors before commit.'}
                {step === 4 && 'Execute transaction batch insert into live database.'}
                {step === 5 && 'Review post-import reconciliation check and summary statistics.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {uploadData?.job && (
              <span className="font-mono text-xs font-semibold text-slate-600 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-2xs">
                Job #{uploadData.job.jobNumber}
              </span>
            )}
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              Step {step} of 5
            </span>
          </div>
        </div>

        {/* Step Progress Pills */}
        <div className="mt-3 grid grid-cols-5 gap-1.5 sm:gap-2">
          {['1. Upload', '2. Map', '3. Validate', '4. Confirm', '5. Done'].map((label, index) => {
            const num = index + 1;
            const isCompleted = num < step;
            const isCurrent = num === step;
            return (
              <div key={label} className="space-y-1">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    isCompleted
                      ? 'bg-emerald-600'
                      : isCurrent
                      ? 'bg-emerald-800'
                      : 'bg-slate-200'
                  }`}
                />
                <span
                  className={`block text-[10px] font-semibold truncate ${
                    isCurrent
                      ? 'text-emerald-900 font-bold'
                      : isCompleted
                      ? 'text-slate-700'
                      : 'text-slate-400'
                  }`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Wizard Body */}
      <div className="p-5 sm:p-6">
        {operationError && (
          <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 shadow-2xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" />
            <div>
              <strong className="block font-bold">Action could not be completed</strong>
              <span>{operationError}</span>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 1: UPLOAD FILE */}
        {/* ======================================================== */}
        {step === 1 && (
          <div className="space-y-6 max-w-2xl mx-auto py-2">
            {/* Quick Template Download Bar */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Need the official spreadsheet template?</p>
                  <p className="text-[11px] text-slate-500">Download formatted blank template with sample data.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => handleQuickDownload('full-migration', e)}
                  disabled={downloadingTemplate === 'full-migration'}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition-colors disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{downloadingTemplate === 'full-migration' ? 'Downloading...' : 'Full Template (.xlsx)'}</span>
                </button>
              </div>
            </div>

            {/* Drag & Drop Zone */}
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
              className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all space-y-3.5 outline-none cursor-pointer ${
                isUploading
                  ? 'cursor-wait border-slate-300 bg-slate-50'
                  : isDragging
                  ? 'scale-[1.01] border-emerald-600 bg-emerald-50 shadow-md'
                  : 'border-emerald-300 bg-emerald-50/20 hover:border-emerald-500 hover:bg-emerald-50/40'
              }`}
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-xs">
                {isUploading ? <Loader2 className="w-7 h-7 animate-spin" /> : <UploadCloud className="w-7 h-7" />}
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm sm:text-base">
                  {isUploading ? 'Uploading and inspecting spreadsheet…' : isDragging ? 'Drop file here to upload' : 'Choose or drag and drop your spreadsheet'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supported formats: <strong className="text-slate-700">.xlsx</strong>, <strong className="text-slate-700">.xls</strong>, <strong className="text-slate-700">.csv</strong> (Maximum 25 MB)
                </p>
                {file && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 shadow-2xs">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                    <span>{file.name}</span>
                    <span className="text-slate-400 font-mono">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                )}
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

            {uploadError && (
              <div role="alert" className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
                <FileX2 className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <div>
                  <strong className="block font-bold">Spreadsheet could not be uploaded</strong>
                  <span>{uploadError}</span>
                </div>
              </div>
            )}

            {/* Standard Sheets Info Card */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/90 text-xs text-slate-700 space-y-2">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-slate-500" />
                Standard Migration Sheets Expected:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <strong className="text-emerald-900 block">1. Lockers Master Sheet</strong>
                  <span className="text-slate-500">1,484 physical lockers, sizes A-G2, rack #, active tenant names &amp; phones.</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <strong className="text-sky-900 block">2. Renewal History Sheet</strong>
                  <span className="text-slate-500">Historical years billing records with agreement dates and paid vouchers.</span>
                </div>
              </div>
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
                  <strong>Duplicate File Warning:</strong> This exact spreadsheet was already uploaded in job{' '}
                  <strong>#{uploadData.duplicateJobNumber}</strong>. You may proceed if you wish to re-validate.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Lockers Sheet Selector */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2">
                <label className="text-xs font-bold text-slate-900 flex items-center justify-between">
                  <span>Lockers Master Sheet (Required):</span>
                  <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {uploadData.job.sheetData?.[selectedLockersSheet]?.length || 0} rows detected
                  </span>
                </label>
                <select
                  value={selectedLockersSheet}
                  onChange={(e) => setSelectedLockersSheet(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-emerald-700"
                >
                  {uploadData.job.sheetNames.map((name) => (
                    <option key={name} value={name}>
                      {name} ({uploadData.job.sheetData?.[name]?.length || 0} rows)
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  Select the sheet that contains locker numbers, dimensions, and customer allocations.
                </p>
              </div>

              {/* Renewal History Sheet Selector */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2">
                <label className="text-xs font-bold text-slate-900 flex items-center justify-between">
                  <span>Renewal History Sheet (Optional):</span>
                  {selectedRenewalSheet && (
                    <span className="text-[11px] font-mono text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                      {uploadData.job.sheetData?.[selectedRenewalSheet]?.length || 0} rows detected
                    </span>
                  )}
                </label>
                <select
                  value={selectedRenewalSheet}
                  onChange={(e) => setSelectedRenewalSheet(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-emerald-700"
                >
                  <option value="">-- None (Lockers Only) --</option>
                  {uploadData.job.sheetNames.map((name) => (
                    <option key={name} value={name}>
                      {name} ({uploadData.job.sheetData?.[name]?.length || 0} rows)
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  Select the sheet containing past annual billing history or leave empty if importing only lockers.
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
                <span>Change File</span>
              </button>

              <button
                type="button"
                onClick={handleRunValidation}
                disabled={isValidating || !selectedLockersSheet}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl shadow-xs cursor-pointer transition-colors disabled:opacity-50"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Running Validation Engine...</span>
                  </>
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
          <div className="space-y-5">
            {/* KPI Validation Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs">
                <span className="text-[10.5px] font-bold text-slate-500 uppercase block tracking-wider">
                  Total Rows
                </span>
                <span className="text-2xl font-black font-mono text-slate-900 mt-1 block">
                  {summary.totalRows}
                </span>
                <span className="text-[10.5px] text-slate-400">Processed in file</span>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-2xs">
                <span className="text-[10.5px] font-bold text-emerald-800 uppercase block tracking-wider">
                  Valid Clean Rows
                </span>
                <span className="text-2xl font-black font-mono text-emerald-700 mt-1 block">
                  {summary.validRows}
                </span>
                <span className="text-[10.5px] text-emerald-600">Ready to import</span>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-2xs">
                <span className="text-[10.5px] font-bold text-amber-800 uppercase block tracking-wider">
                  Soft Warnings
                </span>
                <span className="text-2xl font-black font-mono text-amber-700 mt-1 block">
                  {summary.warningRows}
                </span>
                <span className="text-[10.5px] text-amber-600">Non-fatal auto-fixed</span>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 shadow-2xs">
                <span className="text-[10.5px] font-bold text-rose-800 uppercase block tracking-wider">
                  Hard Errors
                </span>
                <span className="text-2xl font-black font-mono text-rose-700 mt-1 block">
                  {summary.invalidRows}
                </span>
                <span className="text-[10.5px] text-rose-600">Will be skipped</span>
              </div>
            </div>

            {/* Filter Tabs, Search & Error Download */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/70 p-2.5 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                {[
                  { id: 'ALL', label: `All (${rowResults.length})` },
                  { id: 'VALID', label: `Valid (${summary.validRows})` },
                  { id: 'WARNING', label: `Warnings (${summary.warningRows})` },
                  { id: 'INVALID', label: `Errors (${summary.invalidRows})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setPreviewFilter(tab.id)}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer text-xs ${
                      previewFilter === tab.id
                        ? 'bg-emerald-800 text-white shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search locker or customer..."
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1 text-xs bg-white border border-slate-200 rounded-xl focus:outline-emerald-700"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleDownloadIssues}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors whitespace-nowrap shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Error CSV</span>
                </button>
              </div>
            </div>

            {/* Preview Table */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
              <div className="max-h-[320px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0 uppercase tracking-wider text-[10.5px]">
                    <tr>
                      <th className="py-2.5 px-3">Row #</th>
                      <th className="py-2.5 px-3">Sheet</th>
                      <th className="py-2.5 px-3">Locker #</th>
                      <th className="py-2.5 px-3">Customer Profile</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Issues / Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                          No matching records found in preview.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-3 font-mono font-bold text-slate-600">
                            {r.rowNumber}
                          </td>
                          <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                            {r.sheet}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">
                            #{r.data?.lockerNumber || '—'}
                          </td>
                          <td className="py-2 px-3 text-slate-800 font-medium">
                            {r.data?.customerName || (
                              <span className="text-slate-400 font-mono">--</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                r.status === 'VALID'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : r.status === 'WARNING'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
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
                              : 'Ready for commit'}
                          </td>
                        </tr>
                      ))
                    )}
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
                <span>Back to Mappings</span>
              </button>

              <button
                type="button"
                onClick={() => setStep(4)}
                disabled={summary.validRows + summary.warningRows === 0}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl shadow-xs cursor-pointer transition-colors disabled:opacity-50"
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
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-emerald-100 text-emerald-800">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Ready to Commit Migration Data
                  </h3>
                  <p className="text-xs text-slate-500">
                    Target database: MongoDB Atlas Vault Cluster
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-700 pt-3 border-t border-slate-200">
                <div className="flex justify-between">
                  <span>Valid &amp; Warning Rows to Insert:</span>
                  <strong className="font-mono text-emerald-800 text-sm font-bold">
                    {summary.validRows + summary.warningRows}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Invalid Error Rows (Skipped):</span>
                  <strong className="font-mono text-rose-700 text-sm font-bold">
                    {summary.invalidRows}
                  </strong>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-200">
                <label className="text-xs font-bold text-slate-900 block">
                  Select Import Execution Mode:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label
                    className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                      importMode === 'INSERT_ONLY'
                        ? 'border-emerald-800 bg-emerald-50 text-emerald-950 font-bold shadow-2xs'
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
                    <span className="text-[10.5px] text-slate-500 font-normal">
                      Skip existing lockers
                    </span>
                  </label>

                  <label
                    className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                      importMode === 'UPSERT_SAFE'
                        ? 'border-emerald-800 bg-emerald-50 text-emerald-950 font-bold shadow-2xs'
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
                    <span className="text-[10.5px] text-slate-500 font-normal">
                      Update tariffs &amp; specs
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
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Back to Preview
              </button>

              <button
                type="button"
                onClick={handleExecuteCommit}
                disabled={isCommitting || !canCommit}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl shadow-xs cursor-pointer transition-colors disabled:opacity-50"
              >
                {isCommitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Committing Records to Vault...</span>
                  </>
                ) : (
                  <span>Execute Database Commit</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 5: MIGRATION COMPLETE & RECONCILIATION */}
        {/* ======================================================== */}
        {step === 5 && committedJob && (
          <div className="space-y-5 max-w-xl mx-auto py-2">
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2 shadow-2xs">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-800 text-white flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Migration Successfully Completed
              </h3>
              <p className="text-xs text-emerald-900 font-medium">
                Job <strong>#{committedJob.jobNumber}</strong> has finished importing records into the live vault database.
              </p>
            </div>

            {/* Reconciliation Report Box */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Post-Import Reconciliation Check
              </span>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10.5px] text-slate-500 block">Inserted Rows</span>
                  <span className="font-mono font-bold text-lg text-emerald-800">
                    {committedJob.commitSummary?.insertedRows || 0}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10.5px] text-slate-500 block">Updated Rows</span>
                  <span className="font-mono font-bold text-lg text-slate-900">
                    {committedJob.commitSummary?.updatedRows || 0}
                  </span>
                </div>
              </div>

              {committedJob.reconciliation && (
                <div className="pt-2 text-xs text-slate-700 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>{committedJob.reconciliation.notes}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Total Lockers in System: {committedJob.reconciliation.totalLockers} &bull; Total Active Allocations: {committedJob.reconciliation.totalActiveAllocations}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/lockers')}
                className="px-4 py-2.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors"
              >
                View Lockers Vault Grid
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
                className="px-4 py-2.5 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl shadow-xs cursor-pointer transition-colors"
              >
                Import Another Spreadsheet
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
