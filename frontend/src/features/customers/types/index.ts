export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'ARCHIVED';
export type KycStatus = 'PENDING' | 'PARTIAL' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';

export type KycDocumentType =
  | 'AADHAAR'
  | 'PAN'
  | 'PASSPORT'
  | 'DRIVING_LICENSE'
  | 'VOTER_ID'
  | 'OTHER';

export type KycVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface Customer {
  _id: string;
  customerCode: string;
  fullName: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  photoUrl?: string;
  kycStatus: KycStatus;
  kycVerifiedAt?: string;
  kycVerifiedBy?: {
    _id: string;
    name: string;
    username: string;
  };
  notes?: string;
  status: CustomerStatus;
  isActive: boolean;
  assignedLockers?: Array<{
    lockerNumber: string;
    size: string;
    rackNumber?: string;
  }>;
  createdBy?: {
    _id: string;
    name: string;
    username: string;
  };
  updatedBy?: {
    _id: string;
    name: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CustomerKycDocument {
  _id: string;
  customerId: string;
  documentType: KycDocumentType;
  documentNumber: string;
  maskedDocumentNumber?: string;
  documentUrl: string;
  documentName?: string;
  mimeType?: string;
  fileSize?: number;
  verificationStatus: KycVerificationStatus;
  verifiedAt?: string;
  verifiedBy?: {
    _id: string;
    name: string;
    username: string;
  };
  rejectionReason?: string;
  expiryDate?: string;
  remarks?: string;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerStats {
  total: number;
  active: number;
  inactive: number;
  blocked: number;
  archived: number;
  kycPending: number;
  kycPartial: number;
  kycVerified: number;
  kycRejected: number;
  kycExpired: number;
}

export interface CustomerQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  kycStatus?: string;
  city?: string;
  state?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateCustomerInput {
  fullName: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  photoUrl?: string;
  notes?: string;
  status?: CustomerStatus;
}

export interface UpdateCustomerInput {
  fullName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  photoUrl?: string;
  notes?: string;
  status?: CustomerStatus;
  isActive?: boolean;
  expectedUpdatedAt?: string;
}

export interface AddKycDocumentInput {
  documentType: KycDocumentType;
  documentNumber: string;
  documentUrl: string;
  documentName?: string;
  mimeType?: string;
  fileSize?: number;
  expiryDate?: string;
  remarks?: string;
  isPrimary?: boolean;
}

export interface UpdateKycDocumentInput {
  documentType?: KycDocumentType;
  documentNumber?: string;
  documentUrl?: string;
  documentName?: string;
  mimeType?: string;
  fileSize?: number;
  expiryDate?: string;
  remarks?: string;
  isPrimary?: boolean;
}

export interface VerifyKycDocumentInput {
  status: 'VERIFIED' | 'REJECTED' | 'PENDING';
  rejectionReason?: string;
  remarks?: string;
}

export interface CheckDuplicateCustomerResult {
  hasDuplicate: boolean;
  duplicates: Partial<Customer>[];
}

export interface PaginatedCustomersResponse {
  customers: Customer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
