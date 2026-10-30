import React, { useEffect, useState, useId } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Upload,
  Eye,
  RefreshCw,
  X,
  ShieldCheck,
  ShieldAlert,
  FileText,
  CreditCard,
  Globe,
  Car,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Plus,
} from 'lucide-react';
import { customerApi } from '../../customers/api/customerApi';
import { CustomerKycDocument, KycDocumentType } from '../../customers/types';
import { apiClient } from '../../../services/apiClient';
import { usePermission } from '../../../hooks/usePermission';
import { DocumentPreviewModal } from '../../customers/components/DocumentPreviewModal';

export interface LockerKycPanelProps {
  customerId?: string;
  customerName?: string;
  customerCode?: string;
  customerPhone?: string;
  photoUrl?: string;
  kycStatus?: string;
  documents: CustomerKycDocument[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}

interface KycTypeBoxConfig {
  type: KycDocumentType;
  title: string;
  shortLabel: string;
  issuer: string;
  placeholder: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}

const KYC_BOXES: KycTypeBoxConfig[] = [
  {
    type: 'AADHAAR',
    title: 'Aadhaar Card',
    shortLabel: 'Aadhaar',
    issuer: 'UIDAI (12 Digits)',
    placeholder: 'e.g. 5432 9876 1234',
    hint: 'Enter 12-digit Aadhaar UID number',
    icon: ShieldCheck,
  },
  {
    type: 'PAN',
    title: 'PAN Card',
    shortLabel: 'PAN',
    issuer: 'Income Tax (10 Chars)',
    placeholder: 'e.g. ABCDE1234F',
    hint: 'Format: 5 letters, 4 digits, 1 letter',
    icon: CreditCard,
  },
  {
    type: 'PASSPORT',
    title: 'Passport',
    shortLabel: 'Passport',
    issuer: 'Govt. of India',
    placeholder: 'e.g. A1234567',
    hint: 'Starts with a letter followed by 7 digits',
    icon: Globe,
  },
  {
    type: 'DRIVING_LICENSE',
    title: 'Driving License',
    shortLabel: 'Driving Lic.',
    issuer: 'State Transport RTO',
    placeholder: 'e.g. DL-1420110012345',
    hint: 'Minimum 10 alphanumeric characters',
    icon: Car,
  },
  {
    type: 'VOTER_ID',
    title: 'Voter ID (EPIC)',
    shortLabel: 'Voter ID',
    issuer: 'Election Commission',
    placeholder: 'e.g. ABC1234567',
    hint: 'Format: 3 letters followed by 7 digits',
    icon: FileCheck2,
  },
];

/**
 * Validate document ID format based on standard Indian government KYC specifications.
 */
function validateDocumentFormat(type: KycDocumentType, rawValue: string): string | null {
  const clean = rawValue.replace(/\s+/g, '').trim().toUpperCase();
  if (!clean) return 'Document ID number is required.';

  switch (type) {
    case 'AADHAAR': {
      const digits = clean.replace(/\D/g, '');
      if (digits.length !== 12) {
        return `Aadhaar must contain exactly 12 digits (currently ${digits.length}).`;
      }
      if (/^0|^1/.test(digits)) {
        return 'Aadhaar numbers standardly do not start with 0 or 1.';
      }
      return null;
    }
    case 'PAN': {
      if (clean.length !== 10) {
        return `PAN must contain exactly 10 characters (currently ${clean.length}).`;
      }
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(clean)) {
        return 'PAN format should be 5 letters, 4 numbers, 1 letter (e.g. ABCDE1234F).';
      }
      return null;
    }
    case 'PASSPORT': {
      if (clean.length < 8) {
        return `Passport number must be at least 8 characters (currently ${clean.length}).`;
      }
      if (!/^[A-Z][0-9]{7}$/.test(clean)) {
        return 'Passport standardly starts with a letter followed by 7 digits (e.g. A1234567).';
      }
      return null;
    }
    case 'VOTER_ID': {
      if (clean.length !== 10) {
        return `Voter ID (EPIC) must contain 10 characters (currently ${clean.length}).`;
      }
      if (!/^[A-Z]{3}[0-9]{7}$/.test(clean)) {
        return 'Voter ID standardly consists of 3 letters followed by 7 digits (e.g. ABC1234567).';
      }
      return null;
    }
    case 'DRIVING_LICENSE': {
      const chars = clean.replace(/[^A-Z0-9]/g, '');
      if (chars.length < 10) {
        return `Driving License must be at least 10 characters (currently ${chars.length}).`;
      }
      return null;
    }
    default:
      return null;
  }
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LockerKycPanel({
  customerId,
  customerName = 'Customer',
  customerCode = '',
  documents,
  loading,
  failed,
  onRetry,
}: LockerKycPanelProps) {
  const queryClient = useQueryClient();
  const canManage = usePermission('customers.kyc.manage');
  const fileInputId = useId();

  // Active Selected Type Box for Upload
  const [selectedType, setSelectedType] = useState<KycDocumentType>('AADHAAR');
  const [number, setNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState<CustomerKycDocument | null>(null);

  // Status & UI State
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null);

  // Preview Modal State
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    url: string;
    documentName?: string;
    mimeType?: string;
    documentNumber?: string;
    documentType?: string;
    fileSize?: number;
  } | null>(null);

