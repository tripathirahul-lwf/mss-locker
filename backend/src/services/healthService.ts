import { getDatabaseHealth } from '../config/database';
import { env } from '../config/env';
import { HealthStatusResponse } from '../types';

const startTime = Date.now();

export const getHealthStatus = (): HealthStatusResponse => {
  return {
    success: true,
    message: 'Locker Management API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    environment: env.NODE_ENV,
    database: getDatabaseHealth(),
  };
};
