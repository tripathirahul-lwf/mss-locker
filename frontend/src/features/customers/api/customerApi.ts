import { apiClient } from '../../../services/apiClient';
import {
  Customer,
  CustomerKycDocument,
  CustomerStats,
  CustomerQueryParams,
  CreateCustomerInput,
  UpdateCustomerInput,
  AddKycDocumentInput,
  UpdateKycDocumentInput,
  VerifyKycDocumentInput,
  CheckDuplicateCustomerResult,
  PaginatedCustomersResponse,
} from '../types';

export const customerApi = {
  getCustomers: async (params: CustomerQueryParams = {}, signal?: AbortSignal): Promise<PaginatedCustomersResponse> => {
    const response = await apiClient.get('/customers', { params, signal });
    return response.data.data;
  },

  getCustomerStats: async (signal?: AbortSignal): Promise<CustomerStats> => {
    const response = await apiClient.get('/customers/stats', { signal });
    return response.data.data;
  },

  checkDuplicate: async (data: {
    phone: string;
    email?: string;
    fullName?: string;
    excludeCustomerId?: string;
  }): Promise<CheckDuplicateCustomerResult> => {
    const response = await apiClient.post('/customers/check-duplicate', data);
    return response.data.data;
  },

  getCustomerById: async (id: string, signal?: AbortSignal): Promise<Customer> => {
    const response = await apiClient.get(`/customers/${id}`, { signal });
    return response.data.data;
  },

  createCustomer: async (data: CreateCustomerInput): Promise<Customer> => {
    const response = await apiClient.post('/customers', data);
    return response.data.data;
  },

  updateCustomer: async (id: string, data: UpdateCustomerInput): Promise<Customer> => {
    const response = await apiClient.patch(`/customers/${id}`, data);
    return response.data.data;
  },

  deactivateCustomer: async (id: string): Promise<void> => {
    await apiClient.delete(`/customers/${id}`);
  },

  // KYC Endpoints
  getKycDocuments: async (customerId: string): Promise<CustomerKycDocument[]> => {
    const response = await apiClient.get(`/customers/${customerId}/kyc`);
    return response.data.data;
  },

  addKycDocument: async (
    customerId: string,
    data: AddKycDocumentInput
  ): Promise<CustomerKycDocument> => {
    const response = await apiClient.post(`/customers/${customerId}/kyc`, data);
    return response.data.data;
  },

  updateKycDocument: async (
    customerId: string,
    kycId: string,
    data: UpdateKycDocumentInput
  ): Promise<CustomerKycDocument> => {
    const response = await apiClient.patch(`/customers/${customerId}/kyc/${kycId}`, data);
    return response.data.data;
  },

  verifyKycDocument: async (
    customerId: string,
    kycId: string,
    data: VerifyKycDocumentInput
  ): Promise<CustomerKycDocument> => {
    const response = await apiClient.post(
      `/customers/${customerId}/kyc/${kycId}/verify`,
      data
    );
    return response.data.data;
  },

  deleteKycDocument: async (customerId: string, kycId: string): Promise<void> => {
    await apiClient.delete(`/customers/${customerId}/kyc/${kycId}`);
  },

  // File Upload Endpoint
  uploadFile: async (
    file: File,
    folder: 'photos' | 'kyc' | 'general' = 'general',
    onProgress?: (percentage: number) => void
  ): Promise<{ fileUrl: string; fileKey: string; fileName: string; size: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const response = await apiClient.post('/upload/file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60_000,
      onUploadProgress: (event) => {
        if (event.total) onProgress?.(Math.min(99, Math.round((event.loaded * 100) / event.total)));
      },
    });
    return response.data.data;
  },

  deleteUploadedFile: async (fileUrl: string): Promise<void> => {
    await apiClient.delete('/upload/file', { data: { fileUrl } });
  },

  openProtectedFile: async (url: string): Promise<void> => {
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    try {
      const response = await apiClient.get(url, { responseType: 'blob' });
      const objectUrl = URL.createObjectURL(response.data);
      if (popup) popup.location.href = objectUrl;
      else window.open(objectUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      popup?.close();
      throw error;
    }
  },
};
