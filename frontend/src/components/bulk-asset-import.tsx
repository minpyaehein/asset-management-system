"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Master from "./master";

type AssetStatus =
  | "Active"
  | "Available"
  | "Assigned"
  | "Maintenance"
  | "Inactive"
  | "Retired";
type Permission = {
  module: string;
  access: "Own Only" | "Assigned" | "All";
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDeactivate: boolean;
  canExport: boolean;
};
type AssetImportRecord = {
  assetTag: string;
  category: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  status: AssetStatus;
  assignedTo: string | null;
  purchaseDate: string | null;
  purchaseCost: number | null;
  warrantyEnd: string | null;
  location: string | null;
  notes: string | null;
};
type PreviewRow = AssetImportRecord & { rowNumber: number; error?: string };
type ImportIssue = { row: number; assetTag: string; reason: string };
type ImportResult = {
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  skipped: ImportIssue[];
  failed: ImportIssue[];
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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const PAGE_SIZE = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ROWS = 1000;
const requiredHeaders = [
  "Asset Tag",
  "Category",
  "Brand",
  "Model",
  "Serial Number",
  "Status",
  "Assigned To",
  "Purchase Date",
  "Purchase Cost",
  "Warranty End",
  "Location",
  "Notes",
];
const keys = [
  "assetTag",
  "category",
  "brand",
  "model",
  "serialNumber",
  "status",
  "assignedTo",
  "purchaseDate",
  "purchaseCost",
  "warrantyEnd",
  "location",
  "notes",
] as const;
const allowedCategories = new Set([
  "Laptop",
  "Desktop",
  "Monitor",
  "Printer",
  "Network Device",
  "Accessory",
  "Other",
]);
const allowedStatuses = new Set<AssetStatus>([
  "Active",
  "Available",
  "Assigned",
  "Maintenance",
  "Inactive",
  "Retired",
]);

function getUserId() {
  const value = Number(
    sessionStorage.getItem("assetManagementUserId") ??
      sessionStorage.getItem("stockwiseUserId") ??
      "0",
  );
  return Number.isFinite(value) && value > 0 ? value : null;
}
function optionalText(value: string) {
  return value.trim() || null;
}
function validDate(value: string) {
  return (
    !value ||
    (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(`${value}T00:00:00Z`)))
  );
}
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value.trim());
      value = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else value += character;
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
function buildPreview(rows: string[][], indexes: number[]): PreviewRow[] {
  return rows.slice(1).map((row, rowIndex) => {
    const values = Object.fromEntries(
      keys.map((key, index) => [key, row[indexes[index]]?.trim() ?? ""]),
    ) as Record<(typeof keys)[number], string>;
    const errors: string[] = [];
    const cost = values.purchaseCost ? Number(values.purchaseCost) : null;
    if (!values.assetTag) errors.push("Asset Tag is required");
    if (!values.category) errors.push("Category is required");
    else if (!allowedCategories.has(values.category))
      errors.push("Invalid Category");
    if (!allowedStatuses.has(values.status as AssetStatus))
      errors.push("Invalid Status");
    if (values.purchaseCost && (!Number.isFinite(cost) || Number(cost) < 0))
      errors.push("Invalid Purchase Cost");
    if (!validDate(values.purchaseDate)) errors.push("Invalid Purchase Date");
    if (!validDate(values.warrantyEnd)) errors.push("Invalid Warranty End");
    if (
      values.purchaseDate &&
      values.warrantyEnd &&
      values.warrantyEnd < values.purchaseDate
    )
      errors.push("Warranty End is before Purchase Date");
    return {
      rowNumber: rowIndex + 2,
      assetTag: values.assetTag,
      category: values.category,
      brand: optionalText(values.brand),
      model: optionalText(values.model),
      serialNumber: optionalText(values.serialNumber),
      status: values.status as AssetStatus,
      assignedTo: optionalText(values.assignedTo),
      purchaseDate: optionalText(values.purchaseDate),
      purchaseCost: cost,
      warrantyEnd: optionalText(values.warrantyEnd),
      location: optionalText(values.location),
      notes: optionalText(values.notes),
      error: errors.length ? errors.join(", ") : undefined,
    };
  });
}

