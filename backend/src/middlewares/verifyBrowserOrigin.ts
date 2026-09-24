import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { errorResponse } from '../utils/apiResponse';

/** Protects cookie-authenticated state-changing endpoints from cross-site requests. */
export const verifyBrowserOrigin = (req: Request, res: Response, next: NextFunction): void => {
  const origin = req.get('origin');
  const referer = req.get('referer');
  const expected = env.CLIENT_URL.replace(/\/$/, '');

  // Non-browser clients without cookie credentials are not subject to browser CSRF.
  if (!origin && !referer) {
    next();
    return;
  }

  let candidate: string | undefined;
  try {
    candidate = origin ? new URL(origin).origin : referer ? new URL(referer).origin : undefined;
  } catch {
    res.status(403).json(errorResponse('Invalid request origin.'));
    return;
  }

  let allowed = false;

  if (candidate) {
    if (
      env.CLIENT_URL === '*' ||
      candidate === expected ||
      candidate.endsWith('.vercel.app') ||
      candidate.endsWith('.onrender.com') ||
      candidate === 'https://mss-locker.vercel.app' ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(candidate)
    ) {
      allowed = true;
    }
  }

  if (!allowed) {
    res.status(403).json(errorResponse('Cross-site request rejected.'));
    return;
  }
  next();
};
