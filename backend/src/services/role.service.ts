import { Role, IRole } from '../models/Role';
import { User } from '../models/User';
import { recordAuditLog } from '../utils/auditLogger';
import { PERMISSION_GROUPS, ALL_PERMISSIONS } from '../constants/permissions';

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
    const role = await Role.findById(roleId);
    if (!role) {
      throw new Error('Role not found');
    }

    if (data.name) role.name = data.name.trim();
    if (data.description !== undefined) role.description = data.description.trim();
    if (data.permissions) {
      role.permissions = Array.from(new Set(data.permissions));
    }

    await role.save();

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
    });

    return {
      id: role._id.toString(),
      name: role.name,
      code: role.code,
      description: role.description,
      permissions: role.permissions,
      isSystemRole: role.isSystemRole,
      status: role.status,
    };
  }
}
