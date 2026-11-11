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
type TicketCategory = "Hardware" | "Software" | "Access" | "Network" | "Other";
type TicketPriority = "Low" | "Medium" | "High" | "Urgent";
type TicketStatus = "Open" | "In Progress" | "Waiting" | "Resolved" | "Closed";
type Permission = {
  module: string;
  access: AccessLevel;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDeactivate: boolean;
  canExport: boolean;
};
type Ticket = {
  id: number;
  ticketId: string;
  requester: string | null;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdDate: string | null;
  summary: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
type TicketForm = {
  ticketId: string;
  requester: string;
  category: TicketCategory | "";
  priority: TicketPriority;
  status: TicketStatus;
  createdDate: string;
  summary: string;
};
type CurrentUser = {
  id: number;
  roleId: number;
  status: "Active" | "Inactive";
};
type AssignedRole = {
  id: number;
  name: string;
  isActive: boolean;
  permissions: Permission[];
};
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
  PAGE_SIZE = 10;
const categories: TicketCategory[] = [
    "Hardware",
    "Software",
    "Access",
    "Network",
    "Other",
  ],
  priorities: TicketPriority[] = ["Low", "Medium", "High", "Urgent"],
  statuses: TicketStatus[] = [
    "Open",
    "In Progress",
    "Waiting",
    "Resolved",
    "Closed",
  ];
const emptyForm = (): TicketForm => ({
  ticketId: "",
  requester: "",
  category: "",
  priority: "Medium",
  status: "Open",
  createdDate: new Date().toISOString().slice(0, 10),
  summary: "",
});
const getUserId = () => {
  const value = Number(
    sessionStorage.getItem("assetManagementUserId") ??
      sessionStorage.getItem("stockwiseUserId") ??
      "0",
  );
  return Number.isFinite(value) && value > 0 ? value : null;
};

export default function ServiceDesk() {
  const [userId, setUserId] = useState<number | null>(null),
    [permission, setPermission] = useState<Permission | null>(null),
    [tickets, setTickets] = useState<Ticket[]>([]),
    [form, setForm] = useState<TicketForm>(emptyForm),
    [editingId, setEditingId] = useState<number | null>(null),
    [viewingTicket, setViewingTicket] = useState<Ticket | null>(null),
    [formOpen, setFormOpen] = useState(false),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [currentPage, setCurrentPage] = useState(1),
    [accessLoading, setAccessLoading] = useState(true),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [updatingId, setUpdatingId] = useState<number | null>(null),
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
  const loadAccess = useCallback(async () => {
    setAccessLoading(true);
    const id = getUserId();
    if (!id) {
      setError("Your login session is incomplete.");
      setAccessLoading(false);
      return;
    }
    try {
      const ur = await fetch(`${API_URL}/users/${id}`, { cache: "no-store" }),
        u = await ur.json();
      if (!ur.ok) throw new Error(u?.message);
      const user = u as CurrentUser;
      if (user.status !== "Active")
        throw new Error("Your account is inactive.");
      const rr = await fetch(`${API_URL}/roles/${user.roleId}`, {
          cache: "no-store",
        }),
        r = await rr.json();
      if (!rr.ok) throw new Error(r?.message);
      const role = r as AssignedRole;
      if (!role.isActive) throw new Error("Your role is inactive.");
      setUserId(id);
      setPermission(
        role.permissions.find((x) => x.module === "Service Desk") ?? null,
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
      const r = await fetch(`${API_URL}/service-desk`, {
          headers: headers(),
          cache: "no-store",
        }),
        b = await r.json().catch(() => null);
      if (!r.ok) throw new Error(b?.message);
      setTickets(Array.isArray(b) ? b : []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load tickets.");
    } finally {
      setLoading(false);
    }
  }, [canView, headers, userId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAccess();
  }, [loadAccess]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!accessLoading && canView) void load();
  }, [accessLoading, canView, load]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setCurrentPage(1), [search, filter]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter(
      (t) =>
        (!q || Object.values(t).join(" ").toLowerCase().includes(q)) &&
        (!filter ||
          t.status === filter ||
          t.priority === filter ||
          t.category === filter),
    );
  }, [filter, search, tickets]);
  const summary = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "Open").length,
    progress: tickets.filter((t) => t.status === "In Progress").length,
    urgent: tickets.filter((t) => t.priority === "Urgent").length,
  };
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE)),
    page = Math.min(currentPage, pages),
    start = (page - 1) * PAGE_SIZE,
    paged = visible.slice(start, start + PAGE_SIZE);
  const close = () => {
    setForm(emptyForm());
    setEditingId(null);
    setFormOpen(false);
  };
  const openCreate = () => {
    if (!canAdd) return setError("Add permission is required.");
    setForm(emptyForm());
    setEditingId(null);
    setFormOpen(true);
    setError("");
    setSuccess("");
  };
  const openEdit = (t: Ticket) => {
    if (!canEdit) return setError("Edit permission is required.");
    setForm({
      ticketId: t.ticketId,
      requester: t.requester ?? "",
      category: t.category,
      priority: t.priority,
      status: t.status,
      createdDate: t.createdDate?.slice(0, 10) ?? "",
      summary: t.summary ?? "",
    });
    setEditingId(t.id);
    setViewingTicket(null);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const create = editingId === null;
    if (!form.ticketId.trim() || !form.category)
      return setError("Ticket ID and category are required.");
    setSaving(true);
    try {
      const r = await fetch(
          create
            ? `${API_URL}/service-desk`
            : `${API_URL}/service-desk/${editingId}`,
          {
            method: create ? "POST" : "PATCH",
            headers: headers(true),
            body: JSON.stringify({
              ticketId: form.ticketId.trim(),
              requester: form.requester.trim() || null,
              category: form.category,
              priority: form.priority,
              status: form.status,
              createdDate: form.createdDate || null,
              summary: form.summary.trim() || null,
            }),
          },
        ),
        b = await r.json().catch(() => null);
      if (!r.ok)
        throw new Error(
          Array.isArray(b?.message) ? b.message.join(", ") : b?.message,
        );
      setSuccess(
        create
          ? "Ticket created successfully."
          : "Ticket updated successfully.",
      );
      close();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save ticket.");
    } finally {
      setSaving(false);
    }
  }
  async function status(t: Ticket) {
    const next = !t.isActive;
    if (
      !window.confirm(
        `${next ? "Activate" : "Deactivate"} ticket ${t.ticketId}?`,
      )
    )
      return;
    setUpdatingId(t.id);
    try {
      const r = await fetch(`${API_URL}/service-desk/${t.id}/status`, {
          method: "PATCH",
          headers: headers(true),
          body: JSON.stringify({ isActive: next }),
        }),
        b = await r.json().catch(() => null);
      if (!r.ok) throw new Error(b?.message);
      setSuccess(next ? "Ticket activated." : "Ticket deactivated.");
      setViewingTicket(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update status.");
    } finally {
      setUpdatingId(null);
    }
  }
  function exportCsv() {
    const lines = [
      [
        "Ticket ID",
        "Requester",
        "Category",
        "Priority",
        "Status",
        "Created Date",
        "Summary",
        "Record Status",
      ],
      ...visible.map((t) => [
        t.ticketId,
        t.requester ?? "",
        t.category,
        t.priority,
        t.status,
        t.createdDate ?? "",
        t.summary ?? "",
        t.isActive ? "Active" : "Inactive",
      ]),
    ];
    const csv = lines
        .map((line) =>
          line.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","),
        )
        .join("\n"),
      url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      a = document.createElement("a");
    a.href = url;
    a.download = "service-desk-tickets.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  if (accessLoading)
    return (
      <main className="session-loading">
        <div className="session-loading-card">
          <span className="session-loading-spinner" />
          <p>Loading Service Desk permissions...</p>
        </div>
      </main>
    );
  if (!canView)
    return (
      <Master>
        <section className="content">
          <div className="service-permission-denied">
            <h1>Access denied</h1>
            <p>Your role does not have View permission for Service Desk.</p>
          </div>
        </section>
      </Master>
    );
  return (
    <Master>
      <section className="content service-page">
        <header className="service-hero">
          <div>
            <div className="eyebrow">Support workspace</div>
            <h1>Service Desk</h1>
            <p>Log requests and track support ticket progress.</p>
          </div>
          <div className="button-row">
            {canExport && (
              <button className="btn" onClick={exportCsv}>
                Export CSV
              </button>
            )}
            {canAdd && !formOpen && (
              <button className="btn primary" onClick={openCreate}>
                Add New Ticket
              </button>
            )}
          </div>
        </header>
        {error && <div className="service-message error">{error}</div>}
        {success && <div className="service-message success">{success}</div>}
        <div className="service-stats">
          <article>
            <span>Total Tickets</span>
            <strong>{summary.total}</strong>
          </article>
          <article>
            <span>Open</span>
            <strong>{summary.open}</strong>
          </article>
          <article>
            <span>In Progress</span>
            <strong>{summary.progress}</strong>
          </article>
          <article>
            <span>Urgent</span>
            <strong>{summary.urgent}</strong>
          </article>
        </div>
        {viewingTicket && (
          <div
            className="ticket-detail-backdrop"
            onMouseDown={() => setViewingTicket(null)}
          >
            <section
              className="ticket-detail-dialog"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <header>
                <div>
                  <div className="eyebrow">Service Desk Ticket</div>
                  <h2>{viewingTicket.ticketId}</h2>
                  <p>{viewingTicket.summary || "No summary provided"}</p>
                </div>
                <button onClick={() => setViewingTicket(null)}>×</button>
              </header>
              <div className="ticket-detail-grid">
                {[
                  ["Requester", viewingTicket.requester || "Not provided"],
                  ["Category", viewingTicket.category],
                  ["Priority", viewingTicket.priority],
                  ["Workflow Status", viewingTicket.status],
                  ["Created Date", viewingTicket.createdDate || "Not provided"],
                  ["Record", viewingTicket.isActive ? "Active" : "Inactive"],
                  [
                    "Created",
                    new Date(viewingTicket.createdAt).toLocaleString(),
                  ],
                  [
                    "Updated",
                    new Date(viewingTicket.updatedAt).toLocaleString(),
                  ],
                ].map(([k, v]) => (
                  <div key={k}>
                    <span>{k}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
              <footer>
                <button className="btn" onClick={() => setViewingTicket(null)}>
                  Close
                </button>
                {canEdit && (
                  <button
                    className="btn primary"
                    disabled={!viewingTicket.isActive}
                    onClick={() => openEdit(viewingTicket)}
                  >
                    Edit Ticket
                  </button>
                )}
              </footer>
            </section>
          </div>
        )}
        {formOpen && (
          <section className="panel">
            <div className="panel-head service-heading">
              <div>
                <h2>{editingId === null ? "Add New Ticket" : "Edit Ticket"}</h2>
                <p>Enter request and workflow details.</p>
              </div>
              <button onClick={close}>×</button>
            </div>
            <div className="panel-body">
              <form onSubmit={save}>
                <div className="ticket-form-grid">
                  <label>
                    Ticket ID
                    <input
                      value={form.ticketId}
                      maxLength={80}
                      onChange={(e) =>
                        setForm((c) => ({ ...c, ticketId: e.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    Requester
                    <input
                      value={form.requester}
                      maxLength={150}
                      onChange={(e) =>
                        setForm((c) => ({ ...c, requester: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Category
                    <select
                      value={form.category}
                      onChange={(e) =>
                        setForm((c) => ({
                          ...c,
                          category: e.target.value as TicketCategory,
                        }))
                      }
                      required
                    >
                      <option value="">Select category</option>
                      {categories.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Priority
                    <select
                      value={form.priority}
                      onChange={(e) =>
                        setForm((c) => ({
                          ...c,
                          priority: e.target.value as TicketPriority,
                        }))
                      }
                    >
                      {priorities.map((v) => (
                        <option key={v}>{v}</option>
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
                          status: e.target.value as TicketStatus,
                        }))
                      }
                    >
                      {statuses.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Created Date
                    <input
                      type="date"
                      value={form.createdDate}
                      onChange={(e) =>
                        setForm((c) => ({ ...c, createdDate: e.target.value }))
                      }
                    />
                  </label>
                  <label className="wide">
                    Summary
                    <textarea
                      rows={4}
                      maxLength={500}
                      value={form.summary}
                      onChange={(e) =>
                        setForm((c) => ({ ...c, summary: e.target.value }))
                      }
                    />
                  </label>
                </div>
                <div className="form-footer">
                  <button className="btn" type="button" onClick={close}>
                    Cancel
                  </button>
                  <button className="btn primary" disabled={saving}>
                    {saving
                      ? "Saving..."
                      : editingId === null
                        ? "Create Ticket"
                        : "Update Ticket"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}
        <section className="panel">
          <div className="service-toolbar">
            <div>
              <h2>Service Desk Records</h2>
              <p>{visible.length} matching tickets</p>
            </div>
            <div>
              <input
                placeholder="Search tickets"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">All tickets</option>
                {[...statuses, ...priorities, ...categories].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Requester</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="empty-table">
                      Loading tickets...
                    </td>
                  </tr>
                ) : !paged.length ? (
                  <tr>
                    <td colSpan={7} className="empty-table">
                      No tickets found.
                    </td>
                  </tr>
                ) : (
                  paged.map((t) => (
                    <tr
                      key={t.id}
                      className={t.isActive ? "" : "ticket-inactive-row"}
                    >
                      <td>
                        <strong>{t.ticketId}</strong>
                        <small>{t.summary || "No summary"}</small>
                      </td>
                      <td>{t.requester || "—"}</td>
                      <td>{t.category}</td>
                      <td>
                        <span
                          className={`ticket-priority ${t.priority.toLowerCase()}`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td>{t.status}</td>
                      <td>{t.createdDate || "—"}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="mini-btn view"
                            onClick={() => setViewingTicket(t)}
                          >
                            View
                          </button>
                          {canEdit && (
                            <button
                              className="mini-btn"
                              disabled={!t.isActive}
                              onClick={() => openEdit(t)}
                            >
                              Edit
                            </button>
                          )}
                          {canDeactivate && (
                            <button
                              className={
                                t.isActive
                                  ? "mini-btn deactivate"
                                  : "mini-btn activate"
                              }
                              disabled={updatingId === t.id}
                              onClick={() => void status(t)}
                            >
                              {updatingId === t.id
                                ? "Updating..."
                                : t.isActive
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
            <footer className="service-pagination">
              <p>
                Showing {start + 1} to{" "}
                {Math.min(start + PAGE_SIZE, visible.length)} of{" "}
                {visible.length}
              </p>
              <div>
                <button
                  className="btn"
                  disabled={page === 1}
                  onClick={() => setCurrentPage(page - 1)}
                >
                  Previous
                </button>
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                  <button
                    className={
                      n === page
                        ? "service-page-number active"
                        : "service-page-number"
                    }
                    key={n}
                    onClick={() => setCurrentPage(n)}
                  >
                    {n}
                  </button>
                ))}
                <button
                  className="btn"
                  disabled={page === pages}
                  onClick={() => setCurrentPage(page + 1)}
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
