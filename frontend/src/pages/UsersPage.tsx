import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users as UsersIcon,
  UserPlus,
  Search,
  KeyRound,
  Edit2,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { userService, CreateUserData, UpdateUserData } from '../services/userService';
import { roleService } from '../services/roleService';
import { User, RoleListItem } from '../types/auth';
import { useAuth } from '../hooks/useAuth';
import { usePermission } from '../hooks/usePermission';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const canCreateUser = usePermission('users.create');
  const canUpdateUser = usePermission('users.update');
  const canDeactivateUser = usePermission('users.deactivate');
  const canResetPassword = usePermission('users.reset_password');

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const limit = 10;
  useEffect(() => { const timer = window.setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 350); return () => window.clearTimeout(timer); }, [search]);

  // Modals State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalUser, setEditModalUser] = useState<User | null>(null);
  const [resetModalUser, setResetModalUser] = useState<User | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<User | null>(null);

  // Fetch Users
  const { data: usersData, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['users', { search: debouncedSearch, roleFilter, statusFilter, page }],
    queryFn: ({ signal }) =>
      userService.getUsers({
        search: debouncedSearch || undefined,
        role: roleFilter !== 'ALL' ? roleFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        page,
        limit,
      }, signal),
  });

  // Fetch Roles for dropdown selection
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => roleService.getRoles(),
  });

  const roles = rolesData?.roles || [];

  return (
    <div className="space-y-6">
      {/* Top Banner with Navigation to Roles Tab */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-slate-900 text-white">
            <UsersIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Staff & User Management</h2>
            <p className="text-xs text-slate-500">
              Configure counter operators, branch managers, roles, and credential policies
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link to="/users/roles">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-600" />
              <span>Roles & Permissions Matrix</span>
            </Button>
          </Link>
          {canCreateUser && (
            <Button size="sm" onClick={() => setCreateModalOpen(true)} className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              <span>Add Staff User</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                aria-label="Search staff users"
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                }}
                placeholder="Search staff by name, username, email, phone..."
                className="w-full h-10 pl-9 pr-4 text-xs bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Role Filter */}
            <div>
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="ALL">All Roles</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive / Suspended</option>
                <option value="LOCKED">Temporarily Locked</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isError && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error instanceof Error ? error.message : 'Staff directory could not be loaded.'}</span><Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button></div>}

      {/* Users Data Table */}
      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900">
              Staff Directory ({usersData?.pagination.total || 0})
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Active counter logins, assigned roles, and latest authentication timestamps
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 px-2 text-xs flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <caption className="sr-only">Staff operator accounts, assigned roles and login status</caption>
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Operator Name</th>
                  <th className="py-3 px-4">Username & Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Last Login</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <LoadingSpinner size="md" label="Loading staff accounts..." />
                    </td>
                  </tr>
                ) : usersData?.users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No staff accounts found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  usersData?.users.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    const isTargetSuperAdmin = u.role?.code === 'SUPER_ADMIN';

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Name */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>{u.name}</span>
                            {isSelf && (
                              <span className="text-[10px] bg-sky-100 text-sky-800 font-mono px-1.5 py-0.2 rounded font-normal">
                                You
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Username & Email */}
                        <td className="py-3.5 px-4 font-mono">
                          <div className="text-slate-900 font-semibold">@{u.username}</div>
                          <div className="text-slate-500 text-[11px]">{u.email}</div>
                        </td>

                        {/* Role */}
                        <td className="py-3.5 px-4">
                          <Badge variant="outline" className="font-semibold text-slate-800 bg-white">
                            {u.role?.name || 'Unassigned'}
                          </Badge>
                        </td>

                        {/* Phone */}
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {u.phone || '—'}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          {u.status === 'ACTIVE' && (
                            <Badge variant="success" className="font-semibold">
                              ACTIVE
                            </Badge>
                          )}
                          {u.status === 'INACTIVE' && (
                            <Badge variant="secondary" className="font-semibold text-slate-500">
                              INACTIVE
                            </Badge>
                          )}
                          {u.status === 'LOCKED' && (
                            <Badge variant="destructive" className="font-semibold">
                              LOCKED
                            </Badge>
                          )}
                        </td>

                        {/* Last Login */}
                        <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                          {u.lastLoginAt ? (
                            <div>
                              <div>{new Date(u.lastLoginAt).toLocaleDateString()}</div>
                              <div className="text-[10px] text-slate-400">
                                {new Date(u.lastLoginAt).toLocaleTimeString()}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">Never logged in</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canUpdateUser && (
                              <button
                                onClick={() => setEditModalUser(u)}
                                disabled={isTargetSuperAdmin && !currentUser?.isSuperAdmin}
                                className="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none"
                                title="Edit Staff Profile"
                                aria-label={`Edit ${u.name}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}

                            {canResetPassword && (
                              <button
                                onClick={() => setResetModalUser(u)}
                                disabled={isTargetSuperAdmin && !currentUser?.isSuperAdmin}
                                className="p-1.5 rounded hover:bg-slate-200 text-amber-600 hover:text-amber-800 disabled:opacity-30 disabled:pointer-events-none"
                                title="Reset Operator Password"
                                aria-label={`Reset password for ${u.name}`}
                              >
                                <KeyRound className="w-4 h-4" />
                              </button>
                            )}

                            {canDeactivateUser && !isSelf && (
                              <button
                                onClick={() => setDeactivateUser(u)}
                                disabled={isTargetSuperAdmin && !currentUser?.isSuperAdmin}
                                className={`p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none ${
                                  u.status === 'ACTIVE'
                                    ? 'text-red-600 hover:text-red-800'
                                    : 'text-emerald-600 hover:text-emerald-800'
                                }`}
                                title={u.status === 'ACTIVE' ? 'Deactivate Account' : 'Reactivate Account'}
                                aria-label={`${u.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'} ${u.name}`}
                              >
                                {u.status === 'ACTIVE' ? (
                                  <UserX className="w-4 h-4" />
                                ) : (
                                  <UserCheck className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {usersData && usersData.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 text-xs">
              <span className="text-slate-500">
                Page {usersData.pagination.page} of {usersData.pagination.totalPages} (Total {usersData.pagination.total} staff)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-3 text-xs"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= usersData.pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 px-3 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 1. Create User Modal */}
      {createModalOpen && (
        <CreateUserModal
          roles={roles}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={() => {
            setCreateModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['users'] });
          }}
        />
      )}

      {/* 2. Edit User Modal */}
      {editModalUser && (
        <EditUserModal
          user={editModalUser}
          roles={roles}
          onClose={() => setEditModalUser(null)}
          onSuccess={() => {
            setEditModalUser(null);
            queryClient.invalidateQueries({ queryKey: ['users'] });
          }}
        />
      )}

      {/* 3. Reset Password Modal */}
      {resetModalUser && (
        <AdminResetPasswordModal
          user={resetModalUser}
          onClose={() => setResetModalUser(null)}
          onSuccess={() => {
            setResetModalUser(null);
            queryClient.invalidateQueries({ queryKey: ['users'] });
          }}
        />
      )}

      {/* 4. Deactivate / Reactivate User Modal */}
      {deactivateUser && (
        <ToggleUserStatusModal
          user={deactivateUser}
          onClose={() => setDeactivateUser(null)}
          onSuccess={() => {
            setDeactivateUser(null);
            queryClient.invalidateQueries({ queryKey: ['users'] });
          }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Sub-modals for UsersPage
// ----------------------------------------------------------------------

function CreateUserModal({
  roles,
  onClose,
  onSuccess,
}: {
  roles: RoleListItem[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState<CreateUserData>({
    name: '',
    email: '',
    username: '',
    phone: '',
    roleId: roles[0]?.id || '',
    password: '',
    status: 'ACTIVE',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await userService.createUser(formData);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <Card className="max-w-lg w-full bg-white border-slate-200 shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-slate-100 text-slate-800">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">Add New Staff Account</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Register a new operator with role permissions
              </CardDescription>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="p-5 space-y-3.5">
            {error && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Full Name *</label>
                <Input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Ramesh Sharma"
                  className="h-10 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Username *</label>
                <Input
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="e.g. ramesh_counter1"
                  className="h-10 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Email Address *</label>
                <Input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="ramesh@vaultledger.com"
                  className="h-10 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Phone Number</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 9876543210"
                  className="h-10 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Assigned Role *</label>
                <select
                  required
                  value={formData.roleId}
                  onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                  className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Account Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Temporary Password *</label>
              <Input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Min 8 chars, uppercase, lowercase, number"
                className="h-10 text-xs"
              />
              <p className="text-[10px] text-slate-400">
                Staff member will be prompted to change password upon initial login.
              </p>
            </div>
          </CardContent>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Creating Staff User...' : 'Create Account'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function EditUserModal({
  user,
  roles,
  onClose,
  onSuccess,
}: {
  user: User;
  roles: RoleListItem[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || '');
  const [roleId, setRoleId] = useState(user.role?.id || roles[0]?.id || '');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'LOCKED'>(user.status);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await userService.updateUser(user.id, {
        name,
        phone,
        roleId,
        status,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <Card className="max-w-md w-full bg-white border-slate-200 shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-slate-100 text-slate-800">
              <Edit2 className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">Edit Staff Account</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Update details for @{user.username}
              </CardDescription>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="p-5 space-y-3.5">
            {error && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Full Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required className="h-10 text-xs" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Phone Number</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-10 text-xs font-mono" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Assigned Role</label>
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Account Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="LOCKED">LOCKED</option>
              </select>
            </div>
          </CardContent>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function AdminResetPasswordModal({
  user,
  onClose,
  onSuccess,
}: {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await userService.resetPassword(user.id, newPassword);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <Card className="max-w-md w-full bg-white border-slate-200 shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-amber-100 text-amber-800">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">Reset Operator Password</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Generate a new password for @{user.username}
              </CardDescription>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="p-5 space-y-3.5">
            {error && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
              Resetting this password will immediately invalidate all active sessions for this operator.
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">New Temporary Password</label>
              <Input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 chars, uppercase, lowercase, number"
                className="h-10 text-xs"
              />
            </div>
          </CardContent>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Resetting Password...' : 'Confirm Reset'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function ToggleUserStatusModal({
  user,
  onClose,
  onSuccess,
}: {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDeactivating = user.status === 'ACTIVE';

  const handleConfirm = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await userService.updateUser(user.id, {
        status: isDeactivating ? 'INACTIVE' : 'ACTIVE',
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to change status');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <Card className="max-w-md w-full bg-white border-slate-200 shadow-2xl">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded ${
                isDeactivating ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {isDeactivating ? <UserX className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                {isDeactivating ? 'Deactivate Staff Account' : 'Reactivate Staff Account'}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Action on operator account @{user.username}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-3">
          {error && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-xs text-slate-600 leading-relaxed">
            {isDeactivating
              ? `Are you sure you want to suspend @${user.username} (${user.name})? They will be blocked from counter access and their active sessions will be terminated.`
              : `Are you sure you want to reactivate @${user.username} (${user.name})? They will be able to log in again.`}
          </p>
        </CardContent>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isDeactivating ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Processing...'
              : isDeactivating
              ? 'Yes, Deactivate Account'
              : 'Yes, Reactivate Account'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
