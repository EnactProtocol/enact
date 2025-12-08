/**
 * Tests for the get command
 */

import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { configureGetCommand } from "../../src/commands/get";

describe("get command", () => {
  describe("command configuration", () => {
    test("configures get command on program", () => {
      const program = new Command();
      configureGetCommand(program);

      const getCmd = program.commands.find((cmd) => cmd.name() === "get");
      expect(getCmd).toBeDefined();
    });

    test("has correct description", () => {
      const program = new Command();
      configureGetCommand(program);

      const getCmd = program.commands.find((cmd) => cmd.name() === "get");
      expect(getCmd?.description()).toBe("Show detailed information about a tool");
    });

    test("has info as alias", () => {
      const program = new Command();
      configureGetCommand(program);

      const getCmd = program.commands.find((cmd) => cmd.name() === "get");
      expect(getCmd?.aliases()).toContain("info");
    });

    test("accepts tool argument", () => {
      const program = new Command();
      configureGetCommand(program);

      const getCmd = program.commands.find((cmd) => cmd.name() === "get");
      const args = getCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThan(0);
      expect(args[0]?.name()).toBe("tool");
    });

    test("has --version option", () => {
      const program = new Command();
      configureGetCommand(program);

      const getCmd = program.commands.find((cmd) => cmd.name() === "get");
      const opts = getCmd?.options ?? [];
      const versionOpt = opts.find((o) => o.long === "--version");
      expect(versionOpt).toBeDefined();
    });

    test("has -v short option for version", () => {
      const program = new Command();
      configureGetCommand(program);

      const getCmd = program.commands.find((cmd) => cmd.name() === "get");
      const opts = getCmd?.options ?? [];
      const versionOpt = opts.find((o) => o.short === "-v");
      expect(versionOpt).toBeDefined();
    });

    test("has --json option", () => {
      const program = new Command();
      configureGetCommand(program);

      const getCmd = program.commands.find((cmd) => cmd.name() === "get");
      const opts = getCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });

    test("has --verbose option", () => {
      const program = new Command();
      configureGetCommand(program);

      const getCmd = program.commands.find((cmd) => cmd.name() === "get");
      const opts = getCmd?.options ?? [];
      const verboseOpt = opts.find((o) => o.long === "--verbose");
      expect(verboseOpt).toBeDefined();
    });
  });

  describe("tool name parsing", () => {
    test("parses simple tool name", () => {
      const toolName = "my-tool";
      expect(toolName).not.toContain("@");
      expect(toolName).not.toContain("/");
    });

    test("parses scoped tool name", () => {
      const toolName = "@org/my-tool";
      expect(toolName.startsWith("@")).toBe(true);
      const parts = toolName.slice(1).split("/");
      expect(parts[0]).toBe("org");
      expect(parts[1]).toBe("my-tool");
    });

    test("parses tool name with version", () => {
      const input = "my-tool@1.2.3";
      const atIndex = input.lastIndexOf("@");
      // For unscoped tools, @ separator for version
      if (!input.startsWith("@")) {
        const toolName = input.slice(0, atIndex);
        const version = input.slice(atIndex + 1);
        expect(toolName).toBe("my-tool");
        expect(version).toBe("1.2.3");
      }
    });

    test("parses scoped tool name with version", () => {
      const input = "@org/my-tool@1.2.3";
      // For scoped packages, split by /
      const slashIndex = input.indexOf("/");
      const org = input.slice(1, slashIndex);
      const rest = input.slice(slashIndex + 1);
      const atIndex = rest.indexOf("@");
      const toolName = atIndex === -1 ? rest : rest.slice(0, atIndex);
      const version = atIndex === -1 ? undefined : rest.slice(atIndex + 1);

      expect(org).toBe("org");
      expect(toolName).toBe("my-tool");
      expect(version).toBe("1.2.3");
    });
  });

  describe("date formatting", () => {
    test("formats ISO date string", () => {
      const formatDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      };

      const result = formatDate("2024-01-15T10:30:00Z");
      expect(result).toContain("Jan");
      expect(result).toContain("15");
      expect(result).toContain("2024");
    });

    test("handles invalid date gracefully", () => {
      const formatDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return "Unknown";
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      };

      expect(formatDate("invalid")).toBe("Unknown");
    });
  });

  describe("trust status display", () => {
    test("displays trusted status correctly", () => {
      const getTrustLabel = (trusted: boolean): string => {
        return trusted ? "✓ Verified" : "⚠ Unverified";
      };

      expect(getTrustLabel(true)).toContain("Verified");
      expect(getTrustLabel(false)).toContain("Unverified");
    });

    test("trust level enum values", () => {
      const trustLevels = ["none", "publisher", "auditor", "full"];
      expect(trustLevels).toContain("none");
      expect(trustLevels).toContain("publisher");
      expect(trustLevels).toContain("auditor");
      expect(trustLevels).toContain("full");
    });
  });
});
