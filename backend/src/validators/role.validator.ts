import { z } from 'zod';
import { ALL_PERMISSIONS } from '../constants/permissions';

export const updateRoleSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Role ID is required'),
  }),
  body: z.object({
    name: z.string().min(2, 'Role name must be at least 2 characters').trim().optional(),
    description: z.string().trim().max(500).optional(),
    permissions: z
      .array(z.string().refine((val) => ALL_PERMISSIONS.includes(val as any), {
        message: 'Invalid permission code provided',
      }))
      .optional(),
  }),
});
