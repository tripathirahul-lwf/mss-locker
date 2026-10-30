import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Upload,
  Eye,
  RefreshCw,
  X,
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  Globe,
  Car,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Check,
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

interface KycBoxDefinition {
  type: KycDocumentType;
  title: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const KYC_BOXES: KycBoxDefinition[] = [
  {
    type: 'AADHAAR',
    title: 'Aadhaar Card',
    shortLabel: 'Aadhaar',
    description: 'UIDAI biometric ID scan or photo',
    icon: ShieldCheck,
  },
  {
    type: 'PAN',
    title: 'PAN Card',
    shortLabel: 'PAN',
    description: 'Income Tax permanent account card',
    icon: CreditCard,
  },
  {
    type: 'PASSPORT',
    title: 'Passport',
    shortLabel: 'Passport',
    description: 'Republic of India passport bio-page',
    icon: Globe,
  },
  {
    type: 'DRIVING_LICENSE',
    title: 'Driving License',
    shortLabel: 'Driving License',
    description: 'State Transport RTO driving permit',
    icon: Car,
  },
  {
    type: 'VOTER_ID',
    title: 'Voter ID (EPIC)',
    shortLabel: 'Voter ID',
    description: 'Election Commission voter identity card',
    icon: FileCheck2,
  },
];

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

  // Track which box is currently uploading or replacing
  const [uploadingType, setUploadingType] = useState<KycDocumentType | null>(null);
  const [dragOverType, setDragOverType] = useState<KycDocumentType | null>(null);

  // Status & UI State
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Hidden File Inputs Refs for each document type
  const fileInputRefs = useRef<{ [key in KycDocumentType]?: HTMLInputElement | null }>({});

