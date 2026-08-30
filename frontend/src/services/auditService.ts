import { apiClient } from './apiClient';

export interface AuditLogItem {
  _id: string; action: string; module?: string; entityType?: string; description?: string;
  actorUsername?: string; actorUserId?: { name?: string; username?: string };
  performedBy?: { name?: string; username?: string }; createdAt: string;
}

export const auditService = {
  async list(params: { page?: number; search?: string; module?: string; action?: string }, signal?: AbortSignal) {
    const response = await apiClient.get('/audit-logs', { params, signal });
    return response.data.data as { logs: AuditLogItem[]; pagination: { page: number; total: number; totalPages: number } };
  },
};
