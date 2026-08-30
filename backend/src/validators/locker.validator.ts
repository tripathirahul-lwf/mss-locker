import { z } from 'zod';

export const createLockerSchema = z.object({
  lockerNumber: z
    .string()
    .trim()
    .min(1, 'Locker number is required')
    .max(50, 'Locker number cannot exceed 50 characters'),
  lockerCode: z.string().trim().max(50).optional(),
  size: z.string().trim().min(1, 'Locker size is required').max(20),
  rackNumber: z
    .string()
    .trim()
    .min(1, 'Rack number is required')
    .max(50, 'Rack number cannot exceed 50 characters'),
  section: z.string().trim().max(100).optional().default(''),
  floor: z.string().trim().max(50).optional().default('Ground Floor'),
  position: z.string().trim().max(100).optional().default(''),
  masterKeyReference: z.string().trim().max(100).optional().default(''),
  annualRent: z.number().min(0, 'Annual rent cannot be negative').default(0),
  securityDeposit: z.number().min(0, 'Security deposit cannot be negative').default(0),
  status: z.enum(['VACANT', 'RESERVED', 'OCCUPIED', 'BLOCKED']).optional().default('VACANT'),
  operationalStatus: z
    .enum(['ACTIVE', 'MAINTENANCE', 'DAMAGED', 'DECOMMISSIONED'])
    .optional()
    .default('ACTIVE'),
  remarks: z.string().trim().max(500).optional().default(''),
});

export const updateLockerSchema = z.object({
  lockerNumber: z
    .string()
    .trim()
    .min(1, 'Locker number cannot be empty')
    .max(50, 'Locker number cannot exceed 50 characters')
    .optional(),
  lockerCode: z.string().trim().max(50).optional(),
  size: z.string().trim().min(1).max(20).optional(),
  rackNumber: z.string().trim().min(1).max(50).optional(),
  section: z.string().trim().max(100).optional(),
  floor: z.string().trim().max(50).optional(),
  position: z.string().trim().max(100).optional(),
  masterKeyReference: z.string().trim().max(100).optional(),
  annualRent: z.number().min(0, 'Annual rent cannot be negative').optional(),
  securityDeposit: z.number().min(0, 'Security deposit cannot be negative').optional(),
  status: z.enum(['VACANT', 'RESERVED', 'OCCUPIED', 'BLOCKED']).optional(),
  operationalStatus: z.enum(['ACTIVE', 'MAINTENANCE', 'DAMAGED', 'DECOMMISSIONED']).optional(),
  remarks: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
  expectedUpdatedAt: z.string().optional(), // For optimistic concurrency check
});

export const lockerQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(2000).optional().default(25),
  search: z.string().trim().optional(),
  size: z.string().trim().optional(),
  status: z.enum(['VACANT', 'RESERVED', 'OCCUPIED', 'BLOCKED', 'ALL']).optional(),
  operationalStatus: z
    .enum(['ACTIVE', 'MAINTENANCE', 'DAMAGED', 'DECOMMISSIONED', 'ALL'])
    .optional(),
  rackNumber: z.string().trim().optional(),
  section: z.string().trim().optional(),
  isActive: z
    .string()
    .transform((val) => (val === 'false' ? false : val === 'true' ? true : undefined))
    .optional(),
  compact: z.preprocess(
    (val) => val === true || val === 'true',
    z.boolean()
  ).optional().default(false),
  sortBy: z.enum(['lockerNumber', 'size', 'rackNumber', 'status', 'operationalStatus', 'annualRent', 'createdAt']).optional().default('lockerNumber'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

export type CreateLockerInput = z.infer<typeof createLockerSchema>;
export type UpdateLockerInput = z.infer<typeof updateLockerSchema>;
export type LockerQueryParams = z.infer<typeof lockerQuerySchema>;
