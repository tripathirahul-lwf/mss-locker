import { Types } from 'mongoose';
import { AuditLog } from '../models/AuditLog';
import { User } from '../models/User';
import { auditQuerySchema,AuditQuery } from '../validators/audit.validator';
import { auditPresentationStages,escapeAuditSearch,redactAuditValue } from '../utils/auditPresentation';

const IST_OFFSET = 330 * 60 * 1000;
function dateBoundary(value: string, end = false): Date {
  if (value.length !== 10) return new Date(value);
  return new Date(Date.parse(`${value}T00:00:00.000Z`) - IST_OFFSET + (end ? 86400000 - 1 : 0));
}
export class AuditService {
  private async stages(query: AuditQuery, now = new Date()) {
    const match: any = {};
    if (query.action) match.action = query.action;
    const moduleCategory = ['AUTH', 'LOCKER', 'CUSTOMER', 'PAYMENT', 'SYSTEM'].includes(query.module || '') ? query.module : undefined;
    if (query.module && !moduleCategory) match.$or = [{ module: query.module }, { entityType: query.module }];
    if (query.userId) match.$and = [{ $or: [{ actorUserId: new Types.ObjectId(query.userId) }, { performedBy: new Types.ObjectId(query.userId) }] }];
    if (query.period !== 'ALL') {
      const shifted = new Date(now.getTime() + IST_OFFSET);
      const today = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - IST_OFFSET;
      const durations = { '24H': 86400000, '7D': 7 * 86400000, '30D': 30 * 86400000 };
      match.createdAt = { $gte: new Date(query.period === 'TODAY' ? today : now.getTime() - durations[query.period]), $lte: now };
    } else if (query.startDate || query.endDate) {
      match.createdAt = {};
      if (query.startDate) match.createdAt.$gte = dateBoundary(query.startDate);
      if (query.endDate) match.createdAt.$lte = dateBoundary(query.endDate, true);
    }
    if (query.search) {
      const regex = new RegExp(escapeAuditSearch(query.search), 'i');
      const users = await User.find({ $or: [{ name: regex }, { username: regex }] }).select('_id').lean();
      (match.$and ||= []).push({ $or: [
        ...['action', 'description', 'entityType', 'module', 'entityId', 'actorUsername', 'ipAddress'].map(field => ({ [field]: regex })),
        { actorUserId: { $in: users.map(user => user._id) } }, { performedBy: { $in: users.map(user => user._id) } },
      ] });
    }
    const derived: any = {};
    if (query.category !== 'ALL' || moduleCategory) derived.category = query.category === 'ALL' ? moduleCategory : query.category;
    if (query.severity !== 'ALL') derived.severity = query.severity;
    if (query.mutationsOnly) derived.isLedgerMutation = true;
    return [{ $match: match }, ...auditPresentationStages, { $match: derived }];
  }
  private async present(logs: any[]) {
    await AuditLog.populate(logs, [{ path: 'actorUserId', select: 'name username', options: { lean: true } }, { path: 'performedBy', select: 'name username', options: { lean: true } }]);
    return logs.map(log => redactAuditValue({ ...log, metadata: { ...(log.details || {}), ...(log.metadata || {}) } }));
  }
  async list(input: Record<string, unknown>) {
    const query = auditQuerySchema.parse(input);
    const stages = await this.stages(query);
    const [result] = await AuditLog.aggregate([...stages, { $facet: {
      logs: [{ $sort: { createdAt: -1, _id: -1 } }, { $skip: (query.page - 1) * query.limit }, { $limit: query.limit }],
      summary: [{ $group: { _id: null, total: { $sum: 1 }, successfulLogins: { $sum: { $cond: [{ $eq: ['$action', 'LOGIN_SUCCESS'] }, 1, 0] } },
        failedAttempts: { $sum: { $cond: [{ $eq: ['$severity', 'DANGER'] }, 1, 0] } },
        mutations: { $sum: { $cond: ['$isLedgerMutation', 1, 0] } },
      } }],
    } }]);
    const { _id, ...summary } = result.summary[0] || { total: 0, successfulLogins: 0, failedAttempts: 0, mutations: 0 };
    return { logs: await this.present(result.logs), summary, pagination: { page: query.page, limit: query.limit, total: summary.total, totalPages: Math.max(1, Math.ceil(summary.total / query.limit)) } };
  }
  async export(input: Record<string, unknown>) {
    const query = auditQuerySchema.parse(input);
    const now = new Date();
    const stages = await this.stages(query, now);
    const logs = await AuditLog.aggregate([...stages, { $match: { createdAt: { $lte: now } } }, { $sort: { createdAt: -1, _id: -1 } }, { $limit: 10001 }]);
    if (logs.length > 10000) throw Object.assign(new Error('Export exceeds 10,000 events. Narrow the filters or period and retry.'), { statusCode: 413 });
    return { logs: await this.present(logs), exportedAt: now.toISOString() };
  }
}
export const auditService = new AuditService();
