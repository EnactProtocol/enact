export interface TransformOptions {
  input: string;
  inputFormat: "csv" | "json";
  outputFormat: "csv" | "json";
  filterColumn?: string;
  filterValue?: string;
  selectColumns?: string[];
}

export interface TransformResult {
  status: "success" | "error";
  data?: unknown;
  rowCount?: number;
  columnCount?: number;
  columns?: string[];
  error?: string;
}

export type DataRow = Record<string, unknown>;
