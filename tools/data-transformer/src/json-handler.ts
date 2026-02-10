import type { DataRow } from "./types";

export function parseJSON(jsonData: string): DataRow[] {
  try {
    const parsed = JSON.parse(jsonData);

    // Handle both array of objects and single object
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (typeof parsed === "object" && parsed !== null) {
      return [parsed];
    }
    throw new Error("JSON must be an object or array of objects");
  } catch (error) {
    throw new Error(`JSON parsing failed: ${(error as Error).message}`);
  }
}

export function toJSON(data: DataRow[]): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch (error) {
    throw new Error(`JSON generation failed: ${(error as Error).message}`);
  }
}
