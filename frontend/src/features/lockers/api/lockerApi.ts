import { apiClient } from '../../../services/apiClient';
import {
  Locker,
  LockerStats,
  LockerQueryParams,
  CreateLockerInput,
  UpdateLockerInput,
  PaginatedLockersResponse,
} from '../types';

export const lockerApi = {
  getLockers: async (params: LockerQueryParams = {}, signal?: AbortSignal): Promise<PaginatedLockersResponse> => {
    const response = await apiClient.get('/lockers', { params, signal });
    return response.data.data;
  },

  getLockerStats: async (params: LockerQueryParams = {}, signal?: AbortSignal): Promise<LockerStats> => {
    const response = await apiClient.get('/lockers/stats', { params, signal });
    return response.data.data;
  },

  getAllLockers: async (params: LockerQueryParams = {}, signal?: AbortSignal): Promise<Locker[]> => {
    const pageSize = 2000;
    const firstPage = await lockerApi.getLockers({ ...params, page: 1, limit: pageSize }, signal);
    if (firstPage.pagination.totalPages <= 1) return firstPage.lockers;

    const remainingPages = await Promise.all(
      Array.from({ length: firstPage.pagination.totalPages - 1 }, (_, index) =>
        lockerApi.getLockers({ ...params, page: index + 2, limit: pageSize }, signal)
      )
    );
    return [firstPage.lockers, ...remainingPages.map((page) => page.lockers)].flat();
  },

  getAvailableLockers: async (filters: { size?: string; rackNumber?: string; section?: string } = {}): Promise<Locker[]> => {
    const response = await apiClient.get('/lockers/availability', { params: filters });
    return response.data.data;
  },

  getLockerById: async (id: string): Promise<Locker> => {
    const response = await apiClient.get(`/lockers/${id}`);
    return response.data.data;
  },

  createLocker: async (data: CreateLockerInput): Promise<Locker> => {
    const response = await apiClient.post('/lockers', data);
    return response.data.data;
  },

  bulkImport: async (records: CreateLockerInput[]): Promise<{ insertedCount: number; skippedCount: number; errors: string[] }> => {
    const response = await apiClient.post('/lockers/bulk-import', { records });
    return response.data.data;
  },

  updateLocker: async (id: string, data: UpdateLockerInput): Promise<Locker> => {
    const response = await apiClient.patch(`/lockers/${id}`, data);
    return response.data.data;
  },

  deactivateLocker: async (id: string): Promise<void> => {
    await apiClient.delete(`/lockers/${id}`);
  },
};
