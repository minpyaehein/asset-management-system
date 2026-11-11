import type { Metadata } from "next";
import RoleManagement from "@/components/role-management";
import "./role-management.css";

export const metadata: Metadata = {
  title: "Role Management | Asset Management",
};

export default function RoleManagementPage() {
  return <RoleManagement />;
}
