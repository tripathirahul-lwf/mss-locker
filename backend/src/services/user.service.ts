import { Types } from 'mongoose';
import { User, IUser, UserStatus } from '../models/User';
import { Role, IRole } from '../models/Role';
import { Session } from '../models/Session';
import { hashPassword } from '../utils/password';
import { recordAuditLog } from '../utils/auditLogger';
import { SYSTEM_ROLE_CODES } from '../constants/permissions';

export interface CreateUserParams {
  name: string;
  email: string;
  username: string;
  phone?: string;
  roleId: string;
  password: string;
  status?: UserStatus;
  actorUserId: string;
  actorUsername: string;
  isActorSuperAdmin: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export interface UpdateUserParams {
  userId: string;
  name?: string;
  phone?: string;
  roleId?: string;
  status?: UserStatus;
  permissionsOverride?: {
    grant?: string[];
    revoke?: string[];
  };
  actorUserId: string;
  actorUsername: string;
  isActorSuperAdmin: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export interface QueryUsersParams {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export class UserService {
  static async getUsers(params: QueryUsersParams) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 10));
    const skip = (page - 1) * limit;

    const query: any = {};

    if (params.search) {
      const escapedSearch = params.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { username: searchRegex },
        { phone: searchRegex },
      ];
    }

    if (params.role && params.role !== 'ALL') {
      if (Types.ObjectId.isValid(params.role)) {
        query.role = new Types.ObjectId(params.role);
      } else {
        const roleDoc = await Role.findOne({ code: params.role.toUpperCase() });
        if (roleDoc) query.role = roleDoc._id;
      }
    }

    if (params.status && params.status !== 'ALL') {
      query.status = params.status;
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .populate<{ role: IRole }>('role', 'name code description isSystemRole')
        .populate<{ createdBy: IUser }>('createdBy', 'name username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query),
    ]);

