"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Master from "./master";

type EmployeeStatus = "Active" | "Inactive";
type Permission = {
  module: string;
  access: "Own Only" | "Assigned" | "All";
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDeactivate: boolean;
  canExport: boolean;
};
type Employee = {
  id: number;
  staffCode: string;
  fullName: string;
  department: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  location: string | null;
  status: EmployeeStatus;
  createdAt: string;
  updatedAt: string;
};
type EmployeeForm = {
  staffCode: string;
  fullName: string;
  department: string;
  email: string;
  phone: string;
  jobTitle: string;
  location: string;
  status: EmployeeStatus;
};
type UserResponse = { id: number; roleId: number; status: EmployeeStatus };
type RoleResponse = {
  id: number;
  name: string;
  isActive: boolean;
  permissions: Permission[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const PAGE_SIZE = 10;

function emptyForm(): EmployeeForm {
  return {
    staffCode: "",
    fullName: "",
    department: "",
    email: "",
    phone: "",
    jobTitle: "",
    location: "",
    status: "Active",
  };
}

function sessionUserId() {
  const value = Number(
    sessionStorage.getItem("assetManagementUserId") ??
      sessionStorage.getItem("stockwiseUserId") ??
      "0",
  );
  return Number.isFinite(value) && value > 0 ? value : null;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function Employees() {
  const [userId, setUserId] = useState<number | null>(null);
  const [permission, setPermission] = useState<Permission | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canView = permission?.canView === true;
  const canAdd = permission?.canAdd === true;
  const canEdit = permission?.canEdit === true;
  const canDeactivate = permission?.canDeactivate === true;
  const canExport = permission?.canExport === true;

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
        role.permissions.find((item) => item.module === "Employees") ?? null,
      );
    } catch (value) {
      setPermission(null);
      setError(
        value instanceof Error
          ? value.message
          : "Unable to load employee access.",
      );
    } finally {
      setAccessLoading(false);
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    if (!userId || !canView) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/employees`, {
        headers: headers(),
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const message = Array.isArray(body?.message)
          ? body.message.join(", ")
          : body?.message;
        throw new Error(message || "Unable to load employees.");
      }

      const loaded = Array.isArray(body) ? (body as Employee[]) : [];
      setEmployees(loaded);
      setCurrentPage((page) =>
        Math.min(page, Math.max(1, Math.ceil(loaded.length / PAGE_SIZE))),
      );
    } catch (value) {
      setEmployees([]);
      setError(
        value instanceof Error ? value.message : "Unable to load employees.",
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
    if (!accessLoading && canView) void loadEmployees();
  }, [accessLoading, canView, loadEmployees]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [search, departmentFilter, statusFilter]);

  const departments = useMemo(
    () =>
      [
        "All",
        ...Array.from(
          new Set(
            employees.map((employee) => employee.department).filter(Boolean),
          ),
        ).sort(),
      ] as string[],
    [employees],
  );

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesSearch =
        !query ||
        [
          employee.staffCode,
          employee.fullName,
          employee.department,
          employee.email,
          employee.phone,
          employee.jobTitle,
          employee.location,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(query),
        );
      const matchesDepartment =
        departmentFilter === "All" || employee.department === departmentFilter;
      const matchesStatus =
        statusFilter === "All" || employee.status === statusFilter;

      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [departmentFilter, employees, search, statusFilter]);

  const activeCount = employees.filter(
    (employee) => employee.status === "Active",
  ).length;
  const inactiveCount = employees.length - activeCount;
  const departmentCount = new Set(
    employees.map((employee) => employee.department).filter(Boolean),
  ).size;

  function openCreate() {
    if (!canAdd) {
      setError(
        "Your assigned role does not have Add permission for Employees.",
      );
      return;
    }
    setForm(emptyForm());
    setEditingId(null);
    setFormOpen(true);
    setError("");
    setSuccess("");
  }

  function closeForm() {
    setForm(emptyForm());
    setEditingId(null);
    setFormOpen(false);
  }

  function openEdit(employee: Employee) {
    if (!canEdit) {
      setError(
        "Your assigned role does not have Edit permission for Employees.",
      );
      return;
    }

    setForm({
      staffCode: employee.staffCode,
      fullName: employee.fullName,
      department: employee.department ?? "",
      email: employee.email ?? "",
      phone: employee.phone ?? "",
      jobTitle: employee.jobTitle ?? "",
      location: employee.location ?? "",
      status: employee.status,
    });
    setEditingId(employee.id);
    setViewingEmployee(null);
    setFormOpen(true);
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const creating = editingId === null;

    if (creating && !canAdd) return setError("Add permission is required.");
    if (!creating && !canEdit) return setError("Edit permission is required.");
    if (!form.staffCode.trim() || !form.fullName.trim()) {
      return setError("Staff code and full name are required.");
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        creating ? `${API_URL}/employees` : `${API_URL}/employees/${editingId}`,
        {
          method: creating ? "POST" : "PATCH",
          headers: headers(true),
          body: JSON.stringify({
            staffCode: form.staffCode.trim(),
            fullName: form.fullName.trim(),
            department: form.department.trim() || null,
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            jobTitle: form.jobTitle.trim() || null,
            location: form.location.trim() || null,
            status: form.status,
          }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          (Array.isArray(body?.message)
            ? body.message.join(", ")
            : body?.message) || "Unable to save employee.",
        );
      }

      setSuccess(
        creating
          ? "Employee created successfully."
          : "Employee updated successfully.",
      );
      closeForm();
      await loadEmployees();
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Unable to save employee.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeEmployeeStatus(employee: Employee) {
    if (!canDeactivate) {
      setError(
        "Your assigned role does not have Deactivate permission for Employees.",
      );
      return;
    }

    const status: EmployeeStatus =
      employee.status === "Active" ? "Inactive" : "Active";
    const action = status === "Active" ? "activate" : "deactivate";

    if (
      !window.confirm(
        `Are you sure you want to ${action} employee "${employee.fullName}"?`,
      )
    ) {
      return;
    }

    setUpdatingStatusId(employee.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/employees/${employee.id}/status`,
        {
          method: "PATCH",
          headers: headers(true),
          body: JSON.stringify({ status }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message ?? `Unable to ${action} employee.`);
      }

      setSuccess(
        status === "Active"
          ? "Employee activated successfully."
          : "Employee deactivated successfully.",
      );
      setViewingEmployee(null);
      await loadEmployees();
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : `Unable to ${action} employee.`,
      );
    } finally {
      setUpdatingStatusId(null);
    }
  }

  function exportCsv() {
    if (!canExport) {
      setError(
        "Your assigned role does not have Export permission for Employees.",
      );
      return;
    }

    const rows = [
      [
        "Staff Code",
        "Full Name",
        "Department",
        "Job Title",
        "Email",
        "Phone",
        "Location",
        "Status",
      ],
      ...filteredEmployees.map((employee) => [
        employee.staffCode,
        employee.fullName,
        employee.department ?? "",
        employee.jobTitle ?? "",
        employee.email ?? "",
        employee.phone ?? "",
        employee.location ?? "",
        employee.status,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "employees.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEmployees.length / PAGE_SIZE),
  );
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paginatedEmployees = filteredEmployees.slice(
    pageStart,
    pageStart + PAGE_SIZE,
  );
  const firstVisibleRecord = filteredEmployees.length ? pageStart + 1 : 0;
  const lastVisibleRecord = Math.min(
    pageStart + PAGE_SIZE,
    filteredEmployees.length,
  );

  if (accessLoading) {
    return (
      <main className="session-loading">
        <div className="session-loading-card">
          <span className="session-loading-spinner" />
          <p>Loading employee permissions...</p>
        </div>
      </main>
    );
  }

  if (!canView) {
    return (
      <Master>
        <section className="content">
          <div className="employee-permission-denied">
            <h1>Access denied</h1>
            <p>
              Your assigned role does not have View permission for Employees.
            </p>
            {error && <p>{error}</p>}
          </div>
        </section>
      </Master>
    );
  }

  return (
    <Master>
      <section className="content employees-page">
        <header className="employee-hero">
          <div>
            <div className="eyebrow">Inventory</div>
            <h1>Employees</h1>
            <p>
              Manage employee records, contact details, and employment status.
            </p>
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
                Add New Employee
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="employee-message employee-error">{error}</div>
        )}
        {success && (
          <div className="employee-message employee-success">{success}</div>
        )}

        <div className="employee-stats">
          <article>
            <span>Total Employees</span>
            <strong>{employees.length}</strong>
          </article>
          <article>
            <span>Active</span>
            <strong>{activeCount}</strong>
          </article>
          <article>
            <span>Inactive</span>
            <strong>{inactiveCount}</strong>
          </article>
          <article>
            <span>Departments</span>
            <strong>{departmentCount}</strong>
          </article>
        </div>

        {viewingEmployee && (
          <div
            className="employee-detail-backdrop"
            onMouseDown={() => setViewingEmployee(null)}
          >
            <section
              className="employee-detail-dialog"
              role="dialog"
              aria-modal="true"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="employee-detail-header">
                <div className="employee-detail-identity">
                  <span>{initials(viewingEmployee.fullName)}</span>
                  <div>
                    <div className="eyebrow">Employee Detail</div>
                    <h2>{viewingEmployee.fullName}</h2>
                    <p>{viewingEmployee.staffCode}</p>
                  </div>
                </div>
                <button
                  className="employee-close"
                  type="button"
                  onClick={() => setViewingEmployee(null)}
                >
                  ×
                </button>
              </div>
              <div className="employee-detail-grid">
                <div>
                  <span>Staff Code</span>
                  <strong>{viewingEmployee.staffCode}</strong>
                </div>
                <div>
                  <span>Full Name</span>
                  <strong>{viewingEmployee.fullName}</strong>
                </div>
                <div>
                  <span>Department</span>
                  <strong>
                    {viewingEmployee.department || "Not provided"}
                  </strong>
                </div>
                <div>
                  <span>Job Title</span>
                  <strong>{viewingEmployee.jobTitle || "Not provided"}</strong>
                </div>
                <div>
                  <span>Email</span>
                  <strong>{viewingEmployee.email || "Not provided"}</strong>
                </div>
                <div>
                  <span>Phone</span>
                  <strong>{viewingEmployee.phone || "Not provided"}</strong>
                </div>
                <div>
                  <span>Location</span>
                  <strong>{viewingEmployee.location || "Not provided"}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong
                    className={`employee-status ${viewingEmployee.status.toLowerCase()}`}
                  >
                    {viewingEmployee.status}
                  </strong>
                </div>
              </div>
              <div className="employee-detail-footer">
                <button
                  className="btn"
                  type="button"
                  onClick={() => setViewingEmployee(null)}
                >
                  Close
                </button>
                {canEdit && (
                  <button
                    className="btn primary"
                    type="button"
                    disabled={viewingEmployee.status !== "Active"}
                    onClick={() => openEdit(viewingEmployee)}
                  >
                    Edit Employee
                  </button>
                )}
              </div>
            </section>
          </div>
        )}

        {formOpen && (
          <section className="panel employee-editor">
            <div className="panel-head employee-heading">
              <div>
                <h2>
                  {editingId === null ? "Add New Employee" : "Edit Employee"}
                </h2>
                <p>Enter employment and contact information.</p>
              </div>
              <button
                className="employee-close"
                type="button"
                onClick={closeForm}
              >
                ×
              </button>
            </div>
            <div className="panel-body">
              <form onSubmit={saveEmployee}>
                <div className="employee-form-grid">
                  {(
                    [
                      ["staffCode", "Staff Code"],
                      ["fullName", "Full Name"],
                      ["department", "Department"],
                      ["jobTitle", "Job Title"],
                      ["email", "Email"],
                      ["phone", "Phone"],
                      ["location", "Location"],
                    ] as const
                  ).map(([key, label]) => (
                    <div className="employee-field" key={key}>
                      <label htmlFor={`employee-${key}`}>{label}</label>
                      <input
                        id={`employee-${key}`}
                        type={key === "email" ? "email" : "text"}
                        value={form[key]}
                        maxLength={
                          key === "staffCode" ? 50 : key === "email" ? 180 : 150
                        }
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                        required={key === "staffCode" || key === "fullName"}
                      />
                    </div>
                  ))}
                  <div className="employee-field">
                    <label htmlFor="employee-status">Status</label>
                    <select
                      id="employee-status"
                      value={form.status}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          status: event.target.value as EmployeeStatus,
                        }))
                      }
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="form-footer">
                  <button
                    className="btn"
                    type="button"
                    onClick={closeForm}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn primary"
                    type="submit"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : editingId === null
                        ? "Create Employee"
                        : "Update Employee"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        <section className="panel employee-records">
          <div className="employee-toolbar">
            <div>
              <h2>Employee Records</h2>
              <p>{filteredEmployees.length} matching employees</p>
            </div>
            <div className="employee-filter-tools">
              <input
                aria-label="Search employees"
                placeholder="Search staff, name, email, title, or location"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                aria-label="Filter by department"
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
              >
                {departments.map((department) => (
                  <option key={department}>
                    {department === "All" ? "All departments" : department}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="All">All statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Job Title</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="empty-table">
                      Loading employees...
                    </td>
                  </tr>
                ) : !paginatedEmployees.length ? (
                  <tr>
                    <td colSpan={6} className="empty-table">
                      No employees found.
                    </td>
                  </tr>
                ) : (
                  paginatedEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      className={
                        employee.status === "Inactive"
                          ? "employee-inactive-row"
                          : ""
                      }
                    >
                      <td>
                        <div className="employee-identity">
                          <span>{initials(employee.fullName)}</span>
                          <div>
                            <strong>{employee.fullName}</strong>
                            <small>{employee.staffCode}</small>
                          </div>
                        </div>
                      </td>
                      <td>{employee.department || "—"}</td>
                      <td>{employee.jobTitle || "—"}</td>
                      <td>{employee.email || "—"}</td>
                      <td>
                        <span
                          className={`employee-status ${employee.status.toLowerCase()}`}
                        >
                          {employee.status}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="mini-btn view"
                            type="button"
                            onClick={() => setViewingEmployee(employee)}
                          >
                            View
                          </button>
                          {canEdit && (
                            <button
                              className="mini-btn"
                              type="button"
                              disabled={employee.status !== "Active"}
                              onClick={() => openEdit(employee)}
                            >
                              Edit
                            </button>
                          )}
                          {canDeactivate && (
                            <button
                              className={
                                employee.status === "Active"
                                  ? "mini-btn deactivate"
                                  : "mini-btn activate"
                              }
                              type="button"
                              disabled={updatingStatusId === employee.id}
                              onClick={() =>
                                void changeEmployeeStatus(employee)
                              }
                            >
                              {updatingStatusId === employee.id
                                ? "Updating..."
                                : employee.status === "Active"
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
          {filteredEmployees.length > PAGE_SIZE && (
            <footer className="employee-pagination">
              <p>
                Showing {firstVisibleRecord} to {lastVisibleRecord} of{" "}
                {filteredEmployees.length} employees
              </p>
              <div>
                <button
                  className="btn"
                  type="button"
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
                      page === safePage
                        ? "employee-page active"
                        : "employee-page"
                    }
                    type="button"
                    key={page}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  className="btn"
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
      </section>
    </Master>
  );
}
