export type HistoricalImportType = "fee_arrears" | "attendance_totals";

export type HistoricalImportRowStatus =
  | "matched"
  | "unmatched"
  | "ambiguous"
  | "duplicate"
  | "invalid";

export type HistoricalImportRow = {
  rowNumber: number;
  name: string;
  className: string;
  rawValue: string;
  value: number | null;
  studentId: string | null;
  classId: string | null;
  status: HistoricalImportRowStatus;
  message: string;
};

export type HistoricalImportPreview = {
  ok: boolean;
  message: string;
  importType: HistoricalImportType;
  fileName: string;
  totalRows: number;
  rows: HistoricalImportRow[];
};

export type HistoricalImportCommitResult = {
  ok: boolean;
  message: string;
  batchId?: string;
  importedRows?: number;
  skippedRows?: number;
};
