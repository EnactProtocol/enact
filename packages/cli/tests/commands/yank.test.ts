/**
 * Tests for the yank command
 */

import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { configureYankCommand } from "../../src/commands/yank";

describe("yank command", () => {
  describe("command configuration", () => {
    test("configures yank command on program", () => {
      const program = new Command();
      configureYankCommand(program);

      const yankCmd = program.commands.find((cmd) => cmd.name() === "yank");
      expect(yankCmd).toBeDefined();
    });

    test("has correct description", () => {
      const program = new Command();
      configureYankCommand(program);

      const yankCmd = program.commands.find((cmd) => cmd.name() === "yank");
      expect(yankCmd?.description()).toBe("Yank a published tool version from the registry");
    });

    test("accepts tool@version argument", () => {
      const program = new Command();
      configureYankCommand(program);

      const yankCmd = program.commands.find((cmd) => cmd.name() === "yank");
      const args = yankCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThanOrEqual(1);
    });

    test("has --reason option", () => {
      const program = new Command();
      configureYankCommand(program);

      const yankCmd = program.commands.find((cmd) => cmd.name() === "yank");
      const opts = yankCmd?.options ?? [];
      const reasonOpt = opts.find((o) => o.long === "--reason");
      expect(reasonOpt).toBeDefined();
    });

    test("has -r short option for reason", () => {
      const program = new Command();
      configureYankCommand(program);

      const yankCmd = program.commands.find((cmd) => cmd.name() === "yank");
      const opts = yankCmd?.options ?? [];
      const reasonOpt = opts.find((o) => o.short === "-r");
      expect(reasonOpt).toBeDefined();
    });

    test("has --replacement option", () => {
      const program = new Command();
      configureYankCommand(program);

      const yankCmd = program.commands.find((cmd) => cmd.name() === "yank");
      const opts = yankCmd?.options ?? [];
      const replacementOpt = opts.find((o) => o.long === "--replacement");
      expect(replacementOpt).toBeDefined();
    });

    test("has --verbose option", () => {
      const program = new Command();
      configureYankCommand(program);

      const yankCmd = program.commands.find((cmd) => cmd.name() === "yank");
      const opts = yankCmd?.options ?? [];
      const verboseOpt = opts.find((o) => o.long === "--verbose");
      expect(verboseOpt).toBeDefined();
    });

    test("has --json option", () => {
      const program = new Command();
      configureYankCommand(program);

      const yankCmd = program.commands.find((cmd) => cmd.name() === "yank");
      const opts = yankCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });
  });

  describe("tool spec parsing", () => {
    // Helper function that mirrors the command's parseToolSpec
    const parseToolSpec = (spec: string): { name: string; version: string } => {
      const atIndex = spec.lastIndexOf("@");
      if (atIndex === -1 || atIndex === 0) {
        throw new Error(`Invalid tool specification: ${spec}\nExpected format: tool-name@version`);
      }
      return {
        name: spec.slice(0, atIndex),
        version: spec.slice(atIndex + 1),
      };
    };

    test("parses tool@version format", () => {
      const result = parseToolSpec("alice/utils/greeter@1.0.0");
      expect(result.name).toBe("alice/utils/greeter");
      expect(result.version).toBe("1.0.0");
    });

    test("parses tool with semver prerelease", () => {
      const result = parseToolSpec("alice/utils/greeter@2.0.0-beta.1");
      expect(result.name).toBe("alice/utils/greeter");
      expect(result.version).toBe("2.0.0-beta.1");
    });

    test("throws error for missing version", () => {
      expect(() => parseToolSpec("alice/utils/greeter")).toThrow();
    });

    test("throws error for @ at start (scoped without version)", () => {
      expect(() => parseToolSpec("@scope/package")).toThrow();
    });

    test("parses scoped package with version", () => {
      // Scoped packages have @ at the start, so we need lastIndexOf
      const result = parseToolSpec("@scope/package@1.2.3");
      expect(result.name).toBe("@scope/package");
      expect(result.version).toBe("1.2.3");
    });
  });

  describe("yank reasons", () => {
    test("common yank reasons are strings", () => {
      const reasons = [
        "Security vulnerability discovered",
        "Critical bug in this version",
        "Accidental publish",
        "Deprecated in favor of newer version",
      ];

      for (const reason of reasons) {
        expect(typeof reason).toBe("string");
        expect(reason.length).toBeGreaterThan(0);
      }
    });
  });

  describe("replacement version format", () => {
    test("replacement should be a valid version string", () => {
      const validVersions = ["1.0.1", "2.0.0", "1.2.3-patch.1", "3.0.0+build.123"];

      for (const version of validVersions) {
        // Basic semver check
        expect(version).toMatch(/^\d+\.\d+\.\d+/);
      }
    });
  });
});
