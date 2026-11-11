export type BulkImportIssue = {
  row: number;
  assetTag: string;
  reason: string;
};

export type BulkImportResult = {
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  skipped: BulkImportIssue[];
  failed: BulkImportIssue[];
};
