"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Master from "./master";

type Status = "Pending" | "Acknowledged" | "Declined";
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
  status: string;
};

type EmployeeOption = {
  id: number;
  fullName: string;
  status: string;
};

type RecordItem = {
  id: number;
  reference: string;
  assetTag: string | null;
  employeeId: number | null;
  employeeName: string | null;
  issuedDate: string | null;
  status: Status;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  reference: string;
  assetTag: string;
  employeeId: string;
  employeeName: string;
  issuedDate: string;
  status: Status;
  notes: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const PAGE_SIZE = 10;

const emptyForm = (): FormState => ({
  reference: "",
  assetTag: "",
  employeeId: "",
  employeeName: "",
  issuedDate: "",
  status: "Pending",
  notes: "",
});

function sessionUserId() {
  const value = Number(
    sessionStorage.getItem("assetManagementUserId") ??
      sessionStorage.getItem("stockwiseUserId") ??
      "0",
  );
  return Number.isFinite(value) && value > 0 ? value : null;
}

export default function Acknowledgement() {
  const [userId, setUserId] = useState<number | null>(null);
  const [permission, setPermission] = useState<Permission | null>(null);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewing, setViewing] = useState<RecordItem | null>(null);
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
    const id = sessionUserId();

    if (!id) {
      setError("Your session is incomplete. Sign in again.");
      setAccessLoading(false);
      return;
    }

    try {
      const userResponse = await fetch(`${API_URL}/users/${id}`, {
        cache: "no-store",
      });
      const userBody = await userResponse.json().catch(() => null);
      if (!userResponse.ok) {
        throw new Error(
          userBody?.message ?? "Unable to load the user account.",
        );
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
        throw new Error(
          roleBody?.message ?? "Unable to load the assigned role.",
        );
      }

      const role = roleBody as Role;
      if (!role.isActive) {
        throw new Error("Your assigned role is inactive.");
      }

      setUserId(id);
      setPermission(
        role.permissions.find((item) => item.module === "Acknowledgement") ??
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

      const [recordsResponse, assetsResponse, employeesResponse] =
        await Promise.all([
          fetch(`${API_URL}/acknowledgements`, {
            headers,
            cache: "no-store",
          }),
          fetch(`${API_URL}/assets`, { headers, cache: "no-store" }),
          fetch(`${API_URL}/employees`, { headers, cache: "no-store" }),
        ]);

      const [recordBody, assetBody, employeeBody] = await Promise.all([
        recordsResponse.json().catch(() => null),
        assetsResponse.json().catch(() => []),
        employeesResponse.json().catch(() => []),
      ]);

      if (!recordsResponse.ok) {
        throw new Error(
          recordBody?.message ?? "Unable to load acknowledgements.",
        );
      }

      setRecords(Array.isArray(recordBody) ? recordBody : []);
      setAssets(Array.isArray(assetBody) ? assetBody : []);
      setEmployees(
        Array.isArray(employeeBody)
          ? employeeBody.filter(
              (employee: EmployeeOption) => employee.status === "Active",
            )
          : [],
      );
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
      const haystack = [
        item.reference,
        item.assetTag,
        item.employeeName,
        item.status,
        item.notes,
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!query || haystack.includes(query)) &&
        (!filter || item.status === filter)
      );
    });
  }, [filter, records, search]);

  const statistics = {
    total: records.length,
    pending: records.filter((item) => item.status === "Pending").length,
    acknowledged: records.filter((item) => item.status === "Acknowledged")
      .length,
    declined: records.filter((item) => item.status === "Declined").length,
  };

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageRows = visible.slice(pageStart, pageStart + PAGE_SIZE);

  function openCreate() {
    if (!canAdd) return setError("Add permission is required.");
    setForm(emptyForm());
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(item: RecordItem) {
    if (!canEdit || !item.isActive) return;

    setForm({
      reference: item.reference,
      assetTag: item.assetTag ?? "",
      employeeId: item.employeeId ? String(item.employeeId) : "",
      employeeName: item.employeeName ?? "",
      issuedDate: item.issuedDate?.slice(0, 10) ?? "",
      status: item.status,
      notes: item.notes ?? "",
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
    if (!form.reference.trim()) {
      setError("Reference is required.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    const creating = editingId === null;

    try {
      const response = await fetch(
        creating
          ? `${API_URL}/acknowledgements`
          : `${API_URL}/acknowledgements/${editingId}`,
        {
          method: creating ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-User-Id": String(userId),
          },
          body: JSON.stringify({
            reference: form.reference.trim(),
            assetTag: form.assetTag || null,
            employeeId: form.employeeId ? Number(form.employeeId) : null,
            employeeName: form.employeeName || null,
            issuedDate: form.issuedDate || null,
            status: form.status,
            notes: form.notes.trim() || null,
          }),
        },
      );

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          Array.isArray(body?.message)
            ? body.message.join(", ")
            : (body?.message ?? "Unable to save acknowledgement."),
        );
      }

      setSuccess(
        creating
          ? "Acknowledgement created successfully."
          : "Acknowledgement updated successfully.",
      );
      closeForm();
      await loadData();
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Unable to save acknowledgement.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: RecordItem) {
    if (!userId || !canDeactivate) return;
    const next = !item.isActive;

    if (
      !window.confirm(
        `${next ? "Activate" : "Deactivate"} acknowledgement "${item.reference}"?`,
      )
    ) {
      return;
    }

    setUpdatingId(item.id);

    try {
      const response = await fetch(
        `${API_URL}/acknowledgements/${item.id}/active`,
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
        throw new Error(
          body?.message ?? "Unable to update acknowledgement status.",
        );
      }

      setSuccess(
        `Acknowledgement ${next ? "activated" : "deactivated"} successfully.`,
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

    const rows = [
      ["Reference", "Asset Tag", "Employee", "Issued Date", "Status", "Notes"],
      ...visible.map((item) => [
        item.reference,
        item.assetTag ?? "",
        item.employeeName ?? "",
        item.issuedDate ?? "",
        item.status,
        item.notes ?? "",
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
    link.download = "acknowledgements.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (accessLoading) {
    return (
      <main className="session-loading">
        <div className="session-loading-card">
          <span className="session-loading-spinner" />
          <p>Loading acknowledgement permissions...</p>
        </div>
      </main>
    );
  }

  if (!canView) {
    return (
      <Master>
        <section className="content">
          <div className="ack-denied">
            <h1>Access denied</h1>
            <p>
              Your assigned role does not have View permission for
              Acknowledgement.
            </p>
            {error && <p>{error}</p>}
          </div>
        </section>
      </Master>
    );
  }

  return (
    <Master>
      <section className="content acknowledgement-page">
        <header className="ack-hero">
          <div>
            <div className="eyebrow">Asset assignment</div>
            <h1>Acknowledgement</h1>
            <p>Confirm that assigned equipment has been received.</p>
          </div>
          <div className="button-row">
            {canExport && (
              <button className="btn" type="button" onClick={exportCsv}>
                Export CSV
              </button>
            )}
            {canAdd && !formOpen && (
              <button
                className="btn primary"
                type="button"
                onClick={openCreate}
              >
                Add Acknowledgement
              </button>
            )}
          </div>
        </header>

        {error && <div className="ack-message error">{error}</div>}
        {success && <div className="ack-message success">{success}</div>}

        <div className="ack-stats">
          <article>
            <span>Total</span>
            <strong>{statistics.total}</strong>
          </article>
          <article>
            <span>Pending</span>
            <strong>{statistics.pending}</strong>
          </article>
          <article>
            <span>Acknowledged</span>
            <strong>{statistics.acknowledged}</strong>
          </article>
          <article>
            <span>Declined</span>
            <strong>{statistics.declined}</strong>
          </article>
        </div>

        {viewing && (
          <div
            className="ack-modal-backdrop"
            onMouseDown={() => setViewing(null)}
          >
            <section
              className="ack-modal"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header>
                <div>
                  <div className="eyebrow">Acknowledgement Detail</div>
                  <h2>{viewing.reference}</h2>
                  <p>{viewing.assetTag || "No asset selected"}</p>
                </div>
                <button onClick={() => setViewing(null)}>×</button>
              </header>
              <div className="ack-detail-grid">
                {[
                  ["Employee", viewing.employeeName || "Not provided"],
                  ["Issued Date", viewing.issuedDate || "Not provided"],
                  ["Status", viewing.status],
                  ["Record", viewing.isActive ? "Active" : "Inactive"],
                  ["Created", new Date(viewing.createdAt).toLocaleString()],
                  ["Updated", new Date(viewing.updatedAt).toLocaleString()],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
                <div className="wide">
                  <span>Notes</span>
                  <strong>{viewing.notes || "No notes"}</strong>
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
                    Edit Acknowledgement
                  </button>
                )}
              </footer>
            </section>
          </div>
        )}

        {formOpen && (
          <section className="panel">
            <div className="panel-head ack-editor-head">
              <div>
                <h2>
                  {editingId === null
                    ? "Add New Acknowledgement"
                    : "Edit Acknowledgement"}
                </h2>
                <p>Enter asset receipt and acknowledgement details.</p>
              </div>
              <button onClick={closeForm}>×</button>
            </div>
            <div className="panel-body">
              <form onSubmit={save}>
                <div className="ack-form-grid">
                  <label>
                    Reference
                    <input
                      value={form.reference}
                      maxLength={100}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          reference: event.target.value,
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
                    Employee
                    <select
                      value={form.employeeId}
                      onChange={(event) => {
                        const employee = employees.find(
                          (item) => String(item.id) === event.target.value,
                        );
                        setForm((current) => ({
                          ...current,
                          employeeId: event.target.value,
                          employeeName: employee?.fullName ?? "",
                        }));
                      }}
                    >
                      <option value="">Select employee</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.fullName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Issued Date
                    <input
                      type="date"
                      value={form.issuedDate}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          issuedDate: event.target.value,
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
                      <option>Pending</option>
                      <option>Acknowledged</option>
                      <option>Declined</option>
                    </select>
                  </label>
                  <label className="wide">
                    Notes
                    <textarea
                      rows={4}
                      maxLength={1000}
                      value={form.notes}
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
                  <button className="btn" type="button" onClick={closeForm}>
                    Cancel
                  </button>
                  <button className="btn primary" disabled={saving}>
                    {saving
                      ? "Saving..."
                      : editingId === null
                        ? "Create Acknowledgement"
                        : "Update Acknowledgement"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        <section className="panel">
          <div className="ack-toolbar">
            <div>
              <h2>Acknowledgement Records</h2>
              <p>{visible.length} matching records</p>
            </div>
            <div>
              <input
                placeholder="Search acknowledgements"
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
                <option>Pending</option>
                <option>Acknowledged</option>
                <option>Declined</option>
              </select>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Asset Tag</th>
                  <th>Employee</th>
                  <th>Issued Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="empty-table">
                      Loading acknowledgements...
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-table">
                      No acknowledgements found.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((item) => (
                    <tr
                      key={item.id}
                      className={item.isActive ? "" : "ack-inactive"}
                    >
                      <td>
                        <strong>{item.reference}</strong>
                      </td>
                      <td>{item.assetTag || "—"}</td>
                      <td>{item.employeeName || "—"}</td>
                      <td>{item.issuedDate || "—"}</td>
                      <td>
                        <span
                          className={`ack-badge ${item.status.toLowerCase()}`}
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
            <footer className="ack-pagination">
              <p>
                Showing {pageStart + 1} to{" "}
                {Math.min(pageStart + PAGE_SIZE, visible.length)} of{" "}
                {visible.length}
              </p>
              <div>
                <button
                  className="btn"
                  disabled={safePage === 1}
                  onClick={() => setPage(safePage - 1)}
                >
                  Previous
                </button>
                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1,
                ).map((number) => (
                  <button
                    className={
                      number === safePage
                        ? "ack-page-number active"
                        : "ack-page-number"
                    }
                    key={number}
                    onClick={() => setPage(number)}
                  >
                    {number}
                  </button>
                ))}
                <button
                  className="btn"
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
