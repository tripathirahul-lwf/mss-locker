import { Types } from 'mongoose';
import { AuditLog } from '../models/AuditLog';

export class AuditService {
  async list(query: Record<string, unknown>) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
    const filter: any = {};
    if (query.action) filter.action = String(query.action);
    if (query.module) filter.module = String(query.module);
    if (query.userId && Types.ObjectId.isValid(String(query.userId))) {
      filter.$or = [{ actorUserId: query.userId }, { performedBy: query.userId }];
    }
    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) {
        filter.createdAt.$gte = new Date(String(query.startDate));
      }
      if (query.endDate) {
        const end = new Date(String(query.endDate));
        // If date without time or end of day
        filter.createdAt.$lte = end;
      }
    }
    if (query.search) {
      const escaped = String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$and = [{ $or: [
        { action: new RegExp(escaped, 'i') }, { description: new RegExp(escaped, 'i') },
        { entityType: new RegExp(escaped, 'i') }, { actorUsername: new RegExp(escaped, 'i') },
      ] }];
    }
    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
        .populate('actorUserId', 'name username').populate('performedBy', 'name username').lean(),
      AuditLog.countDocuments(filter),
    ]);
    return { logs, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }
}

export const auditService = new AuditService();
