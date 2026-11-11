"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Master from "./master";

type Section = "inventory" | "software" | "maintenance";
type ReportData = {
  generatedAt: string;
  access: "Own Only" | "Assigned" | "All";
  sections: Record<Section, boolean>;
  inventory: {
    total: number;
    available: number;
    assigned: number;
    maintenance: number;
    categories: { name: string; value: number }[];
  };
  software: {
    upcomingRenewals: { name: string; expiryDate: string; owner: string }[];
    dueWithin30Days: number;
  };
  maintenance: {
    total: number;
    planned: number;
    open: number;
    completed: number;
    cost: number;
  };
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const safeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
function getUserId() {
  const id = Number(
    sessionStorage.getItem("assetManagementUserId") ??
      sessionStorage.getItem("stockwiseUserId") ??
      0,
  );
  return Number.isFinite(id) && id > 0 ? id : null;
}
function daysRemaining(expiry: string, generatedAt: string) {
  return Math.ceil(
    (new Date(`${expiry}T00:00:00.000Z`).getTime() -
      new Date(generatedAt).getTime()) /
      86400000,
  );
}
function normalize(value: unknown): ReportData {
  const body = (
    value && typeof value === "object" ? value : {}
  ) as Partial<ReportData>;
  return {
    generatedAt:
      typeof body.generatedAt === "string"
        ? body.generatedAt
        : new Date().toISOString(),
    access:
      body.access === "Own Only" ||
      body.access === "Assigned" ||
      body.access === "All"
        ? body.access
        : "All",
    sections: {
      inventory: body.sections?.inventory === true,
      software: body.sections?.software === true,
      maintenance: body.sections?.maintenance === true,
    },
    inventory: {
      total: safeNumber(body.inventory?.total),
      available: safeNumber(body.inventory?.available),
      assigned: safeNumber(body.inventory?.assigned),
      maintenance: safeNumber(body.inventory?.maintenance),
      categories: Array.isArray(body.inventory?.categories)
        ? body.inventory.categories
        : [],
    },
    software: {
      upcomingRenewals: Array.isArray(body.software?.upcomingRenewals)
        ? body.software.upcomingRenewals
        : [],
      dueWithin30Days: safeNumber(body.software?.dueWithin30Days),
    },
    maintenance: {
      total: safeNumber(body.maintenance?.total),
      planned: safeNumber(body.maintenance?.planned),
      open: safeNumber(body.maintenance?.open),
      completed: safeNumber(body.maintenance?.completed),
      cost: safeNumber(body.maintenance?.cost),
    },
  };
}

export default function Reports() {
  const [data, setData] = useState<ReportData | null>(null);
  const [section, setSection] = useState<"" | Section>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [live] = useState(true);
  const [error, setError] = useState("");

  const loadReports = useCallback(async (silent = false) => {
    const userId = getUserId();
    if (!userId) {
      setError("Your login session is incomplete. Sign in again.");
      setLoading(false);
      return;
    }
    if (!silent) setRefreshing(true);
    try {
      const response = await fetch(`${API_URL}/reports/summary`, {
        headers: { Accept: "application/json", "X-User-Id": String(userId) },
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          Array.isArray(body?.message)
            ? body.message.join(", ")
            : body?.message || "Unable to load reports.",
        );
      setData(normalize(body));
      setError("");
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Unable to load reports.",
      );
    } finally {
      setLoading(false);
      if (!silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReports();
  }, [loadReports]);
  useEffect(() => {
    if (!live) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void loadReports(true);
    };
    const interval = window.setInterval(refresh, 10000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [live, loadReports]);

  const allowedSections = useMemo(
    () =>
      (["inventory", "software", "maintenance"] as Section[]).filter(
        (name) => data?.sections[name],
      ),
    [data],
  );
  const show = (name: Section) =>
    data?.sections[name] && (!section || section === name);
  const total = Math.max(data?.inventory.total ?? 0, 1);

  return (
    <Master>
      <section className="content reports-content">
        <header className="reports-hero">
          <div>
            <div className="eyebrow">Insights</div>
            <h1>Reports &amp; Analytics</h1>
            <p>
              Active inventory, software renewal, and maintenance reporting.
            </p>
          </div>
          <div className="button-row">
            <button
              className="btn"
              disabled={refreshing}
              onClick={() => void loadReports()}
            >
              {refreshing ? "Refreshing..." : "Refresh Now"}
            </button>
            {data?.sections.inventory && (
              <Link className="btn" href="/assets">
                Inventory List
              </Link>
            )}
            <button className="btn primary" onClick={() => window.print()}>
              Print Report
            </button>
          </div>
        </header>
        <div className="reports-toolbar">
          <small>
            {data
              ? `Updated ${new Date(data.generatedAt).toLocaleString()}`
              : "Waiting for data"}
          </small>
          <label>
            Report section
            <select
              value={section}
              onChange={(event) =>
                setSection(event.target.value as "" | Section)
              }
            >
              <option value="">All permitted sections</option>
              {allowedSections.map((name) => (
                <option key={name} value={name}>
                  {name[0].toUpperCase() + name.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <div className="reports-message error">{error}</div>}
        {loading && (
          <section className="panel">
            <div className="panel-body reports-empty">Loading reports...</div>
          </section>
        )}
        {show("inventory") && data && (
          <>
            <div className="reports-stats">
              {[
                ["Active Inventory", data.inventory.total],
                ["Available", data.inventory.available],
                ["Assigned", data.inventory.assigned],
                ["Maintenance", data.inventory.maintenance],
              ].map(([label, value]) => (
                <article key={String(label)}>
                  <span>{label}</span>
                  <strong>{safeNumber(value).toLocaleString()}</strong>
                </article>
              ))}
            </div>
            <section className="panel">
              <div className="panel-head">
                <h2>Active Inventory by Category</h2>
              </div>
              <div className="panel-body">
                {data.inventory.categories.length === 0 ? (
                  <div className="reports-empty">
                    No category data is available.
                  </div>
                ) : (
                  data.inventory.categories.map((item) => (
                    <div className="report-row" key={item.name}>
                      <div className="report-label">
                        <span>{item.name}</span>
                        <strong>{safeNumber(item.value)}</strong>
                      </div>
                      <div className="report-track">
                        <div
                          className="report-fill"
                          style={{
                            width: `${Math.max((safeNumber(item.value) / total) * 100, 3)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}
        {show("software") && data && (
          <section className="panel">
            <div className="panel-head reports-panel-head">
              <div>
                <h2>Software Renewals</h2>
                <p>
                  {data.software.dueWithin30Days} renewal(s) due within 30 days.
                </p>
              </div>
              <Link className="btn" href="/software-management">
                Manage Software
              </Link>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Software</th>
                    <th>Expiry Date</th>
                    <th>Owner</th>
                    <th>Days Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {data.software.upcomingRenewals.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="empty-table">
                        No upcoming software renewals found.
                      </td>
                    </tr>
                  ) : (
                    data.software.upcomingRenewals.map((item, index) => {
                      const days = daysRemaining(
                        item.expiryDate,
                        data.generatedAt,
                      );
                      return (
                        <tr key={`${item.name}-${index}`}>
                          <td>
                            <strong>{item.name}</strong>
                          </td>
                          <td>{item.expiryDate}</td>
                          <td>{item.owner}</td>
                          <td>
                            <span
                              className={
                                days <= 30 ? "renewal-due" : "renewal-ok"
                              }
                            >
                              {days} days
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {show("maintenance") && data && (
          <section className="panel">
            <div className="panel-head reports-panel-head">
              <div>
                <h2>Maintenance Summary</h2>
                <p>Active planner workload and maintenance history.</p>
              </div>
              <Link className="btn" href="/maintenance-center">
                Open Maintenance Center
              </Link>
            </div>
            <div className="panel-body maintenance-report-grid">
              {[
                ["Total Records", data.maintenance.total],
                ["Planned", data.maintenance.planned],
                ["Open Work", data.maintenance.open],
                ["History Records", data.maintenance.completed],
                [
                  "Recorded Cost",
                  data.maintenance.cost.toLocaleString(undefined, {
                    style: "currency",
                    currency: "USD",
                  }),
                ],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </section>
        )}
        {!loading && data && allowedSections.length === 0 && (
          <section className="panel">
            <div className="panel-body reports-empty">
              <h2>No report sections available</h2>
              <p>
                The assigned role needs View permission for Assets, Software, or
                Maintenance.
              </p>
            </div>
          </section>
        )}
      </section>
    </Master>
  );
}
