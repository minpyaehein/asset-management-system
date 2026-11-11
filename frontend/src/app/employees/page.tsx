import type { Metadata } from "next";
import Employees from "@/components/employees";
import "./employees.css";

export const metadata: Metadata = {
  title: "Employees | Asset Management",
};

export default function EmployeesPage() {
  return <Employees />;
}
