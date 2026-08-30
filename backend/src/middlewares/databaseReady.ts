import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { errorResponse } from '../utils/apiResponse';

/** Fail fast and consistently while Atlas is reconnecting. */
export const requireDatabaseReady = (_req: Request, res: Response, next: NextFunction): void => {
  if (mongoose.connection.readyState === 1) {
    next();
    return;
  }
  res.setHeader('Retry-After', '3');
  res.status(503).json(errorResponse('Database is reconnecting. Please retry shortly.'));
};
