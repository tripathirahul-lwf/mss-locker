import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express { interface Request { requestId?: string } }
}

export const requestContext = (req: Request, res: Response, next: NextFunction): void => {
  const supplied = req.get('x-request-id');
  req.requestId = supplied && /^[a-zA-Z0-9._-]{8,100}$/.test(supplied) ? supplied : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};
