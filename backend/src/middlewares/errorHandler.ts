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
        issues: err.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      })
    );
    return;
  }

  // Handle Mongoose buffering and connection timeout errors
  if (/Mongo(Network|ServerSelection|TopologyClosed|NotConnected)|MongooseServerSelection/.test(err.name) || /buffering timed out|before initial connection is complete/i.test(err.message || '')) {
    res.status(503).json(
      errorResponse(
        'Database temporarily unavailable. Please retry shortly.'
      )
    );
    return;
  }

  if ((err as any).code === 11000) {
    res.status(409).json(errorResponse('A receipt, document or request already exists. Refresh and review before retrying.')); return;
  }
  if (err.name === 'CastError' || err.name === 'ValidationError') { res.status(400).json(errorResponse('Invalid request data. Check the identifiers, dates and field values.')); return; }
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
