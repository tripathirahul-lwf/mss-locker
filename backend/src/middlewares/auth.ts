import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { verifyAccessToken } from '../utils/jwt';
import { User, IUser } from '../models/User';
import { Role, IRole } from '../models/Role';
import { SYSTEM_ROLE_CODES, PermissionCode } from '../constants/permissions';
import { errorResponse } from '../utils/apiResponse';

export interface AuthenticatedUserContext {
  _id: Types.ObjectId;
  userId: string;
  name: string;
  email: string;
  username: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  isSuperAdmin: boolean;
  permissions: PermissionCode[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUserContext;
    }
  }
}

/**
 * Middleware to authenticate requests via Bearer JWT token.
 * Populates req.user with user details, role, and effective permissions.
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json(errorResponse('Authentication required. Missing Bearer token.'));
      return;
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      res.status(401).json(errorResponse('Invalid or expired token. Please log in again.'));
      return;
    }

    const user = await User.findById(decoded.userId).populate<{ role: IRole }>('role');
    if (!user) {
      res.status(401).json(errorResponse('User account not found.'));
      return;
    }

    if (user.status !== 'ACTIVE') {
      res.status(403).json(
        errorResponse(
          user.status === 'LOCKED'
            ? 'Account is temporarily locked. Please contact administrator.'
            : 'Account is deactivated. Access denied.'
        )
      );
      return;
    }

    const role = user.role;
    if (!role) {
      res.status(403).json(errorResponse('Assigned role not found.'));
      return;
    }

    const isSuperAdmin = role.code === SYSTEM_ROLE_CODES.SUPER_ADMIN;

    // Calculate effective permissions: Role permissions + grants - revokes
    const rolePermissions = new Set<string>(role.permissions || []);
    user.permissionsOverride?.grant?.forEach((p) => rolePermissions.add(p));
    user.permissionsOverride?.revoke?.forEach((p) => rolePermissions.delete(p));

    const effectivePermissions = Array.from(rolePermissions) as PermissionCode[];

    req.user = {
      _id: user._id,
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      username: user.username,
      roleId: role._id.toString(),
      roleCode: role.code,
      roleName: role.name,
      isSuperAdmin,
      permissions: effectivePermissions,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Enforces that the authenticated user possesses the required permission(s).
 * Super Admin bypasses all normal permission checks.
 */
export const requirePermission = (...requiredPermissions: PermissionCode[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json(errorResponse('Authentication required.'));
      return;
    }

    // Super Admin has universal access
    if (req.user.isSuperAdmin) {
      next();
      return;
    }

    const userPermissions = new Set(req.user.permissions);
    const hasAll = requiredPermissions.every((p) => userPermissions.has(p));

    if (!hasAll) {
      res.status(403).json(
        errorResponse(
          'Access denied. You do not have sufficient permissions to perform this action.',
          { requiredPermissions }
        )
      );
      return;
    }

    next();
  };
};

/** Enforces that the user possesses at least one of the supplied permissions. */
export const requireAnyPermission = (...allowedPermissions: PermissionCode[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json(errorResponse('Authentication required.'));
      return;
    }
    if (req.user.isSuperAdmin || allowedPermissions.some((permission) => req.user!.permissions.includes(permission))) {
      next();
      return;
    }
    res.status(403).json(errorResponse(
      'Access denied. Customer creation or KYC management permission is required to upload files.',
      { allowedPermissions }
    ));
  };
};

/**
 * Enforces specific role codes.
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json(errorResponse('Authentication required.'));
      return;
    }

    if (req.user.isSuperAdmin || allowedRoles.includes(req.user.roleCode)) {
      next();
      return;
    }

    res.status(403).json(errorResponse('Access denied. Role not authorized.'));
  };
};
