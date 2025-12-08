/**
 * Tests for CLI output utilities
 */

import { describe, expect, test } from "bun:test";
import { colors, formatError, symbols } from "../../src/utils/output";

describe("Output Utilities", () => {
  describe("colors", () => {
    test("exports all expected color functions", () => {
      expect(colors.success).toBeDefined();
      expect(colors.error).toBeDefined();
      expect(colors.warning).toBeDefined();
      expect(colors.info).toBeDefined();
      expect(colors.dim).toBeDefined();
      expect(colors.bold).toBeDefined();
      expect(colors.command).toBeDefined();
      expect(colors.path).toBeDefined();
      expect(colors.value).toBeDefined();
      expect(colors.key).toBeDefined();
      expect(colors.version).toBeDefined();
    });

    test("color functions return strings", () => {
      expect(typeof colors.success("test")).toBe("string");
      expect(typeof colors.error("test")).toBe("string");
      expect(typeof colors.warning("test")).toBe("string");
      expect(typeof colors.info("test")).toBe("string");
      expect(typeof colors.dim("test")).toBe("string");
      expect(typeof colors.bold("test")).toBe("string");
    });

    test("color functions preserve input text", () => {
      const input = "Hello World";
      // The text should be contained in the output (may have color codes)
      expect(colors.success(input)).toContain("Hello");
      expect(colors.error(input)).toContain("World");
    });
  });

  describe("symbols", () => {
    test("exports all expected symbols", () => {
      expect(symbols.success).toBeDefined();
      expect(symbols.error).toBeDefined();
      expect(symbols.warning).toBeDefined();
      expect(symbols.info).toBeDefined();
      expect(symbols.arrow).toBeDefined();
      expect(symbols.bullet).toBeDefined();
      expect(symbols.check).toBeDefined();
      expect(symbols.cross).toBeDefined();
    });

    test("symbols are non-empty strings", () => {
      expect(symbols.success.length).toBeGreaterThan(0);
      expect(symbols.error.length).toBeGreaterThan(0);
      expect(symbols.warning.length).toBeGreaterThan(0);
      expect(symbols.info.length).toBeGreaterThan(0);
    });
  });

  describe("formatError", () => {
    test("formats Error objects", () => {
      const error = new Error("Something went wrong");
      expect(formatError(error)).toBe("Something went wrong");
    });

    test("formats string errors", () => {
      expect(formatError("String error")).toBe("String error");
    });

    test("formats number errors", () => {
      expect(formatError(42)).toBe("42");
    });

    test("formats null", () => {
      expect(formatError(null)).toBe("null");
    });

    test("formats undefined", () => {
      expect(formatError(undefined)).toBe("undefined");
    });

    test("formats object errors", () => {
      const result = formatError({ code: "ERR_123" });
      expect(result).toContain("object");
    });
  });
});

describe("TableColumn type", () => {
  test("accepts valid column configuration", () => {
    const column: {
      key: string;
      header: string;
      width?: number;
      align?: "left" | "right" | "center";
    } = {
      key: "name",
      header: "Name",
      width: 20,
      align: "left" as const,
    };

    expect(column.key).toBe("name");
    expect(column.header).toBe("Name");
    expect(column.width).toBe(20);
    expect(column.align).toBe("left");
  });

  test("width and align are optional", () => {
    const column: {
      key: string;
      header: string;
      width?: number;
      align?: "left" | "right" | "center";
    } = {
      key: "id",
      header: "ID",
    };

    expect(column.key).toBe("id");
    expect(column.header).toBe("ID");
    expect(column.width).toBeUndefined();
    expect(column.align).toBeUndefined();
  });
});
