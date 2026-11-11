"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Master from "./master";

type DashboardSection = "inventory" | "software" | "maintenance" | "activity";
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

type DashboardResponse = {
  generatedAt: string;
  roleName: string;
  dashboardAccess: AccessLevel;
  stats: {
    inventory: number;
    available: number;
    assigned: number;
    maintenance: number;
  };
  permissions: Permission[];
};

type QuickAccessItem = {
  label: string;
  description: string;
  href: string;
  icon: string;
  section: DashboardSection;
  module: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const quickAccessItems: QuickAccessItem[] = [
  {
    label: "Assets & Hardware",
    description: "Manage inventory records",
    href: "/assets",
    icon: "▣",
    section: "inventory",
    module: "Assets & Hardware",
  },
  {
    label: "Employees",
    description: "Manage employee records",
    href: "/employees",
    icon: "♙",
    section: "activity",
    module: "Employees",
  },
  {
    label: "Check-in / Check-out",
    description: "Assign and return assets",
    href: "/checkin-checkout",
    icon: "⇄",
    section: "activity",
    module: "Check-in / Check-out",
  },
  {
    label: "Software & Warranty",
    description: "Manage licenses and warranties",
    href: "/software-management",
    icon: "▤",
    section: "software",
    module: "Software & Warranty",
  },
  {
    label: "Service Desk",
    description: "Open support requests",
    href: "/service-desk",
    icon: "◉",
    section: "activity",
    module: "Service Desk",
  },
  {
    label: "Asset Transfer",
    description: "Track asset movements",
    href: "/asset-transfer",
    icon: "⇆",
    section: "activity",
    module: "Asset Transfer",
  },
  {
    label: "Acknowledgement",
    description: "Confirm equipment receipt",
    href: "/acknowledgement",
    icon: "✓",
    section: "activity",
    module: "Acknowledgement",
  },
  {
    label: "Asset Disposal",
    description: "Manage disposal requests",
    href: "/asset-disposal",
    icon: "⌫",
    section: "inventory",
    module: "Asset Disposal",
  },
  {
    label: "Maintenance Center",
    description: "Plan asset maintenance",
    href: "/maintenance-center",
    icon: "◷",
    section: "maintenance",
    module: "Maintenance Center",
  },
  {
    label: "Reports & Analytics",
    description: "Review inventory reports",
    href: "/reports",
    icon: "▥",
    section: "activity",
    module: "Reports & Analytics",
  },
  {
    label: "Notifications",
    description: "Review automatic alerts",
    href: "/notifications",
    icon: "♢",
    section: "activity",
    module: "Notifications",
  },
  {
    label: "Audit Logs",
    description: "Monitor system activity",
    href: "/audit-logs",
    icon: "☷",
    section: "activity",
    module: "Audit Logs",
  },
  {
    label: "User Management",
    description: "Manage system users",
    href: "/user-management",
    icon: "♙",
    section: "activity",
    module: "User Management",
  },
  {
    label: "Role Management",
    description: "Manage access permissions",
    href: "/role-management",
    icon: "⚿",
    section: "activity",
    module: "Role Management",
  },
];

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDashboardResponse(value: unknown): DashboardResponse {
  const body = (
    value && typeof value === "object" ? value : {}
  ) as Partial<DashboardResponse>;
  const stats =
    body.stats && typeof body.stats === "object" ? body.stats : undefined;

  return {
    generatedAt:
      typeof body.generatedAt === "string"
        ? body.generatedAt
        : new Date().toISOString(),
    roleName:
      typeof body.roleName === "string" ? body.roleName : "Assigned role",
    dashboardAccess:
      body.dashboardAccess === "Own Only" ||
        body.dashboardAccess === "Assigned" ||
        body.dashboardAccess === "All"
        ? body.dashboardAccess
        : "All",
    stats: {
      inventory: safeNumber(stats?.inventory),
      available: safeNumber(stats?.available),
      assigned: safeNumber(stats?.assigned),
      maintenance: safeNumber(stats?.maintenance),
    },
    permissions: Array.isArray(body.permissions) ? body.permissions : [],
  };
}

function getUserId() {
  const value = Number(
    sessionStorage.getItem("assetManagementUserId") ??
    sessionStorage.getItem("stockwiseUserId") ??
    "0",
  );
  return Number.isFinite(value) && value > 0 ? value : null;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<"" | DashboardSection>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [live] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (silent = false) => {
    const userId = getUserId();
    if (!userId) {
      setError("Your login session is incomplete. Sign out and sign in again.");
      setLoading(false);
      return;
    }

    if (!silent) setRefreshing(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/dashboard/summary`, {
        headers: {
          Accept: "application/json",
          "X-User-Id": String(userId),
        },
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          Array.isArray(body?.message)
            ? body.message.join(", ")
            : body?.message || "Unable to load dashboard.",
        );
      }
      setData(normalizeDashboardResponse(body));
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Unable to load dashboard.",
      );
    } finally {
      setLoading(false);
      if (!silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!live) return;

    const refresh = () => {
      if (document.visibilityState === "visible") void loadDashboard(true);
    };
    const handleDataUpdated = () => void loadDashboard(true);
    const intervalId = window.setInterval(refresh, 5_000);

    window.addEventListener("focus", refresh);
    window.addEventListener("dashboard-data-updated", handleDataUpdated);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("dashboard-data-updated", handleDataUpdated);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [live, loadDashboard]);

  const permissionMap = useMemo(
    () =>
      new Map(
        (data?.permissions ?? []).map((permission) => [
          permission.module,
          permission,
        ]),
      ),
    [data],
  );

  const stats = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: "Active Inventory",
        value: safeNumber(data.stats?.inventory),
        description: "Operational asset records",
        icon: "▣",
        section: "inventory" as DashboardSection,
      },
      {
        label: "Available",
        value: safeNumber(data.stats?.available),
        description: "Ready to allocate",
        icon: "✓",
        section: "inventory" as DashboardSection,
      },
      {
        label: "Assigned",
        value: safeNumber(data.stats?.assigned),
        description: "Currently in use",
        icon: "♙",
        section: "activity" as DashboardSection,
      },
      {
        label: "Maintenance",
        value: safeNumber(data.stats?.maintenance),
        description: "Requires maintenance",
        icon: "◷",
        section: "maintenance" as DashboardSection,
      },
    ];
  }, [data]);

  const filteredStats = useMemo(() => {
    const query = search.trim().toLowerCase();
    return stats.filter(
      (stat) =>
        (!section || stat.section === section) &&
        (!query ||
          `${stat.label} ${stat.value} ${stat.description}`
            .toLowerCase()
            .includes(query)),
    );
  }, [search, section, stats]);

  const filteredQuickAccessItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return quickAccessItems.filter((item) => {
      const permission = permissionMap.get(item.module);
      return (
        permission?.canView === true &&
        (!section || item.section === section) &&
        (!query ||
          `${item.label} ${item.description}`.toLowerCase().includes(query))
      );
    });
  }, [permissionMap, search, section]);

  const hasResults =
    filteredStats.length > 0 || filteredQuickAccessItems.length > 0;
  const canViewAssets =
    permissionMap.get("Assets & Hardware")?.canView === true;
  const canViewReports =
    permissionMap.get("Reports & Analytics")?.canView === true;

  return (
    <Master>
      <section className="content dashboard-content">
        <header className="dashboard-hero">
          <div>
            <div className="eyebrow">Overview</div>
            <h1>Dashboard</h1>
            <p>
              Live inventory overview that refreshes automatically when data
              changes.
            </p>
          </div>
          <div className="button-row">
            {canViewAssets && (
              <Link className="btn primary" href="/assets">
                View Inventory
              </Link>
            )}
            {canViewReports && (
              <Link className="btn" href="/reports">
                Open Reports
              </Link>
            )}
          </div>
        </header>

        <div className="dashboard-toolbar">
          <div className="dashboard-live">
            <div>
              <small>
                {data
                  ? `Updated ${new Date(data.generatedAt).toLocaleString()}`
                  : "Waiting for data"}
              </small>
            </div>
          </div>
          <input
            placeholder="Search dashboard"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            value={section}
            onChange={(event) =>
              setSection(event.target.value as "" | DashboardSection)
            }
          >
            <option value="">All sections</option>
            <option value="inventory">Inventory</option>
            <option value="software">Software</option>
            <option value="maintenance">Maintenance</option>
            <option value="activity">Activity</option>
          </select>
          
          <button
            className="btn"
            type="button"
            disabled={refreshing}
            onClick={() => void loadDashboard()}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="dashboard-message error" role="alert">
            {error}
          </div>
        )}
        {loading ? (
          <section className="panel">
            <div className="panel-body dashboard-empty">
              <h2>Loading dashboard...</h2>
            </div>
          </section>
        ) : !hasResults ? (
          <section className="panel">
            <div className="panel-body dashboard-empty">
              <h2>No matching sections</h2>
              <p>Change the search text or select another filter.</p>
            </div>
          </section>
        ) : null}

        {filteredStats.length > 0 && (
          <div className="dashboard-stats">
            {filteredStats.map((stat) => (
              <article key={stat.label}>
                <div>
                  <span>{stat.label}</span>
                  <b aria-hidden="true">{stat.icon}</b>
                </div>
                <strong>{safeNumber(stat.value).toLocaleString()}</strong>
                <small>{stat.description}</small>
              </article>
            ))}
          </div>
        )}

        {filteredQuickAccessItems.length > 0 && (
          <section className="panel">
            <div className="panel-head dashboard-panel-head">
              <div>
                <h2>Quick Access</h2>
                <p>
                  Only modules permitted by the assigned role are displayed.
                </p>
              </div>
              <span className="count">
                {filteredQuickAccessItems.length} modules
              </span>
            </div>
            <div className="panel-body">
              <div className="dashboard-quick-grid">
                {filteredQuickAccessItems.map((item) => (
                  <Link
                    className="dashboard-quick-link"
                    href={item.href}
                    key={item.href}
                  >
                    <span className="dashboard-quick-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description} →</small>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </section>
    </Master>
  );
}
