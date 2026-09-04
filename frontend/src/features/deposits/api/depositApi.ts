import { apiClient } from '../../../services/apiClient';
import {
  DepositTransaction,
  RefundRequest,
  DepositSummary,
  DepositStats,
  DepositTransactionType,
  RefundStatus,
} from '../types';
import { PaymentMethod, PaymentSource } from '../../payments/types';

export const depositApi = {
  // Get deposit summary for allocation
  getDepositSummary: async (allocationId: string): Promise<DepositSummary> => {
    const res = await apiClient.get<{ success: boolean; data: DepositSummary }>(
      `/deposits/allocation/${allocationId}/summary`
    );
    return res.data.data;
  },

  // Get deposit statistics
  getDepositStats: async (): Promise<DepositStats> => {
    const res = await apiClient.get<{ success: boolean; data: DepositStats }>(
      '/deposits/stats'
    );
    return res.data.data;
  },

  // Get deposit transactions with filters
  getDepositTransactions: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    transactionType?: DepositTransactionType;
    status?: string;
    allocationId?: string;
    customerId?: string;
    lockerId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    transactions: DepositTransaction[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> => {
    const res = await apiClient.get<{
      success: boolean;
      data: {
        transactions: DepositTransaction[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      };
    }>('/deposits', { params });
    return res.data.data;
  },

  // Collect deposit
  collectDeposit: async (data: {
    allocationId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    transactionReference?: string;
    bankReference?: string;
    upiReference?: string;
    chequeNumber?: string;
    bankName?: string;
    chequeDate?: string;
    paymentDate?: string;
    notes?: string;
    source?: PaymentSource;
    allowOverride?: boolean;
    overrideReason?: string;
  }, idempotencyKey?: string): Promise<{
    payment: any;
    transaction: DepositTransaction;
    summary: DepositSummary;
  }> => {
    const res = await apiClient.post<{
      success: boolean;
      data: {
        payment: any;
        transaction: DepositTransaction;
        summary: DepositSummary;
      };
    }>('/deposits/collect', data, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
    return res.data.data;
  },

  // Adjust deposit
  adjustDeposit: async (data: {
    allocationId: string;
    transactionType: 'DEPOSIT_ADJUSTMENT_ADD' | 'DEPOSIT_ADJUSTMENT_DEDUCT';
    amount: number;
    reason: string;
    notes?: string;
    transactionReference?: string;
  }): Promise<{ transaction: DepositTransaction; summary: DepositSummary }> => {
    const res = await apiClient.post<{
      success: boolean;
      data: { transaction: DepositTransaction; summary: DepositSummary };
    }>('/deposits/adjust', data);
    return res.data.data;
  },

  // Cancel deposit transaction
  cancelDepositTransaction: async (
    id: string,
    cancellationReason: string
  ): Promise<{ transaction: DepositTransaction; summary: DepositSummary }> => {
    const res = await apiClient.post<{
      success: boolean;
      data: { transaction: DepositTransaction; summary: DepositSummary };
    }>(`/deposits/${id}/cancel`, { cancellationReason });
    return res.data.data;
  },

  // Closure readiness helper
  getClosureReadiness: async (allocationId: string) => {
    const res = await apiClient.get<{ success: boolean; data: any }>(
      `/deposits/allocation/${allocationId}/closure-readiness`
    );
    return res.data.data;
  },

  // Refunds API
  getRefunds: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: RefundStatus;
    allocationId?: string;
    customerId?: string;
    lockerId?: string;
    requestedBy?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    refunds: RefundRequest[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> => {
    const res = await apiClient.get<{
      success: boolean;
      data: {
        refunds: RefundRequest[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      };
    }>('/refunds', { params });
    return res.data.data;
  },

  getRefundById: async (id: string): Promise<{ refund: RefundRequest; summary: DepositSummary }> => {
    const res = await apiClient.get<{
      success: boolean;
      data: { refund: RefundRequest; summary: DepositSummary };
    }>(`/refunds/${id}`);
    return res.data.data;
  },

  createRefund: async (data: {
    allocationId: string;
    requestedAmount: number;
    reason: string;
    notes?: string;
    isDraft?: boolean;
  }): Promise<RefundRequest> => {
    const res = await apiClient.post<{ success: boolean; data: RefundRequest }>(
      '/refunds',
      data
    );
    return res.data.data;
  },

  submitRefund: async (id: string): Promise<RefundRequest> => {
    const res = await apiClient.post<{ success: boolean; data: RefundRequest }>(
      `/refunds/${id}/submit`
    );
    return res.data.data;
  },

  approveRefund: async (
    id: string,
    data: { approvedAmount: number; notes?: string }
  ): Promise<RefundRequest> => {
    const res = await apiClient.post<{ success: boolean; data: RefundRequest }>(
      `/refunds/${id}/approve`,
      data
    );
    return res.data.data;
  },

  rejectRefund: async (
    id: string,
    data: { rejectionReason: string }
  ): Promise<RefundRequest> => {
    const res = await apiClient.post<{ success: boolean; data: RefundRequest }>(
      `/refunds/${id}/reject`,
      data
    );
    return res.data.data;
  },

  payRefund: async (
    id: string,
    data: {
      refundPaymentMethod: PaymentMethod;
      transactionReference?: string;
      notes?: string;
      paymentDate?: string;
    }
  ): Promise<{
    refund: RefundRequest;
    payment: any;
    transaction: DepositTransaction;
    summary: DepositSummary;
  }> => {
    const res = await apiClient.post<{
      success: boolean;
      data: {
        refund: RefundRequest;
        payment: any;
        transaction: DepositTransaction;
        summary: DepositSummary;
      };
    }>(`/refunds/${id}/pay`, data);
    return res.data.data;
  },

  cancelRefund: async (
    id: string,
    data: { cancellationReason: string }
  ): Promise<RefundRequest> => {
    const res = await apiClient.post<{ success: boolean; data: RefundRequest }>(
      `/refunds/${id}/cancel`,
      data
    );
    return res.data.data;
  },
};
