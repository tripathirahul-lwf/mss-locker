import React, { useState, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  ShieldCheck,
  FileText,
  FileUp,
  Loader2,
  ChevronDown,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Info,
  Eye,
  RefreshCw,
  FileCheck2,
} from 'lucide-react';
import {
  CustomerKycDocument,
  AddKycDocumentInput,
  UpdateKycDocumentInput,
  KycDocumentType,
} from '../types';
import { KYC_DOCUMENT_TYPES } from '../constants';
import { customerApi } from '../api/customerApi';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { DocumentPreviewModal } from './DocumentPreviewModal';

interface KycDocumentModalProps {
  customerId: string;
  customerName?: string;
  customerCode?: string;
  document?: CustomerKycDocument | null;
  onClose: () => void;
  onSubmit: (data: AddKycDocumentInput | UpdateKycDocumentInput) => Promise<void>;
  isSubmitting: boolean;
}

/**
 * Validate document ID format based on standard Indian government KYC specifications.
 */
function validateDocumentFormat(type: KycDocumentType, rawValue: string): string | null {
  const clean = rawValue.replace(/\s+/g, '').trim().toUpperCase();
  if (!clean) {
    return 'Document ID number is required.';
  }

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
        return 'PAN must follow standard format: 5 letters, 4 numbers, 1 letter (e.g. ABCDE1234F).';
      }
      return null;
    }
    case 'PASSPORT': {
      if (clean.length < 8) {
        return `Passport number must be 8 characters (currently ${clean.length}).`;
      }
      if (!/^[A-Z][0-9]{7}$/.test(clean)) {
        return 'Passport should standardly start with a letter followed by 7 digits (e.g. A1234567).';
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

export function KycDocumentModal({
  customerId,
  customerName = '',
  customerCode = '',
  document,
  onClose,
  onSubmit,
  isSubmitting,
}: KycDocumentModalProps) {
  const isEdit = Boolean(document);
  const fileInputId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Fetch Customer context for clean header subtitle
  const { data: customer } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => customerApi.getCustomerById(customerId),
    enabled: Boolean(customerId),
    staleTime: 60_000,
  });

  const [documentType, setDocumentType] = useState<KycDocumentType>(
    document?.documentType || 'AADHAAR'
  );
  const [documentNumber, setDocumentNumber] = useState(
    document?.documentNumber || ''
  );
  const [documentUrl, setDocumentUrl] = useState(document?.documentUrl || '');
  const [documentName, setDocumentName] = useState(document?.documentName || '');
  const [mimeType, setMimeType] = useState(document?.mimeType || 'image/jpeg');
  const [fileSize, setFileSize] = useState(document?.fileSize || 0);
  const [expiryDate, setExpiryDate] = useState(document?.expiryDate?.split('T')[0] || '');
  const [remarks, setRemarks] = useState(document?.remarks || '');
  const [isPrimary, setIsPrimary] = useState(document?.isPrimary || false);

  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileSize, setUploadFileSize] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [temporaryUploads, setTemporaryUploads] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Document Preview State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);

  // Trap body scroll & handle keyboard navigation (ESC, Ctrl+Enter)
  useEffect(() => {
    const originalOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      // If preview lightbox is open, let it handle Esc
      if (isPreviewOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        temporaryUploads.forEach((url) => void customerApi.deleteUploadedFile(url));
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, temporaryUploads, isPreviewOpen]);

  // Clean and format document number as user types
  const handleDocumentNumberChange = (val: string) => {
    let formatted = val;
    if (documentType === 'AADHAAR') {
      const digits = val.replace(/\D/g, '').slice(0, 12);
      formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    } else if (documentType === 'PAN' || documentType === 'PASSPORT' || documentType === 'VOTER_ID') {
      formatted = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    } else if (documentType === 'DRIVING_LICENSE') {
      formatted = val.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20);
    }
    setDocumentNumber(formatted);

    // Clear documentNumber field error as user types
    if (fieldErrors.documentNumber) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.documentNumber;
        return next;
      });
    }
    if (error) setError(null);
  };

  const processUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors((prev) => ({
        ...prev,
        documentUrl: 'File size exceeds 5MB limit. Please upload a smaller file.',
      }));
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setFieldErrors((prev) => ({
        ...prev,
        documentUrl: 'Unsupported file type. Please upload a JPG, PNG, WebP image or PDF document.',
      }));
      return;
    }

    setError(null);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.documentUrl;
      return next;
    });

    setIsUploading(true);
    setUploadProgress(0);
    setUploadFileName(file.name);
    setUploadFileSize(file.size);

    try {
      const result = await customerApi.uploadFile(file, 'kyc', (progress) => {
        setUploadProgress(progress);
      });
      const previousTemporary = temporaryUploads.includes(documentUrl) ? documentUrl : undefined;
      setDocumentUrl(result.fileUrl);
      setThumbnailError(false);
      setTemporaryUploads((old) => [...old.filter((url) => url !== previousTemporary), result.fileUrl]);
      if (previousTemporary) void customerApi.deleteUploadedFile(previousTemporary);
      setDocumentName(result.fileName || file.name);
      setMimeType(file.type || 'application/octet-stream');
      setFileSize(result.size || file.size);
      setUploadProgress(100);
    } catch (err: any) {
      setFieldErrors((prev) => ({
        ...prev,
        documentUrl: err.response?.data?.message || 'Failed to upload document file. Please try again.',
      }));
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processUpload(file);
    e.target.value = ''; // Reset input to allow re-uploading identical filename if needed
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) processUpload(file);
  };

  const handleRemoveFile = () => {
    if (temporaryUploads.includes(documentUrl)) {
      void customerApi.deleteUploadedFile(documentUrl);
      setTemporaryUploads((old) => old.filter((u) => u !== documentUrl));
    }
    setDocumentUrl('');
    setDocumentName('');
    setFileSize(0);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.documentUrl;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const errors: Record<string, string> = {};

    // 1. Validate Document ID Format
    const docFormatError = validateDocumentFormat(documentType, documentNumber);
    if (docFormatError) {
      errors.documentNumber = docFormatError;
    }

    // 2. Validate Document Upload
    if (!documentUrl.trim()) {
      errors.documentUrl = 'Please upload the scanned document file (JPG, PNG or PDF).';
    }

    // 3. Validate Expiry Date (cannot be in past for active KYC)
    if (expiryDate) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (expiryDate < todayStr) {
        errors.expiryDate = 'Document expiry date cannot be in the past for active KYC verification.';
      }
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setError(`Please resolve the ${Object.keys(errors).length} highlighted validation error${Object.keys(errors).length > 1 ? 's' : ''}.`);
      window.requestAnimationFrame(() => {
        modalRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
      return;
    }

    try {
      await onSubmit({
        documentType,
        documentNumber: documentNumber.trim(),
        documentUrl: documentUrl.trim(),
        documentName: documentName.trim() || `${documentType} Copy`,
        mimeType,
        fileSize,
        expiryDate: expiryDate || undefined,
        remarks: remarks.trim(),
        isPrimary,
      });
      await Promise.all(
        temporaryUploads
          .filter((url) => url !== documentUrl)
          .map((url) => customerApi.deleteUploadedFile(url))
      );
      setTemporaryUploads([]);
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || 'Failed to save KYC document.'
      );
    }
  };

  // Live status badge calculation for Document Number
  const cleanDocNumber = documentNumber.replace(/\s+/g, '').trim().toUpperCase();
  const getDocumentStatusBadge = () => {
    if (!cleanDocNumber) return null;

    if (documentType === 'AADHAAR') {
      const digits = cleanDocNumber.replace(/\D/g, '');
      if (digits.length === 12 && !/^0|^1/.test(digits)) {
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            12/12 Digits Valid
          </span>
        );
      }
      return (
        <span className="inline-flex items-center text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          {digits.length}/12 Digits
        </span>
      );
    }

    if (documentType === 'PAN') {
      if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanDocNumber)) {
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Format Valid
          </span>
        );
      }
      return (
        <span className="inline-flex items-center text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          {cleanDocNumber.length}/10 Chars
        </span>
      );
    }

    if (documentType === 'PASSPORT') {
      if (/^[A-Z][0-9]{7}$/.test(cleanDocNumber)) {
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Format Valid
          </span>
        );
      }
      return (
        <span className="inline-flex items-center text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          {cleanDocNumber.length}/8 Chars
        </span>
      );
    }

    if (documentType === 'VOTER_ID') {
      if (/^[A-Z]{3}[0-9]{7}$/.test(cleanDocNumber)) {
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Format Valid
          </span>
        );
      }
      return (
        <span className="inline-flex items-center text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          {cleanDocNumber.length}/10 Chars
        </span>
      );
    }

    return null;
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isPdf =
    mimeType === 'application/pdf' ||
    documentUrl.toLowerCase().includes('.pdf') ||
    documentName.toLowerCase().endsWith('.pdf');

  const modalContent = (
    <div
      className="fixed inset-0 z-[120] w-screen h-screen flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-[2px] select-none animate-in fade-in-0 duration-150"
      onClick={() => {
        temporaryUploads.forEach((url) => void customerApi.deleteUploadedFile(url));
        onClose();
      }}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kyc-modal-title"
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:px-5 sm:py-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9.5 w-9.5 shrink-0 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 flex items-center justify-center shadow-2xs">
              <ShieldCheck className="w-5 h-5 text-emerald-800" />
            </div>
            <div>
              <h2 id="kyc-modal-title" className="text-base font-semibold text-slate-900 tracking-tight">
                {isEdit ? 'Update KYC Document' : 'Upload KYC Document'}
              </h2>
              <p className="text-[11.5px] text-slate-500 font-normal mt-0.5 truncate max-w-[280px] sm:max-w-md">
                {customer ? `${customer.fullName} • ${customer.customerCode}` : 'Customer ID proof verification'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              temporaryUploads.forEach((url) => void customerApi.deleteUploadedFile(url));
              onClose();
            }}
            className="grid h-8.5 w-8.5 shrink-0 place-items-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
            aria-label="Close KYC modal (ESC)"
            title="Press Esc to close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden" noValidate>
          <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 text-xs">
            {error && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2 font-normal text-xs animate-in fade-in-0 duration-150">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* 1. Document Type */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-800 text-xs block">
                Document Type <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={documentType}
                  onChange={(e) => {
                    const newType = e.target.value as KycDocumentType;
                    setDocumentType(newType);
                    setDocumentNumber('');
                    setFieldErrors({});
                    setError(null);
                  }}
                  className="w-full h-11 pl-4 pr-10 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 text-xs sm:text-[13px] focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 appearance-none cursor-pointer shadow-2xs transition-all hover:border-slate-400"
                >
                  {KYC_DOCUMENT_TYPES.map((dt) => (
                    <option key={dt.type} value={dt.type}>
                      {dt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* 2. Document Number with live counter / badge */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-800 text-xs block">
                  Document / ID Number <span className="text-rose-500">*</span>
                </label>
                {getDocumentStatusBadge()}
              </div>
              <Input
                type="text"
                value={documentNumber}
                onChange={(e) => handleDocumentNumberChange(e.target.value)}
                placeholder={
                  documentType === 'AADHAAR'
                    ? '1234 5678 9012'
                    : documentType === 'PAN'
                    ? 'ABCDE1234F'
                    : documentType === 'PASSPORT'
                    ? 'A1234567'
                    : documentType === 'VOTER_ID'
                    ? 'ABC1234567'
                    : 'Enter document ID'
                }
                aria-invalid={Boolean(fieldErrors.documentNumber)}
                className={`h-11 px-4 text-xs sm:text-[13px] bg-white font-mono font-medium rounded-xl text-slate-900 shadow-2xs transition-all ${
                  fieldErrors.documentNumber
                    ? 'border-rose-400 ring-2 ring-rose-500/20 focus:border-rose-500'
                    : 'border-slate-300 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 hover:border-slate-400'
                }`}
              />
              {fieldErrors.documentNumber && (
                <p className="text-[11.5px] text-rose-600 font-medium flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {fieldErrors.documentNumber}
                </p>
              )}
            </div>

            {/* 3. Drag & Drop File Upload & Preview Section */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-800 text-xs block">
                  Scanned Copy / Photo Proof <span className="text-rose-500">*</span>
                </label>
                {documentUrl && !isUploading && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                    <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                    Attached
                  </span>
                )}
              </div>

              {/* Upload Zone Container */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                aria-invalid={Boolean(fieldErrors.documentUrl)}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  fieldErrors.documentUrl
                    ? 'border-rose-300 bg-rose-50/20'
                    : isDragging
                    ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20 scale-[1.01]'
                    : documentUrl
                    ? 'border-emerald-200/90 bg-emerald-50/15'
                    : 'border-2 border-dashed border-slate-300 hover:border-emerald-700/60 bg-slate-50/70 hover:bg-emerald-50/20'
                }`}
              >
                {/* State A: File Uploading Progress */}
                {isUploading ? (
                  <div className="p-5 flex flex-col items-center justify-center text-center space-y-3 bg-white">
                    <div className="relative flex items-center justify-center">
                      <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shadow-xs">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
                      </div>
                    </div>

                    <div className="space-y-1 w-full max-w-xs">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                        <span className="truncate max-w-[200px]" title={uploadFileName}>
                          {uploadFileName || 'Uploading document...'}
                        </span>
                        <span className="font-mono text-emerald-700">{uploadProgress}%</span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                        <div
                          className="h-full bg-emerald-700 rounded-full transition-all duration-200"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>

                      <p className="text-[11px] text-slate-500 font-normal">
                        {uploadFileSize > 0 ? `${formatFileSize(uploadFileSize)} • ` : ''}
                        Securing file & uploading to bank vault...
                      </p>
                    </div>
                  </div>
                ) : documentUrl ? (
                  /* State B: Document Attached Card with Dedicated Preview & Actions */
                  <div className="p-3.5 sm:p-4 bg-white space-y-3">
                    <div className="flex items-center gap-3">
                      {/* Clickable Thumbnail / Document Icon */}
                      <button
                        type="button"
                        onClick={() => setIsPreviewOpen(true)}
                        className="group relative w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/90 shrink-0 flex items-center justify-center shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-700"
                        title="Click to preview full document"
                        aria-label="Preview full document"
                      >
                        {isPdf ? (
                          <div className="w-full h-full bg-rose-50 text-rose-700 flex flex-col items-center justify-center group-hover:bg-rose-100 transition-colors">
                            <FileText className="w-6 h-6 text-rose-600" />
                            <span className="text-[8.5px] font-bold mt-0.5">PDF</span>
                          </div>
                        ) : thumbnailError ? (
                          <div className="w-full h-full bg-emerald-50 text-emerald-800 flex flex-col items-center justify-center group-hover:bg-emerald-100 transition-colors">
                            <ShieldCheck className="w-6 h-6 text-emerald-700" />
                            <span className="text-[8.5px] font-bold mt-0.5 uppercase">{documentType}</span>
                          </div>
                        ) : (
                          <img
                            src={documentUrl}
                            alt="Proof Thumbnail"
                            onError={() => setThumbnailError(true)}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        )}

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Eye className="w-5 h-5 drop-shadow-sm" />
                        </div>
                      </button>

                      {/* Document Details */}
                      <div className="flex-1 min-w-0 text-left">
                        <p className="font-semibold text-slate-900 truncate text-xs sm:text-[13px]">
                          {documentName || `${documentType} Copy`}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-mono text-[10.5px] font-semibold">
                            {isPdf ? 'PDF Document' : 'Image Copy'}
                          </span>
                          {fileSize > 0 && (
                            <span className="text-[11px] text-slate-500 font-medium">
                              {formatFileSize(fileSize)}
                            </span>
                          )}
                          <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                            ✓ Cloud Vault Secured
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 gap-2">
                      {/* Left: Preview Button */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsPreviewOpen(true)}
                        className="h-8 px-3 text-xs font-semibold text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100/80 border-emerald-200 flex items-center gap-1.5 rounded-xl cursor-pointer shadow-2xs transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Preview Document</span>
                      </Button>

                      {/* Right: Replace & Remove */}
                      <div className="flex items-center gap-1.5">
                        <label
                          htmlFor={fileInputId}
                          className="h-8 px-3 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                          title="Upload a different document file"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                          <span>Replace</span>
                        </label>

                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          className="h-8 w-8 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer transition-colors border border-transparent hover:border-rose-200"
                          title="Remove attached file"
                          aria-label="Remove attached file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* State C: Empty Dropzone */
                  <label
                    htmlFor={fileInputId}
                    className="cursor-pointer flex flex-col items-center justify-center gap-2 w-full p-6 text-center"
                  >
                    <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs group-hover:border-emerald-700 transition-colors">
                      <FileUp className="w-6 h-6 text-emerald-800" />
                    </div>
                    <div>
                      <span className="font-semibold text-emerald-800 hover:underline text-xs sm:text-[13px] block">
                        Click to upload or drag & drop file
                      </span>
                      <p className="text-[11px] text-slate-400 mt-1">
                        JPG, PNG, WebP or PDF (Max 5MB)
                      </p>
                      <p className="text-[10.5px] text-slate-400 mt-0.5 font-normal">
                        Scanned front & back copies accepted for KYC compliance
                      </p>
                    </div>
                  </label>
                )}

                {/* Hidden Native File Input */}
                <input
                  id={fileInputId}
                  type="file"
                  onChange={handleFileUpload}
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  disabled={isUploading}
                  className="hidden"
                />
              </div>

              {fieldErrors.documentUrl && (
                <p className="text-[11.5px] text-rose-600 font-medium flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {fieldErrors.documentUrl}
                </p>
              )}
            </div>

            {/* 4. Expiry Date & Primary Checkbox */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-800 text-xs block">
                    Expiry Date <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  {(documentType === 'AADHAAR' || documentType === 'PAN') && (
                    <span className="text-[10.5px] text-slate-400 font-normal">Lifelong / No expiry</span>
                  )}
                </div>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => {
                    setExpiryDate(e.target.value);
                    if (fieldErrors.expiryDate) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.expiryDate;
                        return next;
                      });
                    }
                  }}
                  aria-invalid={Boolean(fieldErrors.expiryDate)}
                  className={`h-11 px-3.5 text-xs sm:text-[13px] bg-white font-medium rounded-xl text-slate-900 shadow-2xs hover:border-slate-400 transition-all ${
                    fieldErrors.expiryDate
                      ? 'border-rose-400 ring-2 ring-rose-500/20 focus:border-rose-500'
                      : 'border-slate-300 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20'
                  }`}
                />
                {fieldErrors.expiryDate && (
                  <p className="text-[11.5px] text-rose-600 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {fieldErrors.expiryDate}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2.5 px-3.5 rounded-xl border border-slate-200 bg-slate-50/70 self-end h-11">
                <input
                  type="checkbox"
                  id="isPrimaryCheck"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-800 border-slate-300 focus:ring-emerald-700 cursor-pointer accent-emerald-800"
                />
                <label htmlFor="isPrimaryCheck" className="font-semibold text-slate-700 text-xs cursor-pointer select-none">
                  Primary Identity Proof
                </label>
              </div>
            </div>

            {/* 5. Remarks */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-800 text-xs block">
                Remarks / Verification Notes <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <Input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Original physical card sighted at counter"
                className="h-11 px-4 text-xs sm:text-[13px] bg-white border-slate-300 font-normal rounded-xl text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs hover:border-slate-400 transition-all"
              />
            </div>

            {/* Helper tip */}
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-[11px]">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] text-slate-700">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] text-slate-700">Enter</kbd> anywhere to submit.
              </span>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-3.5 sm:px-5 sm:py-3 bg-white border-t border-slate-100 flex items-center justify-between gap-2.5 shrink-0">
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              * Required fields
            </span>
            <div className="flex items-center gap-2.5 ml-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  temporaryUploads.forEach((url) => void customerApi.deleteUploadedFile(url));
                  onClose();
                }}
                disabled={isSubmitting || isUploading}
                className="rounded-xl border-slate-300 text-slate-700 font-medium text-xs h-9 px-4 cursor-pointer hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || isUploading}
                className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium shadow-xs min-w-[120px] rounded-xl text-xs h-9 px-4 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:border disabled:border-slate-200 disabled:shadow-none disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                  </span>
                ) : isEdit ? (
                  'Update Document'
                ) : (
                  'Add Document'
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* High-Resolution Document Preview Lightbox Modal */}
      {documentUrl && (
        <DocumentPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          documentUrl={documentUrl}
          documentName={documentName || `${documentType} Copy`}
          documentType={documentType}
          documentNumber={documentNumber}
          customerName={customerName}
          customerCode={customerCode}
          expiryDate={expiryDate}
          remarks={remarks}
          mimeType={mimeType}
          fileSize={fileSize}
        />
      )}
    </div>
  );

  return createPortal(modalContent, window.document.body);
}
