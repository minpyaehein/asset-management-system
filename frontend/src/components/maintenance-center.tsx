"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Master from "./master";

type Tab = "planner" | "history";
type Permission = {
  module: string;
  access: "Own Only" | "Assigned" | "All";
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDeactivate: boolean;
  canExport: boolean;
};
type Role = {
  id: number;
  name: string;
  isActive: boolean;
  permissions: Permission[];
};
type User = { id: number; roleId: number; status: "Active" | "Inactive" };
type Asset = { id: number; assetTag: string };
type Row = {
  id: number;
  recordCode: string;
  tab: Tab;
  assetTag: string;
  type: string;
  date: string;
  technician: string | null;
  status: string | null;
  cost: string | null;
  detail: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
type FormState = {
  recordCode: string;
  assetTag: string;
  type: string;
  date: string;
  technician: string;
  status: string;
  cost: string;
  detail: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const PAGE_SIZE = 10;

const makeForm = (tab: Tab): FormState => ({
  recordCode: "",
  assetTag: "",
  type: tab === "planner" ? "Preventive" : "Repair",
  date: "",
  technician: "",
  status: tab === "planner" ? "Scheduled" : "",
  cost: "",
  detail: "",
});

function sessionId() {
  const id = Number(
    sessionStorage.getItem("assetManagementUserId") ??
      sessionStorage.getItem("stockwiseUserId") ??
      0,
  );
  return Number.isFinite(id) && id > 0 ? id : null;
}

export default function MaintenanceCenter() {
  const [userId, setUserId] = useState<number | null>(null);
  const [permission, setPermission] = useState<Permission | null>(null);
  const [tab, setTab] = useState<Tab>("planner");
  const [rows, setRows] = useState<Row[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [form, setForm] = useState<FormState>(() => makeForm("planner"));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canView = permission?.canView === true;
  const canAdd = permission?.canAdd === true;
  const canEdit = permission?.canEdit === true;
  const canDeactivate = permission?.canDeactivate === true;
  const canExport = permission?.canExport === true;

  const loadAccess = useCallback(async () => {
    setAccessLoading(true);
    const id = sessionId();

    if (!id) {
      setError("Your login session is incomplete.");
      setAccessLoading(false);
      return;
    }

    try {
      const userResponse = await fetch(`${API_URL}/users/${id}`, {
        cache: "no-store",
      });
      const userBody = await userResponse.json().catch(() => null);
      if (!userResponse.ok) {
        throw new Error(userBody?.message ?? "Unable to load active user.");
      }

      const user = userBody as User;
      if (user.status !== "Active") {
        throw new Error("Your user account is inactive.");
      }

      const roleResponse = await fetch(`${API_URL}/roles/${user.roleId}`, {
        cache: "no-store",
      });
      const roleBody = await roleResponse.json().catch(() => null);
      if (!roleResponse.ok) {
        throw new Error(roleBody?.message ?? "Unable to load assigned role.");
      }

      const role = roleBody as Role;
      if (!role.isActive) {
        throw new Error("Your assigned role is inactive.");
      }

      setUserId(id);
      setPermission(
        role.permissions.find((item) => item.module === "Maintenance Center") ??
          null,
      );
    } catch (value) {
      setPermission(null);
      setError(
        value instanceof Error ? value.message : "Unable to load permissions.",
      );
    } finally {
      setAccessLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!userId || !canView) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const headers = {
        Accept: "application/json",
        "X-User-Id": String(userId),
      };
      const [recordsResponse, assetsResponse] = await Promise.all([
        fetch(`${API_URL}/maintenance-center?tab=${tab}`, {
          headers,
          cache: "no-store",
        }),
        fetch(`${API_URL}/assets`, { headers, cache: "no-store" }),
      ]);
      const [body, assetBody] = await Promise.all([
        recordsResponse.json().catch(() => null),
        assetsResponse.json().catch(() => []),
      ]);

      if (!recordsResponse.ok) {
        throw new Error(body?.message ?? "Unable to load maintenance records.");
      }

      setRows(Array.isArray(body) ? body : []);
      setAssets(Array.isArray(assetBody) ? assetBody : []);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Unable to load maintenance data.",
      );
    } finally {
      setLoading(false);
    }
  }, [canView, tab, userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAccess();
  }, [loadAccess]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!accessLoading && canView) void loadData();
  }, [accessLoading, canView, loadData]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const text = [
        row.recordCode,
        row.assetTag,
        row.type,
        row.technician,
        row.status,
        row.detail,
      ]
        .join(" ")
        .toLowerCase();
      return (
        (!query || text.includes(query)) &&
        (!filter || row.type === filter || row.status === filter)
      );
    });
  }, [filter, rows, search]);

  const statistics = {
    total: rows.length,
    scheduled: rows.filter((row) => row.status === "Scheduled").length,
    inProgress: rows.filter((row) => row.status === "In Progress").length,
    completed: rows.filter((row) => row.status === "Completed").length,
  };

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = visible.slice(start, start + PAGE_SIZE);
  const filterOptions = [
    ...new Set(
      rows.flatMap((row) => [row.type, row.status].filter(Boolean) as string[]),
    ),
  ];

  function changeTab(next: Tab) {
    setTab(next);
    setPage(1);
    setSearch("");
    setFilter("");
    setForm(makeForm(next));
    setEditingId(null);
    setFormOpen(false);
  }

  function openCreate() {
    if (!canAdd) return setError("Add permission is required.");
    setForm(makeForm(tab));
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(row: Row) {
    if (!canEdit || !row.isActive) return;
    setForm({
      recordCode: row.recordCode,
      assetTag: row.assetTag,
      type: row.type,
      date: row.date.slice(0, 10),
      technician: row.technician ?? "",
      status: row.status ?? "",
      cost: row.cost ?? "",
      detail: row.detail ?? "",
    });
    setEditingId(row.id);
    setViewing(null);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeForm() {
    setForm(makeForm(tab));
    setEditingId(null);
    setFormOpen(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    if (!form.recordCode.trim() || !form.assetTag || !form.date) {
      setError("Record ID, Asset Tag, and Date are required.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    const creating = editingId === null;

    try {
      const response = await fetch(
        creating
          ? `${API_URL}/maintenance-center`
          : `${API_URL}/maintenance-center/${editingId}`,
        {
          method: creating ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-User-Id": String(userId),
          },
          body: JSON.stringify({
            recordCode: form.recordCode.trim(),
            tab,
            assetTag: form.assetTag,
            type: form.type,
            date: form.date,
            technician: form.technician.trim() || null,
            status: tab === "planner" ? form.status.trim() || null : null,
            cost: tab === "history" && form.cost ? Number(form.cost) : null,
            detail: form.detail.trim() || null,
          }),
        },
      );

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          Array.isArray(body?.message)
            ? body.message.join(", ")
            : (body?.message ?? "Unable to save maintenance record."),
        );
      }

      setSuccess(
        creating
          ? "Maintenance record created successfully."
          : "Maintenance record updated successfully.",
      );
      closeForm();
      await loadData();
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Unable to save maintenance record.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggle(row: Row) {
    if (!userId || !canDeactivate) return;
    const next = !row.isActive;
    if (
      !window.confirm(
        `${next ? "Activate" : "Deactivate"} record "${row.recordCode}"?`,
      )
    ) {
      return;
    }

    setUpdatingId(row.id);
    try {
      const response = await fetch(
        `${API_URL}/maintenance-center/${row.id}/active`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-User-Id": String(userId),
          },
          body: JSON.stringify({ isActive: next }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to update status.");
      }
      setSuccess(
        `Maintenance record ${next ? "activated" : "deactivated"} successfully.`,
      );
      setViewing(null);
      await loadData();
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Unable to update status.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  function exportCsv() {
    if (!canExport) return setError("Export permission is required.");
    const headers =
      tab === "planner"
        ? [
            "Plan ID",
            "Asset Tag",
            "Type",
            "Date",
            "Technician",
            "Status",
            "Notes",
          ]
        : [
            "Record ID",
            "Asset Tag",
            "Type",
            "Date",
            "Technician",
            "Cost",
            "Outcome",
          ];
    const data = visible.map((row) => [
      row.recordCode,
      row.assetTag,
      row.type,
      row.date,
      row.technician ?? "",
      tab === "planner" ? (row.status ?? "") : (row.cost ?? ""),
      row.detail ?? "",
    ]);
    const csv = [headers, ...data]
      .map((line) =>
        line.map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `maintenance-${tab}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (accessLoading) {
    return (
      <main className="session-loading">
        <div className="session-loading-card">
          <span className="session-loading-spinner" />
          <p>Loading Maintenance Center permissions...</p>
        </div>
      </main>
    );
  }

  if (!canView) {
    return (
      <Master>
        <section className="content">
          <div className="maintenance-denied">
            <h1>Access denied</h1>
            <p>
              Your assigned role does not have View permission for Maintenance
              Center.
            </p>
            {error && <p>{error}</p>}
          </div>
        </section>
      </Master>
    );
  }

  return (
    <Master>
      <section className="content maintenance-page">
        <header className="maintenance-hero">
          <div>
            <div className="eyebrow">Maintenance workspace</div>
            <h1>Maintenance Center</h1>
            <p>Plan upcoming work and review maintenance history.</p>
          </div>
          <div className="button-row">
            {canExport && (
              <button className="btn" onClick={exportCsv}>
                Export Current Tab
              </button>
            )}
            {canAdd && !formOpen && (
              <button className="btn primary" onClick={openCreate}>
                Add {tab === "planner" ? "Plan" : "History Record"}
              </button>
            )}
          </div>
        </header>

        {error && <div className="maintenance-message error">{error}</div>}
        {success && (
          <div className="maintenance-message success">{success}</div>
        )}

        <div className="maintenance-stats">
          <article>
            <span>Total</span>
            <strong>{statistics.total}</strong>
          </article>
          <article>
            <span>Scheduled</span>
            <strong>{statistics.scheduled}</strong>
          </article>
          <article>
            <span>In Progress</span>
            <strong>{statistics.inProgress}</strong>
          </article>
          <article>
            <span>Completed</span>
            <strong>{statistics.completed}</strong>
          </article>
        </div>

        <div className="tab-bar">
          <button
            className={`tab-button${tab === "planner" ? " active" : ""}`}
            onClick={() => changeTab("planner")}
          >
            Maintenance Planner
          </button>
          <button
            className={`tab-button${tab === "history" ? " active" : ""}`}
            onClick={() => changeTab("history")}
          >
            Maintenance History
          </button>
        </div>

        {viewing && (
          <div
            className="maintenance-modal-backdrop"
            onMouseDown={() => setViewing(null)}
          >
            <section
              className="maintenance-modal"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header>
                <div>
                  <div className="eyebrow">Maintenance Detail</div>
                  <h2>{viewing.recordCode}</h2>
                  <p>{viewing.assetTag}</p>
                </div>
                <button onClick={() => setViewing(null)}>×</button>
              </header>
              <div className="maintenance-detail-grid">
                {[
                  [
                    "Record Type",
                    viewing.tab === "planner" ? "Planner" : "History",
                  ],
                  ["Maintenance Type", viewing.type],
                  ["Date", viewing.date],
                  ["Technician", viewing.technician || "Not provided"],
                  [
                    viewing.tab === "planner" ? "Status" : "Cost",
                    viewing.tab === "planner"
                      ? viewing.status || "Not provided"
                      : viewing.cost
                        ? `$${Number(viewing.cost).toFixed(2)}`
                        : "Not provided",
                  ],
                  ["Record Status", viewing.isActive ? "Active" : "Inactive"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
                <div className="wide">
                  <span>{viewing.tab === "planner" ? "Notes" : "Outcome"}</span>
                  <strong>{viewing.detail || "Not provided"}</strong>
                </div>
              </div>
              <footer>
                <button className="btn" onClick={() => setViewing(null)}>
                  Close
                </button>
                {canEdit && (
                  <button
                    className="btn primary"
                    disabled={!viewing.isActive}
                    onClick={() => openEdit(viewing)}
                  >
                    Edit Record
                  </button>
                )}
              </footer>
            </section>
          </div>
        )}

        {formOpen && (
          <section className="panel">
            <div className="panel-head maintenance-editor-head">
              <div>
                <h2>
                  {editingId === null
                    ? `Add New ${tab === "planner" ? "Maintenance Plan" : "Maintenance Record"}`
                    : "Edit Maintenance Record"}
                </h2>
                <p>
                  Enter asset, schedule, technician, and maintenance
                  information.
                </p>
              </div>
              <button onClick={closeForm}>×</button>
            </div>
            <div className="panel-body">
              <form onSubmit={save}>
                <div className="maintenance-form-grid">
                  <label>
                    {tab === "planner" ? "Plan ID" : "Record ID"}
                    <input
                      value={form.recordCode}
                      maxLength={80}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          recordCode: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label>
                    Asset Tag
                    <select
                      value={form.assetTag}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          assetTag: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Select asset</option>
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.assetTag}>
                          {asset.assetTag}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Maintenance Type
                    <select
                      value={form.type}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          type: event.target.value,
                        }))
                      }
                    >
                      {["Preventive", "Inspection", "Repair", "Upgrade"].map(
                        (value) => (
                          <option key={value}>{value}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    Date
                    <input
                      type="date"
                      value={form.date}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          date: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label>
                    Technician
                    <input
                      value={form.technician}
                      maxLength={150}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          technician: event.target.value,
                        }))
                      }
                    />
                  </label>
                  {tab === "planner" ? (
                    <label>
                      Status
                      <select
                        value={form.status}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            status: event.target.value,
                          }))
                        }
                      >
                        <option>Scheduled</option>
                        <option>In Progress</option>
                        <option>Completed</option>
                        <option>Cancelled</option>
                      </select>
                    </label>
                  ) : (
                    <label>
                      Cost
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.cost}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            cost: event.target.value,
                          }))
                        }
                      />
                    </label>
                  )}
                  <label className="wide">
                    {tab === "planner" ? "Notes" : "Outcome"}
                    <textarea
                      rows={4}
                      maxLength={2000}
                      value={form.detail}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          detail: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="form-footer">
                  <button className="btn" type="button" onClick={closeForm}>
                    Cancel
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
          <div className="maintenance-toolbar">
            <div>
              <h2>
                {tab === "planner"
                  ? "Maintenance Planner Records"
                  : "Maintenance History Records"}
              </h2>
              <p>{visible.length} matching records</p>
            </div>
            <div>
              <input
                placeholder="Search records"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
              <select
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All types and statuses</option>
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
                  <th>{tab === "planner" ? "Plan ID" : "Record ID"}</th>
                  <th>Asset Tag</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Technician</th>
                  <th>{tab === "planner" ? "Status" : "Cost"}</th>
                  <th>{tab === "planner" ? "Notes" : "Outcome"}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="empty-table">
                      Loading maintenance records...
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-table">
                      No maintenance records found.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => (
                    <tr
                      key={row.id}
                      className={row.isActive ? "" : "maintenance-inactive"}
                    >
                      <td>
                        <strong>{row.recordCode}</strong>
                      </td>
                      <td>{row.assetTag}</td>
                      <td>{row.type}</td>
                      <td>{row.date}</td>
                      <td>{row.technician || "—"}</td>
                      <td>
                        {tab === "planner"
                          ? row.status || "—"
                          : row.cost
                            ? `$${Number(row.cost).toFixed(2)}`
                            : "—"}
                      </td>
                      <td>{row.detail || "—"}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="mini-btn view"
                            onClick={() => setViewing(row)}
                          >
                            View
                          </button>
                          {canEdit && (
                            <button
                              className="mini-btn"
                              disabled={!row.isActive}
                              onClick={() => openEdit(row)}
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
                              onClick={() => void toggle(row)}
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
          {visible.length > PAGE_SIZE && (
            <footer className="maintenance-pagination">
              <p>
                Showing {start + 1} to{" "}
                {Math.min(start + PAGE_SIZE, visible.length)} of{" "}
                {visible.length}
              </p>
              <div>
                <button
                  className="btn"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </button>
                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1,
                ).map((number) => (
                  <button
                    className={
                      number === currentPage
                        ? "maintenance-page-number active"
                        : "maintenance-page-number"
                    }
                    key={number}
                    onClick={() => setPage(number)}
                  >
                    {number}
                  </button>
                ))}
                <button
                  className="btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(currentPage + 1)}
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
