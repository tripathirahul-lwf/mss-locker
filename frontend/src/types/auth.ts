export interface UserRole {
  id?: string;
  _id?: string;
  name: string;
  code: string;
  description?: string;
  permissions?: string[];
  isSystemRole?: boolean;
}

export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  username: string;
  phone?: string;
  role: UserRole;
  isSuperAdmin: boolean;
  permissions: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  lastLoginAt?: string;
  lastLoginIp?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface RoleListItem {
  id: string;
  name: string;
  code: string;
  description: string;
  permissions: string[];
  isSystemRole: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  userCount: number;
  createdAt: string;
}

export interface PermissionItem {
  code: string;
  name: string;
  description: string;
}

export interface PermissionGroup {
  module: string;
  description: string;
  permissions: PermissionItem[];
}

export interface RolesApiResponse {
  roles: RoleListItem[];
  permissionGroups: PermissionGroup[];
  allPermissions: string[];
}
