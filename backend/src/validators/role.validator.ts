import { z } from 'zod';
import { ALL_PERMISSIONS } from '../constants/permissions';

export const updateRoleSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid role ID'),
  }),
  body: z.object({
    name: z.string().trim().min(2, 'Role name must be at least 2 characters').max(120).optional(),
    description: z.string().trim().max(500).optional(),
    permissions: z
      .array(z.string().refine((val) => ALL_PERMISSIONS.includes(val as any), {
        message: 'Invalid permission code provided',
      }))
      .max(200).optional(),
  }).strict().refine(body => Object.keys(body).length > 0, 'At least one role field is required'),
});
