"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Master from "./master";

export type RecordField = {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "date" | "select";
  required?: boolean;
  options?: string[];
};

export type DataRecord = Record<string, string>;

type RecordPageProps = {
  pageKey: string;
  title: string;
  description: string;
  formTitle: string;
  recordsTitle: string;
  fields: RecordField[];
  initialRecords: DataRecord[];
  agentCanEdit: boolean;
};

export default function RecordPage({
  pageKey,
  title,
  description,
  formTitle,
  recordsTitle,
  fields,
  initialRecords,
  agentCanEdit,
}: RecordPageProps) {
  const storageKey = `assetManagement_${pageKey}`;
  const emptyForm = useMemo(
    () => Object.fromEntries(fields.map((field) => [field.key, ""])),
    [fields],
  );

  const [role, setRole] = useState<"Admin" | "Agent">("Agent");
  const [records, setRecords] = useState<DataRecord[]>(initialRecords);
  const [form, setForm] = useState<DataRecord>(emptyForm);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const statusField = fields.find((field) => field.type === "select");

  useEffect(() => {
    const currentRole =
      sessionStorage.getItem("assetManagementRole") ??
      sessionStorage.getItem("stockwiseRole");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRole(currentRole === "Admin" ? "Admin" : "Agent");

    const saved = localStorage.getItem(storageKey);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) setRecords(parsed);
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(records));
  }, [records, storageKey]);

  const filterOptions = useMemo(() => {
    if (!statusField) return [];
    return [...new Set(records.map((record) => record[statusField.key]).filter(Boolean))]
      .sort()
      .map((value) => ({ label: value, value }));
  }, [records, statusField]);

  const visibleRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records
      .map((record, index) => ({ record, index }))
      .filter(({ record }) => {
        const matchesSearch =
          !query ||
          fields.some((field) =>
            String(record[field.key] ?? "").toLowerCase().includes(query),
          );
        const matchesFilter =
          !filter || !statusField || record[statusField.key] === filter;
        return matchesSearch && matchesFilter;
      });
  }, [records, search, filter, fields, statusField]);

  const canEdit = role === "Admin" || agentCanEdit;
  const canAdd = role === "Admin" || agentCanEdit;

  function updateField(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingIndex(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = Object.fromEntries(
      fields.map((field) => [field.key, String(form[field.key] ?? "").trim()]),
    );

    if (editingIndex === null) {
      setRecords((current) => [normalized, ...current]);
    } else {
      setRecords((current) =>
        current.map((record, index) => (index === editingIndex ? normalized : record)),
      );
    }

    resetForm();
    setFormOpen(false);
  }

  function editRecord(index: number) {
    setForm({ ...records[index] });
    setEditingIndex(index);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteRecord(index: number) {
    if (!window.confirm("Delete this record?")) return;
    setRecords((current) => current.filter((_, rowIndex) => rowIndex !== index));
    if (editingIndex === index) resetForm();
  }

  function exportCsv() {
    const escape = (value: string) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [
      fields.map((field) => escape(field.label)).join(","),
      ...records.map((record) =>
        fields.map((field) => escape(record[field.key] ?? "")).join(","),
      ),
    ].join("\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${pageKey}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Master
      title={title}
      section="Workspace"
      onSearchChange={setSearch}
      onFilterChange={setFilter}
      filterOptions={filterOptions}
    >
      <section className="content">
        <div className="page-head">
          <div>
            <div className="eyebrow">Inventory workspace</div>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <div className="button-row">
            <button className="btn" type="button" onClick={exportCsv}>⇩ Export CSV</button>
            <button className="btn" type="button" onClick={() => window.print()}>Print</button>
          </div>
        </div>

        {canAdd && (
          <details
            className="panel form-panel"
            open={formOpen}
            onToggle={(event) => setFormOpen(event.currentTarget.open)}
          >
            <summary>{editingIndex === null ? formTitle : `Edit ${title} Record`}</summary>
            <div className="form-body">
              <form onSubmit={submit}>
                <div className="form-grid">
                  {fields.map((field) => (
                    <div className="field" key={field.key}>
                      <label htmlFor={`${pageKey}-${field.key}`}>{field.label}</label>
                      {field.type === "select" ? (
                        <select
                          id={`${pageKey}-${field.key}`}
                          value={form[field.key] ?? ""}
                          required={field.required}
                          onChange={(event) => updateField(field.key, event.target.value)}
                        >
                          <option value="" disabled>Select {field.label}</option>
                          {field.options?.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id={`${pageKey}-${field.key}`}
                          type={field.type ?? "text"}
                          value={form[field.key] ?? ""}
                          placeholder={field.placeholder}
                          required={field.required}
                          onChange={(event) => updateField(field.key, event.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="form-footer">
                  <button className="btn" type="button" onClick={resetForm}>Clear</button>
                  <button className="btn primary" type="submit">
                    {editingIndex === null ? "Save Record" : "Update Record"}
                  </button>
                </div>
              </form>
            </div>
          </details>
        )}

        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>{recordsTitle}</h2>
              <p>Search, add and update records. Changes are saved in this browser.</p>
            </div>
            <span className="count">{records.length} records</span>
          </div>
          <div className="record-tools">
            <span className="count">Use the search box in the top bar to filter records.</span>
            <span className="count">Saved in this browser</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {fields.map((field) => <th key={field.key}>{field.label}</th>)}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.length === 0 ? (
                  <tr><td colSpan={fields.length + 1} className="empty-table">No matching records.</td></tr>
                ) : (
                  visibleRecords.map(({ record, index }) => (
                    <tr key={`${pageKey}-${index}`}>
                      {fields.map((field) => <td key={field.key}>{record[field.key]}</td>)}
                      <td>
                        <div className="table-actions">
                          {canEdit && <button className="mini-btn" type="button" onClick={() => editRecord(index)}>Edit</button>}
                          {role === "Admin" && <button className="mini-btn delete" type="button" onClick={() => deleteRecord(index)}>Delete</button>}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="panel-body count">Use Edit to load a row into the form. Delete is available to Admin only.</div>
        </div>
      </section>
    </Master>
  );
}
