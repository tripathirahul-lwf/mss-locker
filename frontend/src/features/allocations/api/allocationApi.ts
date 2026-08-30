import { apiClient } from '../../../services/apiClient';
import {
  LockerAllocation,
  CreateAllocationInput,
  ReserveLockerInput,
  UpdateAllocationInput,
  AllocationQueryParams,
  AllocationStats,
} from '../types';

export const allocationApi = {
  /**
   * List paginated allocations
   */
  async getAllocations(params: AllocationQueryParams = {}) {
    const response = await apiClient.get<{
      success: boolean;
      data: {
        allocations: LockerAllocation[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };
    }>('/allocations', { params });
    return response.data.data;
  },

  /**
   * Allocation Summary Stats
   */
  async getAllocationStats() {
    const response = await apiClient.get<{
      success: boolean;
      data: AllocationStats;
    }>('/allocations/stats');
    return response.data.data;
  },

  /**
   * Single Allocation Details
   */
  async getAllocationById(id: string) {
    const response = await apiClient.get<{
      success: boolean;
      data: LockerAllocation;
    }>(`/allocations/${id}`);
    return response.data.data;
  },

  /**
   * Create New Allocation
   */
  async createAllocation(data: CreateAllocationInput) {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
      data: LockerAllocation;
    }>('/allocations', data);
    return response.data.data;
  },

  /**
   * Reserve Locker
   */
  async reserveLocker(data: ReserveLockerInput) {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
      data: LockerAllocation;
    }>('/allocations/reserve', data);
    return response.data.data;
  },

  /**
   * Activate Reserved Allocation
   */
  async activateReservation(id: string) {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
      data: LockerAllocation;
    }>(`/allocations/${id}/activate`);
    return response.data.data;
  },

  /**
   * Cancel Reservation
   */
  async cancelReservation(id: string) {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
      data: LockerAllocation;
    }>(`/allocations/${id}/cancel`);
    return response.data.data;
  },

  /**
   * Update Allocation Details
   */
  async updateAllocation(id: string, data: UpdateAllocationInput) {
    const response = await apiClient.patch<{
      success: boolean;
      message: string;
      data: LockerAllocation;
    }>(`/allocations/${id}`, data);
    return response.data.data;
  },

  /**
   * Get Customer Allotments
   */
  async getCustomerAllocations(customerId: string) {
    const response = await apiClient.get<{
      success: boolean;
      data: {
        activeAllocation: LockerAllocation | null;
        history: LockerAllocation[];
        totalAllocations: number;
      };
    }>(`/customers/${customerId}/allocations`);
    return response.data.data;
  },

  /**
   * Get Locker Tenancy History
   */
  async getLockerAllocations(lockerId: string) {
    const response = await apiClient.get<{
      success: boolean;
      data: {
        currentAllocation: LockerAllocation | null;
        history: LockerAllocation[];
        totalTenancies: number;
      };
    }>(`/lockers/${lockerId}/allocations`);
    return response.data.data;
  },
};
