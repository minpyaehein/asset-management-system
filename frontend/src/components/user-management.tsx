"use client";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Master from "./master";

type UserStatus = "Active" | "Inactive";
type AccessLevel = "Own Only" | "Assigned" | "All";
type Permission = {
  module: string;
  access: AccessLevel;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDeactivate: boolean;
  canExport: boolean;
};
type RoleOption = { id: number; name: string; isActive?: boolean };
type UserRecord = {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  status: UserStatus;
  roleId: number;
  role: RoleOption;
  createdAt: string;
  updatedAt: string;
};
type UserForm = {
  username: string;
  fullName: string;
  email: string;
  password: string;
  roleId: string;
  status: UserStatus;
};
type CurrentUser = { id: number; roleId: number; status: UserStatus };
type AssignedRole = {
  id: number;
  isActive: boolean;
  permissions: Permission[];
};
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const PAGE_SIZE = 10;
const emptyForm = (): UserForm => ({
  username: "",
  fullName: "",
  email: "",
  password: "",
  roleId: "",
  status: "Active",
});
const sessionId = () => {
  const n = Number(
    sessionStorage.getItem("assetManagementUserId") ??
      sessionStorage.getItem("stockwiseUserId") ??
      "0",
  );
  return Number.isFinite(n) && n > 0 ? n : null;
};

