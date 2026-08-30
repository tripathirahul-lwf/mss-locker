import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Shield,
  Lock,
  Edit2,
  Users as UsersIcon,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Check,
  Search,
  KeyRound,
  Layers3,
  UserCheck,
  ChevronDown,
} from 'lucide-react';
import { roleService } from '../services/roleService';
import { RoleListItem, PermissionGroup } from '../types/auth';
import { usePermission } from '../hooks/usePermission';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export function RolesPage() {
  const queryClient = useQueryClient();
  const canManageRoles = usePermission('roles.manage');

  const [editRole, setEditRole] = useState<RoleListItem | null>(null);
  const [permissionSearch, setPermissionSearch] = useState('');

  const { data, isLoading, isFetching, isError, error: rolesError, refetch } = useQuery({
    queryKey: ['roles'],
    queryFn: () => roleService.getRoles(),
  });

  const roles = data?.roles || [];
  const permissionGroups = data?.permissionGroups || [];
  const totalPermissions = useMemo(() => permissionGroups.reduce((total, group) => total + group.permissions.length, 0), [permissionGroups]);
  const assignedStaff = useMemo(() => roles.reduce((total, role) => total + role.userCount, 0), [roles]);
  const filteredPermissionGroups = useMemo(() => {
    const query = permissionSearch.trim().toLowerCase();
    if (!query) return permissionGroups;
    return permissionGroups.map((group) => ({
      ...group,
      permissions: group.permissions.filter((permission) =>
        [group.module, group.description, permission.name, permission.code].join(' ').toLowerCase().includes(query)
      ),
    })).filter((group) => group.permissions.length > 0);
  }, [permissionGroups, permissionSearch]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-sky-950 text-sky-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Roles & Permissions Master Matrix
            </h2>
            <p className="text-xs text-slate-500">
              Role-Based Access Control policies governing counter operators, auditors, and administrators
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link to="/users">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Staff Users</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {isError && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{rolesError instanceof Error ? rolesError.message : 'Roles could not be loaded.'}</span><Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button></div>}

      {!isLoading && !isError && (
        <section aria-label="Role access overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Security roles', value: roles.length, detail: `${roles.filter((role) => role.isSystemRole).length} protected system roles`, icon: Shield },
            { label: 'Permission gates', value: totalPermissions, detail: `Across ${permissionGroups.length} operational modules`, icon: KeyRound },
            { label: 'Assigned staff', value: assignedStaff, detail: 'Users governed by these roles', icon: UserCheck },
            { label: 'Editable policies', value: roles.filter((role) => role.code !== 'SUPER_ADMIN').length, detail: 'Least-privilege configurations', icon: Layers3 },
          ].map(({ label, value, detail, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{value}</p></div>
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-sky-50 text-sky-700"><Icon className="h-4 w-4" /></span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">{detail}</p>
            </div>
          ))}
        </section>
      )}

      {/* Role Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="col-span-2 py-12 text-center">
            <LoadingSpinner size="lg" label="Loading security roles..." />
          </div>
        ) : (
          roles.map((role) => (
            <Card key={role.id} className="group border-slate-200 hover:border-sky-300 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base font-bold text-slate-900">{role.name}</CardTitle>
                      <Badge variant="outline" className="font-mono text-[10px] font-semibold bg-slate-50">
                        {role.code}
                      </Badge>
                      {role.isSystemRole && (
                        <Badge variant="secondary" className="text-[10px]">
                          System Role
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs text-slate-500 line-clamp-2">
                      {role.description}
                    </CardDescription>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-100 text-slate-700 shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                </div>

                <div aria-label={`${role.name} permission coverage`} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500"><span>Permission coverage</span><span className="font-semibold tabular-nums text-slate-700">{totalPermissions ? Math.round(((role.permissions?.length || 0) / totalPermissions) * 100) : 0}%</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${totalPermissions ? Math.min(100, ((role.permissions?.length || 0) / totalPermissions) * 100) : 0}%` }} /></div>
                </div>
              </CardHeader>

              <CardContent className="pt-0 space-y-4">
                <div className="flex items-center justify-between text-xs p-3 bg-slate-50 rounded-md border border-slate-200/80">
                  <div className="flex items-center gap-1.5 font-medium text-slate-700">
                    <UsersIcon className="w-4 h-4 text-slate-500" />
                    <span>{role.userCount} Assigned Staff</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900 font-mono">
                    <span>{role.permissions?.length || 0} Permissions</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">
                    {role.code === 'SUPER_ADMIN' ? 'Universal System Override' : 'Granular RBAC Policy'}
                  </span>

                  {canManageRoles && role.code !== 'SUPER_ADMIN' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditRole(role)}
                      className="flex items-center gap-1.5 h-8 text-xs"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Permissions</span>
                    </Button>
                  )}
                  {role.code === 'SUPER_ADMIN' && (
                    <span className="text-xs font-semibold text-sky-700 bg-sky-50 px-2 py-1 rounded border border-sky-200">
                      All Rights Granted
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Permissions Matrix Overview */}
      <Card className="border-slate-200">
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><CardTitle className="text-sm font-bold text-slate-900">System Permission Modules Catalog ({permissionGroups.length} Modules)</CardTitle><CardDescription className="mt-1 text-xs text-slate-500">Search and inspect the functional gates enforced at API and interface layers</CardDescription></div>
          <label className="relative block w-full sm:w-80"><span className="sr-only">Search permission catalog</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} placeholder="Search module, action, or code..." className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-xs outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />{permissionSearch && <button type="button" onClick={() => setPermissionSearch('')} aria-label="Clear permission search" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-3.5 w-3.5" /></button>}</label>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredPermissionGroups.map((group) => (
              <details
                key={`${group.module}-${permissionSearch ? 'filtered' : 'default'}`}
                open={permissionSearch ? true : undefined}
                className="group/module rounded-lg border border-slate-200 bg-slate-50/70 open:bg-white open:shadow-sm"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500">
                  <span><span className="block font-bold text-xs text-slate-900">{group.module}</span><span className="mt-1 block text-[11px] text-slate-500">{group.description}</span></span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {group.permissions.length} actions
                  </Badge>
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open/module:rotate-180" />
                </summary>
                <div className="space-y-1 border-t border-slate-100 px-3.5 pb-3.5 pt-2">
                  {group.permissions.map((p) => (
                    <div key={p.code} className="flex items-center gap-1.5 text-[11px] text-slate-700">
                      <Check className="w-3 h-3 text-sky-600 shrink-0" />
                      <span className="font-medium truncate">{p.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono ml-auto">{p.code}</span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
          {filteredPermissionGroups.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 py-10 text-center"><Search className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-2 text-sm font-semibold text-slate-700">No matching permissions</p><p className="mt-1 text-xs text-slate-500">Try a module name, action, or permission code.</p></div>}
        </CardContent>
      </Card>

      {/* Edit Role Permissions Modal */}
      {editRole && (
        <EditRolePermissionsModal
          role={editRole}
          permissionGroups={permissionGroups}
          onClose={() => setEditRole(null)}
          onSuccess={() => {
            setEditRole(null);
            queryClient.invalidateQueries({ queryKey: ['roles'] });
          }}
        />
      )}
    </div>
  );
}

function EditRolePermissionsModal({
  role,
  permissionGroups,
  onClose,
  onSuccess,
}: {
  role: RoleListItem;
  permissionGroups: PermissionGroup[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set(role.permissions || [])
  );
  const [description, setDescription] = useState(role.description || '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [permissionSearch, setPermissionSearch] = useState('');
  const titleRef = useRef<HTMLHeadingElement>(null);
  const initialPermissions = useMemo(() => new Set(role.permissions || []), [role.permissions]);
  const isDirty = description !== (role.description || '') || selectedPermissions.size !== initialPermissions.size || Array.from(selectedPermissions).some((permission) => !initialPermissions.has(permission));
  const visibleGroups = useMemo(() => {
    const query = permissionSearch.trim().toLowerCase();
    if (!query) return permissionGroups;
    return permissionGroups.map((group) => ({
      ...group,
      permissions: group.permissions.filter((permission) => [group.module, permission.name, permission.code].join(' ').toLowerCase().includes(query)),
    })).filter((group) => group.permissions.length > 0);
  }, [permissionGroups, permissionSearch]);

  useEffect(() => {
    titleRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, onClose]);

  const togglePermission = (code: string) => {
    const updated = new Set(selectedPermissions);
    if (updated.has(code)) {
      updated.delete(code);
    } else {
      updated.add(code);
    }
    setSelectedPermissions(updated);
  };

  const toggleAllModule = (group: PermissionGroup) => {
    const updated = new Set(selectedPermissions);
    const allModuleSelected = group.permissions.every((p) => updated.has(p.code));

    if (allModuleSelected) {
      group.permissions.forEach((p) => updated.delete(p.code));
    } else {
      group.permissions.forEach((p) => updated.add(p.code));
    }
    setSelectedPermissions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await roleService.updateRole(role.id, {
        description,
        permissions: Array.from(selectedPermissions),
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update role permissions');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <Card role="dialog" aria-modal="true" aria-labelledby="edit-role-title" className="max-w-3xl w-full max-h-[90vh] flex flex-col bg-white border-slate-200 shadow-2xl overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-sky-100 text-sky-800">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <CardTitle ref={titleRef} tabIndex={-1} id="edit-role-title" className="text-base font-bold text-slate-900 outline-none">
                Edit Permissions: {role.name} ({role.code})
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Grant or revoke functional operational capabilities for this role
              </CardDescription>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-md text-slate-400 hover:text-slate-700" aria-label="Close role permissions editor">
            <X className="w-5 h-5" />
          </button>
        </CardHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {error && (
              <div role="alert" className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Role Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Role purpose and responsibility"
                maxLength={500}
                className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Permission Grants ({selectedPermissions.size} Active)
                </h4>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input aria-label="Search permissions in editor" value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} placeholder="Filter permissions by module, action, or code..." className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-xs outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
              </div>

              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
                Apply least privilege: grant only the capabilities required for this role's operational duties. Changes affect every assigned staff member.
              </div>

              <div className="space-y-3">
                {visibleGroups.map((group) => {
                  const allSelected = group.permissions.every((p) => selectedPermissions.has(p.code));
                  const someSelected =
                    !allSelected && group.permissions.some((p) => selectedPermissions.has(p.code));

                  return (
                    <div
                      key={group.module}
                      className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50 space-y-2.5"
                    >
                      <div className="flex items-center justify-between pb-1 border-b border-slate-200/80">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = someSelected;
                            }}
                            onChange={() => toggleAllModule(group)}
                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                            id={`group-${group.module}`}
                          />
                          <label
                            htmlFor={`group-${group.module}`}
                            className="text-xs font-bold text-slate-900 cursor-pointer"
                          >
                            {group.module}
                          </label>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {group.permissions.filter((p) => selectedPermissions.has(p.code)).length} /{' '}
                          {group.permissions.length} granted
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {group.permissions.map((perm) => {
                          const isChecked = selectedPermissions.has(perm.code);
                          return (
                            <label
                              key={perm.code}
                              className={`flex items-start gap-2.5 p-2 rounded-md border text-xs cursor-pointer select-none transition-colors ${
                                isChecked
                                  ? 'bg-sky-50/80 border-sky-200 text-sky-950 font-medium'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePermission(perm.code)}
                                className="h-4 w-4 mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 shrink-0"
                              />
                              <div className="space-y-0.5">
                                <p className="font-semibold text-slate-900 leading-tight">{perm.name}</p>
                                <p className="text-[10px] text-slate-500 font-mono leading-tight">
                                  {perm.code}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between shrink-0">
            <span aria-live="polite" className={`text-xs font-medium ${isDirty ? 'text-amber-700' : 'text-slate-500'}`}>{isDirty ? `${selectedPermissions.size} permissions selected · Unsaved changes` : 'No unsaved changes'}</span>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isSubmitting || !isDirty}>{isSubmitting ? 'Saving Permissions...' : 'Save Role Permissions'}</Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
