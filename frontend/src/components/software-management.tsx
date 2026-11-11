"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Master from "./master";

type Tab = "licenses" | "installations" | "warranty";
type Permission = {
  module: string;
  access: "Own Only" | "Assigned" | "All";
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDeactivate: boolean;
  canExport: boolean;
};
type Row = Record<string, string | number | boolean | null> & {
  id: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
type UserResponse = {
  id: number;
  roleId: number;
  status: "Active" | "Inactive";
};
type RoleResponse = {
  id: number;
  name: string;
  isActive: boolean;
  permissions: Permission[];
};
type Field = {
  key: string;
  label: string;
  type?: "text" | "date" | "number" | "select";
  optional?: boolean;
  options?: string[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const PAGE_SIZE = 10;
const config: Record<
  Tab,
  { title: string; intro: string; endpoint: string; fields: Field[] }
> = {
  licenses: {
    title: "Software Licenses",
    intro: "Manage license keys, purchased seats, and expiry dates.",
    endpoint: "licenses",
    fields: [
      { key: "product", label: "Product" },
      { key: "vendor", label: "Vendor" },
      { key: "licenseKey", label: "License Key" },
      { key: "seats", label: "Purchased Seats", type: "number" },
      { key: "expiry", label: "Expiry Date", type: "date" },
      { key: "notes", label: "Notes", optional: true },
    ],
  },
  installations: {
    title: "Software Installations",
    intro: "Register software against an asset and a valid license.",
    endpoint: "installations",
    fields: [
      { key: "assetTag", label: "Asset Tag" },
      { key: "license", label: "License" },
      { key: "installedDate", label: "Installed Date", type: "date" },
      { key: "installedBy", label: "Installed By", optional: true },
      { key: "notes", label: "Notes", optional: true },
    ],
  },
  warranty: {
    title: "Warranty & Expiry",
    intro: "Track asset warranty and agreement expiry status.",
    endpoint: "warranties",
    fields: [
      { key: "assetTag", label: "Asset Tag" },
      { key: "product", label: "Product / Agreement" },
      { key: "vendor", label: "Vendor" },
      { key: "reference", label: "Reference" },
      { key: "expiry", label: "Warranty / Expiry Date", type: "date" },
      { key: "owner", label: "Owner", optional: true },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["Active", "Expiring Soon", "Expired", "Inactive"],
      },
    ],
  },
};
function sessionUserId() {
  const value = Number(
    sessionStorage.getItem("assetManagementUserId") ??
      sessionStorage.getItem("stockwiseUserId") ??
      "0",
  );
  return Number.isFinite(value) && value > 0 ? value : null;
}

export default function SoftwareManagement() {
  const [userId, setUserId] = useState<number | null>(null);
  const [permission, setPermission] = useState<Permission | null>(null);
  const [tab, setTab] = useState<Tab>("licenses");
  const [rows, setRows] = useState<Record<Tab, Row[]>>({
    licenses: [],
    installations: [],
    warranty: [],
  });
  const [form, setForm] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingRow, setViewingRow] = useState<Row | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [accessLoading, setAccessLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const current = config[tab];
  const canView = permission?.canView === true,
    canAdd = permission?.canAdd === true,
    canEdit = permission?.canEdit === true,
    canDeactivate = permission?.canDeactivate === true,
    canExport = permission?.canExport === true;
  const headers = useCallback(
    (json = false): Record<string, string> => ({
      Accept: "application/json",
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(userId ? { "X-User-Id": String(userId) } : {}),
    }),
    [userId],
  );

  const loadAccess = useCallback(async () => {
    setAccessLoading(true);
    setError("");
    const id = sessionUserId();
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
      const user = userBody as UserResponse;
      if (user.status !== "Active")
        throw new Error("Your user account is inactive.");
      const roleResponse = await fetch(`${API_URL}/roles/${user.roleId}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const roleBody = await roleResponse.json().catch(() => null);
      if (!roleResponse.ok)
        throw new Error(roleBody?.message ?? "Unable to load assigned role.");
      const role = roleBody as RoleResponse;
      if (!role.isActive) throw new Error("Your assigned role is inactive.");
      setUserId(id);
      setPermission(
        role.permissions.find(
          (item) => item.module === "Software & Warranty",
        ) ?? null,
      );
    } catch (value) {
      setPermission(null);
      setError(
        value instanceof Error
          ? value.message
          : "Unable to load Software & Warranty permission.",
      );
    } finally {
      setAccessLoading(false);
    }
  }, []);

  const loadRows = useCallback(async () => {
    if (!userId || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${API_URL}/software-management/${current.endpoint}`,
        { headers: headers(), cache: "no-store" },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(body?.message ?? `Unable to load ${current.title}.`);
      const loaded = Array.isArray(body) ? (body as Row[]) : [];
      setRows((all) => ({ ...all, [tab]: loaded }));
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : `Unable to load ${current.title}.`,
      );
    } finally {
      setLoading(false);
    }
  }, [canView, current.endpoint, current.title, headers, tab, userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAccess();
  }, [loadAccess]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!accessLoading && canView) void loadRows();
  }, [accessLoading, canView, loadRows]);
  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows[tab].filter((row) => {
      const values = Object.values(row).map(String);
      return (
        (!term || values.join(" ").toLowerCase().includes(term)) &&
        (!filter || values.includes(filter))
      );
    });
  }, [filter, rows, search, tab]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setCurrentPage(1), [search, filter, tab]);
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageRows = visibleRows.slice(pageStart, pageStart + PAGE_SIZE);
  const filterOptions = [
    ...new Set(
      rows[tab]
        .flatMap((row) => Object.values(row).map(String))
        .filter(Boolean),
    ),
  ].slice(0, 30);

  function resetForm() {
    setForm({});
    setEditingId(null);
  }
  function changeTab(next: Tab) {
    setTab(next);
    setFilter("");
    setSearch("");
    resetForm();
    setViewingRow(null);
  }
  function editRow(row: Row) {
    if (!canEdit) return setError("Edit permission is required.");
    const next: Record<string, string> = {};
    current.fields.forEach(({ key }) => {
      next[key] = row[key] == null ? "" : String(row[key]);
    });
    setForm(next);
    setEditingId(row.id);
    setViewingRow(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const creating = editingId === null;
    if (creating && !canAdd) return setError("Add permission is required.");
    if (!creating && !canEdit) return setError("Edit permission is required.");
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload: Record<string, string | number | null> = {};
      current.fields.forEach((field) => {
        const value = form[field.key]?.trim() ?? "";
        payload[field.key] =
          field.type === "number"
            ? value === ""
              ? null
              : Number.parseInt(value, 10)
            : value || null;
      });
      const response = await fetch(
        editingId === null
          ? `${API_URL}/software-management/${current.endpoint}`
          : `${API_URL}/software-management/${current.endpoint}/${editingId}`,
        {
          method: editingId === null ? "POST" : "PATCH",
          headers: headers(true),
          body: JSON.stringify(payload),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const problem = Array.isArray(body?.message)
          ? body.message.join(", ")
          : body?.message;
        throw new Error(problem || "Unable to save record.");
      }
      setSuccess(
        creating
          ? "Record created successfully."
          : "Record updated successfully.",
      );
      resetForm();
      await loadRows();
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Unable to save record.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(row: Row) {
    if (!canDeactivate) return setError("Deactivate permission is required.");
    const next = !row.isActive;
    if (
      !window.confirm(
        `Are you sure you want to ${next ? "activate" : "deactivate"} this record?`,
      )
    )
      return;
    setUpdatingId(row.id);
    try {
      const response = await fetch(
        `${API_URL}/software-management/${current.endpoint}/${row.id}/status`,
        {
          method: "PATCH",
          headers: headers(true),
          body: JSON.stringify({ isActive: next }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(body?.message ?? "Unable to update record status.");
      setSuccess(
        next
          ? "Record activated successfully."
          : "Record deactivated successfully.",
      );
      await loadRows();
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Unable to update record status.",
      );
    } finally {
      setUpdatingId(null);
    }
  }
  function exportCsv() {
    const data = [
      current.fields.map((field) => field.label),
      ...visibleRows.map((row) =>
        current.fields.map((field) => String(row[field.key] ?? "")),
      ),
    ];
    const csv = data
      .map((line) =>
        line.map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `software-${tab}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (accessLoading)
    return (
      <main className="session-loading">
        <div className="session-loading-card">
          <span className="session-loading-spinner" />
          <p>Loading Software &amp; Warranty permissions...</p>
        </div>
      </main>
    );
  if (!canView)
    return (
      <Master>
        <section className="content">
          <div className="software-permission-denied">
            <h1>Access denied</h1>
            <p>
              Your assigned role does not have View permission for Software
              &amp; Warranty.
            </p>
            {error && <p>{error}</p>}
          </div>
        </section>
      </Master>
    );

  return (
    <Master>
      <section className="content software-page">
        <header className="software-hero">
          <div>
            <div className="eyebrow">Software workspace</div>
            <h1>Software &amp; Warranty</h1>
            <p>
              Manage licenses, installations, warranty records, and expiry
              dates.
            </p>
          </div>
          {canExport && (
            <button className="btn" onClick={exportCsv}>
              Export Current Tab
            </button>
          )}
        </header>
        {error && <div className="software-message error">{error}</div>}
        {success && <div className="software-message success">{success}</div>}
        <div className="software-stats">
          <article>
            <span>Current Records</span>
            <strong>{rows[tab].length}</strong>
          </article>
          <article>
            <span>Active</span>
            <strong>{rows[tab].filter((row) => row.isActive).length}</strong>
          </article>
          <article>
            <span>Inactive</span>
            <strong>{rows[tab].filter((row) => !row.isActive).length}</strong>
          </article>
          <article>
            <span>Workspace</span>
            <strong>
              {tab === "licenses"
                ? "Licenses"
                : tab === "installations"
                  ? "Installs"
                  : "Warranty"}
            </strong>
          </article>
        </div>
        {viewingRow && (
          <div
            className="software-detail-backdrop"
            onMouseDown={() => setViewingRow(null)}
          >
            <section
              className="software-detail-dialog"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header>
                <div>
                  <div className="eyebrow">{current.title}</div>
                  <h2>
                    {String(
                      viewingRow.product ??
                        viewingRow.license ??
                        viewingRow.assetTag ??
                        "Record details",
                    )}
                  </h2>
                  <p>
                    {viewingRow.isActive ? "Active record" : "Inactive record"}
                  </p>
                </div>
                <button onClick={() => setViewingRow(null)}>×</button>
              </header>
              <div className="software-detail-grid">
                {current.fields.map((field) => (
                  <div
                    className={
                      field.key === "notes" || field.key === "licenseKey"
                        ? "wide"
                        : ""
                    }
                    key={field.key}
                  >
                    <span>{field.label}</span>
                    <strong>
                      {String(viewingRow[field.key] ?? "").trim() ||
                        "Not provided"}
                    </strong>
                  </div>
                ))}
              </div>
              <footer>
                <button className="btn" onClick={() => setViewingRow(null)}>
                  Close
                </button>
                {canEdit && (
                  <button
                    className="btn primary"
                    disabled={!viewingRow.isActive}
                    onClick={() => editRow(viewingRow)}
                  >
                    Edit Record
                  </button>
                )}
              </footer>
            </section>
          </div>
        )}
        <div className="tab-bar">
          {(Object.keys(config) as Tab[]).map((key) => (
            <button
              className={`tab-button${tab === key ? " active" : ""}`}
              key={key}
              onClick={() => changeTab(key)}
            >
              {config[key].title}
            </button>
          ))}
        </div>
        {(canAdd || (canEdit && editingId !== null)) && (
          <section className="panel">
            <div className="panel-head">
              <h2>
                {editingId === null
                  ? `Add New ${current.title}`
                  : `Edit ${current.title}`}
              </h2>
              <p>{current.intro}</p>
            </div>
            <div className="panel-body">
              <form onSubmit={save}>
                <div className="software-form-grid">
                  {current.fields.map((field) => (
                    <label key={field.key}>
                      {field.label}
                      {field.type === "select" ? (
                        <select
                          value={form[field.key] ?? ""}
                          onChange={(event) =>
                            setForm((old) => ({
                              ...old,
                              [field.key]: event.target.value,
                            }))
                          }
                          required={!field.optional}
                        >
                          <option value="">
                            Select {field.label.toLowerCase()}
                          </option>
                          {field.options?.map((value) => (
                            <option key={value}>{value}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type ?? "text"}
                          min={field.type === "number" ? 0 : undefined}
                          value={form[field.key] ?? ""}
                          onChange={(event) =>
                            setForm((old) => ({
                              ...old,
                              [field.key]: event.target.value,
                            }))
                          }
                          required={!field.optional}
                        />
                      )}
                    </label>
                  ))}
                </div>
                <div className="form-footer">
                  <button className="btn" type="button" onClick={resetForm}>
                    Clear
                  </button>
                  <button className="btn primary" disabled={saving}>
                    {saving
                      ? "Saving..."
                      : editingId === null
                        ? "Save Record"
                        : "Update Record"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}
        <section className="panel">
          <div className="software-toolbar">
            <div>
              <h2>{current.title} Records</h2>
              <p>{visibleRows.length} matching records</p>
            </div>
            <div>
              <input
                placeholder="Search current tab"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="">All values</option>
                {filterOptions.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {current.fields.map((field) => (
                    <th key={field.key}>{field.label}</th>
                  ))}
                  <th>Record</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={current.fields.length + 2}
                      className="empty-table"
                    >
                      Loading records...
                    </td>
                  </tr>
                ) : !pageRows.length ? (
                  <tr>
                    <td
                      colSpan={current.fields.length + 2}
                      className="empty-table"
                    >
                      No records found.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => (
                    <tr
                      key={row.id}
                      className={row.isActive ? "" : "software-inactive-row"}
                    >
                      {current.fields.map((field) => (
                        <td key={field.key}>
                          {String(row[field.key] ?? "") || "—"}
                        </td>
                      ))}
                      <td>
                        <span
                          className={
                            row.isActive
                              ? "software-status active"
                              : "software-status inactive"
                          }
                        >
                          {row.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="mini-btn view"
                            onClick={() => setViewingRow(row)}
                          >
                            View
                          </button>
                          {canEdit && (
                            <button
                              className="mini-btn"
                              disabled={!row.isActive}
                              onClick={() => editRow(row)}
                            >
                              Edit
                            </button>
                          )}
                          {canDeactivate && (
                            <button
                              className={
                                row.isActive
                                  ? "mini-btn deactivate"
                                  : "mini-btn activate"
                              }
                              disabled={updatingId === row.id}
                              onClick={() => void changeStatus(row)}
                            >
                              {updatingId === row.id
                                ? "Updating..."
                                : row.isActive
                                  ? "Deactivate"
                                  : "Activate"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {visibleRows.length > PAGE_SIZE && (
            <footer className="software-pagination">
              <p>
                Showing {pageStart + 1} to{" "}
                {Math.min(pageStart + PAGE_SIZE, visibleRows.length)} of{" "}
                {visibleRows.length}
              </p>
              <div>
                <button
                  className="btn"
                  disabled={safePage === 1}
                  onClick={() => setCurrentPage(safePage - 1)}
                >
                  Previous
                </button>
                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1,
                ).map((page) => (
                  <button
                    className={
                      safePage === page
                        ? "software-page-number active"
                        : "software-page-number"
                    }
                    key={page}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  className="btn"
                  disabled={safePage === totalPages}
                  onClick={() => setCurrentPage(safePage + 1)}
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
