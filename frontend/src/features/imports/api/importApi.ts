import { apiClient } from '../../../services/apiClient';
import {
  ImportJob,
  UploadResponseData,
  ValidationResponseData,
} from '../types';

export const importApi = {
  /**
   * Uploads an Excel or CSV file
   */
  async uploadFile(formData: FormData): Promise<UploadResponseData> {
    const response = await apiClient.post<{
      success: boolean;
      data: UploadResponseData;
    }>('/imports/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  /**
   * Runs dry-run validation on mapped columns
   */
  async validateJob(
    jobId: string,
    payload: {
      columnMappings?: Record<string, Record<string, string>>;
      lockersSheet?: string;
      renewalSheet?: string;
    }
  ): Promise<ValidationResponseData> {
    const response = await apiClient.post<{
      success: boolean;
      data: ValidationResponseData;
    }>(`/imports/${jobId}/validate`, payload);
    return response.data.data;
  },

  /**
   * Commits validated import job
   */
  async commitJob(jobId: string): Promise<{ job: ImportJob; reconciliation: any }> {
    const response = await apiClient.post<{
      success: boolean;
      data: { job: ImportJob; reconciliation: any };
    }>(`/imports/${jobId}/commit`);
    return response.data.data;
  },

  /**
   * Lists historical import jobs
   */
  async getImportJobs(
    page = 1,
    limit = 10
  ): Promise<{
    jobs: ImportJob[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const response = await apiClient.get<{
      success: boolean;
      data: ImportJob[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/imports', {
      params: { page, limit },
    });
    return {
      jobs: response.data.data,
      pagination: response.data.pagination,
    };
  },

  /**
   * Fetches full job details by ID
   */
  async getImportJobById(jobId: string): Promise<ImportJob> {
    const response = await apiClient.get<{
      success: boolean;
      data: ImportJob;
    }>(`/imports/${jobId}`);
    return response.data.data;
  },

  /**
   * Downloads row validation error CSV
   */
  async downloadErrorsCsv(jobId: string, jobNumber: string): Promise<void> {
    const response = await apiClient.get(`/imports/${jobId}/errors`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${jobNumber}-validation-issues.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  /**
   * Safely rolls back an import job
   */
  async rollbackJob(jobId: string, reason: string): Promise<ImportJob> {
    const response = await apiClient.post<{
      success: boolean;
      data: ImportJob;
    }>(`/imports/${jobId}/rollback`, { reason });
    return response.data.data;
  },

  /**
   * Downloads official migration template (.xlsx)
   */
  async downloadTemplate(type: 'full-migration' | 'lockers' | 'customers'): Promise<void> {
    const response = await apiClient.get(`/imports/templates/${type}`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(
      new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    );
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `vault-ledger-${type}-template.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
};
