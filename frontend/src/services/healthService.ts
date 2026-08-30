import { apiClient } from './apiClient';
import { HealthStatusResponse } from '../types';

export const fetchHealthStatus = async (): Promise<HealthStatusResponse> => {
  const response = await apiClient.get<HealthStatusResponse>('/health');
  return response.data;
};
