"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type AccessLevel = "Own Only" | "Assigned" | "All";
type PermissionKey =
  | "canView"
  | "canAdd"
  | "canEdit"
  | "canDeactivate"
  | "canExport";

type RolePermission = {
  id?: number;
  roleId?: number;
  module: string;
  access: AccessLevel;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDeactivate: boolean;
  canExport: boolean;
};

type UserRecord = {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  status: "Active" | "Inactive";
  roleId: number;
};

type RoleRecord = {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  permissions: RolePermission[];
};

type NotificationRecord = {
  id: number;
  isRead: boolean;
};

type MasterProps = {
  children: ReactNode;
  title?: string;
  section?: string;
  showSearch?: boolean;
  showFilter?: boolean;
  onSearchChange?: (value: string) => void;
  onFilterChange?: (value: string) => void;
  filterOptions?: Array<{ label: string; value: string }>;
};

type NavigationItem = {
  label: string;
  href: string;
  icon: string;
  module: string;
  permission?: PermissionKey;
};

type NavigationGroup = {
  caption: string;
  items: NavigationItem[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const SIDEBAR_SCROLL_KEY = "assetManagementSidebarScrollTop";
const NOTIFICATION_REFRESH_MS = 10_000;

const navigationGroups: NavigationGroup[] = [
  {
    caption: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "▦", module: "Dashboard" },
    ],
  },
  {
    caption: "Inventory",
    items: [
      {
        label: "Assets & Hardware",
        href: "/assets",
        icon: "▣",
        module: "Assets & Hardware",
      },
      { label: "Employees", href: "/employees", icon: "♙", module: "Employees" },
      {
        label: "Check-in / Check-out",
        href: "/checkin-checkout",
        icon: "⇄",
        module: "Check-in / Check-out",
      },
    ],
  },
  {
    caption: "Software",
    items: [
      {
        label: "Software & Warranty",
        href: "/software-management",
        icon: "▤",
        module: "Software & Warranty",
      },
    ],
  },
  {
    caption: "Operations",
    items: [
      { label: "Service Desk", href: "/service-desk", icon: "◉", module: "Service Desk" },
      {
        label: "Asset Transfer",
        href: "/asset-transfer",
        icon: "⇆",
        module: "Asset Transfer",
      },
      {
        label: "Acknowledgement",
        href: "/acknowledgement",
        icon: "✓",
        module: "Acknowledgement",
      },
      {
        label: "Asset Disposal",
        href: "/asset-disposal",
        icon: "⌫",
        module: "Asset Disposal",
      },
    ],
  },
  {
    caption: "Maintenance",
    items: [
      {
        label: "Maintenance Center",
        href: "/maintenance-center",
        icon: "↻",
        module: "Maintenance Center",
      },
    ],
  },
  {
    caption: "Insights",
    items: [
      {
        label: "Reports & Analytics",
        href: "/reports",
        icon: "▥",
        module: "Reports & Analytics",
      },
      {
        label: "Notifications",
        href: "/notifications",
        icon: "♢",
        module: "Notifications",
      },
      { label: "Audit Logs", href: "/audit-logs", icon: "☷", module: "Audit Logs" },
    ],
  },
  {
    caption: "Administration",
    items: [
      {
        label: "User Management",
        href: "/user-management",
        icon: "♙",
        module: "User Management",
      },
      {
        label: "Role Management",
        href: "/role-management",
        icon: "⚿",
        module: "Role Management",
      },
    ],
  },
];

const protectedRoutes: NavigationItem[] = [
  ...navigationGroups.flatMap((group) => group.items),
  {
    label: "Bulk Asset Import",
    href: "/bulk-asset-import",
    icon: "⇧",
    module: "Assets & Hardware",
    permission: "canAdd",
  },
];

function getSessionUserId(): number | null {
  const value = Number(
    sessionStorage.getItem("assetManagementUserId") ??
      sessionStorage.getItem("stockwiseUserId") ??
      "0",
  );

  return Number.isFinite(value) && value > 0 ? value : null;
}

