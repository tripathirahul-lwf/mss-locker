import { apiClient } from '../../../services/apiClient';
import {
  GlobalSearchResultData,
  CustomerQuickPreviewData,
  CustomerRenewalHistoryResponse,
  LockerQuickPreviewData,
} from '../types';

export const searchApi = {
  /**
   * Fast global search across customers, lockers, allocations, invoices, and payments
   */
  async globalSearch(
    query: string,
    limit = 6,
    types?: string[],
    signal?: AbortSignal
  ): Promise<GlobalSearchResultData> {
    const response = await apiClient.get<{
      success: boolean;
      data: GlobalSearchResultData;
    }>('/search', {
      params: {
        q: query,
        limit,
        types: types ? types.join(',') : undefined,
      },
      signal,
    });
    return response.data.data;
  },

  /**
   * Walk-in customer quick preview dossier
   */
  async getCustomerQuickPreview(
    customerId: string
  ): Promise<CustomerQuickPreviewData> {
    const response = await apiClient.get<{
      success: boolean;
      data: CustomerQuickPreviewData;
    }>(`/search/customers/${customerId}/quick-preview`);
    return response.data.data;
  },

  /**
   * Lazy-loaded paginated full renewal history for a customer
   */
  async getCustomerRenewalHistory(
    customerId: string,
    page = 1,
    limit = 10
  ): Promise<CustomerRenewalHistoryResponse> {
    const response = await apiClient.get<{
      success: boolean;
      data: any[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/search/customers/${customerId}/renewal-history`, {
      params: { page, limit },
    });
    return {
      invoices: response.data.data,
      pagination: response.data.pagination,
    };
  },

  /**
   * Locker quick preview dossier
   */
  async getLockerQuickPreview(
    lockerId: string
  ): Promise<LockerQuickPreviewData> {
    const response = await apiClient.get<{
      success: boolean;
      data: LockerQuickPreviewData;
    }>(`/search/lockers/${lockerId}/quick-preview`);
    return response.data.data;
  },
};
