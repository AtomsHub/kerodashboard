'use client';

// src/app/roles/page.tsx
// Roles & staff. A staff member has one role plus optional permissions
// granted directly to them ("extra"), so a KYC officer can be given one
// more permission without inventing a new role.

import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Plus, UsersThree, PencilSimple, UserPlus, ArrowRight, Copy, Trash } from '@phosphor-icons/react';
import { Alert } from '@heroui/react';
import { toast } from 'sonner';
import { Permission, AdminRoleItem } from '@/types/admin';
import { api } from '@/lib/api';
import { applyApiFormError } from '@/lib/errors';
import { PermissionGuard, Can } from '@/components/auth/can';
import { PermissionMatrix } from '@/components/auth/permission-matrix';
import { AppInput } from '@/components/ui/app-input';
import { AppTextarea } from '@/components/ui/app-textarea';
import { AppButton } from '@/components/ui/app-button';
import { AppSelect } from '@/components/ui/app-select';
import { AppModal } from '@/components/ui/app-modal';
import { useAuthStore } from '@/stores/auth-store';
import { AppRowActions } from '@/components/ui/app-row-actions';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { UserAvatar } from '@/components/ui/user-avatar';
import { EmptyState, Page, PageHeader, Segmented, StatusPill } from '@/components/ui/page';

interface StaffUserItem {
  id: string;
  fullname: string;
  email: string;
  roleId: string | null;
  roleName: string | null;
  roleLabel: string;
  extraPermissions: Permission[];
  mustChangePassword: boolean;
  isSuperAdmin: boolean;
  isActive: boolean;
  createdAt: string;
}

/** The seeded super-admin role stores a wildcard; it isn't edited here. */
const isSystemRole = (role: AdminRoleItem) => (role.permissions as string[]).includes('*');

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{message}</Alert.Title>
      </Alert.Content>
    </Alert>
  );
}

