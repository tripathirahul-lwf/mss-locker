import { Types } from 'mongoose';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { type IRole } from '../models/Role';
import { Session } from '../models/Session';
import { connectDatabase } from '../config/database';
import { hashPassword, comparePassword } from '../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
} from '../utils/jwt';
import { recordAuditLog } from '../utils/auditLogger';
import { SYSTEM_ROLE_CODES, PermissionCode } from '../constants/permissions';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes
const DUMMY_PASSWORD_HASH = '$2b$12$sMaSmZyPrTmkI5UzyypCaOo4HMDuUjgU11LHHJbhkHdyrAvWRr5mu';

export interface LoginParams {
  identifier: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    username: string;
    phone?: string;
    role: {
      id: string;
      name: string;
      code: string;
    };
    isSuperAdmin: boolean;
    permissions: PermissionCode[];
  };
}

export class AuthService {
  static async login(params: LoginParams): Promise<AuthResult> {
    // Ensure Database is connected (fail fast if Atlas is not reachable)
    if ((mongoose.connection.readyState as number) !== 1) {
      const connected = await connectDatabase();
      if (!connected || (mongoose.connection.readyState as number) !== 1) {
        throw new Error(
          'Database connection failed: MongoDB Atlas access denied. Please whitelist your IP address in MongoDB Atlas Network Access (or add 0.0.0.0/0).'
        );
      }
    }

    const normalizedIdentifier = params.identifier.trim().toLowerCase();

    // Search user by email or username
    const user = await User.findOne({
      $or: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }],
    })
      .select('+passwordHash')
      .populate<{ role: IRole }>('role');

    if (!user) {
      // Keep unknown-user and wrong-password verification costs comparable.
      await comparePassword(params.password, DUMMY_PASSWORD_HASH);
      await recordAuditLog({
        action: 'LOGIN_FAILED',
        entityType: 'AUTH',
        description: `Failed login attempt for non-existent user identifier: ${params.identifier}`,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
      throw new Error('Invalid credentials');
    }

    // Check account status and lockouts
    if (user.status === 'INACTIVE') {
      await recordAuditLog({
        actorUserId: user._id,
        actorUsername: user.username,
        action: 'LOGIN_FAILED',
        entityType: 'AUTH',
        description: 'Login rejected: Account is inactive',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
      throw new Error('Account is deactivated. Please contact your system administrator.');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (60 * 1000));
      await recordAuditLog({
        actorUserId: user._id,
        actorUsername: user.username,
        action: 'LOGIN_FAILED',
        entityType: 'AUTH',
        description: `Login rejected: Account temporarily locked (${remainingMinutes}m remaining)`,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
      throw new Error(`Account is temporarily locked due to multiple failed attempts. Try again in ${remainingMinutes} minutes.`);
    }

    // Verify password
    const isPasswordValid = await comparePassword(params.password, user.passwordHash);

    if (!isPasswordValid) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCK_TIME_MS);
        user.status = 'LOCKED';
        await user.save();

        await recordAuditLog({
          actorUserId: user._id,
          actorUsername: user.username,
          action: 'LOGIN_FAILED',
          entityType: 'AUTH',
          description: `Account automatically locked after ${MAX_FAILED_ATTEMPTS} consecutive failed login attempts`,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        });

        throw new Error('Account locked due to 5 failed login attempts. Please try again after 15 minutes.');
      } else {
        await user.save();
        await recordAuditLog({
          actorUserId: user._id,
          actorUsername: user.username,
          action: 'LOGIN_FAILED',
          entityType: 'AUTH',
          description: `Failed password verification (Attempt ${user.failedLoginAttempts}/${MAX_FAILED_ATTEMPTS})`,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        });
        throw new Error('Invalid credentials');
      }
    }

    // Login Successful: Reset counters and lock
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    if (user.status === 'LOCKED') {
      user.status = 'ACTIVE';
    }
    user.lastLoginAt = new Date();
    user.lastLoginIp = params.ipAddress;
    await user.save();

    const role = user.role;
    const isSuperAdmin = role.code === SYSTEM_ROLE_CODES.SUPER_ADMIN;

    // Calculate effective permissions
    const rolePermissions = new Set<string>(role.permissions || []);
    user.permissionsOverride?.grant?.forEach((p) => rolePermissions.add(p));
    user.permissionsOverride?.revoke?.forEach((p) => rolePermissions.delete(p));
    const permissions = Array.from(rolePermissions) as PermissionCode[];

    // Generate JWT tokens
    const tokenPayload = {
      userId: user._id.toString(),
      username: user.username,
      roleCode: role.code,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Create session in DB with hashed refresh token
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await Session.create({
      userId: user._id,
      refreshTokenHash,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      expiresAt,
      lastUsedAt: new Date(),
    });

    await recordAuditLog({
      actorUserId: user._id,
      actorUsername: user.username,
      action: 'LOGIN_SUCCESS',
      entityType: 'AUTH',
      entityId: user._id.toString(),
      description: `Staff user '${user.username}' successfully authenticated`,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        username: user.username,
        phone: user.phone,
        role: {
          id: role._id.toString(),
          name: role.name,
          code: role.code,
        },
        isSuperAdmin,
        permissions,
      },
    };
  }

  static async refresh(refreshToken: string, ipAddress?: string, userAgent?: string): Promise<{ accessToken: string; newRefreshToken: string; user: AuthResult['user'] }> {
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw new Error('Invalid or expired refresh token');
    }

    const refreshTokenHash = hashRefreshToken(refreshToken);
    const userIdObj = new Types.ObjectId(decoded.userId);

    // Look for active session by current hash, or previous hash within a 60-second rotation grace window
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
    let session = await Session.findOne({
      userId: userIdObj,
      refreshTokenHash,
      revokedAt: { $exists: false },
    });

    let isGracePeriodRecovery = false;
    if (!session) {
      // Check if this token was just rotated in a concurrent burst (grace window)
      session = await Session.findOne({
        userId: userIdObj,
        previousRefreshTokenHash: refreshTokenHash,
        rotatedAt: { $gte: sixtySecondsAgo },
        revokedAt: { $exists: false },
      });
      if (session) {
        isGracePeriodRecovery = true;
      }
    }

    if (!session || session.expiresAt.getTime() < Date.now()) {
      throw new Error('Session expired or revoked');
    }

    const user = await User.findById(decoded.userId).populate<{ role: IRole }>('role');
    if (!user || user.status !== 'ACTIVE') {
      throw new Error('User inactive or not found');
    }

    const tokenPayload = {
      userId: user._id.toString(),
      username: user.username,
      roleCode: user.role.code,
    };

    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    if (!isGracePeriodRecovery) {
      // Normal rotation: Move current hash to previous, store new hash, extend session
      session.previousRefreshTokenHash = session.refreshTokenHash;
      session.refreshTokenHash = hashRefreshToken(newRefreshToken);
      session.rotatedAt = new Date();
      session.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      session.lastUsedAt = new Date();
      session.ipAddress = ipAddress || session.ipAddress;
      session.userAgent = userAgent || session.userAgent;
      await session.save();
    } else {
      // Grace period request: update lastUsedAt, don't break rotation chain
      session.lastUsedAt = new Date();
      await session.save();
    }

    const rolePermissions = new Set<string>(user.role.permissions || []);
    user.permissionsOverride?.grant?.forEach((permission) => rolePermissions.add(permission));
    user.permissionsOverride?.revoke?.forEach((permission) => rolePermissions.delete(permission));

    return {
      accessToken: newAccessToken,
      newRefreshToken,
      user: {
        id: user._id.toString(), name: user.name, email: user.email, username: user.username, phone: user.phone,
        role: { id: user.role._id.toString(), name: user.role.name, code: user.role.code },
        isSuperAdmin: user.role.code === SYSTEM_ROLE_CODES.SUPER_ADMIN,
        permissions: Array.from(rolePermissions) as PermissionCode[],
      },
    };
  }

  static async logout(refreshToken?: string, userId?: string, ipAddress?: string, userAgent?: string): Promise<void> {
    if (refreshToken) {
      const refreshTokenHash = hashRefreshToken(refreshToken);
      await Session.findOneAndUpdate(
        {
          $or: [
            { refreshTokenHash },
            { previousRefreshTokenHash: refreshTokenHash },
          ],
          revokedAt: { $exists: false },
        },
        { revokedAt: new Date() }
      );
    }

    if (userId) {
      const user = await User.findById(userId);
      await recordAuditLog({
        actorUserId: userId ? new Types.ObjectId(userId) : undefined,
        actorUsername: user?.username || 'UNKNOWN',
        action: 'LOGOUT',
        entityType: 'AUTH',
        description: `Staff user '${user?.username || userId}' logged out`,
        ipAddress,
        userAgent,
      });
    }
  }

  static async changePassword(userId: string, currentPass: string, newPass: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const user = await User.findById(userId).select('+passwordHash');
    if (!user) {
      throw new Error('User not found');
    }

    const isMatch = await comparePassword(currentPass, user.passwordHash);
    if (!isMatch) {
      throw new Error('Current password is incorrect');
    }

    user.passwordHash = await hashPassword(newPass);
    await user.save();

    // Revoke all existing sessions for this user for security
    await Session.updateMany(
      { userId: user._id, revokedAt: { $exists: false } },
      { revokedAt: new Date() }
    );

    await recordAuditLog({
      actorUserId: user._id,
      actorUsername: user.username,
      action: 'PASSWORD_CHANGED',
      entityType: 'USER',
      entityId: user._id.toString(),
      description: `Staff user '${user.username}' changed their password. Active sessions revoked.`,
      ipAddress,
      userAgent,
    });
  }
}
