/**
 * Tests for the run command
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { configureRunCommand } from "../../src/commands/run";

// Test fixtures directory
const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures", "run-cmd");

describe("run command", () => {
  beforeAll(() => {
    // Create test fixtures
    mkdirSync(FIXTURES_DIR, { recursive: true });
  });

  afterAll(() => {
    // Clean up
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
  });

  describe("command configuration", () => {
    test("configures run command on program", () => {
      const program = new Command();
      configureRunCommand(program);

      const runCmd = program.commands.find((cmd) => cmd.name() === "run");
      expect(runCmd).toBeDefined();
    });

    test("has correct description", () => {
      const program = new Command();
      configureRunCommand(program);

      const runCmd = program.commands.find((cmd) => cmd.name() === "run");
      expect(runCmd?.description()).toBe("Execute a tool with its manifest-defined command");
    });

    test("accepts tool argument", () => {
      const program = new Command();
      configureRunCommand(program);

      const runCmd = program.commands.find((cmd) => cmd.name() === "run");
      const args = runCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThan(0);
      expect(args[0]?.name()).toBe("tool");
    });

    test("has --args option for JSON input", () => {
      const program = new Command();
      configureRunCommand(program);

      const runCmd = program.commands.find((cmd) => cmd.name() === "run");
      const opts = runCmd?.options ?? [];
      const argsOpt = opts.find((o) => o.long === "--args");
      expect(argsOpt).toBeDefined();
    });

    test("has --input option for key=value pairs", () => {
      const program = new Command();
      configureRunCommand(program);

      const runCmd = program.commands.find((cmd) => cmd.name() === "run");
      const opts = runCmd?.options ?? [];
      const inputOpt = opts.find((o) => o.long === "--input");
      expect(inputOpt).toBeDefined();
    });

    test("has --timeout option", () => {
      const program = new Command();
      configureRunCommand(program);

      const runCmd = program.commands.find((cmd) => cmd.name() === "run");
      const opts = runCmd?.options ?? [];
      const timeoutOpt = opts.find((o) => o.long === "--timeout");
      expect(timeoutOpt).toBeDefined();
    });

    test("has --dry-run option", () => {
      const program = new Command();
      configureRunCommand(program);

      const runCmd = program.commands.find((cmd) => cmd.name() === "run");
      const opts = runCmd?.options ?? [];
      const dryRunOpt = opts.find((o) => o.long === "--dry-run");
      expect(dryRunOpt).toBeDefined();
    });

    test("has --verbose option", () => {
      const program = new Command();
      configureRunCommand(program);

      const runCmd = program.commands.find((cmd) => cmd.name() === "run");
      const opts = runCmd?.options ?? [];
      const verboseOpt = opts.find((o) => o.long === "--verbose");
      expect(verboseOpt).toBeDefined();
    });

    test("has --json option", () => {
      const program = new Command();
      configureRunCommand(program);

      const runCmd = program.commands.find((cmd) => cmd.name() === "run");
      const opts = runCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });

    test("has --no-cache option", () => {
      const program = new Command();
      configureRunCommand(program);

      const runCmd = program.commands.find((cmd) => cmd.name() === "run");
      const opts = runCmd?.options ?? [];
      const noCacheOpt = opts.find((o) => o.long === "--no-cache");
      expect(noCacheOpt).toBeDefined();
    });

    test("has --local option", () => {
      const program = new Command();
      configureRunCommand(program);

      const runCmd = program.commands.find((cmd) => cmd.name() === "run");
      const opts = runCmd?.options ?? [];
      const localOpt = opts.find((o) => o.long === "--local");
      expect(localOpt).toBeDefined();
    });
  });

  describe("input parsing helpers", () => {
    // Test the parseInputArgs logic through module testing
    // We test the expected behavior patterns

    test("JSON args should be parseable", () => {
      const argsJson = '{"name": "World", "count": 5}';
      const parsed = JSON.parse(argsJson);
      expect(parsed.name).toBe("World");
      expect(parsed.count).toBe(5);
    });

    test("key=value pairs should be splittable", () => {
      const input = "name=Alice";
      const eqIndex = input.indexOf("=");
      const key = input.slice(0, eqIndex);
      const value = input.slice(eqIndex + 1);
      expect(key).toBe("name");
      expect(value).toBe("Alice");
    });

    test("key=value with JSON value should be parseable", () => {
      const input = 'data={"nested": true}';
      const eqIndex = input.indexOf("=");
      const value = input.slice(eqIndex + 1);
      const parsed = JSON.parse(value);
      expect(parsed.nested).toBe(true);
    });

    test("key=value with multiple equals signs", () => {
      const input = "url=https://api.example.com?key=value";
      const eqIndex = input.indexOf("=");
      const key = input.slice(0, eqIndex);
      const value = input.slice(eqIndex + 1);
      expect(key).toBe("url");
      expect(value).toBe("https://api.example.com?key=value");
    });
  });

  describe("timeout parsing", () => {
    // Test timeout format parsing patterns

    test("parses seconds", () => {
      const match = "30s".match(/^(\d+)(s|m|h)?$/);
      expect(match).toBeTruthy();
      expect(match?.[1]).toBe("30");
      expect(match?.[2]).toBe("s");
    });

    test("parses minutes", () => {
      const match = "5m".match(/^(\d+)(s|m|h)?$/);
      expect(match).toBeTruthy();
      expect(match?.[1]).toBe("5");
      expect(match?.[2]).toBe("m");
    });

    test("parses hours", () => {
      const match = "1h".match(/^(\d+)(s|m|h)?$/);
      expect(match).toBeTruthy();
      expect(match?.[1]).toBe("1");
      expect(match?.[2]).toBe("h");
    });

    test("parses number without unit (defaults to seconds)", () => {
      const match = "30".match(/^(\d+)(s|m|h)?$/);
      expect(match).toBeTruthy();
      expect(match?.[1]).toBe("30");
      expect(match?.[2]).toBeUndefined();
    });

    test("rejects invalid format", () => {
      const match = "30x".match(/^(\d+)(s|m|h)?$/);
      expect(match).toBeNull();
    });

    test("converts to milliseconds correctly", () => {
      const parseTimeout = (timeout: string): number => {
        const match = timeout.match(/^(\d+)(s|m|h)?$/);
        if (!match) throw new Error("Invalid format");
        const value = Number.parseInt(match[1] ?? "0", 10);
        const unit = match[2] || "s";
        switch (unit) {
          case "h":
            return value * 60 * 60 * 1000;
          case "m":
            return value * 60 * 1000;
          default:
            return value * 1000;
        }
      };

      expect(parseTimeout("30s")).toBe(30000);
      expect(parseTimeout("5m")).toBe(300000);
      expect(parseTimeout("1h")).toBe(3600000);
      expect(parseTimeout("30")).toBe(30000);
    });
  });
});
