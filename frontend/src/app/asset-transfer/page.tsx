import type { Metadata } from "next";
import AssetTransfer from "@/components/asset-transfer";
import "./asset-transfer.css";

export const metadata: Metadata = {
  title: "Asset Transfer | Asset Management",
};

export default function AssetTransferPage() {
  return <AssetTransfer />;
}
