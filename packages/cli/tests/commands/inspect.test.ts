/**
 * Tests for the inspect command
 */

import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { configureInspectCommand } from "../../src/commands/inspect";

describe("inspect command", () => {
  describe("command configuration", () => {
    test("configures inspect command on program", () => {
      const program = new Command();
      configureInspectCommand(program);

      const inspectCmd = program.commands.find((cmd) => cmd.name() === "inspect");
      expect(inspectCmd).toBeDefined();
    });

    test("has correct description", () => {
      const program = new Command();
      configureInspectCommand(program);

      const inspectCmd = program.commands.find((cmd) => cmd.name() === "inspect");
      expect(inspectCmd?.description()).toBe(
        "Open a tool's page in browser for inspection (use --download to save locally)"
      );
    });

    test("accepts tool argument", () => {
      const program = new Command();
      configureInspectCommand(program);

      const inspectCmd = program.commands.find((cmd) => cmd.name() === "inspect");
      const args = inspectCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThanOrEqual(1);
    });

    test("has --download option", () => {
      const program = new Command();
      configureInspectCommand(program);

      const inspectCmd = program.commands.find((cmd) => cmd.name() === "inspect");
      const opts = inspectCmd?.options ?? [];
      const downloadOpt = opts.find((o) => o.long === "--download");
      expect(downloadOpt).toBeDefined();
    });

    test("has -d short option for download", () => {
      const program = new Command();
      configureInspectCommand(program);

      const inspectCmd = program.commands.find((cmd) => cmd.name() === "inspect");
      const opts = inspectCmd?.options ?? [];
      const downloadOpt = opts.find((o) => o.short === "-d");
      expect(downloadOpt).toBeDefined();
    });

    test("has --output option", () => {
      const program = new Command();
      configureInspectCommand(program);

      const inspectCmd = program.commands.find((cmd) => cmd.name() === "inspect");
      const opts = inspectCmd?.options ?? [];
      const outputOpt = opts.find((o) => o.long === "--output");
      expect(outputOpt).toBeDefined();
    });

    test("has -o short option for output", () => {
      const program = new Command();
      configureInspectCommand(program);

      const inspectCmd = program.commands.find((cmd) => cmd.name() === "inspect");
      const opts = inspectCmd?.options ?? [];
      const outputOpt = opts.find((o) => o.short === "-o");
      expect(outputOpt).toBeDefined();
    });

    test("has --force option", () => {
      const program = new Command();
      configureInspectCommand(program);

      const inspectCmd = program.commands.find((cmd) => cmd.name() === "inspect");
      const opts = inspectCmd?.options ?? [];
      const forceOpt = opts.find((o) => o.long === "--force");
      expect(forceOpt).toBeDefined();
    });

    test("has -f short option for force", () => {
      const program = new Command();
      configureInspectCommand(program);

      const inspectCmd = program.commands.find((cmd) => cmd.name() === "inspect");
      const opts = inspectCmd?.options ?? [];
      const forceOpt = opts.find((o) => o.short === "-f");
      expect(forceOpt).toBeDefined();
    });

    test("has --verbose option", () => {
      const program = new Command();
      configureInspectCommand(program);

      const inspectCmd = program.commands.find((cmd) => cmd.name() === "inspect");
      const opts = inspectCmd?.options ?? [];
      const verboseOpt = opts.find((o) => o.long === "--verbose");
      expect(verboseOpt).toBeDefined();
    });

    test("has --json option", () => {
      const program = new Command();
      configureInspectCommand(program);

      const inspectCmd = program.commands.find((cmd) => cmd.name() === "inspect");
      const opts = inspectCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });
  });

  describe("tool spec parsing", () => {
    // Helper function that mirrors the command's parseToolSpec
    const parseToolSpec = (spec: string): { name: string; version: string | undefined } => {
      const match = spec.match(/^(@[^@/]+\/[^@]+|[^@]+)(?:@(.+))?$/);
      if (match?.[1]) {
        return {
          name: match[1],
          version: match[2],
        };
      }
      return { name: spec, version: undefined };
    };

    test("parses tool name without version", () => {
      const result = parseToolSpec("alice/utils/greeter");
      expect(result.name).toBe("alice/utils/greeter");
      expect(result.version).toBeUndefined();
    });

    test("parses tool name with version", () => {
      const result = parseToolSpec("alice/utils/greeter@1.0.0");
      expect(result.name).toBe("alice/utils/greeter");
      expect(result.version).toBe("1.0.0");
    });

    test("parses scoped package without version", () => {
      const result = parseToolSpec("@scope/package");
      expect(result.name).toBe("@scope/package");
      expect(result.version).toBeUndefined();
    });

    test("parses scoped package with version", () => {
      const result = parseToolSpec("@scope/package@2.0.0");
      expect(result.name).toBe("@scope/package");
      expect(result.version).toBe("2.0.0");
    });
  });

  describe("bytes formatting", () => {
    // Helper function that mirrors the command's formatBytes
    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
    };

    test("formats zero bytes", () => {
      expect(formatBytes(0)).toBe("0 B");
    });

    test("formats bytes", () => {
      expect(formatBytes(500)).toBe("500.0 B");
    });

    test("formats kilobytes", () => {
      expect(formatBytes(1024)).toBe("1.0 KB");
    });

    test("formats megabytes", () => {
      expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    });

    test("formats gigabytes", () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB");
    });
  });

  describe("output path logic", () => {
    test("default output uses tool name in current directory", () => {
      const toolName = "alice/utils/greeter";
      const defaultOutput = toolName.split("/").pop();
      expect(defaultOutput).toBe("greeter");
    });

    test("handles nested tool names", () => {
      const toolName = "org/namespace/subspace/tool";
      const defaultOutput = toolName.split("/").pop();
      expect(defaultOutput).toBe("tool");
    });
  });
});
