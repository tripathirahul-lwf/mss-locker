import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { errorResponse } from '../utils/apiResponse';

export interface AppError extends Error {
  statusCode?: number;
  errors?: unknown;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error(`Error processing ${req.method} ${req.originalUrl}:`, {
    requestId: req.requestId,
    message: err.message,
    stack: err.stack,
  });

  if (err instanceof ZodError) {
    res.status(400).json(
      errorResponse('Validation error', {
        issues: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      })
    );
    return;
  }

  // Handle Mongoose buffering and connection timeout errors
  if (err.message && err.message.includes('buffering timed out')) {
    res.status(503).json(
      errorResponse(
        'Database connection timeout: Unable to reach MongoDB Atlas. Please ensure your IP is whitelisted in MongoDB Atlas Network Access (0.0.0.0/0).'
      )
    );
    return;
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json(
    errorResponse(
      message,
      env.NODE_ENV === 'development'
        ? {
            stack: err.stack,
            details: err.errors,
          }
        : undefined
    )
  );
};