export default function Master({ children }: MasterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sidebarNavigationRef = useRef<HTMLDivElement | null>(null);
  const restoredScrollRef = useRef(false);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [roleName, setRoleName] = useState("");
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accessError, setAccessError] = useState("");

  const permissionMap = useMemo(
    () => new Map(permissions.map((permission) => [permission.module, permission])),
    [permissions],
  );

  const saveSidebarScroll = useCallback(() => {
    const navigation = sidebarNavigationRef.current;
    if (!navigation) return;
    sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(navigation.scrollTop));
  }, []);

  const loadUnreadNotificationCount = useCallback(async (userId: number) => {
    try {
      const response = await fetch(`${API_URL}/notifications`, {
        headers: {
          Accept: "application/json",
          "X-User-Id": String(userId),
        },
        cache: "no-store",
      });

      if (!response.ok) {
        setUnreadNotificationCount(0);
        return;
      }

      const body = await response.json().catch(() => null);
      const notifications: NotificationRecord[] = Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
          ? body.data
          : [];

      setUnreadNotificationCount(
        notifications.filter((notification) => !notification.isRead).length,
      );
    } catch {
      setUnreadNotificationCount(0);
    }
  }, []);

  const loadCurrentUserAccess = useCallback(async () => {
    setIsCheckingSession(true);
    setAccessError("");

    const userId = getSessionUserId();
    if (!userId) {
      router.replace("/login");
      return;
    }

    try {
      const userResponse = await fetch(`${API_URL}/users/${userId}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const userBody = await userResponse.json().catch(() => null);
      if (!userResponse.ok) {
        throw new Error(userBody?.message ?? "Unable to load the current user.");
      }

      const currentUser = userBody as UserRecord;
      if (currentUser.status !== "Active") {
        throw new Error("Your user account is inactive.");
      }

      const roleResponse = await fetch(`${API_URL}/roles/${currentUser.roleId}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const roleBody = await roleResponse.json().catch(() => null);
      if (!roleResponse.ok) {
        throw new Error(roleBody?.message ?? "Unable to load the assigned role.");
      }

      const assignedRole = roleBody as RoleRecord;
      if (!assignedRole.isActive) {
        throw new Error("Your assigned role is inactive.");
      }

      const loadedPermissions = Array.isArray(assignedRole.permissions)
        ? assignedRole.permissions
        : [];

      setName(currentUser.fullName || currentUser.username);
      setUsername(currentUser.username);
      setRoleName(assignedRole.name);
      setPermissions(loadedPermissions);

      sessionStorage.setItem("assetManagementUserId", String(currentUser.id));
      sessionStorage.setItem(
        "assetManagementName",
        currentUser.fullName || currentUser.username,
      );
      sessionStorage.setItem("assetManagementUsername", currentUser.username);
      sessionStorage.setItem("assetManagementDatabaseRole", assignedRole.name);
      sessionStorage.setItem("assetManagementDatabaseRoleId", String(assignedRole.id));
      sessionStorage.setItem(
        "assetManagementPermissions",
        JSON.stringify(loadedPermissions),
      );

      void loadUnreadNotificationCount(currentUser.id);
    } catch (value) {
      setPermissions([]);
      setUnreadNotificationCount(0);
      setAccessError(
        value instanceof Error ? value.message : "Unable to load role permissions.",
      );
    } finally {
      setIsCheckingSession(false);
    }
  }, [loadUnreadNotificationCount, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCurrentUserAccess();
  }, [loadCurrentUserAccess]);

  useEffect(() => {
    const userId = getSessionUserId();
    if (!userId || isCheckingSession || accessError) return;

    const refresh = () => void loadUnreadNotificationCount(userId);
    const timer = window.setInterval(refresh, NOTIFICATION_REFRESH_MS);

    window.addEventListener("focus", refresh);
    window.addEventListener("asset-management-notifications-updated", refresh);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("asset-management-notifications-updated", refresh);
    };
  }, [accessError, isCheckingSession, loadUnreadNotificationCount]);

  useEffect(() => {
    if (isCheckingSession || restoredScrollRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      const navigation = sidebarNavigationRef.current;
      if (!navigation) return;

      const savedPosition = Number(sessionStorage.getItem(SIDEBAR_SCROLL_KEY) ?? "0");
      navigation.scrollTop = Number.isFinite(savedPosition) ? savedPosition : 0;
      restoredScrollRef.current = true;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isCheckingSession]);

  useEffect(() => {
    const navigation = sidebarNavigationRef.current;
    if (!navigation || !restoredScrollRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      const savedPosition = Number(sessionStorage.getItem(SIDEBAR_SCROLL_KEY) ?? "0");
      navigation.scrollTop = Number.isFinite(savedPosition) ? savedPosition : 0;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  function hasNavigationPermission(item: NavigationItem): boolean {
    const permission = permissionMap.get(item.module);
    const key = item.permission ?? "canView";
    return permission?.[key] === true;
  }

  function isActiveRoute(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const visibleNavigationGroups = useMemo(
    () =>
      navigationGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            const permission = permissionMap.get(item.module);
            return permission?.canView === true;
          }),
        }))
        .filter((group) => group.items.length > 0),
    [permissionMap],
  );

  const firstAvailableRoute = useMemo(() => {
    for (const group of visibleNavigationGroups) {
      if (group.items[0]) return group.items[0].href;
    }
    return "/profile";
  }, [visibleNavigationGroups]);

  useEffect(() => {
    if (isCheckingSession || accessError || pathname === "/profile") return;

    const requestedItem = protectedRoutes.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    );

    if (requestedItem && !hasNavigationPermission(requestedItem)) {
      router.replace(firstAvailableRoute);
    }
  }, [accessError, firstAvailableRoute, isCheckingSession, pathname, permissionMap, router]);

  function handleNavigationClick() {
    saveSidebarScroll();
    setSidebarOpen(false);
  }

  function handleLogout() {
    [
      "assetManagementRole",
      "assetManagementName",
      "assetManagementUserId",
      "assetManagementUsername",
      "assetManagementDatabaseRole",
      "assetManagementDatabaseRoleId",
      "assetManagementPermissions",
      SIDEBAR_SCROLL_KEY,
      "stockwiseRole",
      "stockwiseName",
      "stockwiseUserId",
      "stockwisePermissions",
    ].forEach((key) => sessionStorage.removeItem(key));

    router.replace("/login");
  }

  if (isCheckingSession) {
    return (
      <main className="session-loading">
        <div className="session-loading-card">
          <span className="session-loading-spinner" />
          <p>Loading role permissions...</p>
        </div>
      </main>
    );
  }

  if (accessError) {
    return (
      <main className="session-loading">
        <div className="session-access-error">
          <h1>Access unavailable</h1>
          <p>{accessError}</p>
          <button className="btn" type="button" onClick={handleLogout}>
            Return to Sign In
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="layout">
      <button
        className="sidebar-backdrop"
        aria-label="Close navigation"
        type="button"
        hidden={!sidebarOpen}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar${sidebarOpen ? " sidebar-open" : ""}`}>
        <div className="sidebar-header">
          <Link className="brand" href={firstAvailableRoute} onClick={handleNavigationClick}>
            <span className="brand-mark">
              <Image
                src="/logo.png"
                alt="Golden Pride logo"
                width={38}
                height={38}
                priority
              />
            </span>
            <span>
              Golden Pride
              <small>Asset Management</small>
            </span>
          </Link>
        </div>

        <div
          className="sidebar-navigation"
          ref={sidebarNavigationRef}
          onScroll={saveSidebarScroll}
        >
          <nav aria-label="Main navigation">
            {visibleNavigationGroups.map((group) => (
              <div className="nav-group" key={group.caption}>
                <div className="nav-caption">{group.caption}</div>
                <div className="nav-list">
                  {group.items.map((item) => {
                    const active = isActiveRoute(item.href);
                    const isNotifications = item.href === "/notifications";

                    return (
                      <Link
                        className={`nav-link${active ? " active" : ""}`}
                        href={item.href}
                        key={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={handleNavigationClick}
                      >
                        <span className="nav-icon" aria-hidden="true">
                          {item.icon}
                        </span>
                        <span className="nav-label">{item.label}</span>
                        {isNotifications && unreadNotificationCount > 0 && (
                          <span
                            className="notification-nav-badge"
                            aria-label={`${unreadNotificationCount} unread notifications`}
                          >
                            {unreadNotificationCount > 99
                              ? "99+"
                              : unreadNotificationCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="sidebar-user-section">
          <Link
            className={`sidebar-profile-link${pathname === "/profile" ? " active" : ""}`}
            href="/profile"
            onClick={handleNavigationClick}
          >
            <span className="sidebar-profile-avatar" aria-hidden="true">
              {name.trim().charAt(0).toUpperCase() || "U"}
            </span>
            <span className="sidebar-profile-copy">
              <strong>{name}</strong>
              <small>{roleName} · View profile</small>
              {username && <small>@{username}</small>}
            </span>
          </Link>

          <button className="sidebar-logout-button" type="button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <button
          className="mobile-menu-button"
          type="button"
          aria-label="Open navigation"
          aria-expanded={sidebarOpen}
          onClick={() => setSidebarOpen(true)}
        >
          ☰
        </button>
        {children}
      </main>
    </div>
  );
}
