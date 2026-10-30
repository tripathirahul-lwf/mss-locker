import React, { useEffect, useState, useRef, useId } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Upload,
  Eye,
  RefreshCw,
  X,
  ShieldCheck,
  ShieldAlert,
  Shield,
  FileText,
  CreditCard,
  Globe,
  Car,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Camera,
  FileCheck2,
  FileUp,
  User,
  Sparkles,
  Info,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { customerApi } from '../../customers/api/customerApi';
import { CustomerKycDocument, KycDocumentType } from '../../customers/types';
import { apiClient } from '../../../services/apiClient';
import { usePermission } from '../../../hooks/usePermission';
import { DocumentPreviewModal } from '../../customers/components/DocumentPreviewModal';
import { CustomerPhotoPreviewModal } from '../../customers/components/CustomerPhotoPreviewModal';
import { KYC_DOCUMENT_TYPES, KYC_VERIFICATION_CONFIG } from '../../customers/constants';

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
        return `Passport number must be 8 characters (currently ${clean.length}).`;
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
    case 'OTHER': {
      if (clean.length < 3) {
        return 'Document identifier must be at least 3 characters.';
      }
      return null;
    }
    default:
      return null;
  }
}

function getDocumentTypeIcon(type: KycDocumentType) {
  switch (type) {
    case 'AADHAAR':
      return ShieldCheck;
    case 'PAN':
      return CreditCard;
    case 'PASSPORT':
      return Globe;
    case 'DRIVING_LICENSE':
      return Car;
    case 'VOTER_ID':
      return FileCheck2;
    default:
      return FileText;
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
  customerPhone = '',
  photoUrl,
  kycStatus,
  documents,
  loading,
  failed,
  onRetry,
}: LockerKycPanelProps) {
  const queryClient = useQueryClient();
  const canManage = usePermission('customers.kyc.manage');
  const canUpdatePhoto = usePermission('customers.update');

  const docInputId = useId();
  const photoInputId = useId();

  // Form State
  const [type, setType] = useState<KycDocumentType>('AADHAAR');
  const [number, setNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState<CustomerKycDocument | null>(null);

  // Status & UI State
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dragOverDoc, setDragOverDoc] = useState(false);
  const [dragOverPhoto, setDragOverPhoto] = useState(false);
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Modals for Rich Inspection / Preview
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
    mimeType?: string;
    documentNumber?: string;
    documentType?: string;
    fileSize?: number;
  } | null>(null);

  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedLocalPhotoPreview, setSelectedLocalPhotoPreview] = useState<string | null>(null);

  // Cleanup object URLs on change and unmount
  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [filePreviewUrl, photoPreviewUrl]);

  // Handle local file selection with pre-upload instant preview
  const handleDocFileSelect = (selected: File | null) => {
    setError('');
    if (!selected) {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
      setFile(null);
      setFilePreviewUrl(null);
      return;
    }

    if (selected.size > 5 * 1024 * 1024) {
      setError('File exceeds 5 MB upload limit. Please select a compressed file.');
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

  const handlePhotoSelect = (selected: File | null) => {
    setError('');
    if (!selected) {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
      setPhoto(null);
      setPhotoPreviewUrl(null);
      return;
    }

    if (selected.size > 5 * 1024 * 1024) {
      setError('Photo exceeds 5 MB upload limit.');
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(selected.type)) {
      setError('Customer photo must be an image (JPEG, PNG, or WebP).');
      return;
    }

    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhoto(selected);
    setPhotoPreviewUrl(URL.createObjectURL(selected));
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
        title: doc.documentName || `${doc.documentType} Document`,
        mimeType: doc.mimeType,
        documentNumber: doc.documentNumber,
        documentType: doc.documentType,
        fileSize: doc.fileSize,
      });
    } catch {
      setError('Could not load document preview. Please check permissions or network connectivity.');
    }
  };

  // Inspect local pre-upload document file
  const handlePreviewLocalFile = () => {
    if (!file) return;
    const url = filePreviewUrl || URL.createObjectURL(file);
    setPreviewModal({
      isOpen: true,
      url,
      title: file.name,
      mimeType: file.type,
      documentNumber: number || 'Pre-upload Document',
      documentType: type,
      fileSize: file.size,
    });
  };

  // Copy document number to clipboard
  const handleCopyNumber = (id: string, num: string) => {
    navigator.clipboard.writeText(num.replace(/\s+/g, ''));
    setCopiedDocId(id);
    setTimeout(() => setCopiedDocId(null), 2000);
  };

  // Switch to replacement mode for an existing document
  const handleStartReplace = (doc: CustomerKycDocument) => {
    setEditing(doc);
    setType(doc.documentType);
    setNumber('');
    setFile(null);
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setFilePreviewUrl(null);
    setError('');
    setNotice('');
    setIsFormOpen(true);
  };

  const handleCancelReplace = () => {
    setEditing(null);
    setNumber('');
    setFile(null);
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setFilePreviewUrl(null);
    setError('');
  };

  // Form submission: uploads and synchronizes with customerApi
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || busy) return;
    setError('');
    setNotice('');

    try {
      if (!file && !photo && !editing) {
        throw new Error('Please select an ID proof document or customer photo to upload.');
      }

      // Validate ID number format
      if ((file || editing) && !editing) {
        if (!number.trim()) {
          throw new Error('Please enter the ID number for this document.');
        }
        const formatErr = validateDocumentFormat(type, number);
        if (formatErr) {
          throw new Error(formatErr);
        }
      }

      setBusy(true);

      // 1. Upload photo if chosen
      if (photo) {
        const uploadedPhoto = await customerApi.uploadFile(photo, 'kyc');
        await customerApi.updateCustomer(customerId, { photoUrl: uploadedPhoto.fileUrl });
      }

      // 2. Upload document and link to customer
      if (file || editing) {
        let uploadedDoc;
        if (file) {
          uploadedDoc = await customerApi.uploadFile(file, 'kyc');
        }

        const inputPayload = {
          documentType: type,
          ...(number.trim() ? { documentNumber: number.trim() } : {}),
          ...(uploadedDoc
            ? {
                documentUrl: uploadedDoc.fileUrl,
                documentName: uploadedDoc.fileName,
                mimeType: file!.type,
                fileSize: uploadedDoc.size,
              }
            : {}),
        };

        if (editing) {
          await customerApi.updateKycDocument(customerId, editing._id, inputPayload);
        } else {
          await customerApi.addKycDocument(customerId, {
            ...inputPayload,
            documentNumber: number.trim(),
            documentUrl: uploadedDoc!.fileUrl,
            isPrimary: documents.length === 0,
          });
        }
      }

      // Reset form
      setFile(null);
      setPhoto(null);
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
      setFilePreviewUrl(null);
      setPhotoPreviewUrl(null);
      setNumber('');
      setEditing(null);
      setIsFormOpen(false);

      setNotice(
        editing
          ? 'KYC document updated successfully. Pending branch verification.'
          : 'KYC document saved successfully. Pending verification.'
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

  const isVerified = kycStatus === 'VERIFIED';
  const hasDocuments = documents.length > 0;

  return (
    <div className="space-y-4 font-sans animate-in fade-in-50 duration-200">
      {/* 1. Header & Tenant KYC Compliance Dossier Strip */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar with click-to-preview */}
          <div className="relative group shrink-0">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={customerName}
                onClick={() => setPhotoModalOpen(true)}
                className="w-12 h-12 rounded-xl object-cover border-2 border-emerald-600 shadow-xs cursor-pointer group-hover:opacity-85 transition-opacity"
              />
            ) : (
              <div
                onClick={() => setPhotoModalOpen(true)}
                className="w-12 h-12 rounded-xl bg-emerald-50 border-2 border-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-sm cursor-pointer shadow-xs"
              >
                {customerName.slice(0, 2).toUpperCase()}
              </div>
            )}
            {photoUrl && (
              <button
                type="button"
                onClick={() => setPhotoModalOpen(true)}
                className="absolute inset-0 bg-slate-950/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer text-white"
                title="View customer photo"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {customerName}
              </h3>
              {customerCode && (
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                  {customerCode}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 flex-wrap">
              {customerPhone && <span>Mob: {customerPhone}</span>}
              <span>•</span>
              <span
                className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-[10.5px] border ${
                  isVerified
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : hasDocuments
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {isVerified ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Branch Verified KYC
                  </>
                ) : hasDocuments ? (
                  <>
                    <Shield className="w-3 h-3 text-amber-600" />
                    Pending Branch Approval
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3 h-3 text-rose-600" />
                    No ID Proof Uploaded
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Button for Photo */}
        <div className="flex items-center gap-2 shrink-0">
          {photoUrl && (
            <button
              type="button"
              onClick={() => setPhotoModalOpen(true)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              View Photo
            </button>
          )}

          {canManage && !isFormOpen && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setNumber('');
                setFile(null);
                setIsFormOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <FileUp className="w-3.5 h-3.5" />
              Add KYC Document
            </button>
          )}
        </div>
      </div>

      {/* Notice / Alerts */}
      {notice && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between gap-2 shadow-2xs"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {notice}
          </span>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between gap-2 shadow-2xs"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            {error}
          </span>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-rose-700 hover:text-rose-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading & Failed States */}
      {loading && (
        <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-700 mx-auto mb-2" />
          <p className="text-xs font-medium">Fetching verified KYC documents from vault ledger...</p>
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

      {/* 2. Uploaded Documents List */}
      {!loading && !failed && documents.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              Verified Identity Documents On Record ({documents.length})
            </h4>
            <span className="text-[11px] text-slate-500 font-medium">
              Statutory Vault Regulation Compliance
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {documents.map((doc) => {
              const DocIcon = getDocumentTypeIcon(doc.documentType);
              const isVerifiedDoc = doc.verificationStatus === 'VERIFIED';
              const isPending = doc.verificationStatus === 'PENDING';
              const isRejected = doc.verificationStatus === 'REJECTED';
              const isPdf =
                doc.mimeType?.includes('pdf') ||
                doc.documentUrl?.toLowerCase().includes('.pdf') ||
                doc.documentName?.toLowerCase().endsWith('.pdf');

              return (
                <div
                  key={doc._id}
                  className={`p-3.5 sm:p-4 rounded-2xl bg-white border transition-all shadow-2xs hover:shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    editing?._id === doc._id
                      ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                        isVerifiedDoc
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : isPending
                          ? 'bg-amber-50 border-amber-200 text-amber-700'
                          : 'bg-rose-50 border-rose-200 text-rose-700'
                      }`}
                    >
                      <DocIcon className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-slate-900">
                          {doc.documentType.replace(/_/g, ' ')}
                        </span>
                        {doc.isPrimary && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            Primary
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isVerifiedDoc
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : isPending
                              ? 'bg-amber-50 border-amber-200 text-amber-800'
                              : 'bg-rose-50 border-rose-200 text-rose-800'
                          }`}
                        >
                          {isVerifiedDoc
                            ? '✓ Verified'
                            : isPending
                            ? 'Pending Verification'
                            : 'Rejected'}
                        </span>
                      </div>

                      {/* Document ID Number with 1-click copy */}
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="text-xs font-mono font-semibold text-slate-700">
                          {doc.maskedDocumentNumber || doc.documentNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyNumber(doc._id, doc.documentNumber)}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5 transition-colors"
                          title="Copy ID number"
                        >
                          {copiedDocId === doc._id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {/* File Metadata */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-0.5 flex-wrap">
                        <span className="truncate max-w-[200px]" title={doc.documentName}>
                          {doc.documentName || 'Scanned ID Proof'}
                        </span>
                        {doc.fileSize ? <span>• {formatBytes(doc.fileSize)}</span> : null}
                        <span>•</span>
                        <span className="font-semibold text-slate-600">
                          {isPdf ? 'PDF' : 'IMAGE'}
                        </span>
                        {doc.createdAt && (
                          <>
                            <span>•</span>
                            <span>
                              {new Date(doc.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions for Document */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleInspectDocument(doc)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 text-slate-800 hover:text-emerald-900 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5 text-emerald-700" />
                      Preview Document
                    </button>

                    {canManage && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleStartReplace(doc)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                        Replace
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Empty State Notice when no documents uploaded */}
      {!loading && !failed && documents.length === 0 && !isFormOpen && (
        <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200/90 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-amber-950">
                No ID Proof Uploaded Yet
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Bank vault regulations mandate at least one verified government ID (Aadhaar, PAN,
                Passport, DL) on file for active locker tenancy.
              </p>
            </div>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
            >
              <Upload className="w-4 h-4" />
              Upload Now
            </button>
          )}
        </div>
      )}

      {/* 4. Enhanced Bank-Grade KYC Upload & Document Replacement Form */}
      {canManage && (isFormOpen || documents.length === 0) && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <FileUp className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                  {editing
                    ? `Replace ${editing.documentType.replace(/_/g, ' ')} Document`
                    : 'Upload Customer KYC Documents'}
                </h4>
                <p className="text-[11px] text-slate-500">
                  {editing
                    ? 'Upload a replacement scan/photo. Existing file will be safely archived.'
                    : 'Aadhaar, PAN, Passport, or DL scans accepted (JPEG, PNG, WebP, PDF up to 5 MB)'}
                </p>
              </div>
            </div>

            {editing && (
              <button
                type="button"
                onClick={handleCancelReplace}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer font-medium"
              >
                <X className="w-3.5 h-3.5" /> Cancel Replace
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Field 1: ID Document Type Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Government ID Type <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value as KycDocumentType);
                      setError('');
                    }}
                    disabled={busy}
                    className="w-full h-10 px-3.5 pr-8 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all cursor-pointer"
                  >
                    {KYC_DOCUMENT_TYPES.map((docType) => (
                      <option key={docType.type} value={docType.type}>
                        {docType.label}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-[10.5px] text-slate-500 mt-1 block">
                  {type === 'AADHAAR' && 'UIDAI 12-digit biometric identity card'}
                  {type === 'PAN' && 'Income Tax Dept 10-character alphanumeric PAN card'}
                  {type === 'PASSPORT' && 'Republic of India Passport (8 alphanumeric characters)'}
                  {type === 'VOTER_ID' && 'Election Commission of India EPIC identity card'}
                  {type === 'DRIVING_LICENSE' && 'State Transport Authority Motor Driving License'}
                  {type === 'OTHER' && 'Other official proof of identification'}
                </span>
              </div>

              {/* Field 2: ID Number Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Document ID Number{' '}
                  {editing ? (
                    <span className="text-slate-400 font-normal">(optional to keep current)</span>
                  ) : (
                    <span className="text-rose-500">*</span>
                  )}
                </label>
                <input
                  type="text"
                  value={number}
                  onChange={(e) => {
                    setNumber(e.target.value);
                    setError('');
                  }}
                  disabled={busy}
                  placeholder={
                    editing
                      ? 'Leave blank to preserve existing number'
                      : type === 'AADHAAR'
                      ? 'e.g. 5432 9876 1234'
                      : type === 'PAN'
                      ? 'e.g. ABCDE1234F'
                      : 'Enter document number'
                  }
                  className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-mono font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all placeholder:font-sans placeholder:text-slate-400"
                />
                <span className="text-[10.5px] text-slate-500 mt-1 block">
                  {type === 'AADHAAR' && 'Format: 12-digit Aadhaar number'}
                  {type === 'PAN' && 'Format: 5 letters, 4 numbers, 1 letter'}
                  {type === 'PASSPORT' && 'Format: 1 letter followed by 7 digits'}
                  {type === 'VOTER_ID' && 'Format: 3 letters followed by 7 digits'}
                </span>
              </div>
            </div>

            {/* Field 3: Interactive File Upload Drag & Drop Zone */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Upload Scanned Document / Photo{' '}
                  {editing ? (
                    <span className="text-slate-400 font-normal">(optional)</span>
                  ) : (
                    <span className="text-rose-500">*</span>
                  )}
                </label>
                {file && (
                  <button
                    type="button"
                    onClick={handlePreviewLocalFile}
                    className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" /> Quick Preview
                  </button>
                )}
              </div>

              {!file ? (
                /* Empty Upload Dropzone */
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverDoc(true);
                  }}
                  onDragLeave={() => setDragOverDoc(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverDoc(false);
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped) handleDocFileSelect(dropped);
                  }}
                  className={`relative p-5 sm:p-6 rounded-2xl border-2 border-dashed transition-all text-center flex flex-col items-center justify-center cursor-pointer ${
                    dragOverDoc
                      ? 'border-emerald-600 bg-emerald-50/50 scale-[0.99]'
                      : 'border-slate-300 hover:border-emerald-600 hover:bg-slate-50/70 bg-slate-50/30'
                  }`}
                  onClick={() => document.getElementById(docInputId)?.click()}
                >
                  <input
                    id={docInputId}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={(e) => handleDocFileSelect(e.target.files?.[0] || null)}
                  />
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center mb-2 shadow-2xs">
                    <FileUp className="w-6 h-6" />
                  </div>
                  <h5 className="text-xs sm:text-sm font-bold text-slate-800">
                    Click to browse or drag & drop document
                  </h5>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Clear front & back scans accepted • Max file size: 5 MB
                  </p>
                  <div className="flex items-center gap-1.5 mt-2.5">
                    {['PDF', 'JPG', 'PNG', 'WEBP'].map((fmt) => (
                      <span
                        key={fmt}
                        className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700"
                      >
                        {fmt}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                /* Selected File Pre-Upload Card with Live Preview */
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-emerald-300 shadow-2xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Thumbnail preview if image, or PDF badge */}
                    {filePreviewUrl ? (
                      <div
                        onClick={handlePreviewLocalFile}
                        className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-200 shrink-0 group cursor-pointer shadow-xs"
                      >
                        <img
                          src={filePreviewUrl}
                          alt="Pre-upload document preview"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                          <Eye className="w-4 h-4" />
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={handlePreviewLocalFile}
                        className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex flex-col items-center justify-center shrink-0 cursor-pointer shadow-xs"
                      >
                        <FileText className="w-5 h-5" />
                        <span className="text-[8.5px] font-bold">PDF</span>
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[240px]">
                          {file.name}
                        </p>
                        <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Ready to upload
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {formatBytes(file.size)} • {file.type.toUpperCase() || 'DOCUMENT'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handlePreviewLocalFile}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDocFileSelect(null)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                      title="Remove file and choose another"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Field 4: Customer Profile Photo Upload (Optional) */}
            {canUpdatePhoto && (
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-emerald-700" />
                    Customer Facial Portrait Photo{' '}
                    <span className="text-slate-400 font-normal">(optional profile photo)</span>
                  </label>
                  {photo && (
                    <button
                      type="button"
                      onClick={() => {
                        if (photoPreviewUrl) {
                          setSelectedLocalPhotoPreview(photoPreviewUrl);
                        }
                      }}
                      className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> Preview Photo
                    </button>
                  )}
                </div>

                {!photo ? (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverPhoto(true);
                    }}
                    onDragLeave={() => setDragOverPhoto(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverPhoto(false);
                      const dropped = e.dataTransfer.files?.[0];
                      if (dropped) handlePhotoSelect(dropped);
                    }}
                    onClick={() => document.getElementById(photoInputId)?.click()}
                    className={`p-3.5 rounded-xl border border-dashed text-center flex items-center justify-between gap-3 cursor-pointer transition-all ${
                      dragOverPhoto
                        ? 'border-emerald-600 bg-emerald-50/50'
                        : 'border-slate-300 hover:border-slate-400 bg-slate-50/40'
                    }`}
                  >
                    <input
                      id={photoInputId}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handlePhotoSelect(e.target.files?.[0] || null)}
                    />
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center">
                        <Camera className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <span className="text-xs font-semibold text-slate-800 block">
                          {photoUrl ? 'Click to change customer portrait' : 'Upload customer portrait'}
                        </span>
                        <span className="text-[10.5px] text-slate-500">
                          Clear passport-style headshot (JPG, PNG, WebP)
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-emerald-800 hover:underline">
                      Choose Photo
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-50 border border-emerald-300 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {photoPreviewUrl && (
                        <img
                          src={photoPreviewUrl}
                          alt="New portrait preview"
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                        />
                      )}
                      <div>
                        <p className="text-xs font-bold text-slate-800 truncate max-w-[200px]">
                          {photo.name}
                        </p>
                        <p className="text-[10.5px] text-slate-500">
                          {formatBytes(photo.size)} • New portrait selected
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePhotoSelect(null)}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-600"
                      title="Clear photo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Form Action Controls */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              {editing && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleCancelReplace}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              )}

              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving KYC Documentation...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    {editing ? 'Save Replacement Document' : 'Save & Submit KYC'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 5. Rich Document Inspection & Preview Modal (DocumentPreviewModal) */}
      {previewModal?.isOpen && (
        <DocumentPreviewModal
          isOpen={previewModal.isOpen}
          onClose={() => setPreviewModal(null)}
          documentUrl={previewModal.url}
          documentName={previewModal.title}
          documentType={previewModal.documentType}
          documentNumber={previewModal.documentNumber}
          customerName={customerName}
          customerCode={customerCode}
          mimeType={previewModal.mimeType}
          fileSize={previewModal.fileSize}
        />
      )}

      {/* 6. Customer Photo Inspection Modal (CustomerPhotoPreviewModal) */}
      {photoModalOpen && photoUrl && (
        <CustomerPhotoPreviewModal
          isOpen={photoModalOpen}
          onClose={() => setPhotoModalOpen(false)}
          photoUrl={photoUrl}
          customerName={customerName}
          customerCode={customerCode}
          phone={customerPhone}
        />
      )}

      {/* 7. Local Pre-Upload Photo Modal */}
      {selectedLocalPhotoPreview && (
        <CustomerPhotoPreviewModal
          isOpen={Boolean(selectedLocalPhotoPreview)}
          onClose={() => setSelectedLocalPhotoPreview(null)}
          photoUrl={selectedLocalPhotoPreview}
          customerName={customerName}
          customerCode={customerCode}
          phone={customerPhone}
        />
      )}
    </div>
  );
}
