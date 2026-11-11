import type { Metadata } from "next";
import BulkAssetImport from "@/components/bulk-asset-import";
import "./bulk-asset-import.css";

export const metadata: Metadata = {
  title: "Bulk Asset Import | Asset Management",
};

export default function BulkAssetImportPage() {
  return <BulkAssetImport />;
}
