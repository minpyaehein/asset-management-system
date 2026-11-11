"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Master from "./master";

type Status = "Requested" | "Approved" | "Disposed" | "Rejected";

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

type User = {
  id: number;
  roleId: number;
  status: "Active" | "Inactive";
};

type AssetOption = {
  id: number;
  assetTag: string;
};

type Disposal = {
  id: number;
  disposalId: string;
  assetTag: string | null;
  reason: string | null;
  requestedBy: string | null;
  date: string | null;
  status: Status;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  disposalId: string;
  assetTag: string;
  reason: string;
  requestedBy: string;
  date: string;
  status: Status;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const PAGE_SIZE = 10;

const emptyForm = (): FormState => ({
  disposalId: "",
  assetTag: "",
  reason: "",
  requestedBy: "",
  date: "",
  status: "Requested",
});

function getUserId() {
  const id = Number(
    sessionStorage.getItem("assetManagementUserId") ??
      sessionStorage.getItem("stockwiseUserId") ??
      0,
  );
  return Number.isFinite(id) && id > 0 ? id : null;
}

export default function AssetDisposal() {
  const [userId, setUserId] = useState<number | null>(null);
  const [permission, setPermission] = useState<Permission | null>(null);
  const [records, setRecords] = useState<Disposal[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewing, setViewing] = useState<Disposal | null>(null);
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
    const id = getUserId();

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
        throw new Error(userBody?.message ?? "Unable to load user account.");
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
        role.permissions.find((item) => item.module === "Asset Disposal") ??
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
        fetch(`${API_URL}/asset-disposals`, { headers, cache: "no-store" }),
        fetch(`${API_URL}/assets`, { headers, cache: "no-store" }),
      ]);

      const [body, assetBody] = await Promise.all([
        recordsResponse.json().catch(() => null),
        assetsResponse.json().catch(() => []),
      ]);

      if (!recordsResponse.ok) {
        throw new Error(body?.message ?? "Unable to load asset disposals.");
      }

      setRecords(Array.isArray(body) ? body : []);
      setAssets(Array.isArray(assetBody) ? assetBody : []);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to load data.");
    } finally {
      setLoading(false);
    }
  }, [canView, userId]);

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

    return records.filter((item) => {
      const text = [
        item.disposalId,
        item.assetTag,
        item.reason,
        item.requestedBy,
        item.status,
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!query || text.includes(query)) && (!filter || item.status === filter)
      );
    });
  }, [filter, records, search]);

  const statistics = {
    total: records.length,
    requested: records.filter((item) => item.status === "Requested").length,
    approved: records.filter((item) => item.status === "Approved").length,
    disposed: records.filter((item) => item.status === "Disposed").length,
  };

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = visible.slice(start, start + PAGE_SIZE);

  function openCreate() {
    if (!canAdd) return setError("Add permission is required.");
    setForm(emptyForm());
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(item: Disposal) {
    if (!canEdit || !item.isActive) return;

    setForm({
      disposalId: item.disposalId,
      assetTag: item.assetTag ?? "",
      reason: item.reason ?? "",
      requestedBy: item.requestedBy ?? "",
      date: item.date?.slice(0, 10) ?? "",
      status: item.status,
    });
    setEditingId(item.id);
    setViewing(null);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeForm() {
    setForm(emptyForm());
    setEditingId(null);
    setFormOpen(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;

    if (!form.disposalId.trim()) {
      setError("Disposal ID is required.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    const creating = editingId === null;

    try {
      const response = await fetch(
        creating
          ? `${API_URL}/asset-disposals`
          : `${API_URL}/asset-disposals/${editingId}`,
        {
          method: creating ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-User-Id": String(userId),
          },
          body: JSON.stringify({
            disposalId: form.disposalId.trim(),
            assetTag: form.assetTag || null,
            reason: form.reason.trim() || null,
            requestedBy: form.requestedBy.trim() || null,
            date: form.date || null,
            status: form.status,
          }),
        },
      );

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          Array.isArray(body?.message)
            ? body.message.join(", ")
            : (body?.message ?? "Unable to save asset disposal."),
        );
      }

      setSuccess(
        creating
          ? "Asset disposal created successfully."
          : "Asset disposal updated successfully.",
      );
      closeForm();
      await loadData();
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Unable to save asset disposal.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: Disposal) {
    if (!userId || !canDeactivate) return;
    const next = !item.isActive;

    if (
      !window.confirm(
        `${next ? "Activate" : "Deactivate"} disposal "${item.disposalId}"?`,
      )
    ) {
      return;
    }

    setUpdatingId(item.id);

    try {
      const response = await fetch(
        `${API_URL}/asset-disposals/${item.id}/active`,
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
        throw new Error(body?.message ?? "Unable to update record status.");
      }

      setSuccess(
        `Asset disposal ${next ? "activated" : "deactivated"} successfully.`,
      );
      setViewing(null);
      await loadData();
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
    if (!canExport) return setError("Export permission is required.");

    const rows = [
      ["Disposal ID", "Asset Tag", "Reason", "Requested By", "Date", "Status"],
      ...visible.map((item) => [
        item.disposalId,
        item.assetTag ?? "",
        item.reason ?? "",
        item.requestedBy ?? "",
        item.date ?? "",
        item.status,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "asset-disposals.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (accessLoading) {
    return (
      <main className="session-loading">
        <div className="session-loading-card">
          <span className="session-loading-spinner" />
          <p>Loading Asset Disposal permissions...</p>
        </div>
      </main>
    );
  }

  if (!canView) {
    return (
      <Master>
        <section className="content">
          <div className="disposal-denied">
            <h1>Access denied</h1>
            <p>
              Your assigned role does not have View permission for Asset
              Disposal.
            </p>
            {error && <p>{error}</p>}
          </div>
        </section>
      </Master>
    );
  }

  return (
    <Master>
      <section className="content disposal-page">
        <header className="disposal-hero">
          <div>
            <div className="eyebrow">Asset lifecycle</div>
            <h1>Asset Disposal</h1>
            <p>Track retired equipment and disposal approvals.</p>
          </div>
          <div className="button-row">
            {canExport && (
              <button className="btn" onClick={exportCsv}>
                Export CSV
              </button>
            )}
            {canAdd && !formOpen && (
              <button className="btn primary" onClick={openCreate}>
                Add Asset Disposal
              </button>
            )}
          </div>
        </header>

        {error && <div className="disposal-message error">{error}</div>}
        {success && <div className="disposal-message success">{success}</div>}

        <div className="disposal-stats">
          <article>
            <span>Total</span>
            <strong>{statistics.total}</strong>
          </article>
          <article>
            <span>Requested</span>
            <strong>{statistics.requested}</strong>
          </article>
          <article>
            <span>Approved</span>
            <strong>{statistics.approved}</strong>
          </article>
          <article>
            <span>Disposed</span>
            <strong>{statistics.disposed}</strong>
          </article>
        </div>

        {viewing && (
          <div
            className="disposal-modal-backdrop"
            onMouseDown={() => setViewing(null)}
          >
            <section
              className="disposal-modal"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header>
                <div>
                  <div className="eyebrow">Disposal Detail</div>
                  <h2>{viewing.disposalId}</h2>
                  <p>{viewing.assetTag || "No asset selected"}</p>
                </div>
                <button onClick={() => setViewing(null)}>×</button>
              </header>
              <div className="disposal-detail-grid">
                {[
                  ["Requested By", viewing.requestedBy || "Not provided"],
                  ["Date", viewing.date || "Not provided"],
                  ["Workflow Status", viewing.status],
                  ["Record Status", viewing.isActive ? "Active" : "Inactive"],
                  ["Created", new Date(viewing.createdAt).toLocaleString()],
                  ["Updated", new Date(viewing.updatedAt).toLocaleString()],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
                <div className="wide">
                  <span>Reason</span>
                  <strong>{viewing.reason || "No reason provided"}</strong>
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
                    Edit Disposal
                  </button>
                )}
              </footer>
            </section>
          </div>
        )}

        {formOpen && (
          <section className="panel">
            <div className="panel-head disposal-editor-head">
              <div>
                <h2>
                  {editingId === null
                    ? "Add New Asset Disposal"
                    : "Edit Asset Disposal"}
                </h2>
                <p>
                  Enter disposal request, asset, reason, and approval status.
                </p>
              </div>
              <button onClick={closeForm}>×</button>
            </div>
            <div className="panel-body">
              <form onSubmit={save}>
                <div className="disposal-form-grid">
                  <label>
                    Disposal ID
                    <input
                      value={form.disposalId}
                      maxLength={80}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          disposalId: event.target.value,
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
                    Requested By
                    <input
                      value={form.requestedBy}
                      maxLength={150}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          requestedBy: event.target.value,
                        }))
                      }
                    />
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
                    />
                  </label>
                  <label>
                    Status
                    <select
                      value={form.status}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          status: event.target.value as Status,
                        }))
                      }
                    >
                      <option>Requested</option>
                      <option>Approved</option>
                      <option>Disposed</option>
                      <option>Rejected</option>
                    </select>
                  </label>
                  <label className="wide">
                    Reason
                    <textarea
                      rows={4}
                      maxLength={1000}
                      value={form.reason}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          reason: event.target.value,
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
                        ? "Create Disposal"
                        : "Update Disposal"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        <section className="panel">
          <div className="disposal-toolbar">
            <div>
              <h2>Asset Disposal Records</h2>
              <p>{visible.length} matching records</p>
            </div>
            <div>
              <input
                placeholder="Search disposals"
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
                <option value="">All statuses</option>
                <option>Requested</option>
                <option>Approved</option>
                <option>Disposed</option>
                <option>Rejected</option>
              </select>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Disposal ID</th>
                  <th>Asset Tag</th>
                  <th>Requested By</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="empty-table">
                      Loading asset disposals...
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-table">
                      No asset disposals found.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((item) => (
                    <tr
                      key={item.id}
                      className={item.isActive ? "" : "disposal-inactive"}
                    >
                      <td>
                        <strong>{item.disposalId}</strong>
                      </td>
                      <td>{item.assetTag || "—"}</td>
                      <td>{item.requestedBy || "—"}</td>
                      <td>{item.date || "—"}</td>
                      <td>
                        <span
                          className={`disposal-badge ${item.status.toLowerCase()}`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="mini-btn view"
                            onClick={() => setViewing(item)}
                          >
                            View
                          </button>
                          {canEdit && (
                            <button
                              className="mini-btn"
                              disabled={!item.isActive}
                              onClick={() => openEdit(item)}
                            >
                              Edit
                            </button>
                          )}
                          {canDeactivate && (
                            <button
                              className={
                                item.isActive
                                  ? "mini-btn deactivate"
                                  : "mini-btn activate"
                              }
                              disabled={updatingId === item.id}
                              onClick={() => void toggleActive(item)}
                            >
                              {updatingId === item.id
                                ? "Updating..."
                                : item.isActive
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
            <footer className="disposal-pagination">
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
                        ? "disposal-page-number active"
                        : "disposal-page-number"
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
