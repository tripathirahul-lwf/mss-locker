import { apiClient } from './apiClient';

export interface AuditLogItem {
  _id: string;
  action: string;
  module?: string;
  entityType?: string;
  entityId?: string;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  actorUsername?: string;
  actorUserId?: {
    _id?: string;
    name?: string;
    username?: string;
  };
  performedBy?: {
    _id?: string;
    name?: string;
    username?: string;
  };
  createdAt: string;
}

export const auditService = {
  async list(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      module?: string;
      action?: string;
      startDate?: string;
      endDate?: string;
      userId?: string;
    },
    signal?: AbortSignal
  ) {
    const response = await apiClient.get('/audit-logs', { params, signal });
    return response.data.data as {
      logs: AuditLogItem[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    };
  },
};
