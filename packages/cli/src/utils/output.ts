/**
 * Output utilities for CLI
 *
 * Provides consistent formatting, colors, and output helpers
 */

import pc from "picocolors";

// ============================================================================
// Colors and Formatting
// ============================================================================

export const colors = {
  // Status colors
  success: pc.green,
  error: pc.red,
  warning: pc.yellow,
  info: pc.blue,
  dim: pc.dim,
  bold: pc.bold,

  // Semantic colors
  command: pc.cyan,
  path: pc.underline,
  value: pc.yellow,
  key: pc.bold,
  version: pc.magenta,
};

// ============================================================================
// Symbols
// ============================================================================

export const symbols = {
  success: pc.green("✓"),
  error: pc.red("✗"),
  warning: pc.yellow("⚠"),
  info: pc.blue("ℹ"),
  arrow: pc.dim("→"),
  bullet: pc.dim("•"),
  check: pc.green("✔"),
  cross: pc.red("✘"),
};

// ============================================================================
// Output Functions
// ============================================================================

/**
 * Print a success message
 */
export function success(message: string): void {
  console.log(`${symbols.success} ${message}`);
}

/**
 * Print an error message
 */
export function error(message: string): void {
  console.error(`${symbols.error} ${colors.error(message)}`);
}

/**
 * Print a warning message
 */
export function warning(message: string): void {
  console.warn(`${symbols.warning} ${colors.warning(message)}`);
}

/**
 * Print an info message
 */
export function info(message: string): void {
  console.log(`${symbols.info} ${message}`);
}

/**
 * Print a dim/subtle message
 */
export function dim(message: string): void {
  console.log(colors.dim(message));
}

/**
 * Print a newline
 */
export function newline(): void {
  console.log();
}

/**
 * Print a header
 */
export function header(text: string): void {
  console.log();
  console.log(colors.bold(text));
  console.log(colors.dim("─".repeat(text.length)));
}

/**
 * Print a key-value pair
 */
export function keyValue(key: string, value: string, indent = 0): void {
  const padding = " ".repeat(indent);
  console.log(`${padding}${colors.key(key)}: ${value}`);
}

/**
 * Print a list item
 */
export function listItem(text: string, indent = 0): void {
  const padding = " ".repeat(indent);
  console.log(`${padding}${symbols.bullet} ${text}`);
}

// ============================================================================
// Tables
// ============================================================================

export interface TableColumn {
  key: string;
  header: string;
  width?: number;
  align?: "left" | "right" | "center";
}

/**
 * Print a simple table
 */
export function table<T extends Record<string, unknown>>(data: T[], columns: TableColumn[]): void {
  if (data.length === 0) {
    dim("  No items to display");
    return;
  }

  // Calculate column widths
  const widths = columns.map((col) => {
    const headerWidth = col.header.length;
    const maxDataWidth = Math.max(...data.map((row) => String(row[col.key] ?? "").length));
    return col.width ?? Math.max(headerWidth, maxDataWidth);
  });

  // Print header
  const headerLine = columns
    .map((col, i) => pad(col.header, widths[i] ?? col.header.length, col.align))
    .join("  ");
  console.log(colors.bold(headerLine));
  console.log(colors.dim("─".repeat(headerLine.length)));

  // Print rows
  for (const row of data) {
    const line = columns
      .map((col, i) => pad(String(row[col.key] ?? ""), widths[i] ?? 10, col.align))
      .join("  ");
    console.log(line);
  }
}

function pad(text: string, width: number, align: "left" | "right" | "center" = "left"): string {
  const padding = width - text.length;
  if (padding <= 0) return text.slice(0, width);

  switch (align) {
    case "right":
      return " ".repeat(padding) + text;
    case "center": {
      const left = Math.floor(padding / 2);
      const right = padding - left;
      return " ".repeat(left) + text + " ".repeat(right);
    }
    default:
      return text + " ".repeat(padding);
  }
}

// ============================================================================
// JSON Output
// ============================================================================

/**
 * Print data as JSON (for --json flag)
 */
export function json(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Print data as compact JSON
 */
export function jsonCompact(data: unknown): void {
  console.log(JSON.stringify(data));
}

// ============================================================================
// Error Formatting
// ============================================================================

/**
 * Format an error for display
 */
export function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

/**
 * Print an error with details
 */
export function errorWithDetails(message: string, details?: string): void {
  error(message);
  if (details) {
    console.error(colors.dim(`  ${details}`));
  }
}

/**
 * Print a suggestion after an error
 */
export function suggest(message: string): void {
  console.log();
  console.log(`${colors.info("Suggestion:")} ${message}`);
}

// ============================================================================
// Progress / Status
// ============================================================================

/**
 * Print a status line that can be updated
 */
export function status(message: string): void {
  process.stdout.write(`\r${symbols.info} ${message}`);
}

/**
 * Clear the current line
 */
export function clearLine(): void {
  process.stdout.write("\r\x1b[K");
}
