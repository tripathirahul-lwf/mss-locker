import { LucideIcon } from 'lucide-react';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  description?: string;
  requiredPermission?: string;
  requiredRole?: string | string[];
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export interface DatabaseHealth {
  status: 'connected' | 'connecting' | 'disconnecting' | 'disconnected';
  readyState: number;
  host?: string;
  name?: string;
}

export interface HealthStatusResponse {
  success: boolean;
  message: string;
  version: string;
  timestamp: string;
  uptime: number;
  environment: 'development' | 'production' | 'test';
  database: DatabaseHealth;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
  timestamp: string;
}

export interface DashboardMetric {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
}