export default function BulkAssetImport() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [permission, setPermission] = useState<Permission | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const hasImportAccess = permission?.canAdd === true;
  const canOpenAssets = permission?.canView === true;

  const loadAccess = useCallback(async () => {
    setAccessLoading(true);
    setError("");
    const id = getUserId();
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
        role.permissions.find((item) => item.module === "Assets & Hardware") ??
          null,
      );
    } catch (value) {
      setPermission(null);
      setError(
        value instanceof Error
          ? value.message
          : "Unable to load asset import permission.",
      );
    } finally {
      setAccessLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAccess();
  }, [loadAccess]);

  const validRows = useMemo(
    () => preview.filter((row) => !row.error),
    [preview],
  );
  const invalidRows = useMemo(
    () => preview.filter((row) => row.error),
    [preview],
  );
  const totalPages = Math.max(1, Math.ceil(preview.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageRows = preview.slice(pageStart, pageStart + PAGE_SIZE);
  const resetImportState = () => {
    setFile(null);
    setPreview([]);
    setResult(null);
    setError("");
    setMessage("");
    setCurrentPage(1);
    const input = document.getElementById(
      "csv-file",
    ) as HTMLInputElement | null;
    if (input) input.value = "";
  };
  const cancelImport = () => {
    if (
      preview.length &&
      !window.confirm("Cancel this import and return to Assets?")
    )
      return;
    resetImportState();
    router.push("/assets");
  };

  async function prepareFile(selectedFile: File | null) {
    if (!hasImportAccess)
      return setError("Assets & Hardware Add permission is required.");
    setFile(selectedFile);
    setPreview([]);
    setResult(null);
    setError("");
    setMessage("");
    setCurrentPage(1);
    if (!selectedFile) return;
    if (!selectedFile.name.toLowerCase().endsWith(".csv"))
      return setError("Choose a CSV file.");
    if (selectedFile.size > MAX_FILE_SIZE)
      return setError("The CSV file must be 5 MB or smaller.");
    setIsReading(true);
    try {
      const rows = parseCsv(await selectedFile.text());
      if (rows.length < 2) throw new Error("The CSV has no data rows.");
      const headers = rows[0].map((value) =>
        value.replace(/^\uFEFF/, "").trim(),
      );
      const missing = requiredHeaders.filter(
        (header) => !headers.includes(header),
      );
      if (missing.length)
        throw new Error(`Missing columns: ${missing.join(", ")}`);
      const parsed = buildPreview(
        rows,
        requiredHeaders.map((header) => headers.indexOf(header)),
      );
      if (parsed.length > MAX_ROWS)
        throw new Error(
          `A single import can contain at most ${MAX_ROWS.toLocaleString()} rows.`,
        );
      setPreview(parsed);
      setMessage(`${parsed.length} row(s) ready for review.`);
    } catch (value) {
      setFile(null);
      setError(
        value instanceof Error ? value.message : "Unable to read the CSV file.",
      );
    } finally {
      setIsReading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasImportAccess)
      return setError("Assets & Hardware Add permission is required.");
    setError("");
    setMessage("");
    setResult(null);
    if (!file) return setError("Choose a CSV file.");
    if (!preview.length) return setError("Prepare a valid CSV file first.");
    if (invalidRows.length)
      return setError(
        `Fix ${invalidRows.length} invalid row(s) before importing.`,
      );
    setIsImporting(true);
    try {
      const response = await fetch(`${API_URL}/assets/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-User-Id": String(userId),
        },
        body: JSON.stringify({
          assets: validRows.map(
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            ({ rowNumber: _row, error: _error, ...asset }) => asset,
          ),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          Array.isArray(body?.message)
            ? body.message.join(", ")
            : (body?.message ?? "Unable to import assets."),
        );
      const imported = body as ImportResult;
      setResult(imported);
      setMessage(
        `${imported.importedCount} imported, ${imported.skippedCount} skipped, ${imported.failedCount} failed.`,
      );
      if (!imported.failedCount) {
        setFile(null);
        setPreview([]);
        setCurrentPage(1);
        const input = document.getElementById(
          "csv-file",
        ) as HTMLInputElement | null;
        if (input) input.value = "";
      }
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Unable to import assets.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  function downloadTemplate() {
    const example = [
      "AST-1007",
      "Laptop",
      "Dell",
      "Latitude 7450",
      "SN-1007",
      "Available",
      "",
      "2026-11-03",
      "1500",
      "2029-11-03",
      "Yangon IT Store",
      "New asset",
    ];
    const url = URL.createObjectURL(
      new Blob([`${requiredHeaders.join(",")}\n${example.join(",")}\n`], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "asset-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (accessLoading)
    return (
      <main className="session-loading">
        <div className="session-loading-card">
          <span className="session-loading-spinner" />
          <p>Loading import permission...</p>
        </div>
      </main>
    );
  if (!hasImportAccess)
    return (
      <Master>
        <section className="content">
          <div className="bulk-permission-denied">
            <h1>Access denied</h1>
            <p>
              Enable Add permission for Assets &amp; Hardware to use Bulk Asset
              Import.
            </p>
            {error && <p>{error}</p>}
          </div>
        </section>
      </Master>
    );

  return (
    <Master>
      <section className="content bulk-import-page">
        <header className="bulk-hero">
          <div>
            <div className="eyebrow">Inventory workspace</div>
            <h1>Bulk Asset Import</h1>
            <p>
              Validate and import up to 1,000 asset records from one CSV file.
            </p>
          </div>
          <div className="button-row">
            <button className="btn" type="button" onClick={downloadTemplate}>
              Download Template
            </button>
            {canOpenAssets && (
              <Link className="btn" href="/assets">
                Open Assets
              </Link>
            )}
          </div>
        </header>
        {error && (
          <div className="bulk-message bulk-error" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="bulk-message bulk-success" role="status">
            {message}
          </div>
        )}
        <section className="panel">
          <div className="panel-head">
            <h2>Choose CSV file</h2>
            <p>CSV only, maximum 5 MB and 1,000 data rows.</p>
          </div>
          <div className="panel-body">
            <form onSubmit={submit}>
              <label className="bulk-drop-zone" htmlFor="csv-file">
                <strong>
                  {isReading
                    ? "Reading CSV..."
                    : file?.name || "Choose a CSV file"}
                </strong>
                <span>
                  Click to browse. Required headers must match the downloaded
                  template.
                </span>
                <input
                  id="csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  disabled={isReading || isImporting}
                  onChange={(event) =>
                    void prepareFile(event.target.files?.[0] ?? null)
                  }
                />
              </label>
              <div className="bulk-import-summary">
                <article>
                  <span>Total Rows</span>
                  <strong>{preview.length}</strong>
                </article>
                <article>
                  <span>Valid Rows</span>
                  <strong>{validRows.length}</strong>
                </article>
                <article>
                  <span>Invalid Rows</span>
                  <strong>{invalidRows.length}</strong>
                </article>
              </div>
              <div className="form-footer">
                <button
                  className="btn"
                  type="button"
                  disabled={isReading || isImporting}
                  onClick={cancelImport}
                >
                  Cancel
                </button>
                <button
                  className="btn primary"
                  type="submit"
                  disabled={
                    isReading ||
                    isImporting ||
                    !preview.length ||
                    !!invalidRows.length
                  }
                >
                  {isImporting ? "Importing..." : "Import Assets"}
                </button>
              </div>
            </form>
          </div>
        </section>
        {!!preview.length && (
          <section className="panel">
            <div className="panel-head bulk-panel-head">
              <div>
                <h2>CSV Preview</h2>
                <p>Review parsed records before import.</p>
              </div>
              <span className="count">{preview.length} rows</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Asset Tag</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Serial Number</th>
                    <th>Purchase Cost</th>
                    <th>Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr
                      key={`${row.rowNumber}-${row.assetTag}`}
                      className={row.error ? "bulk-invalid-row" : ""}
                    >
                      <td>{row.rowNumber}</td>
                      <td>
                        <strong>{row.assetTag || "—"}</strong>
                      </td>
                      <td>{row.category || "—"}</td>
                      <td>{row.status || "—"}</td>
                      <td>{row.serialNumber || "—"}</td>
                      <td>
                        {row.purchaseCost === null
                          ? "—"
                          : row.purchaseCost.toFixed(2)}
                      </td>
                      <td>
                        <span
                          className={
                            row.error
                              ? "bulk-validation invalid"
                              : "bulk-validation valid"
                          }
                        >
                          {row.error || "Valid"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.length > PAGE_SIZE && (
              <footer className="bulk-pagination">
                <p>
                  Showing {pageStart + 1} to{" "}
                  {Math.min(pageStart + PAGE_SIZE, preview.length)} of{" "}
                  {preview.length} rows
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
                        page === safePage ? "bulk-page active" : "bulk-page"
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
        )}
        {result && (
          <section className="panel">
            <div className="panel-head">
              <h2>Import Result</h2>
              <p>
                {result.importedCount} imported, {result.skippedCount} skipped,{" "}
                {result.failedCount} failed.
              </p>
            </div>
            {(result.skipped.length > 0 || result.failed.length > 0) && (
              <div className="panel-body bulk-results">
                {[...result.skipped, ...result.failed].map((item, index) => (
                  <article key={`${item.row}-${index}`}>
                    <strong>
                      Row {item.row}: {item.assetTag || "No Asset Tag"}
                    </strong>
                    <span>{item.reason}</span>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </section>
    </Master>
  );
}
