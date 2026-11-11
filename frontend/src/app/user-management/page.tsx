import type { Metadata } from "next";
import UserManagement from "@/components/user-management";
import "./user-management.css";

export const metadata: Metadata = {
  title: "User Management | Asset Management",
};

export default function UserManagementPage() {
  return <UserManagement />;
}