export default function UserManagement() {
  const [currentUserId, setCurrentUserId] = useState<number | null>(null),
    [permission, setPermission] = useState<Permission | null>(null),
    [users, setUsers] = useState<UserRecord[]>([]),
    [roles, setRoles] = useState<RoleOption[]>([]),
    [form, setForm] = useState<UserForm>(emptyForm),
    [editingId, setEditingId] = useState<number | null>(null),
    [viewingUser, setViewingUser] = useState<UserRecord | null>(null),
    [formOpen, setFormOpen] = useState(false),
    [accessLoading, setAccessLoading] = useState(true),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState(1),
    [saving, setSaving] = useState(false),
    [busyId, setBusyId] = useState<number | null>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [search, setSearch] = useState("");
  const canView = permission?.canView === true,
    canAdd = permission?.canAdd === true,
    canEdit = permission?.canEdit === true,
    canDeactivate = permission?.canDeactivate === true,
    canExport = permission?.canExport === true;
  const headers = useCallback(
    (json = false) => ({
      Accept: "application/json",
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(currentUserId ? { "X-User-Id": String(currentUserId) } : {}),
    }),
    [currentUserId],
  );
  const loadAccess = useCallback(async () => {
    setAccessLoading(true);
    const id = sessionId();
    if (!id) {
      setError("Your login session is incomplete.");
      setAccessLoading(false);
      return;
    }
    try {
      const ur = await fetch(`${API_URL}/users/${id}`, { cache: "no-store" }),
        u = await ur.json();
      if (!ur.ok) throw new Error(u?.message);
      const current = u as CurrentUser;
      if (current.status !== "Active")
        throw new Error("Your account is inactive.");
      const rr = await fetch(`${API_URL}/roles/${current.roleId}`, {
          cache: "no-store",
        }),
        r = await rr.json();
      if (!rr.ok) throw new Error(r?.message);
      const role = r as AssignedRole;
      if (!role.isActive) throw new Error("Your assigned role is inactive.");
      setCurrentUserId(id);
      setPermission(
        role.permissions.find((x) => x.module === "User Management") ?? null,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load permission.");
    } finally {
      setAccessLoading(false);
    }
  }, []);
  const load = useCallback(async () => {
    if (!currentUserId || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [ur, rr] = await Promise.all([
        fetch(`${API_URL}/users`, { headers: headers(), cache: "no-store" }),
        fetch(`${API_URL}/roles`, { headers: headers(), cache: "no-store" }),
      ]);
      const [u, r] = await Promise.all([ur.json(), rr.json()]);
      if (!ur.ok) throw new Error(u?.message);
      if (!rr.ok) throw new Error(r?.message);
      setUsers(Array.isArray(u) ? u : []);
      setRoles(
        Array.isArray(r)
          ? r.filter((x: RoleOption) => x.isActive !== false)
          : [],
      );
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, [canView, currentUserId, headers]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAccess();
  }, [loadAccess]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!accessLoading && canView) void load();
  }, [accessLoading, canView, load]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return !q
      ? users
      : users.filter((u) =>
          [u.username, u.fullName, u.email, u.role?.name, u.status].some((v) =>
            String(v ?? "")
              .toLowerCase()
              .includes(q),
          ),
        );
  }, [search, users]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setPage(1), [search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
    safePage = Math.min(page, totalPages),
    start = (safePage - 1) * PAGE_SIZE,
    paged = filtered.slice(start, start + PAGE_SIZE);
  const openCreate = () => {
    if (!canAdd) return setError("Add permission is required.");
    setForm(emptyForm());
    setEditingId(null);
    setFormOpen(true);
    setError("");
    setSuccess("");
  };
  const openEdit = (u: UserRecord) => {
    if (!canEdit) return setError("Edit permission is required.");
    setForm({
      username: u.username,
      fullName: u.fullName,
      email: u.email ?? "",
      password: "",
      roleId: String(u.roleId),
      status: u.status,
    });
    setEditingId(u.id);
    setViewingUser(null);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const close = () => {
    setForm(emptyForm());
    setEditingId(null);
    setFormOpen(false);
  };
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const create = editingId === null;
    if (!form.username.trim() || !form.fullName.trim() || !form.roleId)
      return setError("Username, full name, and role are required.");
    if (create && form.password.length < 8)
      return setError("Password must contain at least 8 characters.");
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        username: form.username.trim(),
        fullName: form.fullName.trim(),
        email: form.email.trim() || null,
        roleId: Number(form.roleId),
        status: form.status,
      };
      if (create) payload.password = form.password;
      const r = await fetch(
          create ? `${API_URL}/users` : `${API_URL}/users/${editingId}`,
          {
            method: create ? "POST" : "PATCH",
            headers: headers(true),
            body: JSON.stringify(payload),
          },
        ),
        b = await r.json().catch(() => null);
      if (!r.ok)
        throw new Error(
          Array.isArray(b?.message) ? b.message.join(", ") : b?.message,
        );
      setSuccess(
        create ? "User created successfully." : "User updated successfully.",
      );
      close();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save user.");
    } finally {
      setSaving(false);
    }
  }
  async function action(u: UserRecord, kind: "status" | "reset") {
    if (kind === "status" && u.id === currentUserId && u.status === "Active")
      return setError("You cannot deactivate your own account.");
    if (
      !window.confirm(
        kind === "reset"
          ? `Reset password for ${u.username} to Default@12345?`
          : `${u.status === "Active" ? "Deactivate" : "Activate"} ${u.username}?`,
      )
    )
      return;
    setBusyId(u.id);
    try {
      const r = await fetch(
          kind === "reset"
            ? `${API_URL}/users/${u.id}/reset-password`
            : `${API_URL}/users/${u.id}/status`,
          {
            method: "PATCH",
            headers: headers(true),
            ...(kind === "status"
              ? {
                  body: JSON.stringify({
                    status: u.status === "Active" ? "Inactive" : "Active",
                  }),
                }
              : {}),
          },
        ),
        b = await r.json().catch(() => null);
      if (!r.ok) throw new Error(b?.message);
      setSuccess(
        kind === "reset"
          ? "Password reset. Temporary password: Default@12345"
          : "User status updated.",
      );
      setViewingUser(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }
  function exportCsv() {
    const data = [
      ["Username", "Full Name", "Email", "Role", "Status", "Created"],
      ...filtered.map((u) => [
        u.username,
        u.fullName,
        u.email ?? "",
        u.role?.name ?? "",
        u.status,
        new Date(u.createdAt).toLocaleDateString(),
      ]),
    ];
    const csv = data
        .map((r) =>
          r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","),
        )
        .join("\n"),
      url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      a = document.createElement("a");
    a.href = url;
    a.download = "users.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  if (accessLoading)
    return (
      <main className="user-loading">
        <div>
          <span className="user-spinner" />
          <p>Loading permissions...</p>
        </div>
      </main>
    );
  if (!canView)
    return (
      <Master>
        <section className="content">
          <div className="user-denied">
            <h1>Access denied</h1>
            <p>
              Your assigned role does not have View permission for User
              Management.
            </p>
          </div>
        </section>
      </Master>
    );
  return (
    <Master>
      <section className="content user-page-wrap">
        <header className="user-hero">
          <div>
            <div className="eyebrow">Administration</div>
            <h1>User Management</h1>
            <p>Create accounts, assign roles, and control account access.</p>
          </div>
          <div>
            {canExport && (
              <button className="btn" onClick={exportCsv}>
                Export CSV
              </button>
            )}
            {canAdd && !formOpen && (
              <button className="btn primary" onClick={openCreate}>
                Create New User
              </button>
            )}
          </div>
        </header>
        {error && <div className="user-message user-error">{error}</div>}
        {success && <div className="user-message user-success">{success}</div>}
        {viewingUser && (
          <div
            className="user-modal-bg"
            onMouseDown={() => setViewingUser(null)}
          >
            <section
              className="user-modal"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <header>
                <div>
                  <div className="eyebrow">User Detail</div>
                  <h2>{viewingUser.fullName}</h2>
                  <p>@{viewingUser.username}</p>
                </div>
                <button onClick={() => setViewingUser(null)}>×</button>
              </header>
              <div className="user-detail-grid">
                {[
                  ["Username", viewingUser.username],
                  ["Full Name", viewingUser.fullName],
                  ["Email", viewingUser.email || "Not provided"],
                  ["Role", viewingUser.role?.name || "Unassigned"],
                  ["Status", viewingUser.status],
                  ["Created", new Date(viewingUser.createdAt).toLocaleString()],
                  ["Updated", new Date(viewingUser.updatedAt).toLocaleString()],
                ].map(([k, v]) => (
                  <div key={k}>
                    <span>{k}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
              <footer>
                <button className="btn" onClick={() => setViewingUser(null)}>
                  Close
                </button>
                {canEdit && (
                  <button
                    className="btn primary"
                    disabled={viewingUser.status !== "Active"}
                    onClick={() => openEdit(viewingUser)}
                  >
                    Edit User
                  </button>
                )}
              </footer>
            </section>
          </div>
        )}
        {formOpen && (
          <section className="user-card user-editor">
            <header>
              <div>
                <h2>{editingId === null ? "Create New User" : "Edit User"}</h2>
                <p>Enter account information and choose an active role.</p>
              </div>
              <button onClick={close}>×</button>
            </header>
            <form onSubmit={save}>
              <div className="user-form-grid">
                <label>
                  Username
                  <input
                    value={form.username}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, username: e.target.value }))
                    }
                    required
                  />
                </label>
                <label>
                  Full Name
                  <input
                    value={form.fullName}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, fullName: e.target.value }))
                    }
                    required
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, email: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Role
                  <select
                    value={form.roleId}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, roleId: e.target.value }))
                    }
                    required
                  >
                    <option value="">Select role</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Status
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((c) => ({
                        ...c,
                        status: e.target.value as UserStatus,
                      }))
                    }
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </label>
                {editingId === null && (
                  <label>
                    Password
                    <input
                      type="password"
                      minLength={8}
                      value={form.password}
                      onChange={(e) =>
                        setForm((c) => ({ ...c, password: e.target.value }))
                      }
                      required
                    />
                  </label>
                )}
              </div>
              <footer>
                {editingId !== null && canEdit && (
                  <button
                    className="btn reset"
                    type="button"
                    disabled={busyId === editingId}
                    onClick={() => {
                      const u = users.find((x) => x.id === editingId);
                      if (u) void action(u, "reset");
                    }}
                  >
                    Reset Password
                  </button>
                )}
                <div>
                  <button className="btn" type="button" onClick={close}>
                    Cancel
                  </button>
                  <button className="btn primary" disabled={saving}>
                    {saving
                      ? "Saving..."
                      : editingId === null
                        ? "Create User"
                        : "Update User"}
                  </button>
                </div>
              </footer>
            </form>
          </section>
        )}
        <section className="user-card">
          <div className="user-toolbar">
            <div>
              <h2>Users</h2>
              <p>
                {filtered.length} account{filtered.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="user-search">
              <span>⌕</span>
              <input
                placeholder="Search users"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="empty-table">
                      Loading users...
                    </td>
                  </tr>
                ) : !paged.length ? (
                  <tr>
                    <td colSpan={6} className="empty-table">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  paged.map((u) => (
                    <tr
                      key={u.id}
                      className={u.status === "Inactive" ? "inactive" : ""}
                    >
                      <td>
                        <div className="user-identity">
                          <span>
                            {u.fullName
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((x) => x[0])
                              .join("")
                              .toUpperCase()}
                          </span>
                          <div>
                            <strong>{u.fullName}</strong>
                            <small>@{u.username}</small>
                          </div>
                        </div>
                      </td>
                      <td>{u.email || "Not provided"}</td>
                      <td>
                        <span className="role-chip">
                          {u.role?.name || "Unassigned"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-chip ${u.status.toLowerCase()}`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div className="user-actions">
                          <button onClick={() => setViewingUser(u)}>
                            View
                          </button>
                          {canEdit && (
                            <button
                              disabled={u.status !== "Active"}
                              onClick={() => openEdit(u)}
                            >
                              Edit
                            </button>
                          )}
                          {canDeactivate &&
                            (u.id === currentUserId && u.status === "Active" ? (
                              <span
                                className="current-user-badge"
                                title="This is your signed-in account"
                              >
                                <span className="current-user-dot" />
                                Signed in
                              </span>
                            ) : (
                              <button
                                className={
                                  u.status === "Active" ? "danger" : "success"
                                }
                                disabled={busyId === u.id}
                                onClick={() => void action(u, "status")}
                              >
                                {busyId === u.id
                                  ? "Updating..."
                                  : u.status === "Active"
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
          {filtered.length > PAGE_SIZE && (
            <footer className="user-pagination">
              <p>
                Showing {start + 1} to{" "}
                {Math.min(start + PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length}
              </p>
              <div>
                <button
                  disabled={safePage === 1}
                  onClick={() => setPage(safePage - 1)}
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (n) => (
                    <button
                      className={n === safePage ? "active" : ""}
                      key={n}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  ),
                )}
                <button
                  disabled={safePage === totalPages}
                  onClick={() => setPage(safePage + 1)}
                >
                  Next
                </button>
              </div>
            </footer>
          )}
        </section>
      </section>
    </Master>
  );
}
