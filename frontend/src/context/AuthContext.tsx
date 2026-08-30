import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types/auth';
import { authService, LoginCredentials } from '../services/authService';
import { offlineSyncService } from '../offline/services/offline-sync.service';

export interface AuthContextValue {
  user: User | null;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  hasPermission: (permission?: string) => boolean;
  hasRole: (roleCode: string | string[]) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize session from HttpOnly cookie via /auth/me or /auth/refresh
  const initSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const currentUser = await authService.restoreSession();
      if (currentUser) {
        setUser(currentUser);
        void offlineSyncService.bindUser(currentUser.id, currentUser.permissions || []).catch((error) => console.warn('Offline cache binding deferred:', error));
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initSession();
  }, [initSession]);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const { user: loggedInUser } = await authService.login(credentials);
      setUser(loggedInUser);
      void offlineSyncService.bindUser(loggedInUser.id, loggedInUser.permissions || []).catch((error) => console.warn('Offline cache binding deferred:', error));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      await offlineSyncService.clearUserCache();
    } catch (err) {
      console.warn('Error during logout:', err);
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  };

  const changePassword = async (currentPass: string, newPass: string) => {
    await authService.changePassword(currentPass, newPass);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const updatedUser = await authService.getMe();
      await offlineSyncService.bindUser(updatedUser.id, updatedUser.permissions || []);
      setUser(updatedUser);
    } catch {
      setUser(null);
    }
  };

  const hasPermission = useCallback(
    (permission?: string): boolean => {
      if (!permission) return true;
      if (!user) return false;
      if (user.isSuperAdmin) return true;
      return user.permissions?.includes(permission) || false;
    },
    [user]
  );

  const hasRole = useCallback(
    (roleCode: string | string[]): boolean => {
      if (!user) return false;
      if (user.isSuperAdmin) return true;
      if (Array.isArray(roleCode)) {
        return roleCode.includes(user.role?.code);
      }
      return user.role?.code === roleCode;
    },
    [user]
  );

  const permissions = user?.permissions || [];
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        isAuthenticated,
        isLoading,
        login,
        logout,
        changePassword,
        hasPermission,
        hasRole,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
