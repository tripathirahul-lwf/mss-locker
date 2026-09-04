import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { env } from '../config/env';
import { successResponse, errorResponse } from '../utils/apiResponse';

const REFRESH_COOKIE_NAME = env.NODE_ENV === 'production' ? '__Host-vault_refresh_token' : 'vault_refresh_token';

const setRefreshCookie = (res: Response, token: string): void => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
};

const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
};

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

      if (msg.includes('temporarily locked')) {
        statusCode = 423;
        userFriendlyMessage = msg;
      } else if (msg.includes('deactivated') || msg.includes('inactive')) {
        statusCode = 403;
        userFriendlyMessage = 'This account has been deactivated. Please contact your system administrator.';
      } else if (msg.includes('Database') || msg.includes('MongoDB') || msg.includes('unavailable')) {
        statusCode = 503;
        userFriendlyMessage = 'Database service is temporarily unreachable. Please try again in a moment.';
      }

      res.status(statusCode).json(errorResponse(userFriendlyMessage));
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies[REFRESH_COOKIE_NAME];
      if (!refreshToken) {
        res.status(401).json(errorResponse('Refresh token missing or expired'));
        return;
      }

      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await AuthService.refresh(refreshToken, ipAddress, userAgent);
      setRefreshCookie(res, result.newRefreshToken);

      res.status(200).json(
        successResponse('Token refreshed successfully', {
          accessToken: result.accessToken,
          user: result.user,
        })
      );
    } catch (error: any) {
      clearRefreshCookie(res);
      res.status(401).json(errorResponse(error.message || 'Session expired, please login again'));
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies[REFRESH_COOKIE_NAME];
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

  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
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
