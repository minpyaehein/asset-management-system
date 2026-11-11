import type { Metadata } from "next";
import MaintenanceCenter from "@/components/maintenance-center";
import "./maintenance-center.css";

export const metadata: Metadata = {
  title: "Maintenance Center | Asset Management",
};

export default function Page() {
  return <MaintenanceCenter />;
}
