import { Request, Response, NextFunction } from 'express';
import { getHealthStatus } from '../services/healthService';

export const checkHealth = (_req: Request, res: Response, next: NextFunction): void => {
  try {
    const health = getHealthStatus();
    res.status(200).json(health);
  } catch (error) {
    next(error);
  }
};

export const checkLiveness = (_req: Request, res: Response): void => {
  res.status(200).json({ success: true, status: 'alive', timestamp: new Date().toISOString() });
};

export const checkReadiness = (_req: Request, res: Response): void => {
  const health = getHealthStatus();
  const ready = health.database.status === 'connected';
  res.status(ready ? 200 : 503).json({ ...health, success: ready, readiness: ready ? 'ready' : 'not_ready' });
};
