import { apiClient } from './apiClient';
import { RolesApiResponse, RoleListItem } from '../types/auth';

export const roleService = {
  async getRoles(): Promise<RolesApiResponse> {
    const response = await apiClient.get<{ success: boolean; data: RolesApiResponse }>('/roles');
    return response.data.data;
  },

  async getRoleById(id: string): Promise<RoleListItem> {
    const response = await apiClient.get<{ success: boolean; data: RoleListItem }>(`/roles/${id}`);
    return response.data.data;
  },

  async updateRole(
    id: string,
    data: { name?: string; description?: string; permissions?: string[] }
  ): Promise<RoleListItem> {
    const response = await apiClient.patch<{ success: boolean; data: RoleListItem }>(
      `/roles/${id}`,
      data
    );
    return response.data.data;
  },
};
