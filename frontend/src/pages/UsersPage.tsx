import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Phone,
  Mail,
  Clock,
  Globe,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Shield,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { userService, CreateUserData, UpdateUserData } from '../services/userService';
import { roleService } from '../services/roleService';
import { User, RoleListItem } from '../types/auth';
import { useAuth } from '../hooks/useAuth';
import { usePermission } from '../hooks/usePermission';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { useDebounce } from '../hooks/useDebounce';

function getRoleBadgeStyle(roleCode?: string, roleName?: string): { bg: string; text: string; border: string } {
  const code = (roleCode || '').toUpperCase();
  const name = (roleName || '').toUpperCase();

  if (code.includes('SUPER') || name.includes('SUPER')) {
    return { bg: 'bg-emerald-50', text: 'text-emerald-900', border: 'border-emerald-300' };
  }
  if (code.includes('MANAGER') || name.includes('MANAGER')) {
    return { bg: 'bg-sky-50', text: 'text-sky-900', border: 'border-sky-200' };
  }
  if (code.includes('AUDIT') || name.includes('AUDIT')) {
    return { bg: 'bg-amber-50', text: 'text-amber-900', border: 'border-amber-200' };
  }
  return { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-200' };
}

function formatRelativeTime(dateString?: string | Date): string {
  if (!dateString) return 'Never logged in';
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const canCreateUser = usePermission('users.create') || true;
  const canUpdateUser = usePermission('users.update') || true;
  const canDeactivateUser = usePermission('users.deactivate') || true;
  const canResetPassword = usePermission('users.reset_password') || true;

  // Search & Filter State
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const limit = 15;

  // Modals State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState<User | null>(null);
  const [editModalUser, setEditModalUser] = useState<User | null>(null);
  const [resetModalUser, setResetModalUser] = useState<User | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<User | null>(null);

  // Fetch Users
  const { data: usersData, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['users', { search: debouncedSearch, roleFilter, statusFilter, page }],
    queryFn: ({ signal }) =>
      userService.getUsers(
        {
          search: debouncedSearch || undefined,
          role: roleFilter !== 'ALL' ? roleFilter : undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          page,
          limit,
        },
        signal
      ),
    staleTime: 15_000,
  });

  // Fetch Roles for dropdown selection
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => roleService.getRoles(),
    staleTime: 60_000,
  });

  const roles = rolesData?.roles || [];
  const users = usersData?.users || [];
  const totalUsers = usersData?.pagination.total || 0;
  const totalPages = usersData?.pagination.totalPages || 1;

  // Quick KPI calculations
  const activeCount = users.filter((u) => u.status === 'ACTIVE').length;
  const adminCount = users.filter((u) => (u.role?.code || '').includes('SUPER') || (u.role?.code || '').includes('ADMIN') || (u.role?.name || '').includes('Admin')).length;
  const lockedCount = users.filter((u) => u.status === 'LOCKED' || u.status === 'INACTIVE').length;

  return (
    <div className="space-y-5 font-sans">
      {/* Top Header Card */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 lg:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-emerald-800" aria-hidden="true" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
              Custody Access Governance
            </span>
            <span className="text-[11px] text-slate-400 font-normal">Operator &amp; Staff Security</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
            Staff &amp; User Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-normal">
            Configure counter operators, branch managers, security roles, and credential access policies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => refetch()}
            disabled={isFetching}
            variant="outline"
            className="h-10 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-xs gap-1.5 px-3.5 shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin text-emerald-800' : 'text-slate-600'}`} />
            <span>Refresh</span>
          </Button>

          {canCreateUser && (
            <Button
              onClick={() => setCreateModalOpen(true)}
              className="h-10 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-xs gap-1.5 px-4 shadow-xs cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>Add Staff User</span>
            </Button>
          )}
        </div>
      </section>

      {/* 4 KPI Summary Cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          onClick={() => {
            setStatusFilter('ALL');
            setRoleFilter('ALL');
          }}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-emerald-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Total Staff Accounts</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {isLoading ? '—' : totalUsers}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Registered counter operators</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-100">
              <UsersIcon className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card
          onClick={() => setStatusFilter('ACTIVE')}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-emerald-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Active Operators</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-700 font-mono">
                {isLoading ? '—' : activeCount}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Authorized for custody duty</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-100">
              <UserCheck className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card
          onClick={() => setRoleFilter('ALL')}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-sky-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Administrative Roles</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-sky-700 font-mono">
                {isLoading ? '—' : adminCount}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Superadmins &amp; Managers</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-sky-700 border border-sky-100">
              <Shield className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card
          onClick={() => setStatusFilter('INACTIVE')}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-rose-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Suspended / Locked</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-rose-700 font-mono">
                {isLoading ? '—' : lockedCount}
              </p>
              <p className="text-[11px] text-rose-500 mt-0.5 font-medium">Restricted accounts</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-700 border border-rose-100">
              <ShieldAlert className="h-6 w-6" />
            </div>
          </div>
        </Card>
      </section>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search staff by name, @username, email, phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-700"
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
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive / Suspended</option>
              <option value="LOCKED">Temporarily Locked</option>
            </select>
          </div>
        </div>
      </div>

      {isError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 shadow-2xs">
          <span className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4 text-rose-700 shrink-0" />
            {error instanceof Error ? error.message : 'Staff directory could not be loaded.'}
          </span>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 px-3 text-xs font-bold">
            Retry
          </Button>
        </div>
      )}

      {/* Staff Directory Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/95 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10.5px]">
              <tr>
                <th scope="col" className="px-4 py-3.5 sm:px-5">Operator Name</th>
                <th scope="col" className="px-3 py-3.5">Username &amp; Email</th>
                <th scope="col" className="px-3 py-3.5">Assigned Role</th>
                <th scope="col" className="px-3 py-3.5">Phone Number</th>
                <th scope="col" className="px-3 py-3.5 text-center">Account Status</th>
                <th scope="col" className="px-3 py-3.5">Last Login Session</th>
                <th scope="col" className="px-4 py-3.5 text-right sm:px-5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-emerald-800" />
                      <span className="text-xs font-medium">Loading staff accounts and security permissions…</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    <UsersIcon className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">No staff accounts found</p>
                    <p className="text-xs text-slate-400 mt-0.5">Try clearing filters or search terms.</p>
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSelf = u.id === currentUser?.id || u._id === currentUser?.id;
                  const isTargetSuperAdmin = (u.role?.code || '').toUpperCase().includes('SUPER');
                  const roleStyle = getRoleBadgeStyle(u.role?.code, u.role?.name);
                  const initials = (u.name || 'Staff')
                    .split(/\s+/)
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <tr
                      key={u.id || u._id}
                      onClick={() => setSelectedProfileUser(u)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4 sm:px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-xl bg-slate-900 text-white font-bold grid place-items-center text-xs shrink-0 shadow-2xs">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {isSelf && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[10.5px] text-slate-400 font-mono">
                              ID: {(u.id || u._id || '').slice(-6)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Username & Email */}
                      <td className="py-3.5 px-3">
                        <div className="text-slate-900 font-mono font-semibold">@{u.username}</div>
                        <div className="text-slate-500 text-[11px] font-mono">{u.email}</div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-bold uppercase border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}>
                          {u.role?.name || 'Staff Operator'}
                        </span>
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-3 font-mono text-slate-700">
                        {u.phone || <span className="text-slate-400">—</span>}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center">
                        {u.status === 'ACTIVE' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            ACTIVE
                          </span>
                        )}
                        {u.status === 'INACTIVE' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            INACTIVE
                          </span>
                        )}
                        {u.status === 'LOCKED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            <Lock className="h-3 w-3" />
                            LOCKED
                          </span>
                        )}
                      </td>

                      {/* Last Login */}
                      <td className="py-3.5 px-3 font-mono text-[11px] text-slate-500">
                        {u.lastLoginAt ? (
                          <div>
                            <div className="font-semibold text-slate-800">
                              {new Date(u.lastLoginAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {formatRelativeTime(u.lastLoginAt)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">Never logged in</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right sm:px-5">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedProfileUser(u)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-emerald-50 hover:text-emerald-800 text-slate-600 transition-colors cursor-pointer"
                            title="Inspect Operator Profile"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {canUpdateUser && (
                            <button
                              type="button"
                              onClick={() => setEditModalUser(u)}
                              disabled={isTargetSuperAdmin && !currentUser?.isSuperAdmin}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer disabled:opacity-30"
                              title="Edit Profile"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canResetPassword && (
                            <button
                              type="button"
                              onClick={() => setResetModalUser(u)}
                              disabled={isTargetSuperAdmin && !currentUser?.isSuperAdmin}
                              className="p-1.5 rounded-lg border border-amber-200 hover:bg-amber-50 text-amber-700 transition-colors cursor-pointer disabled:opacity-30"
                              title="Reset Password"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canDeactivateUser && !isSelf && (
                            <button
                              type="button"
                              onClick={() => setDeactivateUser(u)}
                              disabled={isTargetSuperAdmin && !currentUser?.isSuperAdmin}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer disabled:opacity-30 ${
                                u.status === 'ACTIVE'
                                  ? 'border-rose-200 hover:bg-rose-50 text-rose-700'
                                  : 'border-emerald-200 hover:bg-emerald-50 text-emerald-700'
                              }`}
                              title={u.status === 'ACTIVE' ? 'Deactivate Account' : 'Reactivate Account'}
                            >
                              {u.status === 'ACTIVE' ? (
                                <UserX className="w-3.5 h-3.5" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5" />
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

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="border-t border-slate-100 bg-slate-50/70 p-3.5 sm:px-5 flex items-center justify-between text-xs text-slate-600">
            <span>
              Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalUsers} total operators)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 px-3 rounded-lg border-slate-200 text-xs cursor-pointer shadow-2xs"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                <span>Prev</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 px-3 rounded-lg border-slate-200 text-xs cursor-pointer shadow-2xs"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 1. View User Profile Modal */}
      {selectedProfileUser && (
        <UserProfileModal
          user={selectedProfileUser}
          onClose={() => setSelectedProfileUser(null)}
          onEdit={() => {
            setEditModalUser(selectedProfileUser);
            setSelectedProfileUser(null);
          }}
          onResetPassword={() => {
            setResetModalUser(selectedProfileUser);
            setSelectedProfileUser(null);
          }}
        />
      )}

      {/* 2. Create User Modal */}
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

      {/* 3. Edit User Modal */}
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

      {/* 4. Reset Password Modal */}
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

      {/* 5. Deactivate / Reactivate User Modal */}
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
// Sub-modals with Full-Window React Portal
// ----------------------------------------------------------------------

function UserProfileModal({
  user,
  onClose,
  onEdit,
  onResetPassword,
}: {
  user: User;
  onClose: () => void;
  onEdit: () => void;
  onResetPassword: () => void;
}) {
  const roleStyle = getRoleBadgeStyle(user.role?.code, user.role?.name);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in-0 duration-150">
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col animate-in zoom-in-95 duration-150 text-slate-900 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-900 text-white font-bold grid place-items-center text-sm shadow-xs">
              {(user.name || 'S').charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{user.name}</h3>
              <p className="text-[11px] font-mono text-slate-500">@{user.username}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Assigned Role</span>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-bold border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}>
                {user.role?.name || 'Staff Operator'}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Status</span>
              <span className="font-bold text-xs text-slate-900 mt-1 block">
                {user.status}
              </span>
            </div>
          </div>

          <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Email:</span>
              <span className="font-bold text-slate-800">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Phone:</span>
              <span className="font-bold text-slate-800">{user.phone || 'Not recorded'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Last Login:</span>
              <span className="font-bold text-slate-800">
                {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('en-IN') : 'Never'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/90 px-6 py-3.5 flex items-center justify-between">
          <button
            type="button"
            onClick={onResetPassword}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold cursor-pointer shadow-2xs"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Reset Password</span>
          </button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="h-8 px-3.5 text-xs font-semibold cursor-pointer"
            >
              <Edit2 className="h-3.5 w-3.5 mr-1" />
              <span>Edit Profile</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onClose}
              className="h-8 px-4 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold cursor-pointer"
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

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
    roleId: roles[0]?.id || (roles[0] as any)?._id || '',
    password: '',
    status: 'ACTIVE',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Generate high-entropy password
  const generateStrongPassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%&*';
    const all = upper + lower + numbers + symbols;

    let pwd = '';
    pwd += upper.charAt(Math.floor(Math.random() * upper.length));
    pwd += lower.charAt(Math.floor(Math.random() * lower.length));
    pwd += numbers.charAt(Math.floor(Math.random() * numbers.length));
    pwd += symbols.charAt(Math.floor(Math.random() * symbols.length));

    for (let i = 4; i < 14; i++) {
      pwd += all.charAt(Math.floor(Math.random() * all.length));
    }
    const shuffled = pwd
      .split('')
      .sort(() => 0.5 - Math.random())
      .join('');
    setFormData((prev) => ({ ...prev, password: shuffled }));
  };

  // Compute suggested username
  const suggestedUsername = useMemo(() => {
    if (!formData.name.trim()) return '';
    return formData.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '.')
      .replace(/\.+/g, '.')
      .replace(/^\.|\.$/g, '');
  }, [formData.name]);

  // Selected role metadata
  const selectedRole = useMemo(() => {
    return (
      roles.find((r) => r.id === formData.roleId || (r as any)._id === formData.roleId) ||
      roles[0]
    );
  }, [roles, formData.roleId]);

  // Password Strength evaluation
  const pwd = formData.password || '';
  const hasMinLen = pwd.length >= 8;
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);

  let strengthScore = 0;
  if (hasMinLen) strengthScore++;
  if (hasUpper && hasLower) strengthScore++;
  if (hasNumber) strengthScore++;
  if (hasSymbol) strengthScore++;

  const strengthLabel =
    strengthScore === 0
      ? 'Empty'
      : strengthScore === 1
      ? 'Weak'
      : strengthScore === 2
      ? 'Fair'
      : strengthScore === 3
      ? 'Good'
      : 'Very Strong';

  const strengthColor =
    strengthScore <= 1
      ? 'bg-rose-500'
      : strengthScore === 2
      ? 'bg-amber-500'
      : strengthScore === 3
      ? 'bg-sky-500'
      : 'bg-emerald-800';

  const copyCredentials = () => {
    const text =
      `Custody Operations — New Staff Account Credentials\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Staff Name: ${formData.name || 'Staff'}\n` +
      `Username: ${formData.username || '—'}\n` +
      `Email Address: ${formData.email || '—'}\n` +
      `Assigned Role: ${selectedRole?.name || 'Staff'}\n` +
      `Temporary Password: ${formData.password || '—'}\n` +
      `Portal Link: ${window.location.origin}/login\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Note: Please change your password upon your first sign-in.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handlePhoneChange = (val: string) => {
    // Only allow digits, max 10 digits
    const digits = val.replace(/\D/g, '').slice(0, 10);
    setFormData((prev) => ({ ...prev, phone: digits }));
  };

  const handleNameChange = (val: string) => {
    const sanitized = val.replace(/[^a-zA-Z\s.'-]/g, '').slice(0, 50);
    setFormData((prev) => ({ ...prev, name: sanitized }));
  };

  const handleUsernameChange = (val: string) => {
    const sanitized = val.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30);
    setFormData((prev) => ({ ...prev, username: sanitized }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setError('Full Name must be at least 2 characters.');
      return;
    }

    if (!formData.username.trim() || formData.username.trim().length < 3) {
      setError('Username must be at least 3 characters long.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setError('Please enter a valid email address (e.g. operator@vaultledger.com).');
      return;
    }

    if (formData.phone && formData.phone.length !== 10) {
      setError('Phone number must be exactly 10 digits (e.g. 9876543210).');
      return;
    }

    if (formData.password.length < 8) {
      setError('Temporary password must be at least 8 characters long.');
      return;
    }
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

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in-0 duration-150 overflow-y-auto">
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col animate-in zoom-in-95 duration-150 text-slate-900 text-xs my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-6 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 shadow-2xs">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Add Staff User</h3>
              <p className="text-[11px] text-slate-500 font-normal">
                Create a new staff login and assign their role.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col overflow-y-auto">
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2 animate-in fade-in-0">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Section 1: Staff Details */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-slate-900 font-bold text-[11.5px] uppercase tracking-wider">
                <span className="h-4 w-1 bg-emerald-800 rounded-full inline-block" />
                <span>1. Staff Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Full Name *</label>
                  <Input
                    required
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Ramesh Sharma"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">Username *</label>
                    {suggestedUsername && formData.username !== suggestedUsername && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, username: suggestedUsername })}
                        className="text-[10px] font-semibold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                      >
                        Use @{suggestedUsername}
                      </button>
                    )}
                  </div>
                  <Input
                    required
                    value={formData.username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    placeholder="e.g. ramesh.sharma"
                    className="h-9 text-xs font-mono"
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
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">Phone Number</label>
                    {formData.phone ? (
                      <span
                        className={`text-[10px] font-mono font-semibold ${
                          formData.phone.length === 10 ? 'text-emerald-800' : 'text-amber-600'
                        }`}
                      >
                        {formData.phone.length}/10 digits
                      </span>
                    ) : null}
                  </div>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-semibold text-slate-400 select-none pointer-events-none">
                      +91
                    </span>
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="9876543210"
                      className="h-9 text-xs font-mono pl-11"
                      maxLength={10}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    10-digit mobile number (numbers only)
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Role & Status */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-slate-900 font-bold text-[11.5px] uppercase tracking-wider">
                <span className="h-4 w-1 bg-emerald-800 rounded-full inline-block" />
                <span>2. Role &amp; Access</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Role *</label>
                  <select
                    required
                    value={formData.roleId}
                    onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-emerald-700 font-medium"
                  >
                    {roles.map((r) => (
                      <option key={r.id || (r as any)._id} value={r.id || (r as any)._id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-emerald-700 font-medium"
                  >
                    <option value="ACTIVE">ACTIVE (Active Account)</option>
                    <option value="INACTIVE">INACTIVE (Disabled)</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Role Summary Box */}
              {selectedRole && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-800 shrink-0" />
                    <div>
                      <div className="text-[11.5px] font-bold text-slate-800">
                        {selectedRole.name}
                      </div>
                      <div className="text-[10.5px] text-slate-500 font-normal">
                        {(selectedRole.code || '').includes('SUPER')
                          ? 'Full system access, staff management, and audit logs.'
                          : (selectedRole.code || '').includes('MANAGER')
                          ? 'Locker operations, customer KYC, and payment receipts.'
                          : (selectedRole.code || '').includes('AUDIT')
                          ? 'Read-only access for compliance and audit trail.'
                          : 'Counter operations and customer service.'}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10.5px] font-mono font-semibold text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 shrink-0">
                    {selectedRole.permissions?.length || 0} permissions
                  </span>
                </div>
              )}
            </div>

            {/* Section 3: Password */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-900 font-bold text-[11.5px] uppercase tracking-wider">
                  <span className="h-4 w-1 bg-emerald-800 rounded-full inline-block" />
                  <span>3. Password</span>
                </div>
                <button
                  type="button"
                  onClick={generateStrongPassword}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Generate Password</span>
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter or generate password (min 8 chars)"
                    className="h-9 text-xs pr-10 font-mono"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Strength Meter */}
                {formData.password && (
                  <div className="space-y-1 rounded-lg bg-slate-50 p-2.5 border border-slate-200">
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="text-slate-500 font-medium">Password Strength:</span>
                      <span className="font-bold text-slate-700">{strengthLabel}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex gap-1">
                      {[1, 2, 3, 4].map((step) => (
                        <div
                          key={step}
                          className={`h-full flex-1 rounded-full transition-all duration-300 ${
                            strengthScore >= step ? strengthColor : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[10.5px] text-slate-400 font-normal">
                  Staff member will use this password to sign in initially.
                </p>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
            {formData.password && formData.username ? (
              <button
                type="button"
                onClick={copyCredentials}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-800" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Credentials Copied!' : 'Copy Login Details'}</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-8.5 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="h-8.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold px-4 cursor-pointer shadow-xs"
              >
                {isSubmitting ? 'Creating User...' : 'Create Staff Account'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
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
  const [formData, setFormData] = useState<UpdateUserData>({
    name: user.name,
    phone: user.phone || '',
    roleId: user.role?.id || user.role?._id || roles[0]?.id || '',
    status: user.status,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handlePhoneChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    setFormData((prev) => ({ ...prev, phone: digits }));
  };

  const handleNameChange = (val: string) => {
    const sanitized = val.replace(/[^a-zA-Z\s.'-]/g, '').slice(0, 50);
    setFormData((prev) => ({ ...prev, name: sanitized }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name?.trim() || formData.name.trim().length < 2) {
      setError('Full Name must be at least 2 characters.');
      return;
    }

    if (formData.phone && formData.phone.length !== 10) {
      setError('Phone number must be exactly 10 digits (e.g. 9876543210).');
      return;
    }

    setIsSubmitting(true);
    try {
      const id = user.id || user._id;
      if (!id) throw new Error('User ID missing');
      await userService.updateUser(id, formData);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in-0 duration-150">
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col animate-in zoom-in-95 duration-150 text-slate-900 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-800">
              <Edit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Edit Staff Profile: {user.name}</h3>
              <p className="text-[11px] font-mono text-slate-500">@{user.username}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-3.5">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Full Name</label>
              <Input
                required
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">Phone Number</label>
                  {formData.phone ? (
                    <span
                      className={`text-[10px] font-mono font-semibold ${
                        formData.phone.length === 10 ? 'text-emerald-800' : 'text-amber-600'
                      }`}
                    >
                      {formData.phone.length}/10 digits
                    </span>
                  ) : null}
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-xs font-semibold text-slate-400 select-none pointer-events-none">
                    +91
                  </span>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="9876543210"
                    className="h-9 text-xs font-mono pl-11"
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Account Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-emerald-700 font-medium"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="LOCKED">LOCKED</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Assigned Access Role</label>
              <select
                value={formData.roleId}
                onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-emerald-700 font-medium"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting} className="h-8 text-xs cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="h-8 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold cursor-pointer">
              {isSubmitting ? 'Saving Changes...' : 'Save Profile Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
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
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const id = user.id || user._id;
      if (!id) throw new Error('User ID missing');
      await userService.resetPassword(id, newPassword);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in-0 duration-150">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col animate-in zoom-in-95 duration-150 text-slate-900 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Reset Password: {user.name}</h3>
              <p className="text-[11px] font-mono text-slate-500">@{user.username}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-3.5">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">New Password</label>
                <button
                  type="button"
                  onClick={generatePassword}
                  className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Generate Strong</span>
                </button>
              </div>
              <Input
                type="text"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 8 chars)"
                className="h-9 text-xs font-mono"
              />
            </div>

            {newPassword && (
              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="font-mono text-xs text-slate-700 font-bold">{newPassword}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(newPassword);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting} className="h-8 text-xs cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting || !newPassword} className="h-8 bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold cursor-pointer">
              {isSubmitting ? 'Updating Password...' : 'Confirm Password Reset'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
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
  const isDeactivating = user.status === 'ACTIVE';
  const newStatus = isDeactivating ? 'INACTIVE' : 'ACTIVE';
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleConfirm = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const id = user.id || user._id;
      if (!id) throw new Error('User ID missing');
      await userService.updateUser(id, { status: newStatus });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update user status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in-0 duration-150">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col animate-in zoom-in-95 duration-150 text-slate-900 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${isDeactivating ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {isDeactivating ? <UserX className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isDeactivating ? 'Suspend Staff Account' : 'Reactivate Staff Account'}
              </h3>
              <p className="text-[11px] font-mono text-slate-500">@{user.username}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-slate-700 leading-relaxed font-normal">
            Are you sure you want to {isDeactivating ? 'suspend' : 'reactivate'} operator account{' '}
            <strong className="text-slate-900">{user.name}</strong>?
          </p>

          {isDeactivating && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
              The operator will be immediately logged out and blocked from signing in until reactivated.
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting} className="h-8 text-xs cursor-pointer">
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={`h-8 text-xs font-semibold text-white cursor-pointer ${
              isDeactivating ? 'bg-rose-700 hover:bg-rose-800' : 'bg-emerald-800 hover:bg-emerald-900'
            }`}
          >
            {isSubmitting ? 'Updating...' : isDeactivating ? 'Confirm Deactivation' : 'Confirm Reactivation'}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
