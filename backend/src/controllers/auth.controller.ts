import { Request,Response,NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { env } from '../config/env';
import { successResponse,errorResponse } from '../utils/apiResponse';

const IS_PRODUCTION = env.NODE_ENV === 'production';
const REFRESH_COOKIE_NAME = IS_PRODUCTION ? '__Host-vault_refresh_token' : 'vault_refresh_token';
const REFRESH_COOKIE_NAMES = ['__Host-vault_refresh_token', 'vault_refresh_token'];

const baseCookieOptions = () => ({
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: (IS_PRODUCTION ? 'none' : 'lax') as 'none' | 'lax',
  path: '/',
});

/**
 * In production the SPA (vercel.app) and the API (onrender.com) are different
 * sites, so the refresh cookie is a third-party cookie. Browsers that block
 * third-party cookies (Chrome/Edge settings, incognito, tracking protection)
 * silently drop an unpartitioned cookie, which makes /auth/refresh return 401
 * once the short-lived access token expires. A Partitioned (CHIPS) cookie is
 * still stored and sent, keyed to the SPA's top-level site.
 */
const clearLegacyUnpartitionedCookies = (res: Response): void => {
  for (const name of REFRESH_COOKIE_NAMES) res.clearCookie(name, baseCookieOptions());
};

const setRefreshCookie = (res: Response, token: string): void => {
  if (IS_PRODUCTION) clearLegacyUnpartitionedCookies(res);
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...baseCookieOptions(),
    partitioned: IS_PRODUCTION,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
};

const clearRefreshCookie = (res: Response): void => {
  clearLegacyUnpartitionedCookies(res);
  if (IS_PRODUCTION) {
    for (const name of REFRESH_COOKIE_NAMES) res.clearCookie(name, { ...baseCookieOptions(), partitioned: true });
  }
};

/**
 * During the migration a browser may hold both a legacy unpartitioned cookie and
 * a partitioned one under the same name; cookie-parser keeps only the first.
 * Collect every candidate from the raw header so a stale value cannot mask a
 * valid one.
 */
const getRefreshTokenCandidates = (req: Request): string[] => {
  const values: string[] = [];
  for (const part of (req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    if (!REFRESH_COOKIE_NAMES.includes(name)) continue;
    let value = part.slice(index + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try { value = decodeURIComponent(value); } catch { /* keep raw value */ }
    if (value && !values.includes(value)) values.push(value);
  }
  const parsed = req.cookies?.[REFRESH_COOKIE_NAME];
  if (typeof parsed === 'string' && parsed && !values.includes(parsed)) values.unshift(parsed);
  return values;
};

const AUTH_REJECTIONS = ['Invalid or expired refresh token', 'Session expired or revoked', 'User inactive or not found'];

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { identifier, password } = req.body;
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await AuthService.login({
        identifier,
        password,
        ipAddress,
        userAgent,
      });

      setRefreshCookie(res, result.refreshToken);

      res.status(200).json(
        successResponse('Login successful', {
          accessToken: result.accessToken,
          user: result.user,
        })
      );
    } catch (err: any) {
      const msg = err.message || '';
      let statusCode = 401;
      let userFriendlyMessage = 'Incorrect username, email, or password. Please verify your credentials.';

      if (/locked/i.test(msg)) {
        statusCode = 423;
        userFriendlyMessage = msg;
      } else if (msg.includes('deactivated') || msg.includes('inactive')) {
        statusCode = 403;
        userFriendlyMessage = 'This account has been deactivated. Please contact your system administrator.';
      } else if (msg.includes('Assigned role is unavailable')) {
        statusCode = 403;
        userFriendlyMessage = msg;
      } else if (msg.includes('Database') || msg.includes('MongoDB')) {
        statusCode = 503;
        userFriendlyMessage = 'Database service is temporarily unreachable. Please try again in a moment.';
      } else if (msg !== 'Invalid credentials') {
        next(err);
        return;
      }

      res.status(statusCode).json(errorResponse(userFriendlyMessage));
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const candidates = getRefreshTokenCandidates(req);
      if (!candidates.length) {
        res.status(401).json(errorResponse('Refresh token missing or expired'));
        return;
      }

      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      let result: Awaited<ReturnType<typeof AuthService.refresh>> | undefined;
      let rejection: unknown;
      for (const candidate of candidates) {
        try {
          result = await AuthService.refresh(candidate, ipAddress, userAgent);
          break;
        } catch (error: any) {
          // Only definitive auth rejections fall through to the next candidate;
          // infrastructure failures surface immediately as retryable errors.
          if (!AUTH_REJECTIONS.includes(error?.message)) throw error;
          rejection = error;
        }
      }
      if (!result) throw rejection;
      if (result.newRefreshToken) setRefreshCookie(res, result.newRefreshToken);

      res.status(200).json(
        successResponse('Token refreshed successfully', {
          accessToken: result.accessToken,
          user: result.user,
        })
      );
    } catch (error: any) {
      const rejected = AUTH_REJECTIONS.includes(error?.message);
      if (rejected) {
        clearRefreshCookie(res);
        res.status(401).json(errorResponse('Session expired, please login again'));
      } else {
        // Database/network failures do not revoke an otherwise valid session.
        next(error);
      }
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken =
        req.cookies?.[REFRESH_COOKIE_NAME] ||
        req.cookies?.['vault_refresh_token'] ||
        req.cookies?.['__Host-vault_refresh_token'];
      const userId = req.user?.userId;
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      await AuthService.logout(refreshToken, userId, ipAddress, userAgent);
      clearRefreshCookie(res);

      res.status(200).json(successResponse('Logged out successfully'));
    } catch (error) {
      clearRefreshCookie(res);
      next(error);
    }
  }

  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(errorResponse('Not authenticated'));
        return;
      }

      res.status(200).json(
        successResponse('Current user profile retrieved', {
          user: {
            id: req.user.userId,
            name: req.user.name,
            email: req.user.email,
            username: req.user.username,
            role: {
              id: req.user.roleId,
              name: req.user.roleName,
              code: req.user.roleCode,
            },
            isSuperAdmin: req.user.isSuperAdmin,
            permissions: req.user.permissions,
          },
        })
      );
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(errorResponse('Not authenticated'));
        return;
      }

      const { currentPassword, newPassword } = req.body;
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      await AuthService.changePassword(req.user.userId, currentPassword, newPassword, ipAddress, userAgent);
      clearRefreshCookie(res);

      res.status(200).json(
        successResponse('Password changed successfully. Please log in with your new password.')
      );
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message || 'Failed to change password'));
    }
  }
}
