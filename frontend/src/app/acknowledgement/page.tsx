import type { Metadata } from "next";
import Acknowledgement from "@/components/acknowledgement";
import "./acknowledgement.css";

export const metadata: Metadata = {
  title: "Acknowledgement | Asset Management",
};

export default function AcknowledgementPage() {
  return <Acknowledgement />;
}