  // Document Preview Modal State
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    url: string;
    documentName?: string;
    mimeType?: string;
    documentNumber?: string;
    documentType?: string;
    fileSize?: number;
  } | null>(null);

  // Trigger file selection for a specific document box
  const handleTriggerUpload = (type: KycDocumentType) => {
    if (!canManage || uploadingType) return;
    setError('');
    const input = fileInputRefs.current[type];
    if (input) {
      input.value = '';
      input.click();
    }
  };

  // Upload or replace document directly on file selection
  const handleFileChange = async (
    type: KycDocumentType,
    selectedFile: File | null,
    existingDoc?: CustomerKycDocument
  ) => {
    if (!customerId || !selectedFile) return;
    setError('');
    setNotice('');

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File exceeds 5 MB upload limit. Please choose a compressed file.');
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(selectedFile.type)) {
      setError('Invalid format. Only JPG, PNG, WebP or PDF documents are permitted.');
      return;
    }

    try {
      setUploadingType(type);

      // 1. Upload file to vault storage
      const uploaded = await customerApi.uploadFile(selectedFile, 'kyc');

      const boxConfig = KYC_BOXES.find((b) => b.type === type);
      const docTitle = boxConfig ? boxConfig.title : type;

      const payload = {
        documentType: type,
        documentNumber: `${docTitle} Scan`,
        documentUrl: uploaded.fileUrl,
        documentName: selectedFile.name,
        mimeType: selectedFile.type,
        fileSize: uploaded.size,
      };

      // 2. Add or update KYC document
      if (existingDoc) {
        await customerApi.updateKycDocument(customerId, existingDoc._id, payload);
        setNotice(`${docTitle} updated successfully.`);
      } else {
        await customerApi.addKycDocument(customerId, {
          ...payload,
          isPrimary: documents.length === 0,
        });
        setNotice(`${docTitle} uploaded successfully.`);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to upload document.');
    } finally {
      await Promise.all([
        'customer-kyc',
        'locker-allocations',
        'lockers',
        'customers',
      ].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      setUploadingType(null);
      setDragOverType(null);
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

  return (
    <div className="space-y-3.5 font-sans animate-in fade-in-50 duration-200">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1 border-b border-slate-100">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            KYC & ID Documents
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Click on any document box to upload. Click Preview once uploaded to inspect.
          </p>
        </div>
        <div>
          <span className="text-[11px] font-semibold">
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

      {/* 3. Direct Document Upload & Preview Boxes Grid */}
      {!loading && !failed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {KYC_BOXES.map((box) => {
            const BoxIcon = box.icon;
            const doc = documents.find((d) => d.documentType === box.type);
            const isUploaded = Boolean(doc);
            const isCurrentlyUploading = uploadingType === box.type;
            const isDragging = dragOverType === box.type;

            const isPdf =
              doc?.mimeType?.includes('pdf') ||
              doc?.documentUrl?.toLowerCase().includes('.pdf') ||
              doc?.documentName?.toLowerCase().endsWith('.pdf');

            return (
              <div
                key={box.type}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (canManage && !isCurrentlyUploading) {
                    setDragOverType(box.type);
                  }
                }}
                onDragLeave={() => setDragOverType(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverType(null);
                  if (canManage && !isCurrentlyUploading && e.dataTransfer.files?.[0]) {
                    handleFileChange(box.type, e.dataTransfer.files[0], doc);
                  }
                }}
                className={`relative rounded-2xl border transition-all p-4 flex flex-col justify-between shadow-2xs ${
                  isCurrentlyUploading
                    ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                    : isDragging
                    ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/30'
                    : isUploaded
                    ? 'border-emerald-200/90 bg-emerald-50/20 hover:border-emerald-300 hover:bg-emerald-50/30'
                    : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50/60'
                }`}
              >
                {/* Hidden File Input for this specific box */}
                <input
                  ref={(el) => {
                    fileInputRefs.current[box.type] = el;
                  }}
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  disabled={isCurrentlyUploading || !canManage}
                  onChange={(e) => handleFileChange(box.type, e.target.files?.[0] || null, doc)}
                  className="hidden"
                />

                {/* Top Section: Icon, Title & Status */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        isUploaded
                          ? 'bg-emerald-100/80 border-emerald-300 text-emerald-800'
                          : 'bg-slate-100 border-slate-200 text-slate-600'
                      }`}
                    >
                      <BoxIcon className="w-4 h-4" />
                    </div>

                    {isUploaded ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                        <Check className="w-3 h-3 text-emerald-700" />
                        Uploaded
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                        Not Uploaded
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-slate-900">
                    {box.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                    {box.description}
                  </p>
                </div>

                {/* Middle / File Info Section */}
                <div className="my-3 min-h-[46px] flex flex-col justify-center">
                  {isCurrentlyUploading ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-100/70 p-2 rounded-xl">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-700 shrink-0" />
                      <span>Uploading to vault...</span>
                    </div>
                  ) : isUploaded && doc ? (
                    <div className="p-2 rounded-xl bg-white border border-emerald-100 flex items-center justify-between gap-2 shadow-2xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate" title={doc.documentName}>
                            {doc.documentName || `${box.shortLabel} Scan`}
                          </p>
                          <p className="text-[10px] text-slate-500 font-medium">
                            {isPdf ? 'PDF Document' : 'Image Scan'}
                            {doc.fileSize ? ` • ${formatBytes(doc.fileSize)}` : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => handleTriggerUpload(box.type)}
                      className="p-2.5 rounded-xl border border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/70 hover:bg-emerald-50/30 transition-all cursor-pointer flex items-center justify-center gap-1.5 text-slate-600 hover:text-emerald-800 text-xs font-semibold"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Click to upload or drag file</span>
                    </div>
                  )}
                </div>

                {/* Bottom Actions Section */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  {isUploaded && doc ? (
                    <>
                      {/* Preview Button */}
                      <button
                        type="button"
                        onClick={() => handleInspectDocument(doc)}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview
                      </button>

                      {/* Replace / Re-upload Button */}
                      {canManage && (
                        <button
                          type="button"
                          disabled={isCurrentlyUploading}
                          onClick={() => handleTriggerUpload(box.type)}
                          className="py-1.5 px-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          title="Upload replacement scan"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                          <span>Replace</span>
                        </button>
                      )}
                    </>
                  ) : (
                    /* Non-Uploaded: Single Big Upload Button */
                    canManage && (
                      <button
                        type="button"
                        disabled={isCurrentlyUploading}
                        onClick={() => handleTriggerUpload(box.type)}
                        className="w-full py-1.5 px-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Upload {box.shortLabel}
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Full-Featured Document Inspection & Preview Modal */}
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