export default function RolesManagementPage() {
  const queryClient = useQueryClient();
  const currentAdminId = useAuthStore((st) => st.admin?.id);
  const hasPermission = useAuthStore((st) => st.hasPermission);
  const [activeTab, setActiveTab] = useState<'roles' | 'staff'>('roles');

  // ── Queries ─────────────────────────────────────────────────────────
  const { data: roles = [], isLoading: isLoadingRoles } = useQuery<AdminRoleItem[]>({
    queryKey: ['admin', 'roles'],
    queryFn: async () => {
      const raw = (await api.get('/admin/roles')).data?.data;
      if (Array.isArray(raw)) return raw;
      if (Array.isArray(raw?.roles)) return raw.roles;
      throw new Error('Unexpected response from server');
    },
  });

  const { data: staff = [], isLoading: isLoadingStaff } = useQuery<StaffUserItem[]>({
    queryKey: ['admin', 'staff'],
    queryFn: async () => {
      const raw = (await api.get('/admin/adminusers')).data?.data;
      if (Array.isArray(raw?.admins)) return raw.admins;
      if (Array.isArray(raw)) return raw;
      throw new Error('Unexpected response from server');
    },
  });

  const assignableRoles = useMemo(() => roles.filter((r) => r.isActive && !isSystemRole(r)), [roles]);
  const roleOptions = assignableRoles.map((r) => ({ key: r.id, label: r.name }));
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] });
  };

  // ── Role editor (create + edit) ─────────────────────────────────────
  const [roleEditor, setRoleEditor] = useState<{ role: AdminRoleItem | null } | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [rolePermissions, setRolePermissions] = useState<Permission[]>([]);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [deletingRole, setDeletingRole] = useState<AdminRoleItem | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeletingRole, setIsDeletingRole] = useState(false);

  const openRole = (role: AdminRoleItem | null) => {
    setRoleEditor({ role });
    setRoleName(role?.name ?? '');
    setRoleDescription(role?.description ?? '');
    setRolePermissions(role ? [...role.permissions] : []);
    setRoleError(null);
  };

  const editingRole = roleEditor?.role ?? null;
  const roleIsSystem = editingRole ? isSystemRole(editingRole) : false;
  const canEditRole = editingRole ? hasPermission('edit_role' as Permission) && !roleIsSystem : true;

  const saveRole = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canEditRole) return;
    if (!roleName.trim()) return setRoleError('Give the role a name.');
    if (rolePermissions.length === 0) return setRoleError('Pick at least one permission.');
    setRoleError(null);
    setIsSavingRole(true);
    const payload = { name: roleName.trim(), description: roleDescription.trim(), permissions: rolePermissions };
    try {
      if (editingRole) {
        await api.put(`/admin/roles/${editingRole.id}`, payload, { silent: true });
        toast.success(`${payload.name} updated`);
      } else {
        await api.post('/admin/roles', payload, { silent: true });
        toast.success(`${payload.name} created`);
      }
      setRoleEditor(null);
      refresh();
    } catch (err) {
      applyApiFormError(err, { setFormError: setRoleError, fallbackMessage: 'Couldn’t save the role' });
    } finally {
      setIsSavingRole(false);
    }
  };

  const deleteRole = async () => {
    if (!deletingRole) return;
    setIsDeletingRole(true);
    try {
      await api.delete(`/admin/roles/${deletingRole.id}`, {
        data: { reason: deleteReason.trim() || 'Role no longer needed' },
        silent: true,
      });
      toast.success(`${deletingRole.name} deleted`);
      setDeletingRole(null);
      setRoleEditor(null);
      refresh();
    } catch (err) {
      applyApiFormError(err, { showToast: true, fallbackMessage: 'Couldn’t delete the role' });
    } finally {
      setIsDeletingRole(false);
    }
  };

  // ── Add staff ───────────────────────────────────────────────────────
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({ fullname: '', email: '', roleId: '' });
  const [newStaffError, setNewStaffError] = useState<string | null>(null);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [createdStaff, setCreatedStaff] = useState<{ email: string; password: string } | null>(null);

  const addStaff = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newStaff.fullname.trim() || !newStaff.email.trim()) return setNewStaffError('Enter a name and email.');
    if (!newStaff.roleId) return setNewStaffError('Choose a role.');
    setNewStaffError(null);
    setIsAddingStaff(true);
    try {
      const res = await api.post('/admin/adminusers', newStaff, { silent: true });
      const temporaryPassword: string | undefined = res.data?.data?.temporaryPassword;
      setIsAddStaffOpen(false);
      if (temporaryPassword) setCreatedStaff({ email: newStaff.email, password: temporaryPassword });
      else toast.success(`${newStaff.fullname} added`);
      refresh();
    } catch (err) {
      applyApiFormError(err, { setFormError: setNewStaffError, fallbackMessage: 'Couldn’t add this staff member' });
    } finally {
      setIsAddingStaff(false);
    }
  };

  // ── Manage access ───────────────────────────────────────────────────
  const [managingStaff, setManagingStaff] = useState<StaffUserItem | null>(null);
  const [staffRoleId, setStaffRoleId] = useState('');
  const [staffExtras, setStaffExtras] = useState<Permission[]>([]);
  const [staffIsSuperAdmin, setStaffIsSuperAdmin] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [isSavingAccess, setIsSavingAccess] = useState(false);

  const staffRole = roles.find((r) => r.id === staffRoleId) ?? null;
  const staffRolePermissions = useMemo(
    () => (staffRole && !isSystemRole(staffRole) ? staffRole.permissions : []),
    [staffRole],
  );

  const openAccess = (member: StaffUserItem) => {
    setManagingStaff(member);
    setStaffRoleId(member.roleId ?? '');
    setStaffExtras(member.extraPermissions ?? []);
    setStaffIsSuperAdmin(member.isSuperAdmin);
    setAccessError(null);
  };

  const saveAccess = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!managingStaff) return;
    if (!staffIsSuperAdmin && !staffRoleId) return setAccessError('Choose a role.');
    setAccessError(null);
    setIsSavingAccess(true);
    try {
      await api.put(
        `/admin/adminusers/${managingStaff.id}`,
        {
          ...(staffRoleId ? { roleId: staffRoleId } : {}),
          extraPermissions: staffExtras.filter((p) => !staffRolePermissions.includes(p)),
          ...(staffIsSuperAdmin !== managingStaff.isSuperAdmin ? { isSuperAdmin: staffIsSuperAdmin } : {}),
        },
        { silent: true },
      );
      toast.success(
        staffIsSuperAdmin
          ? `Saved. ${managingStaff.fullname} is a super admin, so they keep full access.`
          : `Access updated for ${managingStaff.fullname}`,
      );
      setManagingStaff(null);
      refresh();
    } catch (err) {
      applyApiFormError(err, { setFormError: setAccessError, fallbackMessage: 'Couldn’t update access' });
    } finally {
      setIsSavingAccess(false);
    }
  };

  const isSelf = managingStaff?.id === currentAdminId;

  return (
    <PermissionGuard permission="view_roles">
      <Page>
        <PageHeader
          title="Roles & staff"
          description="Who can access what in the admin."
          actions={
            activeTab === 'roles' ? (
              <Can permission="create_role">
                <AppButton variant="brand" startContent={<Plus weight="bold" />} label="New role" onPress={() => openRole(null)} />
              </Can>
            ) : (
              <Can permission="create_admin_user">
                <AppButton
                  variant="brand"
                  startContent={<UserPlus />}
                  label="Add staff"
                  onPress={() => {
                    setNewStaff({ fullname: '', email: '', roleId: '' });
                    setNewStaffError(null);
                    setIsAddStaffOpen(true);
                  }}
                />
              </Can>
            )
          }
        />

        <Segmented
          aria-label="Section"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { key: 'roles', label: 'Roles', icon: ShieldCheck, count: roles.length },
            { key: 'staff', label: 'Staff', icon: UsersThree, count: staff.length },
          ]}
        />

        {activeTab === 'roles' &&
          (isLoadingRoles ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-3xl bg-surface" />
              ))}
            </div>
          ) : roles.length === 0 ? (
            <DashboardCard>
              <EmptyState
                icon={ShieldCheck}
                title="No roles yet"
                description="Create a role to group permissions for a team."
                action={<AppButton variant="tertiary" startContent={<Plus weight="bold" />} label="New role" onPress={() => openRole(null)} />}
              />
            </DashboardCard>
          ) : (
            <DashboardCard className="p-3">
              <ul className="space-y-0.5">
                {roles.map((role) => (
                  <li key={role.id}>
                    <button
                      type="button"
                      onClick={() => openRole(role)}
                      className="group flex w-full cursor-pointer items-center gap-4 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-surface-secondary"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-default text-foreground">
                        <ShieldCheck size={20} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-medium text-foreground">{role.name}</span>
                          {!role.isActive && <StatusPill>Archived</StatusPill>}
                        </span>
                        <span className="block truncate text-xs text-muted">{role.description || 'No description'}</span>
                      </span>
                      <span className="tabular hidden shrink-0 text-[13px] text-muted sm:block">
                        {isSystemRole(role) ? 'All permissions' : `${role.permissions?.length ?? 0} permissions`} · {role.adminCount} staff
                      </span>
                      <ArrowRight
                        size={16}
                        className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </DashboardCard>
          ))}

        {activeTab === 'staff' &&
          (isLoadingStaff ? (
            <div className="h-64 animate-pulse rounded-3xl bg-surface" />
          ) : staff.length === 0 ? (
            <DashboardCard>
              <EmptyState icon={UsersThree} title="No staff yet" description="Invite operators and give them a role." />
            </DashboardCard>
          ) : (
            <DashboardCard className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Access</th>
                      <th>Status</th>
                      <th className="text-right" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <UserAvatar name={member.fullname} size="sm" />
                            <div>
                              <p className="font-medium text-foreground">{member.fullname}</p>
                              <p className="text-xs text-muted">{member.email}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          {member.isSuperAdmin ? (
                            <StatusPill tone="accent">Super admin</StatusPill>
                          ) : (
                            <span className="text-foreground">
                              {member.roleName || 'No role'}
                              {member.extraPermissions?.length > 0 && (
                                <span className="ml-1.5 text-xs text-muted">+{member.extraPermissions.length} extra</span>
                              )}
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusPill tone={member.isActive ? 'success' : 'danger'} dot>
                              {member.isActive ? 'Active' : 'Suspended'}
                            </StatusPill>
                            {member.mustChangePassword && <StatusPill tone="warning">Temporary password</StatusPill>}
                          </div>
                        </td>
                        <td className="text-right">
                          <AppRowActions
                            items={[
                              {
                                key: 'manage',
                                label: 'Manage access',
                                icon: <PencilSimple size={14} />,
                                onClick: () => openAccess(member),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DashboardCard>
          ))}

        {/* ── Role: create / edit ─────────────────────────────────────── */}
        <AppModal
          isOpen={Boolean(roleEditor)}
          onOpenChange={(open) => !open && setRoleEditor(null)}
          title={editingRole ? editingRole.name : 'New role'}
          description={
            roleIsSystem
              ? 'Built-in role with full access. It can’t be edited or deleted.'
              : editingRole
                ? `${editingRole.adminCount} staff on this role.`
                : 'Group permissions for a team.'
          }
          onSubmit={saveRole}
          footer={
            <>
              {editingRole && !roleIsSystem && hasPermission('delete_role' as Permission) && (
                <AppButton
                  variant="ghost"
                  className="mr-auto text-danger"
                  startContent={<Trash size={16} />}
                  label="Delete"
                  onPress={() => {
                    setDeleteReason('');
                    setDeletingRole(editingRole);
                  }}
                />
              )}
              <AppButton variant="tertiary" label={canEditRole ? 'Cancel' : 'Close'} onPress={() => setRoleEditor(null)} isDisabled={isSavingRole} />
              {canEditRole && (
                <AppButton variant="brand" type="submit" label={editingRole ? 'Save' : 'Create role'} isLoading={isSavingRole} />
              )}
            </>
          }
        >
          <FormError message={roleError} />
          {!roleIsSystem && (
            <>
              <AppInput
                label="Name"
                placeholder="e.g. KYC officer"
                isRequired
                isDisabled={!canEditRole}
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
              />
              <AppTextarea
                label="Description"
                placeholder="Optional"
                rows={2}
                isDisabled={!canEditRole}
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
              />
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-medium text-foreground">Permissions</span>
                <PermissionMatrix
                  value={rolePermissions}
                  readOnly={!canEditRole}
                  onChange={(next) => setRolePermissions(next)}
                />
              </div>
            </>
          )}
        </AppModal>

        {/* ── Role: delete ────────────────────────────────────────────── */}
        <AppModal
          isOpen={Boolean(deletingRole)}
          onOpenChange={(open) => !open && setDeletingRole(null)}
          size="sm"
          title={`Delete ${deletingRole?.name ?? 'role'}?`}
          description={
            deletingRole && deletingRole.adminCount > 0
              ? `${deletingRole.adminCount} staff still use this role. Move them to another role first.`
              : 'This can’t be undone.'
          }
          footer={
            <>
              <AppButton variant="tertiary" label="Cancel" onPress={() => setDeletingRole(null)} isDisabled={isDeletingRole} />
              <AppButton
                variant="danger"
                label="Delete role"
                onPress={deleteRole}
                isLoading={isDeletingRole}
                isDisabled={Boolean(deletingRole && deletingRole.adminCount > 0)}
              />
            </>
          }
        >
          {deletingRole && deletingRole.adminCount === 0 && (
            <AppInput
              label="Reason"
              placeholder="Optional, kept in the audit trail"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
            />
          )}
        </AppModal>

        {/* ── Staff: add ──────────────────────────────────────────────── */}
        <AppModal
          isOpen={isAddStaffOpen}
          onOpenChange={setIsAddStaffOpen}
          title="Add staff"
          description="We email them a temporary password. They set their own when they first sign in."
          onSubmit={addStaff}
          footer={
            <>
              <AppButton variant="tertiary" label="Cancel" onPress={() => setIsAddStaffOpen(false)} isDisabled={isAddingStaff} />
              <AppButton variant="brand" type="submit" label="Add staff" isLoading={isAddingStaff} />
            </>
          }
        >
          <FormError message={newStaffError} />
          <AppInput
            label="Full name"
            placeholder="e.g. Babatunde Adebayo"
            isRequired
            value={newStaff.fullname}
            onChange={(e) => setNewStaff((s) => ({ ...s, fullname: e.target.value }))}
          />
          <AppInput
            label="Work email"
            type="email"
            placeholder="name@kero.ng"
            isRequired
            value={newStaff.email}
            onChange={(e) => setNewStaff((s) => ({ ...s, email: e.target.value }))}
          />
          <AppSelect
            label="Role"
            placeholder="Choose a role"
            isRequired
            selectedKey={newStaff.roleId}
            onSelectionChange={(key) => setNewStaff((s) => ({ ...s, roleId: key }))}
            options={roleOptions}
          />
        </AppModal>

        {/* ── Staff: temporary password (shown once) ──────────────────── */}
        <AppModal
          isOpen={Boolean(createdStaff)}
          onOpenChange={(open) => !open && setCreatedStaff(null)}
          size="sm"
          title="Staff added"
          description={`We emailed this temporary password to ${createdStaff?.email ?? ''}. It won’t be shown again.`}
          footer={<AppButton variant="brand" label="Done" onPress={() => setCreatedStaff(null)} />}
        >
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-secondary px-4 py-3">
            <code className="tabular select-all text-[15px] font-semibold tracking-wide text-foreground">{createdStaff?.password}</code>
            <AppButton
              size="sm"
              variant="ghost"
              isIconOnly
              aria-label="Copy password"
              startContent={<Copy size={16} />}
              onPress={() => {
                if (createdStaff) void navigator.clipboard.writeText(createdStaff.password);
                toast.success('Copied');
              }}
            />
          </div>
        </AppModal>

        {/* ── Staff: manage access ────────────────────────────────────── */}
        <AppModal
          isOpen={Boolean(managingStaff)}
          onOpenChange={(open) => !open && setManagingStaff(null)}
          title={managingStaff?.fullname ?? ''}
          description={managingStaff?.email}
          onSubmit={saveAccess}
          footer={
            <>
              <AppButton variant="tertiary" label="Cancel" onPress={() => setManagingStaff(null)} isDisabled={isSavingAccess} />
              <AppButton variant="brand" type="submit" label="Save" isLoading={isSavingAccess} />
            </>
          }
        >
          <FormError message={accessError} />

          <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface-secondary px-4 py-3">
            <div>
              <p className="text-[14px] font-medium text-foreground">Super admin</p>
              <p className="mt-1 text-[13px] text-muted">
                {isSelf
                  ? 'You can’t remove your own super-admin access.'
                  : staffIsSuperAdmin
                    ? 'Full access. Turn off to use the role below.'
                    : 'Access comes from the role below.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={staffIsSuperAdmin}
              disabled={isSelf}
              onClick={() => setStaffIsSuperAdmin((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
                staffIsSuperAdmin ? 'bg-secondary' : 'bg-default'
              } ${isSelf ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            >
              <span className={`size-5 rounded-full bg-surface transition-transform ${staffIsSuperAdmin ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {!staffIsSuperAdmin && (
            <>
              <AppSelect
                label="Role"
                placeholder="Choose a role"
                selectedKey={staffRoleId}
                onSelectionChange={(key) => {
                  setStaffRoleId(key);
                  // Extras the new role already covers are dropped.
                  const next = roles.find((r) => r.id === key)?.permissions ?? [];
                  setStaffExtras((prev) => prev.filter((p) => !next.includes(p)));
                }}
                options={roleOptions}
              />
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-medium text-foreground">Permissions</span>
                  <span className="text-xs text-muted">
                    {staffRolePermissions.length} from role · {staffExtras.length} extra
                  </span>
                </div>
                <PermissionMatrix
                  locked={staffRolePermissions}
                  lockedLabel={staffRole?.name ?? 'Role'}
                  value={staffExtras}
                  onChange={(next) => setStaffExtras(next)}
                />
              </div>
            </>
          )}
        </AppModal>
      </Page>
    </PermissionGuard>
  );
}
