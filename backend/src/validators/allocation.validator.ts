import { z } from 'zod';
import {
  ALLOCATION_STATUS,
  ALLOCATION_TYPE,
  BILLING_CYCLE,
} from '../constants/allocation.constants';

export const createAllocationSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  lockerId: z.string().min(1, 'Locker ID is required'),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  billingCycle: z.nativeEnum(BILLING_CYCLE).default(BILLING_CYCLE.ANNUAL),
  annualRent: z.number().nonnegative('Rent cannot be negative').optional(),
  securityDeposit: z.number().nonnegative('Deposit cannot be negative').optional(),
  allocationType: z.nativeEnum(ALLOCATION_TYPE).default(ALLOCATION_TYPE.NEW),
  remarks: z.string().max(1000).optional(),
});

export const reserveLockerSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  lockerId: z.string().min(1, 'Locker ID is required'),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  reservationExpiresAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  billingCycle: z.nativeEnum(BILLING_CYCLE).default(BILLING_CYCLE.ANNUAL),
  annualRent: z.number().nonnegative().optional(),
  securityDeposit: z.number().nonnegative().optional(),
  remarks: z.string().max(1000).optional(),
});

export const updateAllocationSchema = z.object({
  remarks: z.string().max(1000).optional(),
  billingCycle: z.nativeEnum(BILLING_CYCLE).optional(),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  expectedUpdatedAt: z.string().or(z.date()).optional(),
});

export const allocationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(25),
  search: z.string().optional(),
  status: z.nativeEnum(ALLOCATION_STATUS).or(z.literal('ALL')).optional(),
  customerId: z.string().optional(),
  lockerId: z.string().optional(),
  size: z.string().optional(),
  rackNumber: z.string().optional(),
  startDateFrom: z.string().optional(),
  startDateTo: z.string().optional(),
  sortBy: z
    .enum(['startDate', 'createdAt', 'allocationCode', 'annualRent', 'status'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateAllocationInput = z.infer<typeof createAllocationSchema>;
export type ReserveLockerInput = z.infer<typeof reserveLockerSchema>;
export type UpdateAllocationInput = z.infer<typeof updateAllocationSchema>;
export type AllocationQueryParams = z.infer<typeof allocationQuerySchema>;
