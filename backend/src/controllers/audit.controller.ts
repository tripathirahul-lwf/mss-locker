import { Request, Response, NextFunction } from 'express';
import { auditService } from '../services/audit.service';
import { successResponse } from '../utils/apiResponse';
import { auditCsvCell } from '../utils/auditPresentation';
import { z } from 'zod';

export const listAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try { res.setHeader('Cache-Control', 'private, no-store'); res.json(successResponse('Audit logs retrieved', await auditService.list(req.query))); }
  catch (error) { next(error); }
};
export const exportAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const format = z.enum(['csv', 'json']).parse(req.query.format);
    const result = await auditService.export(req.query);
    const name = `Vault_Audit_${result.exportedAt.slice(0, 10)}.${format}`;
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    if (format === 'json') { res.type('application/json').send(JSON.stringify(result, null, 2)); return; }
    const rows = [['Timestamp (UTC)', 'Action', 'Category', 'Severity', 'Operator', 'Entity', 'Entity ID', 'Description', 'IP Address'],
      ...result.logs.map(log => [new Date(log.createdAt).toISOString(), log.action, log.category, log.severity, log.actorUserId?.name || log.performedBy?.name || log.actorUsername || 'SYSTEM', log.entityType || log.module || '', log.entityId || '', log.description || '', log.ipAddress || ''])];
    res.type('text/csv').send('\uFEFF' + rows.map(row => row.map(auditCsvCell).join(',')).join('\r\n'));
  } catch (error) { next(error); }
};
