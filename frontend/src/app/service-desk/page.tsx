import type { Metadata } from "next";
import ServiceDesk from "@/components/service-desk";
import "./service-desk.css";

export const metadata: Metadata = {
  title: "Service Desk | Asset Management",
};

export default function ServiceDeskPage() {
  return <ServiceDesk />;
}
