"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Master from "./master";

type AccessLevel = "Own Only" | "Assigned" | "All";
type PermissionKey =
  | "canView"
  | "canAdd"
  | "canEdit"
  | "canDeactivate"
  | "canExport";
type Permission = {
  id?: number;
  roleId?: number;
  module: string;
  access: AccessLevel;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDeactivate: boolean;
  canExport: boolean;
};
type Role = {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
};
type RoleForm = {
  name: string;
  description: string;
  permissions: Permission[];
};
type CurrentUser = {
  id: number;
  roleId: number;
  status: "Active" | "Inactive";
};
type RoleUser = { id: number; roleId: number; status?: "Active" | "Inactive" };
type AssignedRole = {
  id: number;
  name: string;
  isActive: boolean;
  permissions: Permission[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const PAGE_SIZE = 10;
const accessOptions: AccessLevel[] = ["Own Only", "Assigned", "All"];
const permissionKeys: PermissionKey[] = [
  "canView",
  "canAdd",
  "canEdit",
  "canDeactivate",
  "canExport",
];
const permissionLabels: Record<PermissionKey, string> = {
  canView: "View",
  canAdd: "Add",
  canEdit: "Edit",
  canDeactivate: "Deactivate",
  canExport: "Export",
};
const modules = [
  "Dashboard",
  "Assets & Hardware",
  "Employees",
  "Check-in / Check-out",
  "Software & Warranty",
  "Service Desk",
  "Asset Transfer",
  "Acknowledgement",
  "Asset Disposal",
  "Maintenance Center",
  "Reports & Analytics",
  "Notifications",
  "Audit Logs",
  "User Management",
  "Role Management",
];

function getSessionUserId() {
  const value = Number(
    sessionStorage.getItem("assetManagementUserId") ??
      sessionStorage.getItem("stockwiseUserId") ??
      "0",
  );
  return Number.isFinite(value) && value > 0 ? value : null;
}
function emptyPermission(module: string): Permission {
  return {
    module,
    access: "Own Only",
    canView: false,
    canAdd: false,
    canEdit: false,
    canDeactivate: false,
    canExport: false,
  };
}
function createEmptyForm(): RoleForm {
  return {
    name: "",
    description: "",
    permissions: modules.map(emptyPermission),
  };
}
function keysForModule(moduleName: string): PermissionKey[] {
  if (["Dashboard", "Notifications", "Audit Logs"].includes(moduleName))
    return ["canView"];
  if (moduleName === "Check-in / Check-out")
    return ["canView", "canAdd", "canEdit", "canExport"];
  if (moduleName === "Reports & Analytics") return ["canView", "canExport"];
  return permissionKeys;
}
function labelForPermission(moduleName: string, key: PermissionKey) {
  if (moduleName === "Check-in / Check-out" && key === "canAdd")
    return "Check In";
  if (moduleName === "Check-in / Check-out" && key === "canEdit")
    return "Check Out";
  return permissionLabels[key];
}
function normalizePermission(permission: Permission): Permission {
  const allowed = new Set(keysForModule(permission.module));
  return {
    ...permission,
    canView: allowed.has("canView") && permission.canView,
    canAdd: allowed.has("canAdd") && permission.canAdd,
    canEdit: allowed.has("canEdit") && permission.canEdit,
    canDeactivate: allowed.has("canDeactivate") && permission.canDeactivate,
    canExport: allowed.has("canExport") && permission.canExport,
  };
}
function hasAllPermissions(permission: Permission) {
  return keysForModule(permission.module).every((key) => permission[key]);
}
function isEnabledModule(permission: Permission) {
  return keysForModule(permission.module).some((key) => permission[key]);
}
function enabledModuleCount(permissions: Permission[]) {
  return permissions.filter(
    (permission) =>
      permission.module !== "Bulk Asset Import" && isEnabledModule(permission),
  ).length;
}
function allApplicableModulesChecked(
  permissions: Permission[],
  key: PermissionKey,
) {
  const applicable = permissions.filter((p) =>
    keysForModule(p.module).includes(key),
  );
  return applicable.length > 0 && applicable.every((p) => p[key]);
}
function moduleNote(moduleName: string) {
  const notes: Record<string, string> = {};
  return notes[moduleName] ?? "";
}

export default function RoleManagement() {
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [pagePermission, setPagePermission] = useState<Permission | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<RoleUser[]>([]);
  const [viewingRole, setViewingRole] = useState<Role | null>(null);
  const [form, setForm] = useState<RoleForm>(createEmptyForm);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingStatusRoleId, setUpdatingStatusRoleId] = useState<
    number | null
  >(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const canView = pagePermission?.canView === true,
    canAdd = pagePermission?.canAdd === true,
    canEdit = pagePermission?.canEdit === true,
    canDeactivate = pagePermission?.canDeactivate === true,
    canExport = pagePermission?.canExport === true;

  const requestHeaders = useCallback(
    (json = false): Record<string, string> => ({
      Accept: "application/json",
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(currentUserId ? { "X-User-Id": String(currentUserId) } : {}),
    }),
    [currentUserId],
  );

  const loadAccess = useCallback(async () => {
    setAccessLoading(true);
    setError("");
    const id = getSessionUserId();
    if (!id) {
      setError("Your login session is incomplete. Sign out and sign in again.");
      setAccessLoading(false);
      return;
    }
    try {
      const userResponse = await fetch(`${API_URL}/users/${id}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const userBody = await userResponse.json().catch(() => null);
      if (!userResponse.ok)
        throw new Error(userBody?.message ?? "Unable to load current user.");
      const currentUser = userBody as CurrentUser;
      if (currentUser.status !== "Active")
        throw new Error("Your user account is inactive.");
      const roleResponse = await fetch(
        `${API_URL}/roles/${currentUser.roleId}`,
        { headers: { Accept: "application/json" }, cache: "no-store" },
      );
      const roleBody = await roleResponse.json().catch(() => null);
      if (!roleResponse.ok)
        throw new Error(roleBody?.message ?? "Unable to load assigned role.");
      const assignedRole = roleBody as AssignedRole;
      if (!assignedRole.isActive)
        throw new Error("Your assigned role is inactive.");
      setCurrentUserId(id);
      setPagePermission(
        assignedRole.permissions.find(
          (item) => item.module === "Role Management",
        ) ?? null,
      );
    } catch (value) {
      setPagePermission(null);
      setError(
        value instanceof Error
          ? value.message
          : "Unable to load Role Management permission.",
      );
    } finally {
      setAccessLoading(false);
    }
  }, []);

  const loadRoles = useCallback(async () => {
    if (!currentUserId || !canView) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const [rolesResponse, usersResponse] = await Promise.all([
        fetch(`${API_URL}/roles`, {
          headers: requestHeaders(),
          cache: "no-store",
        }),
        fetch(`${API_URL}/users`, {
          headers: requestHeaders(),
          cache: "no-store",
        }),
      ]);
      const rolesBody = await rolesResponse.json().catch(() => null);
      const usersBody = await usersResponse.json().catch(() => null);
      if (!rolesResponse.ok)
        throw new Error(
          (Array.isArray(rolesBody?.message)
            ? rolesBody.message.join(", ")
            : rolesBody?.message) ?? "Unable to load roles.",
        );
      if (!usersResponse.ok)
        throw new Error(
          (Array.isArray(usersBody?.message)
            ? usersBody.message.join(", ")
            : usersBody?.message) ?? "Unable to check assigned users.",
        );
      const loaded = Array.isArray(rolesBody) ? (rolesBody as Role[]) : [];
      const loadedUsers = Array.isArray(usersBody)
        ? (usersBody as RoleUser[])
        : Array.isArray(usersBody?.data)
          ? (usersBody.data as RoleUser[])
          : [];
      setRoles(loaded);
      setUsers(loadedUsers);
      setCurrentPage((page) =>
        Math.min(page, Math.max(1, Math.ceil(loaded.length / PAGE_SIZE))),
      );
    } catch (value) {
      setRoles([]);
      setUsers([]);
      setError(
        value instanceof Error ? value.message : "Unable to load roles.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [canView, currentUserId, requestHeaders]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => void loadAccess(), [loadAccess]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!accessLoading && canView) void loadRoles();
  }, [accessLoading, canView, loadRoles]);

  function updatePermission(index: number, changes: Partial<Permission>) {
    setForm((c) => ({
      ...c,
      permissions: c.permissions.map((p, i) =>
        i === index ? normalizePermission({ ...p, ...changes }) : p,
      ),
    }));
  }
  function setRowPermissions(index: number, checked: boolean) {
    setForm((c) => ({
      ...c,
      permissions: c.permissions.map((p, i) =>
        i !== index
          ? p
          : permissionKeys.reduce(
              (next, key) => ({
                ...next,
                [key]: keysForModule(p.module).includes(key) ? checked : false,
              }),
              p,
            ),
      ),
    }));
  }
  function setPermissionColumn(key: PermissionKey, checked: boolean) {
    setForm((c) => ({
      ...c,
      permissions: c.permissions.map((p) => ({
        ...p,
        [key]: keysForModule(p.module).includes(key) ? checked : false,
      })),
    }));
  }
  function setAllPermissions(checked: boolean) {
    setForm((c) => ({
      ...c,
      permissions: c.permissions.map((p) =>
        permissionKeys.reduce(
          (next, key) => ({
            ...next,
            [key]: keysForModule(p.module).includes(key) ? checked : false,
          }),
          p,
        ),
      ),
    }));
  }
  function setAllAccess(access: AccessLevel) {
    setForm((c) => ({
      ...c,
      permissions: c.permissions.map((p) => ({ ...p, access })),
    }));
  }
  function openCreateForm() {
    if (!canAdd)
      return setError(
        "Your role does not have Add permission for Role Management.",
      );
    setForm(createEmptyForm());
    setEditingRoleId(null);
    setError("");
    setSuccess("");
    setShowRoleForm(true);
  }
  function closeRoleForm() {
    setForm(createEmptyForm());
    setEditingRoleId(null);
    setShowRoleForm(false);
  }
  function openEditForm(role: Role) {
    if (!canEdit)
      return setError(
        "Your role does not have Edit permission for Role Management.",
      );
    const saved = new Map(role.permissions.map((p) => [p.module, p]));
    setForm({
      name: role.name,
      description: role.description ?? "",
      permissions: modules.map((module) =>
        saved.get(module)
          ? normalizePermission({ ...saved.get(module)! })
          : emptyPermission(module),
      ),
    });
    setEditingRoleId(role.id);
    setShowRoleForm(true);
    setViewingRole(null);
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const creating = editingRoleId === null;
    if (creating && !canAdd) return setError("Add permission is required.");
    if (!creating && !canEdit) return setError("Edit permission is required.");
    const name = form.name.trim();
    if (!name) return setError("Role name is required.");
    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(
        creating ? `${API_URL}/roles` : `${API_URL}/roles/${editingRoleId}`,
        {
          method: creating ? "POST" : "PATCH",
          headers: requestHeaders(true),
          body: JSON.stringify({
            name,
            description: form.description.trim(),
            permissions: form.permissions.map((permission) => {
              const normalized = normalizePermission(permission);
              return {
                module: normalized.module,
                access: normalized.access,
                canView: normalized.canView,
                canAdd: normalized.canAdd,
                canEdit: normalized.canEdit,
                canDeactivate: normalized.canDeactivate,
                canExport: normalized.canExport,
              };
            }),
          }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          (Array.isArray(body?.message)
            ? body.message.join(", ")
            : body?.message) ?? "Unable to save role.",
        );
      setSuccess(
        creating ? "Role created successfully." : "Role updated successfully.",
      );
      closeRoleForm();
      await loadRoles();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to save role.");
    } finally {
      setIsSaving(false);
    }
  }
  function isRoleInUse(roleId: number) {
    return users.some((user) => user.roleId === roleId);
  }

  async function changeRoleStatus(role: Role) {
    if (!canDeactivate) return setError("Deactivate permission is required.");
    if (role.isActive && isRoleInUse(role.id))
      return setError("This role is in use and cannot be deactivated.");
    const isActive = !role.isActive,
      action = isActive ? "activate" : "deactivate";
    if (
      !window.confirm(
        `Are you sure you want to ${action} the "${role.name}" role?`,
      )
    )
      return;
    setUpdatingStatusRoleId(role.id);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${API_URL}/roles/${role.id}/status`, {
        method: "PATCH",
        headers: requestHeaders(true),
        body: JSON.stringify({ isActive }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(body?.message ?? `Unable to ${action} role.`);
      setSuccess(
        `Role ${isActive ? "activated" : "deactivated"} successfully.`,
      );
      setViewingRole(null);
      await loadRoles();
    } catch (value) {
      setError(
        value instanceof Error ? value.message : `Unable to ${action} role.`,
      );
    } finally {
      setUpdatingStatusRoleId(null);
    }
  }
  function exportCsv() {
    if (!canExport) return setError("Export permission is required.");
    const data = [
      ["Role Name", "Description", "Status", "Enabled Modules", "Created"],
      ...roles.map((r) => [
        r.name,
        r.description ?? "",
        r.isActive ? "Active" : "Inactive",
        enabledModuleCount(r.permissions),
        new Date(r.createdAt).toLocaleDateString(),
      ]),
    ];
    const csv = data
      .map((row) =>
        row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "roles.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.max(1, Math.ceil(roles.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginatedRoles = roles.slice(pageStart, pageStart + PAGE_SIZE);
  const enabledViewingPermissions = useMemo(
    () =>
      viewingRole?.permissions.filter(
        (p) => p.module !== "Bulk Asset Import" && isEnabledModule(p),
      ) ?? [],
    [viewingRole],
  );
  const goToPage = (page: number) =>
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));

  if (accessLoading)
    return (
      <main className="session-loading">
        <div className="session-loading-card">
          <span className="session-loading-spinner" />
          <p>Loading Role Management permissions...</p>
        </div>
      </main>
    );
  if (!canView)
    return (
      <Master>
        <section className="content">
          <div className="role-permission-denied">
            <h1>Access denied</h1>
            <p>
              Your assigned role does not have View permission for Role
              Management.
            </p>
            {error && <p>{error}</p>}
          </div>
        </section>
      </Master>
    );

  return (
    <Master>
      <section className="content">
        <div className="page-head">
          <div>
            <div className="eyebrow">Administration</div>
            <h1>Role Management</h1>
            <p>Create roles and configure module access and permissions.</p>
          </div>
          <div className="button-row">
            {canExport && (
              <button className="btn" onClick={exportCsv}>
                Export CSV
              </button>
            )}
            {canAdd && !showRoleForm && (
              <button className="btn primary" onClick={openCreateForm}>
                Create New Role
              </button>
            )}
          </div>
        </div>
        {error && <div className="role-message role-error">{error}</div>}
        {success && <div className="role-message role-success">{success}</div>}

        {viewingRole && (
          <div
            className="role-detail-backdrop"
            onMouseDown={() => setViewingRole(null)}
          >
            <section
              className="role-detail-dialog"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="role-detail-header">
                <div>
                  <div className="eyebrow">Role Detail</div>
                  <h2>{viewingRole.name}</h2>
                  <p>{viewingRole.description || "No description"}</p>
                </div>
                <button
                  className="role-close"
                  onClick={() => setViewingRole(null)}
                >
                  ×
                </button>
              </div>
              <div className="role-detail-summary">
                <div>
                  <span>Status</span>
                  <strong>
                    {viewingRole.isActive ? "Active" : "Inactive"}
                  </strong>
                </div>
                <div>
                  <span>Enabled Modules</span>
                  <strong>{enabledModuleCount(viewingRole.permissions)}</strong>
                </div>
                <div>
                  <span>Created</span>
                  <strong>
                    {new Date(viewingRole.createdAt).toLocaleDateString()}
                  </strong>
                </div>
                <div>
                  <span>Updated</span>
                  <strong>
                    {new Date(viewingRole.updatedAt).toLocaleDateString()}
                  </strong>
                </div>
              </div>
              <div className="role-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Module</th>
                      <th>Access</th>
                      <th>Permissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enabledViewingPermissions.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="empty-table">
                          No module permissions enabled.
                        </td>
                      </tr>
                    ) : (
                      enabledViewingPermissions.map((item) => (
                        <tr key={item.id ?? item.module}>
                          <td>
                            <strong>{item.module}</strong>
                          </td>
                          <td>
                            <span className="role-access-badge">
                              {item.access}
                            </span>
                          </td>
                          <td>
                            <div className="role-detail-permissions">
                              {keysForModule(item.module).map((key) => (
                                <span
                                  className={item[key] ? "enabled" : "disabled"}
                                  key={key}
                                >
                                  {labelForPermission(item.module, key)}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="role-detail-footer">
                <button className="btn" onClick={() => setViewingRole(null)}>
                  Close
                </button>
                {canEdit && (
                  <button
                    className="btn primary"
                    disabled={!viewingRole.isActive}
                    onClick={() => openEditForm(viewingRole)}
                  >
                    Edit Role
                  </button>
                )}
              </div>
            </section>
          </div>
        )}

        {showRoleForm && (
          <div className="panel role-editor">
            <div className="panel-head role-heading">
              <div>
                <h2>
                  {editingRoleId === null ? "Create New Role" : "Edit Role"}
                </h2>
                <p>Configure access scope and actions for each module.</p>
              </div>
              <button className="role-close" onClick={closeRoleForm}>
                ×
              </button>
            </div>
            <div className="panel-body">
              <form onSubmit={handleSubmit}>
                <div className="role-field">
                  <label htmlFor="role-name">Role Name</label>
                  <input
                    id="role-name"
                    value={form.name}
                    maxLength={100}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, name: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="role-field">
                  <label htmlFor="role-description">Description</label>
                  <textarea
                    id="role-description"
                    value={form.description}
                    maxLength={500}
                    rows={4}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, description: e.target.value }))
                    }
                  />
                  <small>{form.description.length}/500</small>
                </div>
                <div className="role-quick-grid">
                  <div className="role-quick-box">
                    <strong>Permission Quick Actions</strong>
                    <div>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => setAllPermissions(true)}
                      >
                        Select All
                      </button>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => setAllPermissions(false)}
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  <div className="role-quick-box">
                    <strong>Access Quick Actions</strong>
                    <div>
                      {accessOptions.map((a) => (
                        <button
                          className="btn"
                          type="button"
                          key={a}
                          onClick={() => setAllAccess(a)}
                        >
                          Set All: {a}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="role-column-actions">
                  <strong>Enable for all applicable modules</strong>
                  {permissionKeys.map((key) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={allApplicableModulesChecked(
                          form.permissions,
                          key,
                        )}
                        onChange={(e) =>
                          setPermissionColumn(key, e.target.checked)
                        }
                      />
                      {permissionLabels[key]}
                    </label>
                  ))}
                </div>
                <div className="role-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Module</th>
                        <th>Access</th>
                        <th>Permissions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.permissions.map((item, index) => (
                        <tr key={item.module}>
                          <td className="module-cell">
                            <strong>{item.module}</strong>
                            {moduleNote(item.module) && (
                              <small className="import-note">
                                {moduleNote(item.module)}
                              </small>
                            )}
                          </td>
                          <td>
                            <select
                              value={item.access}
                              onChange={(e) =>
                                updatePermission(index, {
                                  access: e.target.value as AccessLevel,
                                })
                              }
                            >
                              {accessOptions.map((a) => (
                                <option key={a}>{a}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <div className="row-permissions">
                              <label>
                                <span>All</span>
                                <input
                                  type="checkbox"
                                  checked={hasAllPermissions(item)}
                                  onChange={(e) =>
                                    setRowPermissions(index, e.target.checked)
                                  }
                                />
                              </label>
                              {keysForModule(item.module).map((key) => (
                                <label key={key}>
                                  <span>
                                    {labelForPermission(item.module, key)}
                                  </span>
                                  <input
                                    type="checkbox"
                                    checked={item[key]}
                                    onChange={(e) =>
                                      updatePermission(index, {
                                        [key]: e.target.checked,
                                      })
                                    }
                                  />
                                </label>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="form-footer">
                  <button
                    className="btn"
                    type="button"
                    onClick={closeRoleForm}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn primary"
                    type="submit"
                    disabled={isSaving}
                  >
                    {isSaving
                      ? "Saving..."
                      : editingRoleId === null
                        ? "Create Role"
                        : "Update Role"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="panel">
          <div className="panel-head role-heading">
            <div>
              <h2>Roles</h2>
              <p>Enabled module counts exclude unused permission rows.</p>
            </div>
            <span className="count">{roles.length} roles</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Role Name</th>
                  <th>Description</th>
                  <th>Enabled Modules</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="empty-table">
                      Loading roles...
                    </td>
                  </tr>
                ) : roles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-table">
                      No roles created.
                    </td>
                  </tr>
                ) : (
                  paginatedRoles.map((role) => (
                    <tr
                      key={role.id}
                      className={role.isActive ? "" : "inactive-row"}
                    >
                      <td>
                        <strong>{role.name}</strong>
                      </td>
                      <td>{role.description || "No description"}</td>
                      <td>{enabledModuleCount(role.permissions)}</td>
                      <td>
                        <span
                          className={
                            role.isActive
                              ? "role-status active"
                              : "role-status inactive"
                          }
                        >
                          {role.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>{new Date(role.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="mini-btn view"
                            onClick={() => setViewingRole(role)}
                          >
                            View
                          </button>
                          {canEdit && (
                            <button
                              className="mini-btn"
                              disabled={!role.isActive}
                              onClick={() => openEditForm(role)}
                            >
                              Edit
                            </button>
                          )}
                          {canDeactivate &&
                            (role.isActive && isRoleInUse(role.id) ? (
                              <span
                                className="role-in-use"
                                title="This role is assigned to one or more users"
                              >
                                In Use
                              </span>
                            ) : (
                              <button
                                className={
                                  role.isActive
                                    ? "mini-btn deactivate"
                                    : "mini-btn activate"
                                }
                                disabled={updatingStatusRoleId === role.id}
                                onClick={() => void changeRoleStatus(role)}
                              >
                                {updatingStatusRoleId === role.id
                                  ? "Updating..."
                                  : role.isActive
                                    ? "Deactivate"
                                    : "Activate"}
                              </button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {roles.length > PAGE_SIZE && (
            <div className="role-pagination">
              <p>
                Showing {pageStart + 1} to{" "}
                {Math.min(pageStart + PAGE_SIZE, roles.length)} of{" "}
                {roles.length} roles
              </p>
              <div className="role-pagination-controls">
                <button
                  className="btn"
                  disabled={currentPage === 1}
                  onClick={() => goToPage(currentPage - 1)}
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      className={
                        page === currentPage
                          ? "role-page-number active"
                          : "role-page-number"
                      }
                      key={page}
                      onClick={() => goToPage(page)}
                    >
                      {page}
                    </button>
                  ),
                )}
                <button
                  className="btn"
                  disabled={currentPage === totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </Master>
  );
}
