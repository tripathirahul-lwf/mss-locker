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
