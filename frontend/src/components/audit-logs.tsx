"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Master from "./master";

type AuditLog = {
  id: number;
  userName: string | null;
  userId: number | null;
  action: string;
  module: string;
  entityType?: string | null;
  entityId?: string | null;
  entityName?: string | null;
  entityUsername?: string | null;
  description: string;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string | null;
  createdAt: string;
};

type CurrentUser = {
  id: number;
  roleId: number;
  status: "Active" | "Inactive";
};
type Permission = { module: string; canView: boolean };
type AssignedRole = {
  id: number;
  isActive: boolean;
  permissions: Permission[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const PAGE_SIZE = 10;
const REFRESH_SECONDS = 5;

function getSessionUserId() {
  const value = Number(
    sessionStorage.getItem("assetManagementUserId") ??
      sessionStorage.getItem("stockwiseUserId") ??
      "0",
  );
  return Number.isFinite(value) && value > 0 ? value : null;
}

function actionClass(action: string) {
  const value = action.toUpperCase();
  if (["CREATE", "ADD", "ACTIVATE", "CHECK_IN"].includes(value))
    return "success";
  if (["DELETE", "DEACTIVATE", "FAILED"].includes(value)) return "danger";
  if (["UPDATE", "EDIT", "CHECK_OUT"].includes(value)) return "warning";
  return "info";
}

function initials(name: string | null, userId: number | null) {
  if (!name) return userId ? `U${userId}`.slice(0, 2).toUpperCase() : "SY";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function jsonText(value: unknown) {
  if (value === null || value === undefined) return "No data";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function statusValue(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const status = (value as Record<string, unknown>).status;
  return typeof status === "string" ? status : null;
}

export default function AuditLogs() {
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [canView, setCanView] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [, setLastUpdated] = useState<Date | null>(null);

  const loadAccess = useCallback(async () => {
    const id = getSessionUserId();
    if (!id) {
      setError("Your login session is incomplete. Sign out and sign in again.");
      setAccessLoading(false);
      return;
    }
    try {
      const userResponse = await fetch(`${API_URL}/users/${id}`, {
        cache: "no-store",
      });
      const userBody = await userResponse.json().catch(() => null);
      if (!userResponse.ok)
        throw new Error(userBody?.message ?? "Unable to load current user.");
      const user = userBody as CurrentUser;
      if (user.status !== "Active")
        throw new Error("Your user account is inactive.");
      const roleResponse = await fetch(`${API_URL}/roles/${user.roleId}`, {
        cache: "no-store",
      });
      const roleBody = await roleResponse.json().catch(() => null);
      if (!roleResponse.ok)
        throw new Error(roleBody?.message ?? "Unable to load assigned role.");
      const role = roleBody as AssignedRole;
      if (!role.isActive) throw new Error("Your assigned role is inactive.");
      setCurrentUserId(id);
      setCanView(
        role.permissions.some(
          (permission) =>
            permission.module === "Audit Logs" && permission.canView,
        ),
      );
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Unable to load Audit Logs permission.",
      );
    } finally {
      setAccessLoading(false);
    }
  }, []);

  const loadLogs = useCallback(
    async (background = false) => {
      if (!currentUserId || !canView) return;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      background ? setRefreshing(true) : setLoading(true);
      try {
        const response = await fetch(`${API_URL}/audit-logs?limit=500`, {
          headers: {
            Accept: "application/json",
            "X-User-Id": String(currentUserId),
          },
          cache: "no-store",
        });
        const body = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(body?.message ?? "Unable to load audit logs.");
        setRows(
          Array.isArray(body)
            ? body
            : Array.isArray(body?.data)
              ? body.data
              : [],
        );
        setLastUpdated(new Date());
        setError("");
      } catch (value) {
        setError(
          value instanceof Error ? value.message : "Unable to load audit logs.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canView, currentUserId],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAccess();
  }, [loadAccess]);
  useEffect(() => {
    if (accessLoading || !canView) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLogs();
    const timer = window.setInterval(
      () => void loadLogs(true),
      REFRESH_SECONDS * 1000,
    );
    return () => window.clearInterval(timer);
  }, [accessLoading, canView, loadLogs]);

  const modules = useMemo(
    () => ["All", ...Array.from(new Set(rows.map((row) => row.module))).sort()],
    [rows],
  );
  const actions = useMemo(
    () => ["All", ...Array.from(new Set(rows.map((row) => row.action))).sort()],
    [rows],
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        !query ||
        [
          row.userName,
          row.userId,
          row.module,
          row.action,
          row.description,
          row.entityType,
          row.entityId,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(query),
        );
      return (
        matchesSearch &&
        (moduleFilter === "All" || row.module === moduleFilter) &&
        (actionFilter === "All" || row.action === actionFilter)
      );
    });
  }, [actionFilter, moduleFilter, rows, search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [search, moduleFilter, actionFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = filteredRows.slice(start, start + PAGE_SIZE);
  const todayCount = rows.filter(
    (row) =>
      new Date(row.createdAt).toDateString() === new Date().toDateString(),
  ).length;
  const uniqueUsers = new Set(
    rows.map((row) => row.userId ?? row.userName).filter(Boolean),
  ).size;
  const changedCount = rows.filter((row) =>
    ["UPDATE", "EDIT"].includes(row.action.toUpperCase()),
  ).length;

  if (accessLoading)
    return (
      <main className="audit-loading">
        <div className="audit-loading-card">
          <span className="audit-spinner" />
          <p>Loading Audit Logs permissions...</p>
        </div>
      </main>
    );
  if (!canView)
    return (
      <Master>
        <section className="content">
          <div className="audit-denied">
            <div className="audit-denied-icon">!</div>
            <h1>Access denied</h1>
            <p>
              Your assigned role does not have View permission for Audit Logs.
            </p>
            {error && <small>{error}</small>}
          </div>
        </section>
      </Master>
    );

  return (
    <Master>
      <section className="content audit-page">
        <header className="audit-hero">
          <div>
            <div className="eyebrow">Security & Monitoring</div>
            <h1>Audit Logs</h1>
            <p>
              Review system activity, permission changes, and administrative
              actions in real time.
            </p>
          </div>
          <div className="audit-live-control">
            <button
              className="btn audit-refresh"
              type="button"
              disabled={refreshing}
              onClick={() => void loadLogs(true)}
            >
              {refreshing ? "Refreshing..." : "Refresh now"}
            </button>
          </div>
        </header>

        {error && (
          <div className="audit-alert" role="alert">
            <strong>Unable to refresh data</strong>
            <span>{error}</span>
          </div>
        )}

        <div className="audit-stats">
          <article>
            <span className="audit-stat-icon blue">≡</span>
            <div>
              <small>Total events</small>
              <strong>{rows.length}</strong>
            </div>
          </article>
          <article>
            <span className="audit-stat-icon green">●</span>
            <div>
              <small>Events today</small>
              <strong>{todayCount}</strong>
            </div>
          </article>
          <article>
            <span className="audit-stat-icon violet">U</span>
            <div>
              <small>Active users</small>
              <strong>{uniqueUsers}</strong>
            </div>
          </article>
          <article>
            <span className="audit-stat-icon amber">↻</span>
            <div>
              <small>Updates</small>
              <strong>{changedCount}</strong>
            </div>
          </article>
        </div>

        <section className="audit-card">
          <div className="audit-toolbar">
            <div className="audit-search-wrap">
              <span>⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search user, module, action, or description"
                aria-label="Search audit logs"
              />
            </div>
            <select
              value={moduleFilter}
              onChange={(event) => setModuleFilter(event.target.value)}
              aria-label="Filter by module"
            >
              {modules.map((module) => (
                <option key={module}>
                  {module === "All" ? "All modules" : module}
                </option>
              ))}
            </select>
            <select
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              aria-label="Filter by action"
            >
              {actions.map((action) => (
                <option key={action}>
                  {action === "All" ? "All actions" : action}
                </option>
              ))}
            </select>
            {(search || moduleFilter !== "All" || actionFilter !== "All") && (
              <button
                className="audit-clear"
                type="button"
                onClick={() => {
                  setSearch("");
                  setModuleFilter("All");
                  setActionFilter("All");
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="audit-table-header">
            <div>
              <h2>Activity history</h2>
              <p>
                {filteredRows.length} matching{" "}
                {filteredRows.length === 1 ? "event" : "events"}
              </p>
            </div>
          </div>

          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Activity</th>
                  <th>Module</th>
                  <th>Date & time</th>
                  <th aria-label="Open details" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="audit-empty">
                        <span className="audit-spinner" />
                        <strong>Loading activity...</strong>
                      </div>
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="audit-empty">
                        <span className="audit-empty-icon">⌕</span>
                        <strong>No audit records found</strong>
                        <p>
                          Try changing the filters, or perform a system action.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedLog(row)}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") setSelectedLog(row);
                      }}
                    >
                      <td>
                        <div className="audit-user">
                          <span className="audit-avatar">
                            {initials(row.userName, row.userId)}
                          </span>
                          <div>
                            <strong>
                              {row.userName ??
                                (row.userId ? `User #${row.userId}` : "System")}
                            </strong>
                            <small>
                              {row.userId
                                ? `ID ${row.userId}`
                                : "Automated action"}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="audit-activity">
                          <span
                            className={`audit-action ${actionClass(row.action)}`}
                          >
                            {row.action}
                          </span>
                          <p>{row.description}</p>
                        </div>
                      </td>
                      <td>
                        <span className="audit-module">{row.module}</span>
                      </td>
                      <td>
                        <time>{formatDate(row.createdAt)}</time>
                      </td>
                      <td>
                        <button
                          className="audit-open"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedLog(row);
                          }}
                          aria-label={`View audit record ${row.id}`}
                        >
                          ›
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredRows.length > PAGE_SIZE && (
            <footer className="audit-pagination">
              <p>
                Showing {start + 1} to{" "}
                {Math.min(start + PAGE_SIZE, filteredRows.length)} of{" "}
                {filteredRows.length}
              </p>
              <div>
                <button
                  type="button"
                  disabled={safePage === 1}
                  onClick={() => setCurrentPage(safePage - 1)}
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      type="button"
                      className={page === safePage ? "active" : ""}
                      key={page}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  disabled={safePage === totalPages}
                  onClick={() => setCurrentPage(safePage + 1)}
                >
                  Next
                </button>
              </div>
            </footer>
          )}
        </section>

        {selectedLog && (
          <div
            className="audit-modal-backdrop"
            onMouseDown={() => setSelectedLog(null)}
          >
            <section
              className="audit-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="audit-detail-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header>
                <div>
                  <div className="eyebrow">Event #{selectedLog.id}</div>
                  <h2 id="audit-detail-title">Audit event details</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  aria-label="Close"
                >
                  ×
                </button>
              </header>
              <div className="audit-detail-grid">
                <div>
                  <span>Action</span>
                  <strong
                    className={`audit-action ${actionClass(selectedLog.action)}`}
                  >
                    {selectedLog.action}
                  </strong>
                </div>
                <div>
                  <span>Module</span>
                  <strong>{selectedLog.module}</strong>
                </div>
                <div>
                  <span>User</span>
                  <strong>
                    {selectedLog.userName ??
                      (selectedLog.userId
                        ? `User #${selectedLog.userId}`
                        : "System")}
                  </strong>
                </div>
                <div>
                  <span>Date</span>
                  <strong>{formatDate(selectedLog.createdAt)}</strong>
                </div>
                <div>
                  <span>Entity</span>
                  <strong>
                    {selectedLog.entityName ||
                      selectedLog.entityType ||
                      "Not specified"}
                  </strong>
                  {selectedLog.entityUsername && (
                    <small className="audit-entity-username">
                      @{selectedLog.entityUsername}
                    </small>
                  )}
                  {selectedLog.entityId && (
                    <small className="audit-entity-id">
                      {selectedLog.entityType || "Record"} ID:{" "}
                      {selectedLog.entityId}
                    </small>
                  )}
                </div>
                <div>
                  <span>IP address</span>
                  <strong>{selectedLog.ipAddress || "Not recorded"}</strong>
                </div>
              </div>
              <div className="audit-description">
                <span>Description</span>
                <p>{selectedLog.description}</p>
              </div>
              {statusValue(selectedLog.oldValues) &&
              statusValue(selectedLog.newValues) ? (
                <div className="audit-status-change">
                  <span>Status change</span>
                  <div>
                    <strong className="audit-status-old">
                      {statusValue(selectedLog.oldValues)}
                    </strong>
                    <b>→</b>
                    <strong className="audit-status-new">
                      {statusValue(selectedLog.newValues)}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="audit-values">
                  <div>
                    <span>Previous values</span>
                    <pre>{jsonText(selectedLog.oldValues)}</pre>
                  </div>
                  <div>
                    <span>New values</span>
                    <pre>{jsonText(selectedLog.newValues)}</pre>
                  </div>
                </div>
              )}
              <footer>
                <button
                  className="btn"
                  type="button"
                  onClick={() => setSelectedLog(null)}
                >
                  Close
                </button>
              </footer>
            </section>
          </div>
        )}
      </section>
    </Master>
  );
}
