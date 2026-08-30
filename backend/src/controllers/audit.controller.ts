import { Request, Response, NextFunction } from 'express';
import { auditService } from '../services/audit.service';
import { successResponse } from '../utils/apiResponse';
import { z } from 'zod';

const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  search: z.string().trim().max(100).optional(),
  action: z.string().trim().max(100).optional(),
  module: z.string().trim().max(100).optional(),
  userId: z.string().trim().max(50).optional(),
});

export const listAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try { res.json(successResponse('Audit logs retrieved', await auditService.list(auditQuerySchema.parse(req.query)))); }
  catch (error) { next(error); }
};
