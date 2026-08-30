import { ClientSession, Types } from 'mongoose';
import { AuditLog, AuditAction } from '../models/AuditLog';
import { logger } from './logger';

export interface AuditLogParams {
  actorUserId?: Types.ObjectId | string;
  actorUsername?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export const recordAuditLog = async (params: AuditLogParams, session?: ClientSession): Promise<void> => {
  try {
    const cleanText = (value: string, max: number) => value.replace(/[\r\n\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
    const sanitizeMetadata = (value: unknown, depth = 0): unknown => {
      if (depth > 5) return '[TRUNCATED]';
      if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeMetadata(item, depth + 1));
      if (!value || typeof value !== 'object') return typeof value === 'string' ? cleanText(value, 1000) : value;
      return Object.fromEntries(Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !/password|token|secret|authorization|cookie|documentnumber|aadhaar|pan/i.test(key))
        .map(([key, item]) => [cleanText(key, 100), sanitizeMetadata(item, depth + 1)]));
    };
    const sanitizedMetadata = sanitizeMetadata(params.metadata || {});

    await AuditLog.create([{
      actorUserId: params.actorUserId ? new Types.ObjectId(params.actorUserId.toString()) : undefined,
      actorUsername: cleanText(params.actorUsername || 'SYSTEM', 100),
      action: params.action,
      entityType: cleanText(params.entityType, 100),
      entityId: params.entityId ? cleanText(params.entityId, 150) : undefined,
      description: cleanText(params.description, 2000),
      ipAddress: cleanText(params.ipAddress || '', 100),
      userAgent: cleanText(params.userAgent || '', 500),
      metadata: sanitizedMetadata,
    }], { session });
  } catch (error) {
    logger.error('Failed to write audit log record:', error);
    if (session) throw error;
  }
};
