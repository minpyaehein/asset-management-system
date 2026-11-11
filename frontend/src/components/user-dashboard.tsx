"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import Master from "./master";
const stats = [
    { label: "Inventory", value: "06", foot: "Sample assets in this demo", icon: "▣", section: "inventory" },
    { label: "Available", value: "03", foot: "Ready to allocate", icon: "✓", section: "inventory" },
    { label: "Assigned", value: "02", foot: "Currently in use", icon: "♙", section: "activity" },
    { label: "Renewals Due", value: "01", foot: "Review agreements", icon: "◷", section: "software" },
];
const links = [
    ["Assets & Hardware", "/assets", "▣", "inventory"], ["Employees", "/employees", "♙", "activity"], ["Check-in / Check-out", "/checkin-checkout", "⇄", "activity"], ["Software & Warranty", "/software-management", "▤", "software"], ["Service Desk", "/service-desk", "◉", "activity"], ["Maintenance Center", "/maintenance-center", "◷", "maintenance"], ["Reports & Analytics", "/reports", "▥", "activity"],
] as const;
export default function UserDashboard() { const [search, setSearch] = useState(""), [section, setSection] = useState(""); const match = (text: string, group: string) => (!section || section === group) && (!search || text.toLowerCase().includes(search.toLowerCase())); const visibleStats = useMemo(() => stats.filter(s => match(`${s.label} ${s.foot}`, s.section)), [search, section]); const visibleLinks = useMemo(() => links.filter(([name, , , group]) => match(name, group)), [search, section]); return <Master title="Agent Dashboard" onSearchChange={setSearch} onFilterChange={setSection}><section className="content"><div className="page-head"><div><div className="eyebrow">Overview</div><h1>Agent Dashboard</h1><p>Operational shortcuts and current inventory overview.</p></div><div className="button-row"><Link className="btn primary" href="/assets">＋ View Inventory</Link><Link className="btn" href="/reports">Open Reports</Link></div></div><div className="notice">Welcome to Asset Management. Use the left menu or quick-access cards to open an operational module.</div><div className="stats">{visibleStats.map(s => <div className="stat" key={s.label}><div className="stat-top">{s.label}<span className="stat-icon">{s.icon}</span></div><div className="stat-value">{s.value}</div><div className="stat-foot">{s.foot}</div></div>)}</div><div className="panel"><div className="panel-head"><div><h2>Quick Access</h2><p>Commonly used modules</p></div></div><div className="panel-body"><div className="quick-grid">{visibleLinks.map(([name, href, icon]) => <Link className="quick-link" href={href} key={href}><span className="quick-icon">{icon}</span><span><strong>{name}</strong><small>Open module →</small></span></Link>)}</div></div></div></section></Master> }
