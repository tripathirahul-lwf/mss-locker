import React, { useState } from 'react';
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Trash2,
  Edit3,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Plus,
  AlertOctagon,
  UploadCloud,
  Lock,
  UserCheck,
  FileCheck,
} from 'lucide-react';
import {
  CustomerKycDocument,
  KycVerificationStatus,
  VerifyKycDocumentInput,
} from '../types';
import { KYC_DOCUMENT_TYPES, KYC_VERIFICATION_CONFIG } from '../constants';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { usePermission } from '../../../hooks/usePermission';
import { customerApi } from '../api/customerApi';
import { DocumentPreviewModal } from './DocumentPreviewModal';

interface KycDocumentListProps {
  documents: CustomerKycDocument[];
  isLoading: boolean;
  customerKycStatus?: string;
  customerName?: string;
  customerCode?: string;
  onAddDocument: () => void;
  onEditDocument: (doc: CustomerKycDocument) => void;
  onVerifyDocument: (docId: string, input: VerifyKycDocumentInput) => Promise<void>;
  onDeleteDocument: (docId: string) => Promise<void>;
}

export function KycDocumentList({
  documents,
  isLoading,
  customerKycStatus,
  customerName = '',
  customerCode = '',
  onAddDocument,
  onEditDocument,
  onVerifyDocument,
  onDeleteDocument,
}: KycDocumentListProps) {
  const canManageKyc = usePermission('customers.kyc.manage');
  const canVerifyKyc = usePermission('customers.kyc.verify');

  const [selectedDocForVerify, setSelectedDocForVerify] =
    useState<CustomerKycDocument | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<KycVerificationStatus>('VERIFIED');
  const [rejectionReason, setRejectionReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<CustomerKycDocument | null>(null);

  const handleOpenVerifyModal = (
    doc: CustomerKycDocument,
    status: KycVerificationStatus
  ) => {
    setSelectedDocForVerify(doc);
    setVerifyStatus(status);
    setRejectionReason('');
    setRemarks('');
    setApprovalConfirmed(false);
  };

  const handleConfirmVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocForVerify) return;

    setIsProcessing(true);
    try {
      await onVerifyDocument(selectedDocForVerify._id, {
        status: verifyStatus,
        rejectionReason: verifyStatus === 'REJECTED' ? rejectionReason : undefined,
        remarks: remarks.trim() || undefined,
      });
      setSelectedDocForVerify(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const getDocTypeLabel = (type: string) => {
    const match = KYC_DOCUMENT_TYPES.find((d) => d.type === type);
    return match ? match.label : type;
  };

  const getMaskedDocumentNumber = (doc: CustomerKycDocument) => {
    if (doc.maskedDocumentNumber) return doc.maskedDocumentNumber;
    const raw = doc.documentNumber || '';
    if (!raw) return 'Not recorded';
    const visible = raw.slice(-4);
    return `${'X'.repeat(Math.max(4, raw.length - 4))}${visible}`;
  };

  const verifiedCount = documents.filter((doc) => doc.verificationStatus === 'VERIFIED').length;
  const rejectedCount = documents.filter((doc) => doc.verificationStatus === 'REJECTED').length;
  const pendingCount = documents.length - verifiedCount - rejectedCount;

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            KYC Proof Documents
          </h3>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            Government proof of identity, address and photo documentation.
          </p>
        </div>

        {canManageKyc && (
          <Button
            size="sm"
            onClick={onAddDocument}
            className="h-9 bg-emerald-800 hover:bg-emerald-900 text-white flex items-center gap-1.5 text-xs font-medium rounded-xl px-3.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload Document</span>
          </Button>
        )}
      </div>

      {!isLoading && documents.length > 0 && (
        <div className="grid grid-cols-3 gap-2" aria-label="KYC document summary">
          <SummaryMetric label="Verified" value={verifiedCount} className="text-emerald-800 bg-emerald-50/80 border-emerald-200/80" />
          <SummaryMetric label="Needs review" value={pendingCount} className="text-amber-800 bg-amber-50/80 border-amber-200/80" />
          <SummaryMetric label="Rejected" value={rejectedCount} className="text-rose-800 bg-rose-50/80 border-rose-200/80" />
        </div>
      )}

      {/* Documents Grid / List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div
              key={`kyc-skel-${idx}`}
              className="h-32 bg-slate-100 rounded-2xl animate-pulse border border-slate-200"
            />
          ))}
        </div>
      ) : documents.length === 0 ? (
        customerKycStatus === 'VERIFIED' ? (
          <div className="space-y-4">
            {/* Banking-Grade KYC Compliance Dossier Card */}
            <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200 shadow-2xs">
                    <ShieldCheck className="w-5 h-5 text-emerald-800" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">
                        Branch Certified KYC Compliance
                      </h4>
                      <span className="text-[10.5px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Active
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-normal mt-0.5">
                      Customer identity and address have been verified and certified by the branch compliance officer.
                    </p>
                  </div>
                </div>

                {canManageKyc && (
                  <Button
                    size="sm"
                    onClick={onAddDocument}
                    className="h-9 px-3.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-xl shrink-0 cursor-pointer shadow-xs gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Attach Scanned Copy</span>
                  </Button>
                )}
              </div>

              {/* Verification Breakdown Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                    Proof of Identity (POI)
                  </span>
                  <span className="font-semibold text-slate-900 block mt-1 text-xs">
                    Verified in Branch
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal block mt-0.5">
                    Physical Aadhaar / PAN certified
                  </span>
                </div>

                <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                    Proof of Address (POA)
                  </span>
                  <span className="font-semibold text-slate-900 block mt-1 text-xs">
                    Address Authenticated
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal block mt-0.5">
                    Residential address confirmed
                  </span>
                </div>

                <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                    Digital Scans Archive
                  </span>
                  <span className="font-semibold text-slate-600 block mt-1 text-xs">
                    0 Attachments on File
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal block mt-0.5">
                    Optional scanned copy for digital vault
                  </span>
                </div>
              </div>
            </div>

            {/* Interactive Upload Dropzone Card */}
            {canManageKyc && (
              <div
                onClick={onAddDocument}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-600 bg-white hover:bg-emerald-50/20 transition-all rounded-2xl p-6 sm:p-7 text-center cursor-pointer group shadow-2xs"
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover:bg-emerald-100/70 text-slate-500 group-hover:text-emerald-800 flex items-center justify-center mx-auto transition-colors">
                  <UploadCloud className="w-6 h-6 group-hover:-translate-y-0.5 transition-transform" />
                </div>
                <div className="mt-3 space-y-1">
                  <h5 className="text-sm font-semibold text-slate-900 group-hover:text-emerald-950 transition-colors">
                    Upload Digital Scans &amp; Custody Documentation
                  </h5>
                  <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
                    Click to attach high-resolution digital copies of government IDs, tax registrations, or specimen signatures (PDF, JPG, PNG up to 10MB).
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4">
                  <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-md">Aadhaar Card</span>
                  <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-md">PAN Card</span>
                  <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-md">Passport</span>
                  <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-md">Voter ID</span>
                  <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-md">Specimen Card</span>
                </div>
              </div>
            )}

            {/* Regulatory KYC Proof Requirements Matrix */}
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Regulatory Proof Requirements Matrix
                </h5>
                <span className="text-[11px] text-slate-500">
                  RBI Safe Deposit Locker Guidelines Compliant
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* POI */}
                <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10.5px] uppercase font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        Mandatory POI
                      </span>
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <h6 className="text-xs font-semibold text-slate-900">
                        Proof of Identity (POI)
                      </h6>
                      <p className="text-[11.5px] text-slate-500 leading-snug mt-1">
                        Valid Aadhaar Card (masked), Passport, Voter ID, or Driving License with photograph.
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-600" /> Branch Certified
                    </span>
                    {canManageKyc && (
                      <button
                        type="button"
                        onClick={onAddDocument}
                        className="text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 cursor-pointer"
                      >
                        + Attach Scan
                      </button>
                    )}
                  </div>
                </div>

                {/* PAN */}
                <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10.5px] uppercase font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                        Tax Mandate
                      </span>
                      <FileText className="w-4 h-4 text-slate-600" />
                    </div>
                    <div>
                      <h6 className="text-xs font-semibold text-slate-900">
                        Permanent Account Number (PAN)
                      </h6>
                      <p className="text-[11.5px] text-slate-500 leading-snug mt-1">
                        Section 139A IT Act mandate. Mandatory for annual rent invoicing and vault custody records.
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-600" /> PAN Certified
                    </span>
                    {canManageKyc && (
                      <button
                        type="button"
                        onClick={onAddDocument}
                        className="text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 cursor-pointer"
                      >
                        + Attach Scan
                      </button>
                    )}
                  </div>
                </div>

                {/* Specimen Signature */}
                <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10.5px] uppercase font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                        Access Control
                      </span>
                      <FileCheck className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <h6 className="text-xs font-semibold text-slate-900">
                        Signature &amp; Photo Specimen
                      </h6>
                      <p className="text-[11.5px] text-slate-500 leading-snug mt-1">
                        Signature specimen card and photo for dual-key vault counter release authorization.
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" /> Physical Specimen
                    </span>
                    {canManageKyc && (
                      <button
                        type="button"
                        onClick={onAddDocument}
                        className="text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 cursor-pointer"
                      >
                        + Attach Scan
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Institutional Compliance & Audit Footer */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-slate-600 flex items-start gap-3">
              <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div className="text-[11.5px] leading-relaxed">
                <strong className="font-semibold text-slate-800">Statutory Custody Compliance: </strong>
                Compliant with Reserve Bank of India Safe Deposit Locker Guidelines (RBI/2021-2022/86) and Prevention of Money Laundering Act (PMLA). Digital documents uploaded to VaultLedger are encrypted at rest with immutable audit logs and SHA-256 access logging.
              </div>
            </div>
          </div>
        ) : (
          /* Standard Unverified State */
          <div className="p-8 sm:p-10 bg-slate-50/70 border border-slate-200/90 rounded-2xl text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">
                No KYC Documents Uploaded
              </p>
              <p className="text-xs text-slate-500 font-normal max-w-md mx-auto leading-relaxed">
                Upload customer's Aadhaar, PAN card, or Passport to initiate vault KYC compliance verification.
              </p>
            </div>
            {canManageKyc && (
              <Button
                size="sm"
                onClick={onAddDocument}
                className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium rounded-xl shadow-xs px-4 h-9 cursor-pointer gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload First Document</span>
              </Button>
            )}
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documents.map((doc) => {
            const verConfig =
              KYC_VERIFICATION_CONFIG[doc.verificationStatus] ||
              KYC_VERIFICATION_CONFIG.PENDING;

            return (
              <div
                key={doc._id}
                className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-3 relative flex flex-col justify-between"
              >
                {/* Top Info */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900 text-xs">
                          {getDocTypeLabel(doc.documentType)}
                        </h4>
                        {doc.isPrimary && (
                          <span className="text-[10px] font-medium text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Primary Proof
                          </span>
                        )}
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${verConfig.bg} ${verConfig.text} ${verConfig.border}`}
                    >
                      {verConfig.label}
                    </span>
                  </div>

                  {/* Document Number Display */}
                  <div className="p-2.5 bg-slate-50/80 border border-slate-200/80 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-medium text-slate-400 block">
                        Document ID
                      </span>
                      <span className="font-sans font-semibold text-slate-800 text-xs tracking-wider tabular-nums">
                        {getMaskedDocumentNumber(doc)}
                      </span>
                    </div>

                    {doc.documentUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(doc)}
                        className="h-8 text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1.5 bg-white px-3 rounded-lg border border-slate-200 shadow-2xs hover:bg-emerald-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 cursor-pointer transition-colors"
                        aria-label={`Preview ${getDocTypeLabel(doc.documentType)} file`}
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Preview</span>
                      </button>
                    )}
                  </div>

                  {/* Verification Info / Rejection Details */}
                  {doc.verificationStatus === 'VERIFIED' && (
                    <div className="text-[11px] text-emerald-800 flex items-center gap-1.5 pt-0.5 font-normal">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>
                        Verified by <strong className="font-semibold">{doc.verifiedBy?.name || 'Officer'}</strong>
                        {doc.verifiedAt && (
                          <> on {new Date(doc.verifiedAt).toLocaleDateString('en-IN')}</>
                        )}
                      </span>
                    </div>
                  )}

                  {doc.verificationStatus === 'REJECTED' && (
                    <div className="text-[11px] text-rose-800 flex items-start gap-1.5 pt-0.5 bg-rose-50 p-2.5 rounded-xl border border-rose-200 font-normal">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-semibold">Reason for Rejection:</strong>
                        <p>{doc.rejectionReason || 'Document unreadable or invalid.'}</p>
                      </div>
                    </div>
                  )}

                  {doc.remarks && (
                    <p className="text-[11px] text-slate-500 italic font-normal">
                      Remarks: {doc.remarks}
                    </p>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {canVerifyKyc && doc.verificationStatus !== 'VERIFIED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenVerifyModal(doc, 'VERIFIED')}
                        className="h-8 text-xs text-emerald-800 border-emerald-300 hover:bg-emerald-50 rounded-lg flex items-center gap-1 font-medium cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Review & approve</span>
                      </Button>
                    )}

                    {canVerifyKyc && doc.verificationStatus !== 'REJECTED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenVerifyModal(doc, 'REJECTED')}
                        className="h-8 text-xs text-rose-700 border-rose-300 hover:bg-rose-50 rounded-lg flex items-center gap-1 font-medium cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {canManageKyc && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditDocument(doc)}
                        className="h-8 w-8 p-0 text-slate-500 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg cursor-pointer"
                        title="Edit Details"
                        aria-label={`Edit ${getDocTypeLabel(doc.documentType)}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    {canManageKyc && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteDocument(doc._id)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="Delete Document"
                        aria-label={`Delete ${getDocTypeLabel(doc.documentType)}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Verification / Rejection Modal */}
      {selectedDocForVerify && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-[2px] select-none">
          <div role="dialog" aria-modal="true" aria-labelledby="kyc-verification-title" className="w-full max-w-md bg-white rounded-2xl p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                {verifyStatus === 'VERIFIED' ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-700" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-rose-600" />
                )}
                <h3 id="kyc-verification-title" className="text-sm font-semibold text-slate-900">
                  {verifyStatus === 'VERIFIED'
                    ? 'Approve KYC Document'
                    : 'Reject KYC Document'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDocForVerify(null)}
                className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 cursor-pointer"
                aria-label="Close verification dialog"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmVerification} className="space-y-3 text-xs">
              <p className="text-slate-600 font-normal">
                You are performing counter verification for{' '}
                <strong className="font-semibold text-slate-800">
                  {getDocTypeLabel(selectedDocForVerify.documentType)} (
                  {getMaskedDocumentNumber(selectedDocForVerify)}
                  )
                </strong>
                .
              </p>

              {verifyStatus === 'VERIFIED' && selectedDocForVerify.documentUrl && (
                <button
                  type="button"
                  onClick={() => setPreviewDoc(selectedDocForVerify)}
                  className="h-10 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 font-semibold text-emerald-800 hover:bg-emerald-100/70 cursor-pointer shadow-2xs transition-colors"
                >
                  <Eye className="w-4 h-4 text-emerald-700" /> Inspect Document (Zoom & Rotate)
                </button>
              )}

              {verifyStatus === 'REJECTED' && (
                <div className="space-y-1">
                  <label className="font-medium text-slate-700 text-xs block">
                    Reason for Rejection <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Scanned copy blurred, name mismatch with PAN database, or expired ID"
                    required
                    rows={3}
                    className="w-full p-2.5 bg-white border border-rose-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 text-xs resize-none"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="font-medium text-slate-700 text-xs block">
                  Officer Remarks <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Original physical ID sighted & verified at branch counter"
                  className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 text-xs"
                />
              </div>

              {verifyStatus === 'VERIFIED' && (
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/40 text-emerald-950 font-normal cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={approvalConfirmed}
                    onChange={(e) => setApprovalConfirmed(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-800 border-slate-300 focus:ring-emerald-700 accent-emerald-800"
                  />
                  <span>
                    I confirm that I have inspected this government ID proof and certified its authenticity.
                  </span>
                </label>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDocForVerify(null)}
                  className="rounded-xl border-slate-300 text-slate-700 font-medium text-xs h-9 px-3.5 cursor-pointer hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isProcessing || (verifyStatus === 'VERIFIED' && !approvalConfirmed)}
                  className={
                    verifyStatus === 'VERIFIED'
                      ? 'bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-xs rounded-xl h-9 px-3.5 cursor-pointer shadow-xs'
                      : 'bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs rounded-xl h-9 px-3.5 cursor-pointer shadow-xs'
                  }
                >
                  {isProcessing
                    ? 'Processing...'
                    : verifyStatus === 'VERIFIED'
                    ? 'Confirm & Approve'
                    : 'Confirm Rejection'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* High-Resolution Document Preview Lightbox Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          isOpen={Boolean(previewDoc)}
          onClose={() => setPreviewDoc(null)}
          documentUrl={previewDoc.documentUrl}
          documentName={previewDoc.documentName || `${getDocTypeLabel(previewDoc.documentType)} Copy`}
          documentType={previewDoc.documentType}
          documentNumber={previewDoc.documentNumber}
          customerName={customerName}
          customerCode={customerCode}
          expiryDate={previewDoc.expiryDate}
          remarks={previewDoc.remarks}
          mimeType={previewDoc.mimeType}
          fileSize={previewDoc.fileSize}
        />
      )}
    </div>
  );
}

function SummaryMetric({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${className}`}>
      <span className="text-lg font-semibold block leading-none tabular-nums font-sans">{value}</span>
      <span className="text-[10px] font-medium tracking-wide uppercase">{label}</span>
    </div>
  );
}
