import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FileText,
  Upload,
  AlertCircle,
  CheckCircle,
  FileUp,
  Loader2,
  ChevronDown,
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
  customerId: _customerId,
  document,
  onClose,
  onSubmit,
  isSubmitting,
}: KycDocumentModalProps) {
  const isEdit = Boolean(document);

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
  const [temporaryUploads, setTemporaryUploads] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      setDocumentName(result.fileName);
      setMimeType(file.type);
      setFileSize(result.size);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload document file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!documentNumber.trim()) {
      setError('Document ID number is required.');
      return;
    }
    if (!documentUrl.trim()) {
      setError('Please upload the proof document file (JPG/PNG/PDF).');
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
      await Promise.all(temporaryUploads.filter((url) => url !== documentUrl).map((url) => customerApi.deleteUploadedFile(url)));
      setTemporaryUploads([]);
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || 'Failed to save KYC document.'
      );
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-[2px] select-none animate-in fade-in-0 duration-150">
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:px-6 sm:py-4.5 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 flex items-center justify-center shadow-2xs">
              <FileText className="w-5 h-5 text-emerald-800" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight">
                {isEdit ? 'Update KYC Document' : 'Upload KYC Document'}
              </h2>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                Official government identification document proof
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { temporaryUploads.forEach((url) => void customerApi.deleteUploadedFile(url)); onClose(); }}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close KYC modal"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 font-normal">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Document Type */}
            <div className="space-y-1">
              <label className="font-medium text-slate-700 text-xs block">
                Document Classification <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value as KycDocumentType)}
                  className="w-full h-10 pl-3.5 pr-9 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 text-xs focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 appearance-none cursor-pointer shadow-2xs"
                >
                  {KYC_DOCUMENT_TYPES.map((dt) => (
                    <option key={dt.type} value={dt.type}>
                      {dt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* Document Number */}
            <div className="space-y-1">
              <label className="font-medium text-slate-700 text-xs block">
                Official Document / ID Number <span className="text-rose-500">*</span>
              </label>
              <Input
                type="text"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="e.g. 1234 5678 9012 or ABCDE1234F"
                required
                className="h-10 text-xs bg-white border-slate-300 font-mono font-medium rounded-xl text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs"
              />
              <p className="text-[10.5px] text-slate-400 font-normal">
                Numbers are securely masked for unprivileged staff members.
              </p>
            </div>

            {/* File Upload Box */}
            <div className="space-y-1">
              <label className="font-medium text-slate-700 text-xs block">
                Scanned Copy / Photo Proof <span className="text-rose-500">*</span>
              </label>

              <div className="p-5 border-2 border-dashed border-slate-300 hover:border-emerald-700/60 rounded-xl bg-slate-50/70 hover:bg-emerald-50/20 flex flex-col items-center justify-center text-center transition-all cursor-pointer">
                {documentUrl ? (
                  <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl w-full">
                    <CheckCircle className="w-5 h-5 text-emerald-700 shrink-0" />
                    <div className="text-left flex-1 truncate">
                      <p className="font-medium text-slate-900 truncate">
                        {documentName || 'Document file attached'}
                      </p>
                      <p className="text-[10.5px] text-slate-400 font-mono font-normal">
                        {(fileSize / 1024).toFixed(0)} KB • Ready for verification
                      </p>
                    </div>
                    <label className="cursor-pointer text-xs font-semibold text-emerald-800 hover:underline">
                      Replace
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center gap-2">
                    <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
                      {isUploading ? (
                        <Loader2 className="w-5 h-5 text-emerald-800 animate-spin" />
                      ) : (
                        <FileUp className="w-5 h-5 text-emerald-800" />
                      )}
                    </div>
                    <div>
                      <span className="font-semibold text-emerald-800 hover:underline">
                        Click to select document file
                      </span>
                      <p className="text-[10.5px] text-slate-400 mt-0.5 font-normal">
                        JPG, PNG, WebP or PDF (Up to 5MB)
                      </p>
                    </div>
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      disabled={isUploading}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Expiry Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-medium text-slate-700 text-xs block">Document Expiry Date</label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="h-10 text-xs bg-white border-slate-300 font-medium rounded-xl text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="isPrimaryCheck"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-800 border-slate-300 focus:ring-emerald-700 cursor-pointer"
                />
                <label htmlFor="isPrimaryCheck" className="font-medium text-slate-700 text-xs cursor-pointer">
                  Mark as Primary Identity Proof
                </label>
              </div>
            </div>

            {/* Remarks */}
            <div className="space-y-1">
              <label className="font-medium text-slate-700 text-xs block">Remarks / Attestation Notes</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional notes e.g. Original physical card sighted at counter"
                rows={2}
                className="w-full p-3 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-3.5 sm:px-6 sm:py-3.5 bg-white border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { temporaryUploads.forEach((url) => void customerApi.deleteUploadedFile(url)); onClose(); }}
              disabled={isSubmitting || isUploading}
              className="rounded-xl border-slate-300 text-slate-700 font-medium text-xs h-9.5 px-4 cursor-pointer hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || isUploading}
              className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium shadow-xs min-w-[130px] rounded-xl text-xs h-9.5 px-4 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:border disabled:border-slate-200 disabled:shadow-none disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? 'Uploading...'
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
