import { z } from 'zod';
import { isValidPhone } from '../utils/phone';

const phoneSchema = z.string().trim().min(10).max(20).refine(isValidPhone, {
  message: 'Enter a valid phone number containing 10 to 15 digits',
});
const optionalBirthDateSchema = z.string().trim().refine((value) => {
  if (!value) return true;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed <= new Date();
}, 'Date of birth must be a valid date and cannot be in the future').optional();
const optionalIndianPinSchema = z.string().trim().refine(
  (value) => !value || /^\d{6}$/.test(value),
  'Indian postal PIN must contain exactly 6 digits'
).optional();
const kycStatuses = ['PENDING', 'PARTIAL', 'VERIFIED', 'REJECTED', 'EXPIRED'] as const;

export const createCustomerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full Name must be at least 2 characters')
    .max(100, 'Full Name cannot exceed 100 characters'),
  firstName: z.string().trim().max(50).optional(),
  middleName: z.string().trim().max(50).optional(),
  lastName: z.string().trim().max(50).optional(),
  phone: phoneSchema,
  alternatePhone: phoneSchema.optional().or(z.literal('')),
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .optional()
    .or(z.literal('')),
  dateOfBirth: optionalBirthDateSchema,
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().default('OTHER'),
  address: z.string().trim().max(300).optional().default(''),
  city: z.string().trim().max(100).optional().default(''),
  state: z.string().trim().max(100).optional().default(''),
  postalCode: optionalIndianPinSchema.default(''),
  country: z.string().trim().max(100).optional().default('India'),
  photoUrl: z.string().trim().optional(),
  notes: z.string().trim().max(500).optional().default(''),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED', 'ARCHIVED']).optional().default('ACTIVE'),
});

export const updateCustomerSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  firstName: z.string().trim().max(50).optional(),
  middleName: z.string().trim().max(50).optional(),
  lastName: z.string().trim().max(50).optional(),
  phone: phoneSchema.optional(),
  alternatePhone: phoneSchema.optional().or(z.literal('')),
  email: z.string().trim().email().optional().or(z.literal('')),
  dateOfBirth: optionalBirthDateSchema,
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  postalCode: optionalIndianPinSchema,
  country: z.string().trim().max(100).optional(),
  photoUrl: z.string().trim().optional(),
  notes: z.string().trim().max(500).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED', 'ARCHIVED']).optional(),
  isActive: z.boolean().optional(),
  expectedUpdatedAt: z.string().optional(),
});

export const customerQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(200).optional().default(25),
  search: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED', 'ARCHIVED', 'ALL']).optional(),
  kycStatus: z.string().trim().refine((value) =>
    value === 'ALL' || value.split(',').every((status) => kycStatuses.includes(status as typeof kycStatuses[number])),
    'Invalid KYC status filter'
  ).optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  isActive: z
    .string()
    .transform((val) => (val === 'false' ? false : val === 'true' ? true : undefined))
    .optional(),
  sortBy: z.enum(['customerCode', 'fullName', 'phone', 'status', 'kycStatus', 'createdAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const checkDuplicateCustomerSchema = z.object({
  phone: phoneSchema,
  email: z.string().trim().email().optional().or(z.literal('')),
  fullName: z.string().trim().optional(),
  excludeCustomerId: z.string().optional(),
});

export const addKycDocumentSchema = z.object({
  documentType: z.enum(['AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID', 'OTHER']),
  documentNumber: z.string().trim().min(1, 'Document Number is required').max(100),
  documentUrl: z.string().trim().min(1, 'Document file upload is required'),
  documentName: z.string().trim().max(200).optional(),
  mimeType: z.string().trim().optional().default('image/jpeg'),
  fileSize: z.number().optional().default(0),
  expiryDate: z.string().optional(),
  remarks: z.string().trim().max(500).optional().default(''),
  isPrimary: z.boolean().optional().default(false),
});

export const updateKycDocumentSchema = z.object({
  documentType: z.enum(['AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID', 'OTHER']).optional(),
  documentNumber: z.string().trim().min(1).max(100).optional(),
  documentUrl: z.string().trim().optional(),
  documentName: z.string().trim().max(200).optional(),
  mimeType: z.string().trim().optional(),
  fileSize: z.number().optional(),
  expiryDate: z.string().optional(),
  remarks: z.string().trim().max(500).optional(),
  isPrimary: z.boolean().optional(),
});

export const verifyKycDocumentSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED', 'PENDING']),
  rejectionReason: z.string().trim().max(500).optional(),
  remarks: z.string().trim().max(500).optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerQueryParams = z.infer<typeof customerQuerySchema>;
export type AddKycDocumentInput = z.infer<typeof addKycDocumentSchema>;
export type UpdateKycDocumentInput = z.infer<typeof updateKycDocumentSchema>;
export type VerifyKycDocumentInput = z.infer<typeof verifyKycDocumentSchema>;
export type CheckDuplicateCustomerInput = z.infer<typeof checkDuplicateCustomerSchema>;
