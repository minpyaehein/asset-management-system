import type { Metadata } from "next";
import Assets from "@/components/assets";
import "./assets.css";

export const metadata: Metadata = {
  title: "Assets & Hardware | Asset Management",
};

export default function AssetsPage() {
  return <Assets />;
}
