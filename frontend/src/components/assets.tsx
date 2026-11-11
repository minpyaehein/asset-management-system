"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Master from "./master";

type AssetStatus =
  | "Active"
  | "Available"
  | "Assigned"
  | "Maintenance"
  | "Inactive"
  | "Retired";

type AssetPermission = {
  module: string;
  access: "Own Only" | "Assigned" | "All";
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDeactivate: boolean;
  canExport: boolean;
};

type Asset = {
  id: number;
  assetTag: string;
  category: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  status: AssetStatus;
  assignedTo: string | null;
  purchaseDate: string | null;
  purchaseCost: string | null;
  warrantyEnd: string | null;
  location: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type AssetForm = {
  assetTag: string;
  category: string;
  brand: string;
  model: string;
  serialNumber: string;
  status: AssetStatus;
  assignedTo: string;
  purchaseDate: string;
  purchaseCost: string;
  warrantyEnd: string;
  location: string;
  notes: string;
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
  permissions: AssetPermission[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const PAGE_SIZE = 10;

const categories = [
  "Laptop",
  "Desktop",
  "Monitor",
  "Printer",
  "Network Device",
  "Accessory",
  "Other",
];

const statuses: AssetStatus[] = [
  "Active",
  "Available",
  "Assigned",
  "Maintenance",
  "Inactive",
  "Retired",
];

function emptyForm(): AssetForm {
  return {
    assetTag: "",
    category: "",
    brand: "",
    model: "",
    serialNumber: "",
    status: "Available",
    assignedTo: "",
    purchaseDate: "",
    purchaseCost: "",
    warrantyEnd: "",
    location: "",
    notes: "",
  };
}

function getSessionUserId() {
  const value = Number(
    sessionStorage.getItem("assetManagementUserId") ??
      sessionStorage.getItem("stockwiseUserId") ??
      "0",
  );

  return Number.isFinite(value) && value > 0 ? value : null;
}

function dateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function formatDate(value: string | null, includeTime = false) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not provided";
  return includeTime ? date.toLocaleString() : date.toLocaleDateString();
}

function money(value: string | null) {
  if (!value) return "Not provided";
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(numericValue)
    : value;
}

function statusClass(status: AssetStatus) {
  return status.toLowerCase().replaceAll(" ", "-");
}

export default function Assets() {
  const router = useRouter();

  const [userId, setUserId] = useState<number | null>(null);
  const [permission, setPermission] = useState<AssetPermission | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [form, setForm] = useState<AssetForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canView = permission?.canView === true;
  const canAdd = permission?.canAdd === true;
  const canEdit = permission?.canEdit === true;
  const canDeactivate = permission?.canDeactivate === true;
  const canExport = permission?.canExport === true;

  const requestHeaders = useCallback(
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

    const currentUserId = getSessionUserId();
    if (!currentUserId) {
      setPermission(null);
      setError("Your login session is incomplete. Sign out and sign in again.");
      setAccessLoading(false);
      return;
    }

    try {
      const userResponse = await fetch(`${API_URL}/users/${currentUserId}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const userBody = await userResponse.json().catch(() => null);
      if (!userResponse.ok) {
        throw new Error(userBody?.message ?? "Unable to load current user.");
      }

      const currentUser = userBody as CurrentUser;
      if (currentUser.status !== "Active") {
        throw new Error("Your user account is inactive.");
      }

      const roleResponse = await fetch(
        `${API_URL}/roles/${currentUser.roleId}`,
        {
          headers: { Accept: "application/json" },
          cache: "no-store",
        },
      );
      const roleBody = await roleResponse.json().catch(() => null);
      if (!roleResponse.ok) {
        throw new Error(roleBody?.message ?? "Unable to load assigned role.");
      }

      const assignedRole = roleBody as AssignedRole;
      if (!assignedRole.isActive) {
        throw new Error("Your assigned role is inactive.");
      }

      setUserId(currentUserId);
      setPermission(
        assignedRole.permissions.find(
          (item) => item.module === "Assets & Hardware",
        ) ?? null,
      );
    } catch (value) {
      setPermission(null);
      setError(
        value instanceof Error
          ? value.message
          : "Unable to load asset permissions.",
      );
    } finally {
      setAccessLoading(false);
    }
  }, []);

  const loadAssets = useCallback(async () => {
    if (!userId || !canView) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/assets`, {
        headers: requestHeaders(),
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        const message = Array.isArray(body?.message)
          ? body.message.join(", ")
          : body?.message;
        throw new Error(message || "Unable to load assets.");
      }

      const loadedAssets = Array.isArray(body) ? (body as Asset[]) : [];
      setAssets(loadedAssets);
      setCurrentPage((page) =>
        Math.min(page, Math.max(1, Math.ceil(loadedAssets.length / PAGE_SIZE))),
      );
    } catch (value) {
      setAssets([]);
      setError(
        value instanceof Error ? value.message : "Unable to load assets.",
      );
    } finally {
      setLoading(false);
    }
  }, [canView, requestHeaders, userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAccess();
  }, [loadAccess]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!accessLoading && canView) void loadAssets();
  }, [accessLoading, canView, loadAssets]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [search, statusFilter]);

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return assets.filter((asset) => {
      const matchesStatus =
        statusFilter === "All" || asset.status === statusFilter;
      const matchesSearch =
        !query ||
        [
          asset.assetTag,
          asset.category,
          asset.brand,
          asset.model,
          asset.serialNumber,
          asset.assignedTo,
          asset.location,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(query),
        );

      return matchesStatus && matchesSearch;
    });
  }, [assets, search, statusFilter]);

  const summary = useMemo(
    () => ({
      total: assets.length,
      available: assets.filter((asset) => asset.status === "Available").length,
      assigned: assets.filter((asset) => asset.status === "Assigned").length,
      maintenance: assets.filter((asset) => asset.status === "Maintenance")
        .length,
    }),
    [assets],
  );

  function openCreate() {
    if (!canAdd) {
      setError("Your role does not have Add permission for Assets & Hardware.");
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

  function openEdit(asset: Asset) {
    if (!canEdit) {
      setError(
        "Your role does not have Edit permission for Assets & Hardware.",
      );
      return;
    }

    setForm({
      assetTag: asset.assetTag,
      category: asset.category,
      brand: asset.brand ?? "",
      model: asset.model ?? "",
      serialNumber: asset.serialNumber ?? "",
      status: asset.status,
      assignedTo: asset.assignedTo ?? "",
      purchaseDate: dateInputValue(asset.purchaseDate),
      purchaseCost: asset.purchaseCost ?? "",
      warrantyEnd: dateInputValue(asset.warrantyEnd),
      location: asset.location ?? "",
      notes: asset.notes ?? "",
    });
    setEditingId(asset.id);
    setFormOpen(true);
    setViewingAsset(null);
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const creating = editingId === null;
    if (creating && !canAdd) return setError("Add permission is required.");
    if (!creating && !canEdit) return setError("Edit permission is required.");
    if (!form.assetTag.trim() || !form.category) {
      return setError("Asset tag and category are required.");
    }
    if (form.purchaseCost && Number(form.purchaseCost) < 0) {
      return setError("Purchase cost cannot be negative.");
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        creating ? `${API_URL}/assets` : `${API_URL}/assets/${editingId}`,
        {
          method: creating ? "POST" : "PATCH",
          headers: requestHeaders(true),
          body: JSON.stringify({
            assetTag: form.assetTag.trim(),
            category: form.category,
            brand: form.brand.trim() || null,
            model: form.model.trim() || null,
            serialNumber: form.serialNumber.trim() || null,
            status: form.status,
            assignedTo: form.assignedTo.trim() || null,
            purchaseDate: form.purchaseDate || null,
            purchaseCost: form.purchaseCost ? Number(form.purchaseCost) : null,
            warrantyEnd: form.warrantyEnd || null,
            location: form.location.trim() || null,
            notes: form.notes.trim() || null,
          }),
        },
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        const message = Array.isArray(body?.message)
          ? body.message.join(", ")
          : body?.message;
        throw new Error(message || "Unable to save asset.");
      }

      setSuccess(
        creating
          ? "Asset created successfully."
          : "Asset updated successfully.",
      );
      closeForm();
      await loadAssets();
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Unable to save asset.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeAssetStatus(asset: Asset) {
    if (!canDeactivate) {
      setError(
        "Your role does not have Deactivate permission for Assets & Hardware.",
      );
      return;
    }

    const status: AssetStatus =
      asset.status === "Inactive" ? "Available" : "Inactive";
    const action = status === "Inactive" ? "deactivate" : "activate";

    if (
      !window.confirm(
        `Are you sure you want to ${action} asset "${asset.assetTag}"?`,
      )
    ) {
      return;
    }

    setUpdatingStatusId(asset.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_URL}/assets/${asset.id}/status`, {
        method: "PATCH",
        headers: requestHeaders(true),
        body: JSON.stringify({ status }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.message ?? `Unable to ${action} asset.`);
      }

      setSuccess(
        status === "Inactive"
          ? "Asset deactivated successfully."
          : "Asset activated successfully.",
      );
      setViewingAsset(null);
      await loadAssets();
    } catch (value) {
      setError(
        value instanceof Error ? value.message : `Unable to ${action} asset.`,
      );
    } finally {
      setUpdatingStatusId(null);
    }
  }

  function exportCsv() {
    if (!canExport) {
      setError(
        "Your role does not have Export permission for Assets & Hardware.",
      );
      return;
    }

    const rows = [
      [
        "Asset Tag",
        "Category",
        "Brand",
        "Model",
        "Serial Number",
        "Status",
        "Assigned To",
        "Location",
      ],
      ...filteredAssets.map((asset) => [
        asset.assetTag,
        asset.category,
        asset.brand ?? "",
        asset.model ?? "",
        asset.serialNumber ?? "",
        asset.status,
        asset.assignedTo ?? "",
        asset.location ?? "",
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
    link.download = "assets.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paginatedAssets = filteredAssets.slice(
    pageStart,
    pageStart + PAGE_SIZE,
  );
  const firstVisibleRecord = filteredAssets.length ? pageStart + 1 : 0;
  const lastVisibleRecord = Math.min(
    pageStart + PAGE_SIZE,
    filteredAssets.length,
  );

  function goToPage(page: number) {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
  }

  if (accessLoading) {
    return (
      <main className="session-loading">
        <div className="session-loading-card">
          <span className="session-loading-spinner" />
          <p>Loading asset permissions...</p>
        </div>
      </main>
    );
  }

  if (!canView) {
    return (
      <Master>
        <section className="content">
          <div className="asset-permission-denied">
            <h1>Access denied</h1>
            <p>
              Your assigned role does not have View permission for Assets &amp;
              Hardware.
            </p>
            {error && <p>{error}</p>}
          </div>
        </section>
      </Master>
    );
  }

  return (
    <Master>
      <section className="content assets-page">
        <header className="assets-hero">
          <div>
            <div className="eyebrow">Inventory</div>
            <h1>Assets &amp; Hardware</h1>
            <p>
              Manage asset details, assignment, warranty, and lifecycle status.
            </p>
          </div>
          <div className="button-row">
            {canExport && (
              <button className="btn" type="button" onClick={exportCsv}>
                Export CSV
              </button>
            )}
            {canAdd && (
              <button
                className="btn"
                type="button"
                onClick={() => router.push("/bulk-asset-import")}
              >
                Import Assets
              </button>
            )}
            {canAdd && !formOpen && (
              <button
                className="btn primary"
                type="button"
                onClick={openCreate}
              >
                Add New Asset
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="asset-message asset-error" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="asset-message asset-success" role="status">
            {success}
          </div>
        )}

        <div className="asset-stats">
          <article>
            <span>Total assets</span>
            <strong>{summary.total}</strong>
          </article>
          <article>
            <span>Available</span>
            <strong>{summary.available}</strong>
          </article>
          <article>
            <span>Assigned</span>
            <strong>{summary.assigned}</strong>
          </article>
          <article>
            <span>Maintenance</span>
            <strong>{summary.maintenance}</strong>
          </article>
        </div>

        {viewingAsset && (
          <div
            className="asset-detail-backdrop"
            onMouseDown={() => setViewingAsset(null)}
          >
            <section
              className="asset-detail-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="asset-detail-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="asset-detail-header">
                <div>
                  <div className="eyebrow">Asset Detail</div>
                  <h2 id="asset-detail-title">{viewingAsset.assetTag}</h2>
                  <p>
                    {[viewingAsset.brand, viewingAsset.model]
                      .filter(Boolean)
                      .join(" · ") || viewingAsset.category}
                  </p>
                </div>
                <button
                  className="asset-close"
                  type="button"
                  aria-label="Close asset detail"
                  onClick={() => setViewingAsset(null)}
                >
                  ×
                </button>
              </div>

              <div className="asset-detail-grid">
                <div>
                  <span>Asset Tag</span>
                  <strong>{viewingAsset.assetTag}</strong>
                </div>
                <div>
                  <span>Category</span>
                  <strong>{viewingAsset.category}</strong>
                </div>
                <div>
                  <span>Brand</span>
                  <strong>{viewingAsset.brand || "Not provided"}</strong>
                </div>
                <div>
                  <span>Model</span>
                  <strong>{viewingAsset.model || "Not provided"}</strong>
                </div>
                <div>
                  <span>Serial Number</span>
                  <strong>{viewingAsset.serialNumber || "Not provided"}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong
                    className={`asset-status ${statusClass(viewingAsset.status)}`}
                  >
                    {viewingAsset.status}
                  </strong>
                </div>
                <div>
                  <span>Assigned To</span>
                  <strong>{viewingAsset.assignedTo || "Unassigned"}</strong>
                </div>
                <div>
                  <span>Location</span>
                  <strong>{viewingAsset.location || "Not provided"}</strong>
                </div>
                <div>
                  <span>Purchase Date</span>
                  <strong>{formatDate(viewingAsset.purchaseDate)}</strong>
                </div>
                <div>
                  <span>Purchase Cost</span>
                  <strong>{money(viewingAsset.purchaseCost)}</strong>
                </div>
                <div>
                  <span>Warranty End</span>
                  <strong>{formatDate(viewingAsset.warrantyEnd)}</strong>
                </div>
                <div>
                  <span>Created</span>
                  <strong>{formatDate(viewingAsset.createdAt, true)}</strong>
                </div>
                <div>
                  <span>Updated</span>
                  <strong>{formatDate(viewingAsset.updatedAt, true)}</strong>
                </div>
                <div className="asset-detail-notes">
                  <span>Notes</span>
                  <strong>{viewingAsset.notes || "No notes"}</strong>
                </div>
              </div>

              <div className="asset-detail-footer">
                <button
                  className="btn"
                  type="button"
                  onClick={() => setViewingAsset(null)}
                >
                  Close
                </button>
                {canEdit && (
                  <button
                    className="btn primary"
                    type="button"
                    disabled={viewingAsset.status === "Inactive"}
                    onClick={() => openEdit(viewingAsset)}
                  >
                    Edit Asset
                  </button>
                )}
              </div>
            </section>
          </div>
        )}

        {formOpen && (
          <section className="panel asset-editor">
            <div className="panel-head asset-heading">
              <div>
                <h2>{editingId === null ? "Add New Asset" : "Edit Asset"}</h2>
                <p>
                  Enter the asset identity, assignment, cost, and warranty
                  details.
                </p>
              </div>
              <button
                className="asset-close"
                type="button"
                aria-label="Close asset form"
                onClick={closeForm}
              >
                ×
              </button>
            </div>

            <div className="panel-body">
              <form onSubmit={saveAsset}>
                <div className="asset-form-grid">
                  <div className="asset-field">
                    <label htmlFor="asset-tag">Asset Tag</label>
                    <input
                      id="asset-tag"
                      value={form.assetTag}
                      maxLength={100}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          assetTag: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="asset-field">
                    <label htmlFor="asset-category">Category</label>
                    <select
                      id="asset-category"
                      value={form.category}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          category: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="" disabled>
                        Select category
                      </option>
                      {categories.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </div>
                  <div className="asset-field">
                    <label htmlFor="asset-brand">Brand</label>
                    <input
                      id="asset-brand"
                      value={form.brand}
                      maxLength={100}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          brand: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="asset-field">
                    <label htmlFor="asset-model">Model</label>
                    <input
                      id="asset-model"
                      value={form.model}
                      maxLength={100}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          model: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="asset-field">
                    <label htmlFor="asset-serial">Serial Number</label>
                    <input
                      id="asset-serial"
                      value={form.serialNumber}
                      maxLength={150}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          serialNumber: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="asset-field">
                    <label htmlFor="asset-status">Status</label>
                    <select
                      id="asset-status"
                      value={form.status}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          status: event.target.value as AssetStatus,
                        }))
                      }
                    >
                      {statuses.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </div>
                  <div className="asset-field">
                    <label htmlFor="asset-assigned">Assigned To</label>
                    <input
                      id="asset-assigned"
                      value={form.assignedTo}
                      maxLength={150}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          assignedTo: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="asset-field">
                    <label htmlFor="asset-location">Location</label>
                    <input
                      id="asset-location"
                      value={form.location}
                      maxLength={150}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          location: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="asset-field">
                    <label htmlFor="purchase-date">Purchase Date</label>
                    <input
                      id="purchase-date"
                      type="date"
                      value={form.purchaseDate}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          purchaseDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="asset-field">
                    <label htmlFor="purchase-cost">Purchase Cost</label>
                    <input
                      id="purchase-cost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.purchaseCost}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          purchaseCost: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="asset-field">
                    <label htmlFor="warranty-end">Warranty End</label>
                    <input
                      id="warranty-end"
                      type="date"
                      value={form.warrantyEnd}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          warrantyEnd: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="asset-field asset-notes-field">
                    <label htmlFor="asset-notes">Notes</label>
                    <textarea
                      id="asset-notes"
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
                        ? "Create Asset"
                        : "Update Asset"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        <section className="panel asset-records">
          <div className="asset-toolbar">
            <div>
              <h2>Asset Records</h2>
              <p>{filteredAssets.length} matching assets</p>
            </div>
            <div className="asset-filter-tools">
              <input
                aria-label="Search assets"
                placeholder="Search tag, model, serial, person, or location"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                aria-label="Filter assets by status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="All">All statuses</option>
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Asset Tag</th>
                  <th>Category</th>
                  <th>Brand / Model</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Location</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="empty-table">
                      Loading assets...
                    </td>
                  </tr>
                ) : paginatedAssets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-table">
                      No assets found.
                    </td>
                  </tr>
                ) : (
                  paginatedAssets.map((asset) => (
                    <tr
                      key={asset.id}
                      className={
                        asset.status === "Inactive" ? "asset-inactive-row" : ""
                      }
                    >
                      <td>
                        <strong>{asset.assetTag}</strong>
                        <small className="asset-serial-copy">
                          {asset.serialNumber || "No serial number"}
                        </small>
                      </td>
                      <td>{asset.category}</td>
                      <td>
                        {[asset.brand, asset.model]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                      <td>
                        <span
                          className={`asset-status ${statusClass(asset.status)}`}
                        >
                          {asset.status}
                        </span>
                      </td>
                      <td>{asset.assignedTo || "Unassigned"}</td>
                      <td>{asset.location || "—"}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="mini-btn view"
                            type="button"
                            onClick={() => setViewingAsset(asset)}
                          >
                            View
                          </button>
                          {canEdit && (
                            <button
                              className="mini-btn"
                              type="button"
                              disabled={asset.status === "Inactive"}
                              onClick={() => openEdit(asset)}
                            >
                              Edit
                            </button>
                          )}
                          {canDeactivate && (
                            <button
                              className={
                                asset.status === "Inactive"
                                  ? "mini-btn activate"
                                  : "mini-btn deactivate"
                              }
                              type="button"
                              disabled={updatingStatusId === asset.id}
                              onClick={() => void changeAssetStatus(asset)}
                            >
                              {updatingStatusId === asset.id
                                ? "Updating..."
                                : asset.status === "Inactive"
                                  ? "Activate"
                                  : "Deactivate"}
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

          {filteredAssets.length > PAGE_SIZE && (
            <footer className="asset-pagination">
              <p>
                Showing {firstVisibleRecord} to {lastVisibleRecord} of{" "}
                {filteredAssets.length} assets
              </p>
              <div>
                <button
                  className="btn"
                  type="button"
                  disabled={safePage === 1}
                  onClick={() => goToPage(safePage - 1)}
                >
                  Previous
                </button>
                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1,
                ).map((page) => (
                  <button
                    className={
                      page === safePage ? "asset-page active" : "asset-page"
                    }
                    type="button"
                    key={page}
                    onClick={() => goToPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  className="btn"
                  type="button"
                  disabled={safePage === totalPages}
                  onClick={() => goToPage(safePage + 1)}
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
