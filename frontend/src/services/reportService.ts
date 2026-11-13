import { apiClient } from './apiClient';

export interface OperationalReport {
  period: { from: string; to: string };
  summary: { totalLockers: number; occupiedLockers: number; occupancyRate: number; collections: number; billed: number; paid: number; outstanding: number; tax: number; count: number; overdueAccounts: number };
  occupancyBySize: Record<string, Record<string, number>>;
  collectionsByMethod: { method: string; amount: number; count: number }[];
  monthlyCollections: { month: string; amount: number; count: number }[];
  overdue: Array<{ _id: string; invoiceNumber: string; dueDate: string; balanceAmount: number; customerId?: { fullName: string; phone: string }; lockerId?: { lockerNumber: string } }>;
}

export const reportService = {
  async exportLockerDues(params: { status: string; search?: string; size?: string; rackNumber?: string }) {
    try {
      const response = await apiClient.get('/reports/locker-dues/export', { params, responseType: 'blob', timeout: 60000 });
      const url = URL.createObjectURL(response.data), anchor = document.createElement('a');
      try {
        anchor.href = url; anchor.download = `lockers-${params.status.toLowerCase()}.xlsx`; document.body.appendChild(anchor); anchor.click();
      } finally { anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch (error: any) {
      if (error.response?.data instanceof Blob) {
        let message: string | undefined;
        try { message = JSON.parse(await error.response.data.text()).message; } catch { /* Use the normal fallback for non-JSON errors. */ }
        if (message) throw new Error(message);
      }
      throw new Error(error.response?.data?.message || 'Could not export lockers. Please retry.');
    }
  },
  async overview(from: string, to: string) {
    const response = await apiClient.get('/reports/overview', { params: { from, to } });
    return response.data.data as OperationalReport;
  },
  async exportExcel(from: string, to: string) {
    const response = await apiClient.get('/reports/export', { params: { from, to }, responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `vault-report-${to}.xlsx`; anchor.click();
    URL.revokeObjectURL(url);
  },
};
