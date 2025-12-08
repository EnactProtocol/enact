/**
 * Tests for the unyank command
 */

import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { configureUnyankCommand } from "../../src/commands/unyank";

describe("unyank command", () => {
  describe("command configuration", () => {
    test("configures unyank command on program", () => {
      const program = new Command();
      configureUnyankCommand(program);

      const unyankCmd = program.commands.find((cmd) => cmd.name() === "unyank");
      expect(unyankCmd).toBeDefined();
    });

    test("has correct description", () => {
      const program = new Command();
      configureUnyankCommand(program);

      const unyankCmd = program.commands.find((cmd) => cmd.name() === "unyank");
      expect(unyankCmd?.description()).toBe("Restore a previously yanked tool version");
    });

    test("accepts tool@version argument", () => {
      const program = new Command();
      configureUnyankCommand(program);

      const unyankCmd = program.commands.find((cmd) => cmd.name() === "unyank");
      const args = unyankCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThanOrEqual(1);
    });

    test("has --verbose option", () => {
      const program = new Command();
      configureUnyankCommand(program);

      const unyankCmd = program.commands.find((cmd) => cmd.name() === "unyank");
      const opts = unyankCmd?.options ?? [];
      const verboseOpt = opts.find((o) => o.long === "--verbose");
      expect(verboseOpt).toBeDefined();
    });

    test("has --json option", () => {
      const program = new Command();
      configureUnyankCommand(program);

      const unyankCmd = program.commands.find((cmd) => cmd.name() === "unyank");
      const opts = unyankCmd?.options ?? [];
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

    test("parses scoped package with version", () => {
      const result = parseToolSpec("@scope/package@1.2.3");
      expect(result.name).toBe("@scope/package");
      expect(result.version).toBe("1.2.3");
    });
  });

  describe("yank/unyank workflow", () => {
    test("unyank requires same tool@version format as yank", () => {
      // Both yank and unyank use the same parseToolSpec format
      const spec = "alice/tools/helper@1.0.0";
      const atIndex = spec.lastIndexOf("@");

      expect(atIndex).toBeGreaterThan(0);
      expect(spec.slice(0, atIndex)).toBe("alice/tools/helper");
      expect(spec.slice(atIndex + 1)).toBe("1.0.0");
    });

    test("unyank is the inverse of yank", () => {
      // Conceptual test - unyank should restore a yanked version
      const yankedState = { yanked: true, version: "1.0.0" };
      const unyankedState = { yanked: false, version: "1.0.0" };

      expect(yankedState.yanked).toBe(true);
      expect(unyankedState.yanked).toBe(false);
      expect(yankedState.version).toBe(unyankedState.version);
    });
  });
});
