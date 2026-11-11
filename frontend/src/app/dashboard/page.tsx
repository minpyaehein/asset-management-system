import type { Metadata } from "next";
import Dashboard from "@/components/dashboard";
import "./dashboard.css";

export const metadata: Metadata = {
  title: "Dashboard | Asset Management",
};

export default function DashboardPage() {
  return <Dashboard />;
}
