import type { Metadata } from "next";
import Reports from "@/components/reports";
import "./reports.css";

export const metadata: Metadata = {
  title: "Reports & Analytics | Asset Management",
};

export default function ReportsPage() {
  return <Reports />;
}
