import { Request,Response,NextFunction } from 'express';
import { isAllowedOrigin } from '../utils/origin';
import { env } from '../config/env';
import { errorResponse } from '../utils/apiResponse';

/** Protects cookie-authenticated state-changing endpoints from cross-site requests. */
export const verifyBrowserOrigin = (req: Request, res: Response, next: NextFunction): void => {
  const origin = req.get('origin');
  const referer = req.get('referer');

  // Non-browser clients without cookie credentials are not subject to browser CSRF.
  if (!origin && !referer) {
    if (req.cookies?.vault_refresh_token || req.cookies?.['__Host-vault_refresh_token']) {
      res.status(403).json(errorResponse('Browser origin required for cookie-authenticated changes.')); return;
    }
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

  const allowed = candidate && isAllowedOrigin(candidate, env.CLIENT_URL, env.NODE_ENV);

  if (!allowed) {
    res.status(403).json(errorResponse('Cross-site request rejected.'));
    return;
  }
  next();
};