    return {
      users: users.map((u) => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        username: u.username,
        phone: u.phone,
        role: u.role
          ? {
              id: (u.role as any)._id?.toString(),
              name: (u.role as any).name,
              code: (u.role as any).code,
            }
          : null,
        permissionsOverride: u.permissionsOverride,
        status: u.status,
        lastLoginAt: u.lastLoginAt,
        lastLoginIp: u.lastLoginIp,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getUserById(userId: string) {
    const user = await User.findById(userId)
      .populate<{ role: IRole }>('role', 'name code description isSystemRole permissions')
      .populate<{ createdBy: IUser }>('createdBy', 'name username');

    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      username: user.username,
      phone: user.phone,
      role: user.role
        ? {
            id: user.role._id.toString(),
            name: user.role.name,
            code: user.role.code,
            description: user.role.description,
            permissions: user.role.permissions,
          }
        : null,
      permissionsOverride: user.permissionsOverride,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      lastLoginIp: user.lastLoginIp,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  static async createUser(params: CreateUserParams) {
    const normalizedEmail = params.email.trim().toLowerCase();
    const normalizedUsername = params.username.trim().toLowerCase();

    // Check duplicate email or username
    const existing = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
    });

    if (existing) {
      if (existing.email === normalizedEmail) {
        throw new Error('A user with this email address already exists');
      }
      throw new Error('A user with this username already exists');
    }

    // Verify role
    const targetRole = await Role.findById(params.roleId);
    if (!targetRole) {
      throw new Error('Assigned role not found');
    }

    // Privilege escalation protection: Only Super Admin can create another Super Admin
    if (targetRole.code === SYSTEM_ROLE_CODES.SUPER_ADMIN && !params.isActorSuperAdmin) {
      throw new Error('Forbidden: Only Super Administrators can create Super Admin accounts');
    }

    const passwordHash = await hashPassword(params.password);

    const newUser = await User.create({
      name: params.name.trim(),
      email: normalizedEmail,
      username: normalizedUsername,
      phone: params.phone?.trim() || '',
      passwordHash,
      role: targetRole._id,
      status: params.status || 'ACTIVE',
      createdBy: new Types.ObjectId(params.actorUserId),
    });

    await recordAuditLog({
      actorUserId: new Types.ObjectId(params.actorUserId),
      actorUsername: params.actorUsername,
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: newUser._id.toString(),
      description: `Created new staff user '${newUser.username}' with role '${targetRole.name}'`,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return {
      id: newUser._id.toString(),
      name: newUser.name,
      email: newUser.email,
      username: newUser.username,
      phone: newUser.phone,
      role: {
        id: targetRole._id.toString(),
        name: targetRole.name,
        code: targetRole.code,
      },
      status: newUser.status,
      createdAt: newUser.createdAt,
    };
  }

  static async updateUser(params: UpdateUserParams) {
    const user = await User.findById(params.userId).populate<{ role: IRole }>('role');
    if (!user) {
      throw new Error('User not found');
    }

    // If target user is Super Admin, only Super Admin can edit them
    if (user.role.code === SYSTEM_ROLE_CODES.SUPER_ADMIN && !params.isActorSuperAdmin) {
      throw new Error('Forbidden: Cannot modify a Super Administrator account');
    }

    // If changing role
    if (params.roleId && params.roleId !== user.role._id.toString()) {
      const newRole = await Role.findById(params.roleId);
      if (!newRole) {
        throw new Error('Target role not found');
      }

      // Privilege escalation protection: Only Super Admin can promote to Super Admin
      if (newRole.code === SYSTEM_ROLE_CODES.SUPER_ADMIN && !params.isActorSuperAdmin) {
        throw new Error('Forbidden: Only Super Administrators can assign the Super Admin role');
      }

      user.role = newRole._id as any;
    }

    if (params.name) user.name = params.name.trim();
    if (params.phone !== undefined) user.phone = params.phone.trim();
    if (params.status) {
      user.status = params.status;
      if (params.status === 'INACTIVE' || params.status === 'LOCKED') {
        // Revoke active sessions immediately if deactivated/locked
        await Session.updateMany(
          { userId: user._id, revokedAt: { $exists: false } },
          { revokedAt: new Date() }
        );
      }
    }

    if (params.permissionsOverride) {
      user.permissionsOverride = {
        grant: params.permissionsOverride.grant || [],
        revoke: params.permissionsOverride.revoke || [],
      };
    }

    await user.save();

    await recordAuditLog({
      actorUserId: new Types.ObjectId(params.actorUserId),
      actorUsername: params.actorUsername,
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: user._id.toString(),
      description: `Updated staff user '${user.username}' details/role/status`,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      username: user.username,
      phone: user.phone,
      status: user.status,
      updatedAt: user.updatedAt,
    };
  }

  static async resetPassword(userId: string, newPass: string, actorUserId: string, actorUsername: string, isActorSuperAdmin: boolean, ipAddress?: string, userAgent?: string) {
    const user = await User.findById(userId).populate<{ role: IRole }>('role');
    if (!user) {
      throw new Error('User not found');
    }

    if (user.role.code === SYSTEM_ROLE_CODES.SUPER_ADMIN && !isActorSuperAdmin) {
      throw new Error('Forbidden: Cannot reset password of a Super Administrator');
    }

    user.passwordHash = await hashPassword(newPass);
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    if (user.status === 'LOCKED') {
      user.status = 'ACTIVE';
    }
    await user.save();

    // Invalidate all active sessions for security
    await Session.updateMany(
      { userId: user._id, revokedAt: { $exists: false } },
      { revokedAt: new Date() }
    );

    await recordAuditLog({
      actorUserId: new Types.ObjectId(actorUserId),
      actorUsername,
      action: 'PASSWORD_RESET',
      entityType: 'USER',
      entityId: user._id.toString(),
      description: `Administrator '${actorUsername}' reset password for user '${user.username}'`,
      ipAddress,
      userAgent,
    });
  }
}
