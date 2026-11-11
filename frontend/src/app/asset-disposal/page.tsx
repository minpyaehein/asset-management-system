import type { Metadata } from "next";
import AssetDisposal from "@/components/asset-disposal";
import "./asset-disposal.css";

export const metadata: Metadata = {
  title: "Asset Disposal | Asset Management",
};

export default function AssetDisposalPage() {
  return <AssetDisposal />;
}
