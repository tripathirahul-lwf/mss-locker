import React, { useState, useEffect, useId } from 'react';
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
  CheckCircle,
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

interface KycDocumentModalProps {
  customerId: string;
  document?: CustomerKycDocument | null;
  onClose: () => void;
  onSubmit: (data: AddKycDocumentInput | UpdateKycDocumentInput) => Promise<void>;
  isSubmitting: boolean;
}

export function KycDocumentModal({
  customerId,
  document,
  onClose,
  onSubmit,
  isSubmitting,
}: KycDocumentModalProps) {
  const isEdit = Boolean(document);
  const fileInputId = useId();

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

  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [temporaryUploads, setTemporaryUploads] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        temporaryUploads.forEach((url) => void customerApi.deleteUploadedFile(url));
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, temporaryUploads]);

  // Smart document formatting
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
  };

  const processUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError('Document file size exceeds 5MB limit.');
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const result = await customerApi.uploadFile(file, 'kyc');
      const previousTemporary = temporaryUploads.includes(documentUrl) ? documentUrl : undefined;
      setDocumentUrl(result.fileUrl);
      setTemporaryUploads((old) => [...old.filter((url) => url !== previousTemporary), result.fileUrl]);
      if (previousTemporary) void customerApi.deleteUploadedFile(previousTemporary);
      setDocumentName(result.fileName || file.name);
      setMimeType(file.type || 'application/octet-stream');
      setFileSize(result.size || file.size);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload document file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanNumber = documentNumber.replace(/\s+/g, '').trim();
    if (!cleanNumber) {
      setError('Document ID number is required.');
      return;
    }
    if (!documentUrl.trim()) {
      setError('Please upload the scanned document file.');
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

  const modalContent = (
    <div
      className="fixed inset-0 z-[120] w-screen h-screen flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-[2px] select-none animate-in fade-in-0 duration-150"
      onClick={() => {
        temporaryUploads.forEach((url) => void customerApi.deleteUploadedFile(url));
        onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:px-5 sm:py-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9.5 w-9.5 shrink-0 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 flex items-center justify-center shadow-2xs">
              <ShieldCheck className="w-5 h-5 text-emerald-800" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                {isEdit ? 'Update KYC Document' : 'Upload KYC Document'}
              </h2>
              <p className="text-[11.5px] text-slate-500 font-normal mt-0.5 truncate max-w-[260px]">
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
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 text-xs">
            {error && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2 font-normal text-xs">
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
                    setDocumentType(e.target.value as KycDocumentType);
                    setDocumentNumber('');
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

            {/* 2. Document Number */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-800 text-xs block">
                Document / ID Number <span className="text-rose-500">*</span>
              </label>
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
                    : 'Enter document number'
                }
                required
                className="h-11 px-4 text-xs sm:text-[13px] bg-white border-slate-300 font-mono font-medium rounded-xl text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs transition-all hover:border-slate-400"
              />
            </div>

            {/* 3. Drag & Drop File Upload */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-800 text-xs block">
                Scanned Copy / Photo Proof <span className="text-rose-500">*</span>
              </label>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`p-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition-all ${
                  isDragging
                    ? 'border-emerald-600 bg-emerald-50/50 scale-[1.01]'
                    : documentUrl
                    ? 'border-emerald-300 bg-emerald-50/20'
                    : 'border-slate-300 hover:border-emerald-700/60 bg-slate-50/70 hover:bg-emerald-50/20'
                }`}
              >
                {documentUrl ? (
                  <div className="flex items-center gap-3 p-2.5 bg-white border border-emerald-200/80 rounded-xl w-full shadow-2xs">
                    {mimeType.startsWith('image/') ? (
                      <img
                        src={documentUrl}
                        alt="Proof"
                        className="w-11 h-11 object-cover rounded-lg border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex flex-col items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-rose-600" />
                        <span className="text-[8.5px] font-bold">PDF</span>
                      </div>
                    )}

                    <div className="text-left flex-1 truncate">
                      <p className="font-semibold text-slate-900 truncate text-xs sm:text-[13px]">
                        {documentName || 'Document file attached'}
                      </p>
                      <p className="text-[11px] text-emerald-700 font-medium">
                        ✓ {(fileSize / 1024).toFixed(0)} KB ready
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <label
                        htmlFor={fileInputId}
                        className="cursor-pointer text-xs font-semibold text-emerald-800 hover:text-emerald-950 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200"
                      >
                        Replace
                      </label>
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="Remove file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor={fileInputId}
                    className="cursor-pointer flex flex-col items-center gap-2 w-full py-2"
                  >
                    <div className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                      {isUploading ? (
                        <Loader2 className="w-5 h-5 text-emerald-800 animate-spin" />
                      ) : (
                        <FileUp className="w-5 h-5 text-emerald-800" />
                      )}
                    </div>
                    <div>
                      <span className="font-semibold text-emerald-800 hover:underline text-xs sm:text-[13px]">
                        Click to upload or drag & drop file
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        JPG, PNG, WebP or PDF (Up to 5MB)
                      </p>
                    </div>
                  </label>
                )}

                <input
                  id={fileInputId}
                  type="file"
                  onChange={handleFileUpload}
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  disabled={isUploading}
                  className="hidden"
                />
              </div>
            </div>

            {/* 4. Expiry Date & Primary Checkbox */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-800 text-xs block">
                  Expiry Date <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="h-11 px-3.5 text-xs sm:text-[13px] bg-white border-slate-300 font-medium rounded-xl text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs hover:border-slate-400"
                />
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
                Remarks <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <Input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Original physical card sighted at counter"
                className="h-11 px-4 text-xs sm:text-[13px] bg-white border-slate-300 font-normal rounded-xl text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs hover:border-slate-400"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-3.5 sm:px-5 sm:py-3 bg-white border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
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
              disabled={isSubmitting || isUploading || !documentUrl || !documentNumber.trim()}
              className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium shadow-xs min-w-[120px] rounded-xl text-xs h-9 px-4 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:border disabled:border-slate-200 disabled:shadow-none disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? 'Saving...'
                : isEdit
                ? 'Update Document'
                : 'Add Document'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, window.document.body);
}

