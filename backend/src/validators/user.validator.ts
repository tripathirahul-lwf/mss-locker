import { z } from 'zod';
import { ALL_PERMISSIONS } from '../constants/permissions';
import { isValidPhone } from '../utils/phone';

const optionalPhone = z.string().trim().max(20).refine((value) => !value || (/^[+\d\s().-]+$/.test(value) && isValidPhone(value)), 'Invalid phone number').optional();

export const createUserSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().trim().email('Invalid email address').max(254).toLowerCase(),
    username: z
      .string().trim()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username cannot exceed 30 characters')
      .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, dashes, dots, and underscores')
      .toLowerCase()
      .trim(),
    phone: optionalPhone,
    roleId: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid role ID'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number').refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password cannot exceed 72 bytes'),
    status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED']).default('ACTIVE'),
  }).strict(),
});

export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid user ID'),
  }),
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
    phone: optionalPhone,
    roleId: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid role ID').optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED']).optional(),
    permissionsOverride: z
      .object({
        grant: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).max(200).optional(),
        revoke: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).max(200).optional(),
      }).strict()
      .optional(),
  }).strict().refine(body => Object.keys(body).length > 0, 'At least one profile field is required'),
});

export const resetUserPasswordSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid user ID'),
  }),
  body: z.object({
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters long')
      .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'New password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'New password must contain at least one number').refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password cannot exceed 72 bytes'),
  }).strict(),
});

export const queryUsersSchema = z.object({
  query: z.object({
    search: z.string().trim().max(100).optional(),
    role: z.string().trim().max(50).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED', 'RESTRICTED', 'ALL']).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  }),
});

export const userIdSchema = z.object({ params: z.object({ id: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid user ID') }) });