  // Cleanup object URLs on unmount or change
  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    };
  }, [filePreviewUrl]);

  // Handle local file selection with instant thumbnail preview
  const handleFileSelect = (selected: File | null) => {
    setError('');
    if (!selected) {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
      setFile(null);
      setFilePreviewUrl(null);
      return;
    }

    if (selected.size > 5 * 1024 * 1024) {
      setError('File exceeds 5 MB upload limit. Please choose a compressed file.');
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(selected.type)) {
      setError('Invalid format. Only JPG, PNG, WebP or PDF documents are permitted.');
      return;
    }

    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setFile(selected);

    if (selected.type.startsWith('image/')) {
      setFilePreviewUrl(URL.createObjectURL(selected));
    } else {
      setFilePreviewUrl(null);
    }
  };

  // Inspect uploaded document via DocumentPreviewModal
  const handleInspectDocument = async (doc: CustomerKycDocument) => {
    setError('');
    try {
      let resolvedUrl = doc.documentUrl;
      if (resolvedUrl.startsWith('/uploads/kyc/')) {
        const resource = `/upload/private/${resolvedUrl.split('/').pop()}`;
        const response = await apiClient.get(resource, { responseType: 'blob' });
        resolvedUrl = URL.createObjectURL(response.data);
      } else if (resolvedUrl.startsWith('/api/')) {
        const resource = resolvedUrl.slice(4);
        const response = await apiClient.get(resource, { responseType: 'blob' });
        resolvedUrl = URL.createObjectURL(response.data);
      }

      setPreviewModal({
        isOpen: true,
        url: resolvedUrl,
        documentName: doc.documentName || `${doc.documentType} Document`,
        mimeType: doc.mimeType,
        documentNumber: doc.documentNumber,
        documentType: doc.documentType,
        fileSize: doc.fileSize,
      });
    } catch {
      setError('Could not load document preview. Please check permissions or network connectivity.');
    }
  };

  // Inspect pre-upload file before saving
  const handlePreviewLocalFile = () => {
    if (!file) return;
    const url = filePreviewUrl || URL.createObjectURL(file);
    setPreviewModal({
      isOpen: true,
      url,
      documentName: file.name,
      mimeType: file.type,
      documentNumber: number || 'Pre-upload Document',
      documentType: selectedType,
      fileSize: file.size,
    });
  };

  // Copy document number
  const handleCopyNumber = (id: string, num: string) => {
    navigator.clipboard.writeText(num.replace(/\s+/g, ''));
    setCopiedDocId(id);
    setTimeout(() => setCopiedDocId(null), 2000);
  };

  // Switch to replacement mode for an existing document
  const handleStartReplace = (doc: CustomerKycDocument) => {
    setEditing(doc);
    setSelectedType(doc.documentType);
    setNumber('');
    setFile(null);
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setFilePreviewUrl(null);
    setError('');
    setNotice('');
  };

  const handleCancelReplace = () => {
    setEditing(null);
    setNumber('');
    setFile(null);
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setFilePreviewUrl(null);
    setError('');
  };

  // Select box to upload
  const handleSelectBox = (boxType: KycDocumentType) => {
    if (editing) {
      setEditing(null);
    }
    setSelectedType(boxType);
    setNumber('');
    setFile(null);
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setFilePreviewUrl(null);
    setError('');
    setNotice('');
  };

  // Submit KYC Document Upload
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || busy) return;
    setError('');
    setNotice('');

    try {
      if (!file) {
        throw new Error('Please select an ID proof document (scan or photo) to upload.');
      }

      if (!number.trim()) {
        throw new Error('Please enter the ID document number.');
      }

      const formatErr = validateDocumentFormat(selectedType, number);
      if (formatErr) {
        throw new Error(formatErr);
      }

      setBusy(true);

      // Upload file to secure vault storage
      const uploadedDoc = await customerApi.uploadFile(file, 'kyc');

      const inputPayload = {
        documentType: selectedType,
        documentNumber: number.trim(),
        documentUrl: uploadedDoc.fileUrl,
        documentName: uploadedDoc.fileName,
        mimeType: file.type,
        fileSize: uploadedDoc.size,
      };

      if (editing) {
        await customerApi.updateKycDocument(customerId, editing._id, inputPayload);
      } else {
        await customerApi.addKycDocument(customerId, {
          ...inputPayload,
          isPrimary: documents.length === 0,
        });
      }

      // Reset
      setFile(null);
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
      setNumber('');
      setEditing(null);

      setNotice(
        editing
          ? 'KYC document updated successfully. Pending verification.'
          : `${activeConfig.title} uploaded successfully. Pending verification.`
      );
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to save KYC documentation.');
    } finally {
      await Promise.all([
        'customer-kyc',
        'locker-allocations',
        'lockers',
        'locker-stats',
        'customers',
        'customer',
        'customer-stats',
      ].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      setBusy(false);
    }
  };

  if (!customerId) {
    return (
      <div className="p-8 text-center rounded-2xl bg-slate-50 border border-slate-200 text-slate-500">
        <ShieldAlert className="w-10 h-10 text-slate-400 mx-auto mb-2" />
        <h4 className="font-semibold text-slate-700">Locker Not Allocated</h4>
        <p className="text-xs text-slate-500 mt-1">
          Please assign this locker to a tenant customer before managing KYC records.
        </p>
      </div>
    );
  }

  const activeConfig =
    KYC_BOXES.find((b) => b.type === selectedType) || KYC_BOXES[0];
  const activeExistingDoc = documents.find((d) => d.documentType === selectedType);
  const isReplacingCurrent = editing && editing.documentType === selectedType;

  return (
    <div className="space-y-4 font-sans animate-in fade-in-50 duration-200">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-100">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            KYC & ID Documents
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Select a document box below to upload, view or replace customer identity proofs.
          </p>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-semibold text-slate-500">
            {documents.length > 0 ? (
              <span className="text-emerald-700 font-bold">
                ✓ {documents.length} Document{documents.length > 1 ? 's' : ''} on record
              </span>
            ) : (
              <span className="text-amber-700 font-medium">No document uploaded yet</span>
            )}
          </span>
        </div>
      </div>

      {/* 2. Feedback Alerts */}
      {notice && (
        <div
          role="status"
          className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between gap-2 shadow-2xs"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {notice}
          </span>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between gap-2 shadow-2xs"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            {error}
          </span>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-rose-700 hover:text-rose-900 cursor-pointer p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading & Failed States */}
      {loading && (
        <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-700 mx-auto mb-2" />
          <p className="text-xs font-medium">Loading verified documents from vault ledger...</p>
        </div>
      )}

      {failed && (
        <div className="p-6 text-center text-rose-700 bg-rose-50 rounded-2xl border border-rose-200">
          <AlertCircle className="w-6 h-6 text-rose-600 mx-auto mb-2" />
          <p className="text-xs font-semibold">Failed to retrieve KYC records for this customer.</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* 3. Document Boxes Grid (Replaces dropdown) */}
      {!loading && !failed && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">
              Identity Document Boxes
            </label>
            <span className="text-[11px] text-slate-500">
              Click any box to upload or preview
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {KYC_BOXES.map((box) => {
              const BoxIcon = box.icon;
              const doc = documents.find((d) => d.documentType === box.type);
              const isUploaded = Boolean(doc);
              const isSelected = selectedType === box.type;
              const isEditingThis = editing?.documentType === box.type;

              return (
                <div
                  key={box.type}
                  onClick={() => handleSelectBox(box.type)}
                  className={`relative p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                    isUploaded
                      ? isSelected
                        ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-emerald-200/90 bg-emerald-50/20 hover:border-emerald-400 hover:bg-emerald-50/40'
                      : isSelected
                      ? 'border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
                  }`}
                >
                  {/* Top: Icon + Status Pill */}
                  <div className="flex items-start justify-between gap-1.5 mb-2">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                        isUploaded
                          ? 'bg-emerald-100/80 border-emerald-300 text-emerald-800'
                          : isSelected
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                          : 'bg-slate-100 border-slate-200 text-slate-600'
                      }`}
                    >
                      <BoxIcon className="w-4 h-4" />
                    </div>

                    {isUploaded ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                        <Check className="w-2.5 h-2.5" />
                        Uploaded
                      </span>
                    ) : isSelected ? (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                        Active
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                        Pending
                      </span>
                    )}
                  </div>

                  {/* Middle: Title & Format */}
                  <div className="space-y-0.5 min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate">
                      {box.title}
                    </h4>
                    <p className="text-[10px] text-slate-500 truncate">
                      {box.issuer}
                    </p>

                    {/* Masked Doc Number if uploaded */}
                    {doc && (
                      <div className="flex items-center gap-1 pt-1">
                        <span className="text-[11px] font-mono font-semibold text-slate-800 truncate">
                          {doc.maskedDocumentNumber || doc.documentNumber}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyNumber(doc._id, doc.documentNumber);
                          }}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                          title="Copy ID number"
                        >
                          {copiedDocId === doc._id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Bottom: Action Buttons if uploaded */}
                  {doc && (
                    <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-emerald-100/80">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInspectDocument(doc);
                        }}
                        className="flex-1 py-1 px-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer shadow-2xs transition-colors"
                        title="Preview uploaded document"
                      >
                        <Eye className="w-3 h-3" />
                        Preview
                      </button>
                      {canManage && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartReplace(doc);
                          }}
                          className="py-1 px-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          title="Replace this document"
                        >
                          <RefreshCw className="w-3 h-3 text-slate-500" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Bottom for non-uploaded: Simple upload trigger */}
                  {!doc && (
                    <div className="mt-2.5 pt-1.5 flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <Plus className="w-3 h-3" />
                      Upload
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Active Document Upload Box */}
      {canManage && !loading && !failed && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
          {/* Header of the Active Box */}
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <activeConfig.icon className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                  {isReplacingCurrent
                    ? `Replace ${activeConfig.title}`
                    : `Upload ${activeConfig.title}`}
                </h4>
                <p className="text-[10.5px] text-slate-500">
                  {isReplacingCurrent
                    ? 'Upload a new scan. The previous document will be replaced.'
                    : `${activeConfig.hint} • Scans accepted in PDF, JPG, PNG, WebP`}
                </p>
              </div>
            </div>

            {isReplacingCurrent && (
              <button
                type="button"
                onClick={handleCancelReplace}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer font-medium"
              >
                <X className="w-3.5 h-3.5" /> Cancel Replace
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
            {/* Field 1: Document Number Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {activeConfig.title} Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={number}
                onChange={(e) => {
                  setNumber(e.target.value.toUpperCase());
                  setError('');
                }}
                disabled={busy}
                placeholder={activeConfig.placeholder}
                className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-mono font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all"
              />
              <span className="text-[10.5px] text-slate-500 mt-1 block">
                {activeConfig.hint}
              </span>
            </div>

            {/* Field 2: Scanned File Drag & Drop Box with Instant Preview */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Upload Scanned Document / Photo <span className="text-rose-500">*</span>
              </label>

              <input
                id={fileInputId}
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                className="hidden"
              />

              {!file ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files?.[0]) {
                      handleFileSelect(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => document.getElementById(fileInputId)?.click()}
                  className={`p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
                    dragOver
                      ? 'border-emerald-600 bg-emerald-50'
                      : 'border-slate-300 hover:border-emerald-500 bg-slate-50/60 hover:bg-emerald-50/20'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2 shadow-2xs">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">
                    Click to browse or drag & drop {activeConfig.shortLabel} scan
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Clear front scan or photo • PDF, JPG, PNG, WebP up to 5 MB
                  </p>
                </div>
              ) : (
                /* Selected File Preview Box */
                <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Thumbnail preview or PDF icon */}
                    {filePreviewUrl ? (
                      <img
                        src={filePreviewUrl}
                        alt="Preview"
                        onClick={handlePreviewLocalFile}
                        className="w-12 h-12 rounded-lg object-cover border border-emerald-300 shadow-2xs cursor-pointer hover:opacity-85 transition-opacity shrink-0"
                        title="Click to preview full size"
                      />
                    ) : (
                      <div
                        onClick={handlePreviewLocalFile}
                        className="w-12 h-12 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 flex flex-col items-center justify-center shrink-0 cursor-pointer shadow-2xs hover:bg-emerald-200 transition-colors"
                        title="Click to preview PDF"
                      >
                        <FileText className="w-5 h-5" />
                        <span className="text-[9px] font-bold uppercase mt-0.5">PDF</span>
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 truncate max-w-[200px]">
                          {file.name}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {formatBytes(file.size)}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800 mt-0.5 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        Ready to upload • Click preview to inspect
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handlePreviewLocalFile}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-900 text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                      title="Inspect document full screen"
                    >
                      <Eye className="w-3.5 h-3.5 text-emerald-700" />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFileSelect(null)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-500 hover:text-rose-700 cursor-pointer transition-colors"
                      title="Remove selected file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              {isReplacingCurrent && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleCancelReplace}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              )}

              <button
                type="submit"
                disabled={busy || !file}
                className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading to Vault...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>
                      {isReplacingCurrent
                        ? `Save & Replace ${activeConfig.shortLabel}`
                        : `Save & Upload ${activeConfig.shortLabel}`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 5. Rich Document Inspection & Preview Modal */}
      {previewModal && (
        <DocumentPreviewModal
          isOpen={previewModal.isOpen}
          onClose={() => setPreviewModal(null)}
          documentUrl={previewModal.url}
          documentName={previewModal.documentName}
          mimeType={previewModal.mimeType}
          customerName={customerName}
          customerCode={customerCode}
          documentNumber={previewModal.documentNumber}
          documentType={previewModal.documentType}
          fileSize={previewModal.fileSize}
        />
      )}
    </div>
  );
}
