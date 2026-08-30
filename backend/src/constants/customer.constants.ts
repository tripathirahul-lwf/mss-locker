export const CUSTOMER_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  BLOCKED: 'BLOCKED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type CustomerStatus = typeof CUSTOMER_STATUS[keyof typeof CUSTOMER_STATUS];

export const KYC_STATUS = {
  PENDING: 'PENDING',
  PARTIAL: 'PARTIAL',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;

export type KycStatus = typeof KYC_STATUS[keyof typeof KYC_STATUS];

export const KYC_DOCUMENT_TYPE = {
  AADHAAR: 'AADHAAR',
  PAN: 'PAN',
  PASSPORT: 'PASSPORT',
  DRIVING_LICENSE: 'DRIVING_LICENSE',
  VOTER_ID: 'VOTER_ID',
  OTHER: 'OTHER',
} as const;

export type KycDocumentType = typeof KYC_DOCUMENT_TYPE[keyof typeof KYC_DOCUMENT_TYPE];

export const KYC_VERIFICATION_STATUS = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;

export type KycVerificationStatus =
  typeof KYC_VERIFICATION_STATUS[keyof typeof KYC_VERIFICATION_STATUS];

export const KYC_DOCUMENT_CONFIG = [
  { type: 'AADHAAR', label: 'Aadhaar Card', requiredForVerified: true, format: '12-digit UID' },
  { type: 'PAN', label: 'PAN Card', requiredForVerified: true, format: '10-character alphanumeric' },
  { type: 'PASSPORT', label: 'Passport', requiredForVerified: false, format: 'Alpha-numeric passport code' },
  { type: 'DRIVING_LICENSE', label: 'Driving License', requiredForVerified: false, format: 'State-issued DL number' },
  { type: 'VOTER_ID', label: 'Voter ID (EPIC)', requiredForVerified: false, format: 'EPIC identity number' },
  { type: 'OTHER', label: 'Other Official Document', requiredForVerified: false, format: 'Custom ID number' },
] as const;

/**
 * Centralized policy: At least 1 verified primary document (Aadhaar or PAN or Passport)
 * is required for overall customer KYC status to be VERIFIED.
 */
export const KYC_POLICY = {
  MIN_VERIFIED_DOCS: 1,
  PRIMARY_DOC_TYPES: ['AADHAAR', 'PAN', 'PASSPORT'] as KycDocumentType[],
};
