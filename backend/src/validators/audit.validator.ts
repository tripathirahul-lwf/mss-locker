import { z } from 'zod';
const auditDate = z.union([z.iso.date(), z.iso.datetime({ offset: true })]);
export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(100).optional(),
  mutationsOnly: z.union([z.boolean(), z.enum(['true', 'false']).transform(value => value === 'true')]).default(false),
  action: z.string().trim().max(100).optional(),
  category: z.enum(['ALL', 'AUTH', 'LOCKER', 'CUSTOMER', 'PAYMENT', 'SYSTEM']).default('ALL'),
  severity: z.enum(['ALL', 'SUCCESS', 'INFO', 'WARNING', 'DANGER']).default('ALL'),
  period: z.enum(['ALL', 'TODAY', '24H', '7D', '30D']).default('ALL'),
  module: z.string().trim().max(100).optional(),
  userId: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid operator ID').optional(),
  startDate: auditDate.optional(), endDate: auditDate.optional(),
}).superRefine((value, ctx) => {
  if (value.startDate && value.endDate && new Date(value.startDate.length === 10 ? `${value.startDate}T00:00:00+05:30` : value.startDate).getTime() > new Date(value.endDate.length === 10 ? `${value.endDate}T23:59:59.999+05:30` : value.endDate).getTime()) ctx.addIssue({ code: 'custom', message: 'Start date must not be after end date', path: ['endDate'] });
  if (value.period !== 'ALL' && (value.startDate || value.endDate)) ctx.addIssue({ code: 'custom', message: 'Choose a period or custom dates, not both', path: ['period'] });
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;
