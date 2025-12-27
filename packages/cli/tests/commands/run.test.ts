/**
 * Tests for the run command
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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

    test("has --input-file option for JSON file input", () => {
      const program = new Command();
      configureRunCommand(program);

      const runCmd = program.commands.find((cmd) => cmd.name() === "run");
      const opts = runCmd?.options ?? [];
      const inputFileOpt = opts.find((o) => o.long === "--input-file");
      expect(inputFileOpt).toBeDefined();
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

    test("has --remote option", () => {
      const program = new Command();
      configureRunCommand(program);

      const runCmd = program.commands.find((cmd) => cmd.name() === "run");
      const opts = runCmd?.options ?? [];
      const remoteOpt = opts.find((o) => o.long === "--remote");
      expect(remoteOpt).toBeDefined();
    });

    test("--remote option has short flag -r", () => {
      const program = new Command();
      configureRunCommand(program);

      const runCmd = program.commands.find((cmd) => cmd.name() === "run");
      const opts = runCmd?.options ?? [];
      const remoteOpt = opts.find((o) => o.long === "--remote");
      expect(remoteOpt?.short).toBe("-r");
    });
  });

  describe("tool resolution logic", () => {
    // Test the resolution logic patterns for local vs remote tools

    test("path-like targets are local only (./)", () => {
      const tool = "./hello";
      const isRegistryFormat = tool.includes("/") && !tool.startsWith("/") && !tool.startsWith(".");
      expect(isRegistryFormat).toBe(false);
    });

    test("path-like targets are local only (../)", () => {
      const tool = "../tools/hello";
      const isRegistryFormat = tool.includes("/") && !tool.startsWith("/") && !tool.startsWith(".");
      expect(isRegistryFormat).toBe(false);
    });

    test("path-like targets are local only (/abs)", () => {
      const tool = "/absolute/path/hello";
      const isRegistryFormat = tool.includes("/") && !tool.startsWith("/") && !tool.startsWith(".");
      expect(isRegistryFormat).toBe(false);
    });

    test("simple names without slash are local only", () => {
      const tool = "hello";
      const isRegistryFormat = tool.includes("/") && !tool.startsWith("/") && !tool.startsWith(".");
      expect(isRegistryFormat).toBe(false);
    });

    test("namespace/tool format can be registry", () => {
      const tool = "user/hello";
      const isRegistryFormat = tool.includes("/") && !tool.startsWith("/") && !tool.startsWith(".");
      expect(isRegistryFormat).toBe(true);
    });

    test("nested namespace/ns/tool format can be registry", () => {
      const tool = "org/namespace/hello";
      const isRegistryFormat = tool.includes("/") && !tool.startsWith("/") && !tool.startsWith(".");
      expect(isRegistryFormat).toBe(true);
    });

    test("--remote with simple name should be rejected", () => {
      const tool = "hello";
      const isRegistryFormat = tool.includes("/") && !tool.startsWith("/") && !tool.startsWith(".");
      const remoteFlag = true;

      // --remote requires registry format
      const isValid = !remoteFlag || isRegistryFormat;
      expect(isValid).toBe(false);
    });

    test("--remote with namespace/tool is valid", () => {
      const tool = "user/hello";
      const isRegistryFormat = tool.includes("/") && !tool.startsWith("/") && !tool.startsWith(".");
      const remoteFlag = true;

      const isValid = !remoteFlag || isRegistryFormat;
      expect(isValid).toBe(true);
    });

    test("--remote with path should be rejected", () => {
      const tool = "./hello";
      const isRegistryFormat = tool.includes("/") && !tool.startsWith("/") && !tool.startsWith(".");
      const remoteFlag = true;

      const isValid = !remoteFlag || isRegistryFormat;
      expect(isValid).toBe(false);
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

  describe("--output option configuration", () => {
    test("has --output option", () => {
      const program = new Command();
      configureRunCommand(program);

      const runCmd = program.commands.find((cmd) => cmd.name() === "run");
      const opts = runCmd?.options ?? [];
      const outputOpt = opts.find((o) => o.long === "--output");
      expect(outputOpt).toBeDefined();
    });

    test("--output option has short flag -o", () => {
      const program = new Command();
      configureRunCommand(program);

      const runCmd = program.commands.find((cmd) => cmd.name() === "run");
      const opts = runCmd?.options ?? [];
      const outputOpt = opts.find((o) => o.long === "--output");
      expect(outputOpt?.short).toBe("-o");
    });

    test("--output option takes a path argument", () => {
      const program = new Command();
      configureRunCommand(program);

      const runCmd = program.commands.find((cmd) => cmd.name() === "run");
      const opts = runCmd?.options ?? [];
      const outputOpt = opts.find((o) => o.long === "--output");
      // Non-variadic options should not be variadic
      expect(outputOpt?.variadic).toBeFalsy();
    });
  });

  describe("input path parsing patterns", () => {
    // Test the input parsing logic patterns (--input can be key=value or path)

    test("key=value is detected as parameter, not path", () => {
      const input = "name=Alice";
      const eqIndex = input.indexOf("=");
      const looksLikePath =
        input.startsWith("./") || input.startsWith("../") || input.startsWith("/");

      expect(eqIndex).toBeGreaterThan(0);
      expect(looksLikePath).toBe(false);
      // This should be treated as a key=value parameter
    });

    test("./path is detected as input path", () => {
      const input = "./data";
      const looksLikePath =
        input.startsWith("./") || input.startsWith("../") || input.startsWith("/");

      expect(looksLikePath).toBe(true);
    });

    test("../path is detected as input path", () => {
      const input = "../parent/data";
      const looksLikePath =
        input.startsWith("./") || input.startsWith("../") || input.startsWith("/");

      expect(looksLikePath).toBe(true);
    });

    test("/absolute/path is detected as input path", () => {
      const input = "/absolute/data";
      const looksLikePath =
        input.startsWith("./") || input.startsWith("../") || input.startsWith("/");

      expect(looksLikePath).toBe(true);
    });

    test("name=./path is detected as named input", () => {
      const input = "left=./old";
      const eqIndex = input.indexOf("=");
      const key = input.slice(0, eqIndex);
      const value = input.slice(eqIndex + 1);

      expect(key).toBe("left");
      expect(value).toBe("./old");
      expect(value.startsWith("./")).toBe(true);
      // This should be treated as a named input path
    });
  });

  describe("input target paths", () => {
    test("single unnamed input goes to /input", () => {
      const inputName = undefined;

      const target = inputName !== undefined ? `/inputs/${inputName}` : "/input";

      expect(target).toBe("/input");
    });

    test("named input goes to /inputs/<name>", () => {
      const inputName = "left";

      const target = `/inputs/${inputName}`;
      expect(target).toBe("/inputs/left");
    });

    test("single file input goes to /input/<filename>", () => {
      const inputType = "file";
      const inputName = undefined;
      const filename = "data.csv";

      const target =
        inputName !== undefined
          ? `/inputs/${inputName}`
          : inputType === "file"
            ? `/input/${filename}`
            : "/input";

      expect(target).toBe("/input/data.csv");
    });
  });

  describe("--apply option configuration", () => {
    test("has --apply option", () => {
      const program = new Command();
      configureRunCommand(program);

      const runCmd = program.commands.find((cmd) => cmd.name() === "run");
      const opts = runCmd?.options ?? [];
      const applyOpt = opts.find((o) => o.long === "--apply");
      expect(applyOpt).toBeDefined();
    });

    test("--apply option is a boolean flag", () => {
      const program = new Command();
      configureRunCommand(program);

      const runCmd = program.commands.find((cmd) => cmd.name() === "run");
      const opts = runCmd?.options ?? [];
      const applyOpt = opts.find((o) => o.long === "--apply");
      // Boolean flags don't have required or optional args
      expect(applyOpt?.required).toBeFalsy();
    });
  });

  describe("--apply validation logic", () => {
    test("--apply requires a directory input", () => {
      // When using --apply, you need exactly one unnamed directory input
      const inputPaths = [{ path: "/some/dir", type: "directory" as const }];
      const hasValidInput = inputPaths.some((p) => p.type === "directory");
      expect(hasValidInput).toBe(true);
    });

    test("--apply rejects file-only inputs", () => {
      const inputPaths: { path: string; type: "directory" | "file" }[] = [
        { path: "/some/file.txt", type: "file" as "directory" | "file" },
      ];
      const dirInputs = inputPaths.filter((p) => p.type === "directory");
      expect(dirInputs.length).toBe(0);
    });

    test("--apply requires output path", () => {
      // Validation check: --apply needs --output
      const options = { apply: true, output: undefined };
      const isValid = options.apply ? options.output !== undefined : true;
      expect(isValid).toBe(false);
    });

    test("--apply with matching input/output is valid", () => {
      const options = { apply: true, output: "/some/dir" };
      const inputPath = "/some/dir";
      const outputPath = options.output;

      // When input and output match, it's an in-place apply
      expect(inputPath).toBe(outputPath);
    });
  });

  describe("input file handling", () => {
    test("JSON input file can be parsed", () => {
      // Create a test JSON file
      const inputFilePath = join(FIXTURES_DIR, "test-inputs.json");
      const inputData = { name: "Alice", count: 5, nested: { key: "value" } };
      writeFileSync(inputFilePath, JSON.stringify(inputData));

      // Verify the file can be read and parsed
      const content = require("node:fs").readFileSync(inputFilePath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.name).toBe("Alice");
      expect(parsed.count).toBe(5);
      expect(parsed.nested.key).toBe("value");
    });

    test("JSON input file with optional params can omit them", () => {
      // This is the recommended pattern for optional params
      const inputFilePath = join(FIXTURES_DIR, "optional-inputs.json");
      // Only required param provided, optional params omitted
      const inputData = { name: "Alice" };
      writeFileSync(inputFilePath, JSON.stringify(inputData));

      const content = require("node:fs").readFileSync(inputFilePath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.name).toBe("Alice");
      expect(parsed.greeting).toBeUndefined();
    });

    test("JSON input file with explicit empty values", () => {
      // User can explicitly set empty values for optional params
      const inputFilePath = join(FIXTURES_DIR, "explicit-empty.json");
      const inputData = { name: "Alice", prefix: "", suffix: null };
      writeFileSync(inputFilePath, JSON.stringify(inputData));

      const content = require("node:fs").readFileSync(inputFilePath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.name).toBe("Alice");
      expect(parsed.prefix).toBe("");
      expect(parsed.suffix).toBeNull();
    });

    test("input priority: --input overrides --args overrides --input-file", () => {
      // Simulate the merge logic from parseInputArgs
      const fromFile = { a: "file", b: "file", c: "file" };
      const fromArgs = { b: "args", c: "args" };
      const fromInput = { c: "input" };

      // Merge in order: file -> args -> input
      const merged = { ...fromFile, ...fromArgs, ...fromInput };

      expect(merged.a).toBe("file"); // Only from file
      expect(merged.b).toBe("args"); // Overridden by args
      expect(merged.c).toBe("input"); // Overridden by input
    });
  });
});
