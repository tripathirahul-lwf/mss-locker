import mongoose,{ Types,ClientSession } from 'mongoose';
import { User,IUser,UserStatus } from '../models/User';
import { Role,IRole } from '../models/Role';
import { Session } from '../models/Session';
import { hashPassword } from '../utils/password';
import { recordAuditLog } from '../utils/auditLogger';
import { SYSTEM_ROLE_CODES,PERMISSIONS } from '../constants/permissions';

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
  private static fail(message: string, statusCode = 403): never { throw Object.assign(new Error(message), { statusCode }); }

  private static async actor(actorUserId: string, lock = false) {
    const actor = await User.findById(actorUserId).populate<{ role: IRole }>('role');
    if (!actor || actor.status !== 'ACTIVE' || !actor.role || actor.role.status !== 'ACTIVE') this.fail('Active administrator account required');
    // A write to the acting account serializes concurrent account mutations.
    // If another admin disables/demotes this actor concurrently, the transaction retries and rechecks authorization.
    if (lock) await User.updateOne({ _id: actor._id }, { $inc: { __v: 1 } });
    const permissions = new Set(actor.role.permissions || []);
    actor.permissionsOverride?.grant?.forEach(p => permissions.add(p));
    actor.permissionsOverride?.revoke?.forEach(p => permissions.delete(p));
    return { user: actor, superAdmin: actor.role.code === SYSTEM_ROLE_CODES.SUPER_ADMIN, permissions };
  }

  private static requireAction(actor: Awaited<ReturnType<typeof UserService.actor>>, permission: string) {
    if (!actor.superAdmin && !actor.permissions.has(permission as any)) this.fail('Permission required: ' + permission);
  }

  private static canManage(actor: Awaited<ReturnType<typeof UserService.actor>>, role: IRole, grants: string[] = []) {
    if (actor.superAdmin) return true;
    return role.code !== SYSTEM_ROLE_CODES.SUPER_ADMIN && [...role.permissions, ...grants].every(p => actor.permissions.has(p));
  }

  static async assignableRoles(actorUserId: string) {
    const actor = await this.actor(actorUserId);
    const roles = await Role.find({ status: 'ACTIVE' }).sort({ createdAt: 1 });
    return { roles: roles.filter(role => this.canManage(actor, role)).map(role => ({ id: String(role._id), name: role.name, code: role.code, description: role.description, permissions: role.permissions, status: role.status })) };
  }

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
        { username: new RegExp(params.search.trim().replace(/^@/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { phone: searchRegex },
      ];
    }

    if (params.role && params.role !== 'ALL') {
      if (params.role === 'ADMINISTRATIVE') {
        const roles = await Role.find({ code: { $in: [SYSTEM_ROLE_CODES.SUPER_ADMIN, SYSTEM_ROLE_CODES.ADMIN] } }).select('_id');
        query.role = { $in: roles.map(role => role._id) };
      } else if (Types.ObjectId.isValid(params.role)) {
        query.role = new Types.ObjectId(params.role);
      } else {
        const roleDoc = await Role.findOne({ code: params.role.toUpperCase() });
        query.role = roleDoc?._id || null;
      }
    }

    if (params.status && params.status !== 'ALL') {
      query.status = params.status === 'RESTRICTED' ? { $in: ['INACTIVE', 'LOCKED'] } : params.status;
    }

    const adminRoles = await Role.find({ code: { $in: [SYSTEM_ROLE_CODES.SUPER_ADMIN, SYSTEM_ROLE_CODES.ADMIN] } }).select('_id');
    const [users, total, active, administrative, restricted] = await Promise.all([
      User.find(query)
        .populate<{ role: IRole }>('role', 'name code description isSystemRole')
        .populate<{ createdBy: IUser }>('createdBy', 'name username')
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query),
      User.countDocuments({ $and: [query, { status: 'ACTIVE' }] }),
      User.countDocuments({ $and: [query, { role: { $in: adminRoles.map(role => role._id) } }] }),
      User.countDocuments({ $and: [query, { status: { $in: ['INACTIVE', 'LOCKED'] } }] }),
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
      summary: { total, active, administrative, restricted },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  static async getUserById(userId: string) {
    const user = await User.findById(userId)
      .populate<{ role: IRole }>('role', 'name code description isSystemRole permissions')
      .populate<{ createdBy: IUser }>('createdBy', 'name username');

    if (!user) {
      this.fail('User not found', 404);
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
    return mongoose.connection.transaction(session => this.createUserTransaction(params, session));
  }
  private static async createUserTransaction(params: CreateUserParams, session: ClientSession) {
    const actor = await this.actor(params.actorUserId, true);
    this.requireAction(actor, PERMISSIONS.USERS_CREATE);
    const normalizedEmail = params.email.trim().toLowerCase();
    const normalizedUsername = params.username.trim().toLowerCase();

    // Check duplicate email or username
    const existing = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
    });

    if (existing) {
      if (existing.email === normalizedEmail) {
        this.fail('A user with this email address already exists', 409);
      }
      this.fail('A user with this username already exists', 409);
    }

    // Verify role
    const targetRole = await Role.findById(params.roleId);
    if (!targetRole) {
      this.fail('Assigned role not found', 404);
    }

    if (targetRole.status !== 'ACTIVE') this.fail('Assigned role is inactive', 400);
    if (!this.canManage(actor, targetRole)) this.fail('Cannot assign a role with permissions beyond your own');
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
    }, session);

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
    return mongoose.connection.transaction(session => this.updateUserTransaction(params, session));
  }
  private static async updateUserTransaction(params: UpdateUserParams, session: ClientSession) {
    const actor = await this.actor(params.actorUserId, true);
    const profileChange = params.name !== undefined || params.phone !== undefined || params.roleId !== undefined || params.permissionsOverride !== undefined;
    this.requireAction(actor, profileChange ? PERMISSIONS.USERS_UPDATE : PERMISSIONS.USERS_DEACTIVATE);
    const user = await User.findById(params.userId).populate<{ role: IRole }>('role');
    if (!user) {
      this.fail('User not found', 404);
    }

    if (!user.role) this.fail('Assigned role not found', 409);
    if (!this.canManage(actor, user.role, user.permissionsOverride?.grant)) this.fail('Cannot modify an account with permissions beyond your own');
    const before = { name: user.name, phone: user.phone, roleId: String(user.role._id), status: user.status, permissionsOverride: JSON.parse(JSON.stringify(user.permissionsOverride || {})) };
    const roleChanged = !!params.roleId && params.roleId !== String(user.role._id);
    const statusChanged = !!params.status && params.status !== user.status;
    if (String(user._id) === params.actorUserId && (roleChanged || statusChanged || params.permissionsOverride)) this.fail('You cannot change your own role, status or permission overrides');
    if (statusChanged && !actor.superAdmin && !actor.permissions.has(PERMISSIONS.USERS_DEACTIVATE)) this.fail('Account status changes require users.deactivate permission');
    if (params.permissionsOverride && !actor.superAdmin) this.fail('Only Super Administrators can change permission overrides');
    if (params.permissionsOverride?.grant?.some(p => params.permissionsOverride?.revoke?.includes(p))) this.fail('A permission cannot be both granted and revoked', 400);
    // If target user is Super Admin, only Super Admin can edit them
    if (user.role.code === SYSTEM_ROLE_CODES.SUPER_ADMIN && !params.isActorSuperAdmin) {
      throw new Error('Forbidden: Cannot modify a Super Administrator account');
    }

    // If changing role
    if (params.roleId && params.roleId !== user.role._id.toString()) {
      const newRole = await Role.findById(params.roleId);
      if (!newRole) {
        this.fail('Target role not found', 404);
      }

      if (newRole.status !== 'ACTIVE') this.fail('Target role is inactive', 400);
      if (!this.canManage(actor, newRole)) this.fail('Cannot assign a role with permissions beyond your own');
      // Privilege escalation protection: Only Super Admin can promote to Super Admin
      if (newRole.code === SYSTEM_ROLE_CODES.SUPER_ADMIN && !params.isActorSuperAdmin) {
        throw new Error('Forbidden: Only Super Administrators can assign the Super Admin role');
      }

      user.role = newRole._id as any;
    }

    if (params.name) user.name = params.name.trim();
    if (params.phone !== undefined) user.phone = params.phone.trim();
    if (params.status && statusChanged) {
      user.status = params.status;
      user.failedLoginAttempts = 0; user.lockedUntil = undefined;
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
        grant: params.permissionsOverride.grant ?? user.permissionsOverride?.grant ?? [],
        revoke: params.permissionsOverride.revoke ?? user.permissionsOverride?.revoke ?? [],
      };
    }

    if (user.permissionsOverride.grant.some(p => user.permissionsOverride.revoke.includes(p))) this.fail('A permission cannot be both granted and revoked', 400);
    if (roleChanged || statusChanged || params.permissionsOverride) {
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await Session.updateMany({ userId: user._id, revokedAt: { $exists: false } }, { revokedAt: new Date() });
    }
    await user.save();

    await recordAuditLog({
      actorUserId: new Types.ObjectId(params.actorUserId),
      actorUsername: params.actorUsername,
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: user._id.toString(),
      description: `Updated staff user '${user.username}'${statusChanged ? `: status ${before.status} to ${user.status}` : ''}${roleChanged ? ': role changed' : ''}`,
      metadata: { before, after: { name: user.name, phone: user.phone, roleId: params.roleId || before.roleId, status: user.status, permissionsOverride: user.permissionsOverride } },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    }, session);

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
    return mongoose.connection.transaction(session => this.resetPasswordTransaction(userId, newPass, actorUserId, actorUsername, isActorSuperAdmin, session, ipAddress, userAgent));
  }
  private static async resetPasswordTransaction(userId: string, newPass: string, actorUserId: string, actorUsername: string, isActorSuperAdmin: boolean, session: ClientSession, ipAddress?: string, userAgent?: string) {
    const actor = await this.actor(actorUserId, true);
    this.requireAction(actor, PERMISSIONS.USERS_RESET_PASSWORD);
    const user = await User.findById(userId).populate<{ role: IRole }>('role');
    if (!user) {
      this.fail('User not found', 404);
    }

    if (!user.role) this.fail('Assigned role not found', 409);
    if (!this.canManage(actor, user.role, user.permissionsOverride?.grant)) this.fail('Cannot reset an account with permissions beyond your own');
    if (user.role.code === SYSTEM_ROLE_CODES.SUPER_ADMIN && !isActorSuperAdmin) {
      throw new Error('Forbidden: Cannot reset password of a Super Administrator');
    }

    user.passwordHash = await hashPassword(newPass);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;

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
    }, session);
  }
}
