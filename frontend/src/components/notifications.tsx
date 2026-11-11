"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Master from "./master";

type Notice = {
  id: number;
  type: string;
  title: string;
  message: string;
  referenceType: string | null;
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
};
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const getId = () =>
  Number(
    sessionStorage.getItem("assetManagementUserId") ??
      sessionStorage.getItem("stockwiseUserId") ??
      0,
  );
export default function Notifications() {
  const [rows, setRows] = useState<Notice[]>([]),
    [filter, setFilter] = useState<"All" | "Unread" | "Read">("All"),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState<number | "all" | null>(null);
  const load = useCallback(async () => {
    const id = getId();
    if (!id) {
      setError("Login session is incomplete.");
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(`${API}/notifications`, {
        headers: { "X-User-Id": String(id) },
        cache: "no-store",
      });
      const b = await r.json().catch(() => null);
      if (!r.ok) throw new Error(b?.message ?? "Unable to load notifications.");
      setRows(Array.isArray(b) ? b : []);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load notifications.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  const read = async (path: string, target: number | "all") => {
    setBusy(target);
    try {
      const r = await fetch(`${API}${path}`, {
        method: "PATCH",
        headers: { "X-User-Id": String(getId()) },
      });
      if (!r.ok) {
        const b = await r.json().catch(() => null);
        throw new Error(b?.message ?? "Unable to update notification.");
      }
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to update notification.",
      );
    } finally {
      setBusy(null);
    }
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => clearInterval(timer);
  }, [load]);
  const unread = rows.filter((x) => !x.isRead).length;
  const visible = useMemo(
    () =>
      rows.filter(
        (x) => filter === "All" || (filter === "Unread" ? !x.isRead : x.isRead),
      ),
    [filter, rows],
  );
  return (
    <Master>
      <section className="content personal-notices">
        <header className="notice-head">
          <div>
            <div className="eyebrow">Personal Alerts</div>
            <h1>Notifications</h1>
            <p>Account changes and actions that directly affect you.</p>
          </div>
          <div>
            <button className="btn" onClick={() => void load()}>
              Refresh
            </button>
            <button
              className="btn primary"
              disabled={!unread || busy === "all"}
              onClick={() => void read("/notifications/read-all", "all")}
            >
              Mark all as read
            </button>
          </div>
        </header>
        {error && <div className="notice-error">{error}</div>}
        <div className="notice-tabs">
          {(["All", "Unread", "Read"] as const).map((x) => (
            <button
              className={filter === x ? "active" : ""}
              key={x}
              onClick={() => setFilter(x)}
            >
              {x}
              <span>
                {x === "All"
                  ? rows.length
                  : x === "Unread"
                    ? unread
                    : rows.length - unread}
              </span>
            </button>
          ))}
        </div>
        <div className="notice-list">
          {loading ? (
            <div className="notice-empty">Loading notifications...</div>
          ) : !visible.length ? (
            <div className="notice-empty">
              <strong>No personal notifications</strong>
              <p>Account changes that affect you will appear here.</p>
            </div>
          ) : (
            visible.map((n) => (
              <article
                className={n.isRead ? "notice read" : "notice unread"}
                key={n.id}
              >
                <div className="notice-icon">
                  {n.type.includes("PASSWORD")
                    ? "P"
                    : n.type.includes("ROLE")
                      ? "R"
                      : "U"}
                </div>
                <div>
                  <div className="notice-title">
                    <h3>{n.title}</h3>
                    {!n.isRead && <span />}
                  </div>
                  <p>{n.message}</p>
                  <small>
                    {new Date(n.createdAt).toLocaleString()} ·{" "}
                    {n.type.replaceAll("_", " ")}
                  </small>
                </div>
                <div>
                  {!n.isRead ? (
                    <button
                      disabled={busy === n.id}
                      onClick={() =>
                        void read(`/notifications/${n.id}/read`, n.id)
                      }
                    >
                      Mark read
                    </button>
                  ) : (
                    <span className="read-label">Read</span>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </Master>
  );
}
