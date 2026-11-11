import type { Metadata } from "next";
import SoftwareManagement from "@/components/software-management";
import "./software-management.css";

export const metadata: Metadata = {
  title: "Software & Warranty | Asset Management",
};

export default function SoftwareManagementPage() {
  return <SoftwareManagement />;
}
