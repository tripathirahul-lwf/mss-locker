import { apiClient } from './apiClient';
export interface SystemSettings { businessName: string; branchName: string; address: string; gstin: string; invoicePrefix: string; receiptPrefix: string; renewalReminderDays: number; offlineCacheHours: number }
export interface TariffPlan { _id: string; size: string; annualRent: number; securityDeposit: number; effectiveFrom: string; version: number; notes?: string }
export const settingService = {
  async get() { const r = await apiClient.get('/settings'); return r.data.data as { settings: SystemSettings; tariffs: TariffPlan[] }; },
  async update(settings: SystemSettings) { const r = await apiClient.put('/settings', settings); return r.data.data as SystemSettings; },
  async revise(input: { size: string; annualRent: number; securityDeposit: number; effectiveFrom: string; notes?: string }) { const r = await apiClient.post('/settings/tariffs/revisions', input); return r.data.data as TariffPlan; },
  async history(size: string) { const r = await apiClient.get(`/settings/tariffs/${encodeURIComponent(size)}/history`); return r.data.data as TariffPlan[]; },
};
