import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import type { DataRow } from "./types";

export function parseCSV(csvData: string): DataRow[] {
  try {
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    return records;
  } catch (error) {
    throw new Error(`CSV parsing failed: ${(error as Error).message}`);
  }
}

export function toCSV(data: DataRow[]): string {
  try {
    if (data.length === 0) {
      return "";
    }
    return stringify(data, {
      header: true,
      quoted: true,
    });
  } catch (error) {
    throw new Error(`CSV generation failed: ${(error as Error).message}`);
  }
}

export function getColumns(data: DataRow[]): string[] {
  if (data.length === 0) return [];
  return Object.keys(data[0]);
}
