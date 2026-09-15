import { apiClient } from '../../../services/apiClient';
import {
  Payment,
  PaymentStats,
  RecordPaymentInput,
  PaymentQueryParams,
} from '../types';

export const paymentApi = {
  /**
   * Get paginated payment transactions with search and filters
   */
  async getPayments(params: PaymentQueryParams = {}) {
    const response = await apiClient.get<{
      success: boolean;
      data: Payment[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>('/payments', { params });
    return {
      payments: response.data.data,
      pagination: response.data.pagination,
    };
  },

  /**
   * Get dashboard & card payment collection stats
   */
  async getPaymentStats(): Promise<PaymentStats> {
    const response = await apiClient.get<{
      success: boolean;
      data: PaymentStats;
    }>('/payments/stats');
    return response.data.data;
  },

  /**
   * Get single payment dossier
   */
  async getPaymentById(id: string): Promise<Payment> {
    const response = await apiClient.get<{
      success: boolean;
      data: Payment;
    }>(`/payments/${id}`);
    return response.data.data;
  },

  /**
   * Record a new customer payment with optional Idempotency Key
   */
  async recordPayment(
    data: RecordPaymentInput,
    idempotencyKey?: string
  ): Promise<Payment> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const response = await apiClient.post<{
      success: boolean;
      data: Payment;
      message: string;
    }>('/payments', data, { headers });
    return response.data.data;
  },

  /**
   * Cancel a payment transaction
   */
  async cancelPayment(id: string, reason: string): Promise<Payment> {
    const response = await apiClient.post<{
      success: boolean;
      data: Payment;
      message: string;
    }>(`/payments/${id}/cancel`, { reason });
    return response.data.data;
  },

  /**
   * Get all payments for a customer
   */
  async getCustomerPayments(customerId: string): Promise<Payment[]> {
    const response = await apiClient.get<{
      success: boolean;
      data: Payment[];
    }>(`/payments/customer/${customerId}`);
    return response.data.data;
  },

  /**
   * Get all payments for a locker
   */
  async getLockerPayments(lockerId: string): Promise<Payment[]> {
    const response = await apiClient.get<{
      success: boolean;
      data: Payment[];
    }>(`/payments/locker/${lockerId}`);
    return response.data.data;
  },

  /**
   * Get all payments for an invoice
   */
  async getInvoicePayments(invoiceId: string): Promise<Payment[]> {
    const response = await apiClient.get<{
      success: boolean;
      data: Payment[];
    }>(`/payments/invoice/${invoiceId}`);
    return response.data.data;
  },

  /**
   * Get backend-generated print-ready HTML receipt
   */
  async getReceiptHtml(paymentId: string, autoPrint = false): Promise<string> {
    const response = await apiClient.get<string>(`/payments/${paymentId}/receipt-html`, {
      params: { autoprint: autoPrint },
      responseType: 'text' as any,
    });
    return response.data;
  },

  /**
   * Upload payment proof/document (UPI screenshot, bank advice, cheque leaf, POS slip)
   */
  async uploadProof(
    file: File,
    onProgress?: (percentage: number) => void
  ): Promise<{ fileUrl: string; fileKey: string; fileName: string; size: number }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'payments');

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
};

