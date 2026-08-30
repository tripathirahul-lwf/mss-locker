import { apiClient } from '../../../services/apiClient';
import {
  LockerClosure,
  ClosureStats,
  ClosureReadinessSummary,
  ClosureQueryParams,
  ClosureType,
  PhysicalChecklist,
} from '../types';

export interface CreateClosurePayload {
  allocationId: string;
  closureType?: ClosureType;
  closureReason: string;
  requestedClosureDate?: string;
  physicalChecklist?: Partial<PhysicalChecklist>;
  notes?: string;
}

export const closureApi = {
  /**
   * Get paginated closures with search and filters
   */
  async getClosures(params: ClosureQueryParams = {}) {
    const response = await apiClient.get<{
      success: boolean;
      data: LockerClosure[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>('/closures', { params });
    return {
      closures: response.data.data,
      pagination: response.data.pagination,
    };
  },

  /**
   * Get closure statistics for summary cards
   */
  async getClosureStats(): Promise<ClosureStats> {
    const response = await apiClient.get<{
      success: boolean;
      data: ClosureStats;
    }>('/closures/stats');
    return response.data.data;
  },

  /**
   * Get single closure dossier by ID
   */
  async getClosureById(id: string): Promise<LockerClosure> {
    const response = await apiClient.get<{
      success: boolean;
      data: LockerClosure;
    }>(`/closures/${id}`);
    return response.data.data;
  },

  /**
   * Calculate live financial & physical checklist readiness
   */
  async getClosureReadiness(
    idOrAllocationId: string,
    checklist?: Partial<PhysicalChecklist>
  ): Promise<ClosureReadinessSummary> {
    const response = await apiClient.post<{
      success: boolean;
      data: ClosureReadinessSummary;
    }>(`/closures/${idOrAllocationId}/readiness`, { checklist });
    return response.data.data;
  },

  /**
   * Initiate a new Locker Closure
   */
  async createClosure(payload: CreateClosurePayload): Promise<LockerClosure> {
    const response = await apiClient.post<{
      success: boolean;
      data: LockerClosure;
      message: string;
    }>('/closures', payload);
    return response.data.data;
  },

  /**
   * Submit a DRAFT closure for review
   */
  async submitClosure(id: string): Promise<LockerClosure> {
    const response = await apiClient.post<{
      success: boolean;
      data: LockerClosure;
      message: string;
    }>(`/closures/${id}/submit`);
    return response.data.data;
  },

  /**
   * Operational review of closure
   */
  async reviewClosure(
    id: string,
    reviewNotes?: string,
    checklist?: Partial<PhysicalChecklist>
  ): Promise<LockerClosure> {
    const response = await apiClient.post<{
      success: boolean;
      data: LockerClosure;
      message: string;
    }>(`/closures/${id}/review`, { reviewNotes, checklist });
    return response.data.data;
  },

  /**
   * Maker-Checker approval of closure
   */
  async approveClosure(
    id: string,
    approvalNotes?: string,
    overrideFinancial = false,
    overrideReason?: string
  ): Promise<LockerClosure> {
    const response = await apiClient.post<{
      success: boolean;
      data: LockerClosure;
      message: string;
    }>(`/closures/${id}/approve`, {
      approvalNotes,
      overrideFinancial,
      overrideReason,
    });
    return response.data.data;
  },

  /**
   * Execute final completion, release locker, and archive records
   */
  async completeClosure(
    id: string,
    completionNotes?: string
  ): Promise<LockerClosure> {
    const response = await apiClient.post<{
      success: boolean;
      data: LockerClosure;
      message: string;
    }>(`/closures/${id}/complete`, { completionNotes });
    return response.data.data;
  },

  /**
   * Reject closure request
   */
  async rejectClosure(id: string, reason: string): Promise<LockerClosure> {
    const response = await apiClient.post<{
      success: boolean;
      data: LockerClosure;
      message: string;
    }>(`/closures/${id}/reject`, { reason });
    return response.data.data;
  },

  /**
   * Cancel closure request
   */
  async cancelClosure(id: string, reason: string): Promise<LockerClosure> {
    const response = await apiClient.post<{
      success: boolean;
      data: LockerClosure;
      message: string;
    }>(`/closures/${id}/cancel`, { reason });
    return response.data.data;
  },

  /**
   * Get backend-generated print-ready HTML closure certificate
   */
  async getStatementHtml(closureId: string, autoPrint = false): Promise<string> {
    const response = await apiClient.get<string>(
      `/closures/${closureId}/statement-html`,
      {
        params: { autoprint: autoPrint },
        responseType: 'text' as any,
      }
    );
    return response.data;
  },
};
