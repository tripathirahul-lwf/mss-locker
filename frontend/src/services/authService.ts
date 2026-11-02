import { AxiosError } from 'axios';
import { apiClient,setAccessToken } from './apiClient';
import { User } from '../types/auth';

const SESSION_HINT_KEY = 'mss-locker-session';
let restorePromise: Promise<User | null> | null = null;

const setSessionHint = (active: boolean) => {
  if (active) localStorage.setItem(SESSION_HINT_KEY, 'active');
  else localStorage.removeItem(SESSION_HINT_KEY);
};

export interface LoginCredentials {
  identifier: string;
  password: string;
}

export interface LoginResponseData {
  accessToken: string;
  user: User;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<LoginResponseData> {
    const response = await apiClient.post<{ success: boolean; message: string; data: LoginResponseData }>(
      '/auth/login',
      credentials
    );
    const data = response.data.data;
    setAccessToken(data.accessToken);
    setSessionHint(true);
    return data;
  },

  async refresh(): Promise<{ accessToken: string; user: User }> {
    const response = await apiClient.post<{ success: boolean; data: { accessToken: string; user: User } }>(
      '/auth/refresh'
    );
    const newToken = response.data.data.accessToken;
    setAccessToken(newToken);
    setSessionHint(true);
    return { accessToken: newToken, user: response.data.data.user };
  },

  async getMe(): Promise<User> {
    const response = await apiClient.get<{ success: boolean; data: { user: User } }>('/auth/me');
    return response.data.data.user;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setSessionHint(false);
    }
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<string> {
    const response = await apiClient.post<{ success: boolean; message: string }>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    setAccessToken(null);
    setSessionHint(false);
    return response.data.message;
  },

  async restoreSession(): Promise<User | null> {
    if (!localStorage.getItem(SESSION_HINT_KEY)) return null;
    if (!restorePromise) {
      restorePromise = (async () => {
        try {
          const restored = await authService.refresh();
          return restored.user;
        } catch (error) {
          const status = (error as AxiosError)?.response?.status;
          if (status === 400 || status === 401 || status === 403) {
            setAccessToken(null);
            setSessionHint(false);
            return null;
          }
          // Preserve the session hint on outages; retry through an explicit reload.
          throw error;
        } finally {
          restorePromise = null;
        }
      })();
    }
    return restorePromise;
  },
};
