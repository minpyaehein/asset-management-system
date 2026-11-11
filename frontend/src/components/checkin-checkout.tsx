"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Master from "./master";

type Permission = {
  module: string;
  access: "Own Only" | "Assigned" | "All";
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDeactivate: boolean;
  canExport: boolean;
};
type AssetOption = {
  id: number;
  assetTag: string;
  brand: string | null;
  model: string | null;
  status: string;
};
type EmployeeOption = {
  id: number;
  staffCode: string;
  fullName: string;
  status: string;
};
type Allocation = {
  id: number;
  assetId: number;
  employeeId: number;
  assetTag: string;
  employeeName: string;
  employeeStaffCode: string;
  issuedAt: string;
  returnedAt: string | null;
  checkoutNotes: string | null;
  returnNotes: string | null;
  createdByUserId: number | null;
};
type AccessResponse = {
  userId: number;
  roleName: string;
  permission: Permission;
};
type FormState = { assetId: string; employeeId: string; notes: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const PAGE_SIZE = 10;
const emptyForm = (): FormState => ({ assetId: "", employeeId: "", notes: "" });
function getSessionUserId() {
  const value = Number(
    sessionStorage.getItem("assetManagementUserId") ??
      sessionStorage.getItem("stockwiseUserId") ??
      "0",
  );
  return Number.isFinite(value) && value > 0 ? value : null;
}

export default function CheckinCheckout() {
  const [userId, setUserId] = useState<number | null>(null);
  const [permission, setPermission] = useState<Permission | null>(null);
  const [rows, setRows] = useState<Allocation[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [accessLoading, setAccessLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingInId, setCheckingInId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const canView = permission?.canView === true,
    canCheckOut = permission?.canAdd === true,
    canCheckIn = permission?.canEdit === true,
    canExport = permission?.canExport === true;
  const headers = useMemo<Record<string, string>>(
    () => ({
      Accept: "application/json",
      ...(userId ? { "X-User-Id": String(userId) } : {}),
    }),
    [userId],
  );

  const loadAccess = useCallback(async () => {
    setAccessLoading(true);
    setError("");
    const id = getSessionUserId();
    if (!id) {
      setUserId(null);
      setPermission(null);
      setError("Your login session is incomplete. Sign out and sign in again.");
      setAccessLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_URL}/checkin-checkout/access`, {
        headers: { Accept: "application/json", "X-User-Id": String(id) },
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(body?.message ?? "Unable to load role access.");
      const access = body as AccessResponse;
      setUserId(access.userId);
      setPermission(access.permission);
    } catch (value) {
      setPermission(null);
      setError(
        value instanceof Error ? value.message : "Unable to load role access.",
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
      const [recordsResponse, assetsResponse, employeesResponse] =
        await Promise.all([
          fetch(`${API_URL}/checkin-checkout`, { headers, cache: "no-store" }),
          fetch(`${API_URL}/checkin-checkout/options/assets`, {
            headers,
            cache: "no-store",
          }),
          fetch(`${API_URL}/checkin-checkout/options/employees`, {
            headers,
            cache: "no-store",
          }),
        ]);
      const [recordsBody, assetsBody, employeesBody] = await Promise.all([
        recordsResponse.json().catch(() => null),
        assetsResponse.json().catch(() => null),
        employeesResponse.json().catch(() => null),
      ]);
      if (!recordsResponse.ok)
        throw new Error(
          recordsBody?.message ?? "Unable to load allocation history.",
        );
      if (!assetsResponse.ok)
        throw new Error(
          assetsBody?.message ?? "Unable to load available assets.",
        );
      if (!employeesResponse.ok)
        throw new Error(
          employeesBody?.message ?? "Unable to load active employees.",
        );
      const records = Array.isArray(recordsBody)
        ? (recordsBody as Allocation[])
        : [];
      setRows(records);
      setAssets(Array.isArray(assetsBody) ? assetsBody : []);
      setEmployees(Array.isArray(employeesBody) ? employeesBody : []);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Unable to load check-in/check-out data.",
      );
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
    if (!accessLoading && canView) void loadData();
  }, [accessLoading, canView, loadData]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const open = !row.returnedAt;
      const matchesText =
        !term ||
        [
          row.assetTag,
          row.employeeName,
          row.employeeStaffCode,
          row.checkoutNotes ?? "",
          row.returnNotes ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);
      const matchesStatus = !filter || (filter === "out" ? open : !open);
      return matchesText && matchesStatus;
    });
  }, [filter, rows, search]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setCurrentPage(1), [search, filter]);
  const checkedOutCount = rows.filter((row) => !row.returnedAt).length;
  const returnedCount = rows.length - checkedOutCount;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageRows = filteredRows.slice(pageStart, pageStart + PAGE_SIZE);

  async function checkOut(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCheckOut)
      return setError("Your role does not have Check Out permission.");
    if (!form.assetId || !form.employeeId)
      return setError("Asset and employee are required.");
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${API_URL}/checkin-checkout/checkout`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: Number(form.assetId),
          employeeId: Number(form.employeeId),
          notes: form.notes.trim() || null,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          Array.isArray(body?.message)
            ? body.message.join(", ")
            : (body?.message ?? "Unable to check out the asset."),
        );
      setForm(emptyForm());
      setSuccess("Asset checked out successfully.");
      await loadData();
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Unable to check out the asset.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function checkIn(row: Allocation) {
    if (!canCheckIn)
      return setError("Your role does not have Check In permission.");
    const notes = window.prompt("Return notes (optional):", "");
    if (notes === null) return;
    if (!window.confirm(`Check in asset "${row.assetTag}"?`)) return;
    setCheckingInId(row.id);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(
        `${API_URL}/checkin-checkout/${row.id}/checkin`,
        {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ notes: notes.trim() || null }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(body?.message ?? "Unable to check in the asset.");
      setSuccess("Asset checked in successfully.");
      await loadData();
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Unable to check in the asset.",
      );
    } finally {
      setCheckingInId(null);
    }
  }

  function exportCsv() {
    const lines = [
      [
        "Asset Tag",
        "Employee Code",
        "Employee",
        "Issued At",
        "Returned At",
        "Checkout Notes",
        "Return Notes",
        "Status",
      ],
      ...filteredRows.map((row) => [
        row.assetTag,
        row.employeeStaffCode,
        row.employeeName,
        new Date(row.issuedAt).toLocaleString(),
        row.returnedAt ? new Date(row.returnedAt).toLocaleString() : "",
        row.checkoutNotes ?? "",
        row.returnNotes ?? "",
        row.returnedAt ? "Returned" : "Checked Out",
      ]),
    ];
    const csv = lines
      .map((line) =>
        line
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "checkin-checkout.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (accessLoading)
    return (
      <main className="session-loading">
        <div className="session-loading-card">
          <span className="session-loading-spinner" />
          <p>Loading role permissions...</p>
        </div>
      </main>
    );
  if (!canView)
    return (
      <Master>
        <section className="content">
          <div className="allocation-permission-denied">
            <h1>Access denied</h1>
            <p>
              Your assigned role does not have View permission for Check-in /
              Check-out.
            </p>
            {error && <p>{error}</p>}
          </div>
        </section>
      </Master>
    );

  return (
    <Master>
      <section className="content allocation-page">
        <header className="allocation-hero">
          <div>
            <div className="eyebrow">Asset allocation</div>
            <h1>Check-in / Check-out</h1>
            <p>
              Issue hardware to employees and maintain a complete return
              history.
            </p>
          </div>
          {canExport && (
            <button className="btn" onClick={exportCsv}>
              Export CSV
            </button>
          )}
        </header>
        {error && <div className="allocation-message error">{error}</div>}
        {success && <div className="allocation-message success">{success}</div>}
        <div className="allocation-stats">
          <article>
            <span>Total Records</span>
            <strong>{rows.length}</strong>
          </article>
          <article>
            <span>Checked Out</span>
            <strong>{checkedOutCount}</strong>
          </article>
          <article>
            <span>Returned</span>
            <strong>{returnedCount}</strong>
          </article>
          <article>
            <span>Available Assets</span>
            <strong>{assets.length}</strong>
          </article>
        </div>
        {canCheckOut && (
          <section className="panel">
            <div className="panel-head">
              <h2>Check Out Hardware</h2>
              <p>Only available assets and active employees are listed.</p>
            </div>
            <div className="panel-body">
              <form onSubmit={checkOut}>
                <div className="allocation-form-grid">
                  <label>
                    Asset
                    <select
                      value={form.assetId}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          assetId: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Select asset</option>
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.assetTag} ·{" "}
                          {[asset.brand, asset.model]
                            .filter(Boolean)
                            .join(" ") || "Asset"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Employee
                    <select
                      value={form.employeeId}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          employeeId: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Select employee</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.staffCode} · {employee.fullName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Notes
                    <input
                      value={form.notes}
                      maxLength={500}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="form-footer">
                  <button
                    className="btn primary"
                    disabled={saving || !assets.length || !employees.length}
                  >
                    {saving ? "Checking out..." : "Check Out Asset"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}
        <section className="panel">
          <div className="allocation-toolbar">
            <div>
              <h2>Allocation History</h2>
              <p>{filteredRows.length} matching records</p>
            </div>
            <div>
              <input
                placeholder="Search asset, employee, or notes"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="">All statuses</option>
                <option value="out">Checked Out</option>
                <option value="in">Returned</option>
              </select>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Employee</th>
                  <th>Issued At</th>
                  <th>Returned At</th>
                  <th>Notes</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="empty-table">
                      Loading records...
                    </td>
                  </tr>
                ) : !pageRows.length ? (
                  <tr>
                    <td colSpan={7} className="empty-table">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.assetTag}</strong>
                      </td>
                      <td>
                        {row.employeeStaffCode} · {row.employeeName}
                      </td>
                      <td>{new Date(row.issuedAt).toLocaleString()}</td>
                      <td>
                        {row.returnedAt
                          ? new Date(row.returnedAt).toLocaleString()
                          : "—"}
                      </td>
                      <td>
                        {[
                          row.checkoutNotes,
                          row.returnNotes ? `Return: ${row.returnNotes}` : "",
                        ]
                          .filter(Boolean)
                          .join(" | ") || "—"}
                      </td>
                      <td>
                        <span
                          className={
                            row.returnedAt
                              ? "allocation-status returned"
                              : "allocation-status checked-out"
                          }
                        >
                          {row.returnedAt ? "Returned" : "Checked Out"}
                        </span>
                      </td>
                      <td>
                        {!row.returnedAt && canCheckIn && (
                          <button
                            className="mini-btn"
                            disabled={checkingInId === row.id}
                            onClick={() => void checkIn(row)}
                          >
                            {checkingInId === row.id
                              ? "Checking in..."
                              : "Check In"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filteredRows.length > PAGE_SIZE && (
            <footer className="allocation-pagination">
              <p>
                Showing {pageStart + 1} to{" "}
                {Math.min(pageStart + PAGE_SIZE, filteredRows.length)} of{" "}
                {filteredRows.length}
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
                      page === safePage ? "page-number active" : "page-number"
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
