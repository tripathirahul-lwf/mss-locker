export type NodeEnvironment = 'development' | 'production' | 'test';

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
  environment: NodeEnvironment;
  database: DatabaseHealth;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
  timestamp: string;
}
