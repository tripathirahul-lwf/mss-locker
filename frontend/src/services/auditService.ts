import { apiClient } from './apiClient';

export interface AuditLogItem {
  _id: string;
  action: string;
  category?: string;
  severity?: 'SUCCESS' | 'INFO' | 'WARNING' | 'DANGER';
  details?: Record<string, unknown>;
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
      category?: string;
      severity?: string;
      period?: string;
      action?: string;
      mutationsOnly?: boolean;
      startDate?: string;
      endDate?: string;
      userId?: string;
    },
    signal?: AbortSignal
  ) {
    const response = await apiClient.get('/audit-logs', { params, signal });
    return response.data.data as {
      logs: AuditLogItem[];
      summary: { total: number; successfulLogins: number; failedAttempts: number; mutations: number };
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    };
  },
  async export(params: { search?: string; category?: string; severity?: string; period?: string; action?: string; mutationsOnly?: boolean }, format: 'csv' | 'json') {
    try {
      const response = await apiClient.get('/audit-logs/export', { params: { ...params, format }, responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url; link.download = `Vault_Audit_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error: any) {
      if (error.response?.data instanceof Blob) {
        try { error.message = JSON.parse(await error.response.data.text()).message || error.message; } catch { /* retain network message */ }
      }
      throw error;
    }
  },
};
