import { CustomerStatus, KycStatus, KycDocumentType, KycVerificationStatus } from '../types';

export const CUSTOMER_STATUS_CONFIG: Record<
  CustomerStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  ACTIVE: {
    label: 'Active',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  INACTIVE: {
    label: 'Inactive',
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
  BLOCKED: {
    label: 'Blocked',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  ARCHIVED: {
    label: 'Archived',
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
};

export const KYC_STATUS_CONFIG: Record<
  KycStatus,
  { label: string; bg: string; text: string; border: string; dot: string; description: string }
> = {
  VERIFIED: {
    label: 'KYC Verified',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    description: 'Mandatory identity documentation verified and approved',
  },
  PARTIAL: {
    label: 'KYC Incomplete',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    description: 'Documents uploaded but pending counter officer approval',
  },
  PENDING: {
    label: 'KYC Pending',
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
    description: 'No identity proof documents uploaded yet',
  },
  REJECTED: {
    label: 'KYC Rejected',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    description: 'Document rejected due to illegibility or mismatch',
  },
  EXPIRED: {
    label: 'KYC Expired',
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
    description: 'Document passed validity/tenure expiration date',
  },
};

export const KYC_DOCUMENT_TYPES: { type: KycDocumentType; label: string; format: string }[] = [
  { type: 'AADHAAR', label: 'Aadhaar Card (UID)', format: '12-digit UID' },
  { type: 'PAN', label: 'Permanent Account Number (PAN)', format: '10-character code' },
  { type: 'PASSPORT', label: 'Passport', format: 'Alphanumeric passport code' },
  { type: 'DRIVING_LICENSE', label: 'Driving License', format: 'State DL code' },
  { type: 'VOTER_ID', label: 'Voter Identity Card (EPIC)', format: 'EPIC identity number' },
  { type: 'OTHER', label: 'Other Official Document', format: 'Custom ID number' },
];

export const KYC_VERIFICATION_CONFIG: Record<
  KycVerificationStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  VERIFIED: {
    label: 'Verified & Approved',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
  },
  PENDING: {
    label: 'Pending Verification',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
  },
  REJECTED: {
    label: 'Rejected',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
  },
};
