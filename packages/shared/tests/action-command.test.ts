/**
 * Tests for buildCommand and jsonArgsToFlags (passthrough arg model).
 */

import { describe, expect, test } from "bun:test";
import { buildCommand, jsonArgsToFlags } from "../src/execution/action-command";

describe("buildCommand", () => {
  test("splits string command into array", () => {
    expect(buildCommand("python main.py")).toEqual(["python", "main.py"]);
  });

  test("handles array command", () => {
    expect(buildCommand(["python", "main.py"])).toEqual(["python", "main.py"]);
  });

  test("appends args to string command", () => {
    expect(buildCommand("python main.py", ["--url", "https://example.com"])).toEqual([
      "python",
      "main.py",
      "--url",
      "https://example.com",
    ]);
  });

  test("appends args to array command", () => {
    expect(buildCommand(["echo", "hello"], ["world"])).toEqual(["echo", "hello", "world"]);
  });

  test("returns base command when no args", () => {
    expect(buildCommand("echo hello")).toEqual(["echo", "hello"]);
  });

  test("returns base command with empty args", () => {
    expect(buildCommand("echo hello", [])).toEqual(["echo", "hello"]);
  });

  test("handles extra whitespace in string command", () => {
    expect(buildCommand("python   main.py   --verbose")).toEqual([
      "python",
      "main.py",
      "--verbose",
    ]);
  });

  test("does not modify original array", () => {
    const original = ["python", "main.py"];
    buildCommand(original, ["--flag"]);
    expect(original).toEqual(["python", "main.py"]);
  });

  test("handles single-word command", () => {
    expect(buildCommand("ls", ["-la"])).toEqual(["ls", "-la"]);
  });

  test("handles empty string command", () => {
    expect(buildCommand("", ["arg"])).toEqual(["arg"]);
  });
});

describe("jsonArgsToFlags", () => {
  test("converts string value to --key value", () => {
    expect(jsonArgsToFlags({ url: "https://example.com" })).toEqual([
      "--url",
      "https://example.com",
    ]);
  });

  test("converts number value to --key value", () => {
    expect(jsonArgsToFlags({ limit: 10 })).toEqual(["--limit", "10"]);
  });

  test("converts true to flag-only --key", () => {
    expect(jsonArgsToFlags({ verbose: true })).toEqual(["--verbose"]);
  });

  test("omits false values", () => {
    expect(jsonArgsToFlags({ verbose: false })).toEqual([]);
  });

  test("omits null values", () => {
    expect(jsonArgsToFlags({ name: null })).toEqual([]);
  });

  test("omits undefined values", () => {
    expect(jsonArgsToFlags({ name: undefined })).toEqual([]);
  });

  test("converts object to JSON string", () => {
    expect(jsonArgsToFlags({ config: { key: "value" } })).toEqual(["--config", '{"key":"value"}']);
  });

  test("converts array to JSON string", () => {
    expect(jsonArgsToFlags({ items: [1, 2, 3] })).toEqual(["--items", "[1,2,3]"]);
  });

  test("handles multiple params", () => {
    expect(jsonArgsToFlags({ url: "https://example.com", limit: 5, verbose: true })).toEqual([
      "--url",
      "https://example.com",
      "--limit",
      "5",
      "--verbose",
    ]);
  });

  test("handles empty object", () => {
    expect(jsonArgsToFlags({})).toEqual([]);
  });

  test("handles mixed truthy and falsy values", () => {
    expect(
      jsonArgsToFlags({
        name: "Alice",
        debug: true,
        quiet: false,
        missing: null,
        count: 3,
      })
    ).toEqual(["--name", "Alice", "--debug", "--count", "3"]);
  });
});
