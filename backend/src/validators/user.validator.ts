import { z } from 'zod';
import { ALL_PERMISSIONS } from '../constants/permissions';
import { isValidPhone } from '../utils/phone';

const optionalPhone = z.string().trim().max(20).refine((value) => !value || isValidPhone(value), 'Invalid phone number').optional();

export const createUserSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').trim(),
    email: z.string().email('Invalid email address').toLowerCase().trim(),
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username cannot exceed 30 characters')
      .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, dashes, dots, and underscores')
      .toLowerCase()
      .trim(),
    phone: optionalPhone,
    roleId: z.string().min(1, 'Role is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED']).default('ACTIVE'),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'User ID is required'),
  }),
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').trim().optional(),
    phone: optionalPhone,
    roleId: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED']).optional(),
    permissionsOverride: z
      .object({
        grant: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).max(200).optional(),
        revoke: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).max(200).optional(),
      })
      .optional(),
  }),
});

export const resetUserPasswordSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'User ID is required'),
  }),
  body: z.object({
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters long')
      .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'New password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'New password must contain at least one number'),
  }),
});

export const queryUsersSchema = z.object({
  query: z.object({
    search: z.string().trim().max(100).optional(),
    role: z.string().trim().max(50).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED', 'ALL']).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  }),
});
