"use client";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Master from "./master";
type TransferStatus = "Pending" | "Approved" | "Completed" | "Rejected";
type Permission = {
  module: string;
  access: "Own Only" | "Assigned" | "All";
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDeactivate: boolean;
  canExport: boolean;
};
type Transfer = {
  id: number;
  transferId: string;
  assetTag: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  requestedBy: string | null;
  date: string | null;
  status: TransferStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
type Form = {
  transferId: string;
  assetTag: string;
  fromLocation: string;
  toLocation: string;
  requestedBy: string;
  date: string;
  status: TransferStatus;
};
type User = { id: number; roleId: number; status: "Active" | "Inactive" };
type Role = {
  id: number;
  name: string;
  isActive: boolean;
  permissions: Permission[];
};
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
  SIZE = 10,
  statuses: TransferStatus[] = ["Pending", "Approved", "Completed", "Rejected"];
const empty = (): Form => ({
  transferId: "",
  assetTag: "",
  fromLocation: "",
  toLocation: "",
  requestedBy: "",
  date: new Date().toISOString().slice(0, 10),
  status: "Pending",
});
const uid = () => {
  const n = Number(
    sessionStorage.getItem("assetManagementUserId") ??
      sessionStorage.getItem("stockwiseUserId") ??
      0,
  );
  return n > 0 ? n : null;
};
export default function AssetTransfer() {
  const [userId, setUserId] = useState<number | null>(null),
    [permission, setPermission] = useState<Permission | null>(null),
    [rows, setRows] = useState<Transfer[]>([]),
    [form, setForm] = useState<Form>(empty),
    [edit, setEdit] = useState<number | null>(null),
    [view, setView] = useState<Transfer | null>(null),
    [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [page, setPage] = useState(1),
    [accessLoading, setAccessLoading] = useState(true),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [updating, setUpdating] = useState<number | null>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const canView = permission?.canView === true,
    canAdd = permission?.canAdd === true,
    canEdit = permission?.canEdit === true,
    canDeactivate = permission?.canDeactivate === true,
    canExport = permission?.canExport === true;
  const headers = useCallback(
    (json = false) => ({
      Accept: "application/json",
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(userId ? { "X-User-Id": String(userId) } : {}),
    }),
    [userId],
  );
  const access = useCallback(async () => {
    setAccessLoading(true);
    const id = uid();
    if (!id) {
      setError("Your login session is incomplete.");
      setAccessLoading(false);
      return;
    }
    try {
      const ur = await fetch(`${API}/users/${id}`, { cache: "no-store" }),
        u = await ur.json();
      if (!ur.ok) throw new Error(u?.message);
      const user = u as User;
      if (user.status !== "Active")
        throw new Error("Your account is inactive.");
      const rr = await fetch(`${API}/roles/${user.roleId}`, {
          cache: "no-store",
        }),
        r = await rr.json();
      if (!rr.ok) throw new Error(r?.message);
      const role = r as Role;
      if (!role.isActive) throw new Error("Your role is inactive.");
      setUserId(id);
      setPermission(
        role.permissions.find((p) => p.module === "Asset Transfer") ?? null,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load permission.");
    } finally {
      setAccessLoading(false);
    }
  }, []);
  const load = useCallback(async () => {
    if (!userId || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`${API}/asset-transfer`, {
          headers: headers(),
          cache: "no-store",
        }),
        b = await r.json().catch(() => null);
      if (!r.ok) throw new Error(b?.message);
      setRows(Array.isArray(b) ? b : []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load transfers.");
    } finally {
      setLoading(false);
    }
  }, [canView, headers, userId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void access();
  }, [access]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!accessLoading && canView) void load();
  }, [accessLoading, canView, load]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setPage(1), [search, filter]);
  const visible = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter(
      (r) =>
        (!q || Object.values(r).join(" ").toLowerCase().includes(q)) &&
        (!filter || r.status === filter),
    );
  }, [rows, search, filter]);
  const stats = {
    total: rows.length,
    pending: rows.filter((r) => r.status === "Pending").length,
    approved: rows.filter((r) => r.status === "Approved").length,
    completed: rows.filter((r) => r.status === "Completed").length,
  };
  const pages = Math.max(1, Math.ceil(visible.length / SIZE)),
    safe = Math.min(page, pages),
    start = (safe - 1) * SIZE,
    paged = visible.slice(start, start + SIZE);
  const close = () => {
    setForm(empty());
    setEdit(null);
    setOpen(false);
  };
  const create = () => {
    if (!canAdd) return setError("Add permission is required.");
    setForm(empty());
    setEdit(null);
    setOpen(true);
  };
  const editRow = (r: Transfer) => {
    setForm({
      transferId: r.transferId,
      assetTag: r.assetTag ?? "",
      fromLocation: r.fromLocation ?? "",
      toLocation: r.toLocation ?? "",
      requestedBy: r.requestedBy ?? "",
      date: r.date?.slice(0, 10) ?? "",
      status: r.status,
    });
    setEdit(r.id);
    setView(null);
    setOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  async function save(e: FormEvent) {
    e.preventDefault();
    const isNew = edit === null;
    setSaving(true);
    try {
      const r = await fetch(
          isNew ? `${API}/asset-transfer` : `${API}/asset-transfer/${edit}`,
          {
            method: isNew ? "POST" : "PATCH",
            headers: headers(true),
            body: JSON.stringify({
              transferId: form.transferId.trim(),
              assetTag: form.assetTag.trim() || null,
              fromLocation: form.fromLocation.trim() || null,
              toLocation: form.toLocation.trim() || null,
              requestedBy: form.requestedBy.trim() || null,
              date: form.date || null,
              status: form.status,
            }),
          },
        ),
        b = await r.json().catch(() => null);
      if (!r.ok)
        throw new Error(
          Array.isArray(b?.message) ? b.message.join(", ") : b?.message,
        );
      setSuccess(
        isNew
          ? "Transfer created successfully."
          : "Transfer updated successfully.",
      );
      close();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save transfer.");
    } finally {
      setSaving(false);
    }
  }
  async function active(r: Transfer) {
    const next = !r.isActive;
    if (
      !window.confirm(
        `${next ? "Activate" : "Deactivate"} transfer ${r.transferId}?`,
      )
    )
      return;
    setUpdating(r.id);
    try {
      const res = await fetch(`${API}/asset-transfer/${r.id}/status`, {
          method: "PATCH",
          headers: headers(true),
          body: JSON.stringify({ isActive: next }),
        }),
        b = await res.json().catch(() => null);
      if (!res.ok) throw new Error(b?.message);
      setSuccess(next ? "Transfer activated." : "Transfer deactivated.");
      setView(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update transfer.");
    } finally {
      setUpdating(null);
    }
  }
  function csv() {
    const data = [
      [
        "Transfer ID",
        "Asset Tag",
        "From",
        "To",
        "Requested By",
        "Date",
        "Status",
        "Record",
      ],
      ...visible.map((r) => [
        r.transferId,
        r.assetTag ?? "",
        r.fromLocation ?? "",
        r.toLocation ?? "",
        r.requestedBy ?? "",
        r.date ?? "",
        r.status,
        r.isActive ? "Active" : "Inactive",
      ]),
    ];
    const text = data
        .map((x) =>
          x.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","),
        )
        .join("\n"),
      url = URL.createObjectURL(new Blob([text], { type: "text/csv" })),
      a = document.createElement("a");
    a.href = url;
    a.download = "asset-transfers.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  if (accessLoading)
    return (
      <main className="session-loading">
        <div className="session-loading-card">
          <span className="session-loading-spinner" />
          <p>Loading Asset Transfer permissions...</p>
        </div>
      </main>
    );
  if (!canView)
    return (
      <Master>
        <section className="content">
          <div className="transfer-permission-denied">
            <h1>Access denied</h1>
            <p>Your role does not have View permission for Asset Transfer.</p>
          </div>
        </section>
      </Master>
    );
  return (
    <Master>
      <section className="content transfer-page">
        <header className="transfer-hero">
          <div>
            <div className="eyebrow">Operations</div>
            <h1>Asset Transfer</h1>
            <p>Track asset movements between people, teams, and locations.</p>
          </div>
          <div className="button-row">
            {canExport && (
              <button className="btn" onClick={csv}>
                Export CSV
              </button>
            )}
            {canAdd && !open && (
              <button className="btn primary" onClick={create}>
                Add New Transfer
              </button>
            )}
          </div>
        </header>
        {error && <div className="transfer-message error">{error}</div>}
        {success && <div className="transfer-message success">{success}</div>}
        <div className="transfer-stats">
          <article>
            <span>Total</span>
            <strong>{stats.total}</strong>
          </article>
          <article>
            <span>Pending</span>
            <strong>{stats.pending}</strong>
          </article>
          <article>
            <span>Approved</span>
            <strong>{stats.approved}</strong>
          </article>
          <article>
            <span>Completed</span>
            <strong>{stats.completed}</strong>
          </article>
        </div>
        {view && (
          <div className="transfer-backdrop" onMouseDown={() => setView(null)}>
            <section
              className="transfer-dialog"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <header>
                <div>
                  <div className="eyebrow">Transfer Detail</div>
                  <h2>{view.transferId}</h2>
                  <p>{view.assetTag || "No asset tag"}</p>
                </div>
                <button onClick={() => setView(null)}>×</button>
              </header>
              <div className="transfer-route">
                <div>
                  <span>From</span>
                  <strong>{view.fromLocation || "Not provided"}</strong>
                </div>
                <b>→</b>
                <div>
                  <span>To</span>
                  <strong>{view.toLocation || "Not provided"}</strong>
                </div>
              </div>
              <div className="transfer-detail-grid">
                {[
                  ["Requested By", view.requestedBy || "Not provided"],
                  ["Date", view.date || "Not provided"],
                  ["Workflow", view.status],
                  ["Record", view.isActive ? "Active" : "Inactive"],
                  ["Created", new Date(view.createdAt).toLocaleString()],
                  ["Updated", new Date(view.updatedAt).toLocaleString()],
                ].map(([k, v]) => (
                  <div key={k}>
                    <span>{k}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
              <footer>
                <button className="btn" onClick={() => setView(null)}>
                  Close
                </button>
                {canEdit && (
                  <button
                    className="btn primary"
                    disabled={!view.isActive}
                    onClick={() => editRow(view)}
                  >
                    Edit Transfer
                  </button>
                )}
              </footer>
            </section>
          </div>
        )}
        {open && (
          <section className="panel">
            <div className="panel-head transfer-heading">
              <div>
                <h2>{edit === null ? "Add New Transfer" : "Edit Transfer"}</h2>
                <p>Enter asset, route, requester, date, and workflow.</p>
              </div>
              <button onClick={close}>×</button>
            </div>
            <div className="panel-body">
              <form onSubmit={save}>
                <div className="transfer-form-grid">
                  {(
                    [
                      ["transferId", "Transfer ID"],
                      ["assetTag", "Asset Tag"],
                      ["fromLocation", "From Location"],
                      ["toLocation", "To Location"],
                      ["requestedBy", "Requested By"],
                    ] as const
                  ).map(([k, l]) => (
                    <label key={k}>
                      {l}
                      <input
                        value={form[k]}
                        maxLength={k === "transferId" ? 80 : 150}
                        onChange={(e) =>
                          setForm((c) => ({ ...c, [k]: e.target.value }))
                        }
                        required={k === "transferId"}
                      />
                    </label>
                  ))}
                  <label>
                    Date
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) =>
                        setForm((c) => ({ ...c, date: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Status
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm((c) => ({
                          ...c,
                          status: e.target.value as TransferStatus,
                        }))
                      }
                    >
                      {statuses.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="form-footer">
                  <button className="btn" type="button" onClick={close}>
                    Cancel
                  </button>
                  <button className="btn primary" disabled={saving}>
                    {saving
                      ? "Saving..."
                      : edit === null
                        ? "Create Transfer"
                        : "Update Transfer"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}
        <section className="panel">
          <div className="transfer-toolbar">
            <div>
              <h2>Asset Transfer Records</h2>
              <p>{visible.length} matching transfers</p>
            </div>
            <div>
              <input
                placeholder="Search transfer, asset, requester, or location"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                {statuses.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Transfer ID</th>
                  <th>Asset</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Requested By</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="empty-table">
                      Loading transfers...
                    </td>
                  </tr>
                ) : !paged.length ? (
                  <tr>
                    <td colSpan={8} className="empty-table">
                      No transfers found.
                    </td>
                  </tr>
                ) : (
                  paged.map((r) => (
                    <tr
                      key={r.id}
                      className={r.isActive ? "" : "transfer-inactive-row"}
                    >
                      <td>
                        <strong>{r.transferId}</strong>
                      </td>
                      <td>{r.assetTag || "—"}</td>
                      <td>{r.fromLocation || "—"}</td>
                      <td>{r.toLocation || "—"}</td>
                      <td>{r.requestedBy || "—"}</td>
                      <td>{r.date || "—"}</td>
                      <td>
                        <span
                          className={`transfer-workflow ${r.status.toLowerCase()}`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="mini-btn view"
                            onClick={() => setView(r)}
                          >
                            View
                          </button>
                          {canEdit && (
                            <button
                              className="mini-btn"
                              disabled={!r.isActive}
                              onClick={() => editRow(r)}
                            >
                              Edit
                            </button>
                          )}
                          {canDeactivate && (
                            <button
                              className={
                                r.isActive
                                  ? "mini-btn deactivate"
                                  : "mini-btn activate"
                              }
                              disabled={updating === r.id}
                              onClick={() => void active(r)}
                            >
                              {updating === r.id
                                ? "Updating..."
                                : r.isActive
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
          {visible.length > SIZE && (
            <footer className="transfer-pagination">
              <p>
                Showing {start + 1} to {Math.min(start + SIZE, visible.length)}{" "}
                of {visible.length}
              </p>
              <div>
                <button
                  className="btn"
                  disabled={safe === 1}
                  onClick={() => setPage(safe - 1)}
                >
                  Previous
                </button>
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                  <button
                    className={
                      n === safe
                        ? "transfer-page-number active"
                        : "transfer-page-number"
                    }
                    key={n}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                ))}
                <button
                  className="btn"
                  disabled={safe === pages}
                  onClick={() => setPage(safe + 1)}
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
