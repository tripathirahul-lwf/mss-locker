import { apiClient } from './apiClient';
import { User } from '../types/auth';

export interface GetUsersQuery {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface GetUsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateUserData {
  name: string;
  email: string;
  username: string;
  phone?: string;
  roleId: string;
  password: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
}

export interface UpdateUserData {
  name?: string;
  phone?: string;
  roleId?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  permissionsOverride?: {
    grant?: string[];
    revoke?: string[];
  };
}

export const userService = {
  async getUsers(query: GetUsersQuery = {}, signal?: AbortSignal): Promise<GetUsersResponse> {
    const params = new URLSearchParams();
    if (query.search) params.append('search', query.search);
    if (query.role) params.append('role', query.role);
    if (query.status) params.append('status', query.status);
    if (query.page) params.append('page', query.page.toString());
    if (query.limit) params.append('limit', query.limit.toString());

    const response = await apiClient.get<{ success: boolean; data: GetUsersResponse }>(
      `/users?${params.toString()}`,
      { signal }
    );
    return response.data.data;
  },

  async getUserById(id: string): Promise<User> {
    const response = await apiClient.get<{ success: boolean; data: User }>(`/users/${id}`);
    return response.data.data;
  },

  async createUser(data: CreateUserData): Promise<User> {
    const response = await apiClient.post<{ success: boolean; data: User }>('/users', data);
    return response.data.data;
  },

  async updateUser(id: string, data: UpdateUserData): Promise<User> {
    const response = await apiClient.patch<{ success: boolean; data: User }>(`/users/${id}`, data);
    return response.data.data;
  },

  async resetPassword(id: string, newPassword: string): Promise<string> {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/users/${id}/reset-password`,
      { newPassword }
    );
    return response.data.message;
  },
};
