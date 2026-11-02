import mongoose from 'mongoose';
import { Role,IRole } from '../models/Role';
import { Session } from '../models/Session';
import { User } from '../models/User';
import { recordAuditLog } from '../utils/auditLogger';
import { PERMISSION_GROUPS,ALL_PERMISSIONS,PERMISSIONS,SYSTEM_ROLE_CODES } from '../constants/permissions';

export class RoleService {
  static async getRoles() {
    const roles = await Role.find().sort({ isSystemRole: -1, createdAt: 1 });

    // Count users per role
    const userCounts = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);

    const countsMap = new Map<string, number>();
    userCounts.forEach((item) => {
      if (item._id) countsMap.set(item._id.toString(), item.count);
    });

    return {
      roles: roles.map((r) => ({
        id: r._id.toString(),
        name: r.name,
        code: r.code,
        description: r.description,
        permissions: r.permissions,
        isSystemRole: r.isSystemRole,
        status: r.status,
        userCount: countsMap.get(r._id.toString()) || 0,
        createdAt: r.createdAt,
      })),
      permissionGroups: PERMISSION_GROUPS,
      allPermissions: ALL_PERMISSIONS,
    };
  }

  static async getRoleById(roleId: string) {
    const role = await Role.findById(roleId);
    if (!role) {
      throw new Error('Role not found');
    }

    const userCount = await User.countDocuments({ role: role._id });

    return {
      id: role._id.toString(),
      name: role.name,
      code: role.code,
      description: role.description,
      permissions: role.permissions,
      isSystemRole: role.isSystemRole,
      status: role.status,
      userCount,
      createdAt: role.createdAt,
    };
  }

  static async updateRole(
    roleId: string,
    data: { name?: string; description?: string; permissions?: string[] },
    actorUserId: string,
    actorUsername: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    return mongoose.connection.transaction(async session => {
    function fail(message: string, statusCode = 403): never { throw Object.assign(new Error(message), { statusCode }); }
    const actor = await User.findById(actorUserId).populate<{ role: IRole }>('role');
    if (!actor || actor.status !== 'ACTIVE' || actor.role?.status !== 'ACTIVE') fail('Active operator required');
    await User.updateOne({_id:actor!._id},{$inc:{__v:1}});
    const superAdmin = actor!.role.code === SYSTEM_ROLE_CODES.SUPER_ADMIN;
    const ownPermissions = new Set<string>(actor!.role.permissions);
    actor!.permissionsOverride?.grant?.forEach(p => ownPermissions.add(p));
    actor!.permissionsOverride?.revoke?.forEach(p => ownPermissions.delete(p));
    if (!superAdmin && !ownPermissions.has(PERMISSIONS.ROLES_MANAGE)) fail('Role management permission required');
    const role = await Role.findById(roleId);
    if (!role) {
      fail('Role not found', 404);
    }
    if (!superAdmin && (role!.code === SYSTEM_ROLE_CODES.SUPER_ADMIN || role!.permissions.some(p => !ownPermissions.has(p)))) fail('Cannot modify a role with permissions beyond your own');
    if (!superAdmin && data.permissions && (String(actor!.role._id) === roleId || data.permissions.some(p => !ownPermissions.has(p)))) fail('Cannot increase role privileges or change your own role permissions');
    if (data.permissions?.some(p => !ALL_PERMISSIONS.includes(p as any))) fail('Unknown permission code', 400);
    const permissionsChanged = !!data.permissions && [...new Set(data.permissions)].sort().join('|') !== [...role!.permissions].sort().join('|');

    if (data.name) role.name = data.name.trim();
    if (data.description !== undefined) role.description = data.description.trim();
    if (data.permissions) {
      role.permissions = Array.from(new Set(data.permissions));
    }

    await role.save();
    if (permissionsChanged) {
      const users = await User.find({ role: role._id }).select('_id');
      await User.updateMany({ role: role._id }, { $inc: { tokenVersion: 1 } });
      await Session.updateMany({ userId: { $in: users.map(user => user._id) }, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    }

    await recordAuditLog({
      actorUserId,
      actorUsername,
      action: 'ROLE_UPDATED',
      entityType: 'ROLE',
      entityId: role._id.toString(),
      description: `Updated role '${role.code}' permissions and settings`,
      ipAddress,
      userAgent,
      metadata: { permissionsCount: role.permissions.length },
    }, session);

    return {
      id: role._id.toString(),
      name: role.name,
      code: role.code,
      description: role.description,
      permissions: role.permissions,
      isSystemRole: role.isSystemRole,
      status: role.status,
    };
    });
  }
}
