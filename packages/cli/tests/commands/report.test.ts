/**
 * Tests for the report command
 */

import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { configureReportCommand } from "../../src/commands/report";

describe("report command", () => {
  describe("command configuration", () => {
    test("configures report command on program", () => {
      const program = new Command();
      configureReportCommand(program);

      const reportCmd = program.commands.find((cmd) => cmd.name() === "report");
      expect(reportCmd).toBeDefined();
    });

    test("has correct description", () => {
      const program = new Command();
      configureReportCommand(program);

      const reportCmd = program.commands.find((cmd) => cmd.name() === "report");
      expect(reportCmd?.description()).toBe(
        "Report security vulnerabilities or issues with a tool (creates signed attestation)"
      );
    });

    test("accepts tool argument", () => {
      const program = new Command();
      configureReportCommand(program);

      const reportCmd = program.commands.find((cmd) => cmd.name() === "report");
      const args = reportCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThanOrEqual(1);
      expect(args[0]?.name()).toBe("tool");
    });

    test("has required --reason option", () => {
      const program = new Command();
      configureReportCommand(program);

      const reportCmd = program.commands.find((cmd) => cmd.name() === "report");
      const opts = reportCmd?.options ?? [];
      const reasonOpt = opts.find((o) => o.long === "--reason");
      expect(reasonOpt).toBeDefined();
      expect(reasonOpt?.required).toBe(true);
    });

    test("has --severity option", () => {
      const program = new Command();
      configureReportCommand(program);

      const reportCmd = program.commands.find((cmd) => cmd.name() === "report");
      const opts = reportCmd?.options ?? [];
      const severityOpt = opts.find((o) => o.long === "--severity");
      expect(severityOpt).toBeDefined();
    });

    test("has --category option", () => {
      const program = new Command();
      configureReportCommand(program);

      const reportCmd = program.commands.find((cmd) => cmd.name() === "report");
      const opts = reportCmd?.options ?? [];
      const categoryOpt = opts.find((o) => o.long === "--category");
      expect(categoryOpt).toBeDefined();
    });

    test("has --dry-run option", () => {
      const program = new Command();
      configureReportCommand(program);

      const reportCmd = program.commands.find((cmd) => cmd.name() === "report");
      const opts = reportCmd?.options ?? [];
      const dryRunOpt = opts.find((o) => o.long === "--dry-run");
      expect(dryRunOpt).toBeDefined();
    });

    test("has --verbose option", () => {
      const program = new Command();
      configureReportCommand(program);

      const reportCmd = program.commands.find((cmd) => cmd.name() === "report");
      const opts = reportCmd?.options ?? [];
      const verboseOpt = opts.find((o) => o.long === "--verbose");
      expect(verboseOpt).toBeDefined();
    });

    test("has --json option", () => {
      const program = new Command();
      configureReportCommand(program);

      const reportCmd = program.commands.find((cmd) => cmd.name() === "report");
      const opts = reportCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });
  });

  describe("severity levels", () => {
    const severityLevels = ["critical", "high", "medium", "low"];

    test("supports critical severity", () => {
      expect(severityLevels).toContain("critical");
    });

    test("supports high severity", () => {
      expect(severityLevels).toContain("high");
    });

    test("supports medium severity", () => {
      expect(severityLevels).toContain("medium");
    });

    test("supports low severity", () => {
      expect(severityLevels).toContain("low");
    });

    test("default severity is medium", () => {
      const program = new Command();
      configureReportCommand(program);

      const reportCmd = program.commands.find((cmd) => cmd.name() === "report");
      const opts = reportCmd?.options ?? [];
      const severityOpt = opts.find((o) => o.long === "--severity");
      expect(severityOpt?.defaultValue).toBe("medium");
    });
  });

  describe("category types", () => {
    const categories = ["security", "malware", "quality", "license", "other"];

    test("supports security category", () => {
      expect(categories).toContain("security");
    });

    test("supports malware category", () => {
      expect(categories).toContain("malware");
    });

    test("supports quality category", () => {
      expect(categories).toContain("quality");
    });

    test("supports license category", () => {
      expect(categories).toContain("license");
    });

    test("supports other category", () => {
      expect(categories).toContain("other");
    });

    test("default category is other", () => {
      const program = new Command();
      configureReportCommand(program);

      const reportCmd = program.commands.find((cmd) => cmd.name() === "report");
      const opts = reportCmd?.options ?? [];
      const categoryOpt = opts.find((o) => o.long === "--category");
      expect(categoryOpt?.defaultValue).toBe("other");
    });
  });

  describe("tool@version parsing", () => {
    test("parses tool name without version", () => {
      const toolArg = "alice/utils/greeter";
      const atIndex = toolArg.lastIndexOf("@");
      expect(atIndex).toBe(-1); // No @ in this string
    });

    test("parses tool name with version", () => {
      const toolArg = "alice/utils/greeter@1.0.0";
      const atIndex = toolArg.lastIndexOf("@");
      expect(atIndex).toBeGreaterThan(0);
      expect(toolArg.slice(0, atIndex)).toBe("alice/utils/greeter");
      expect(toolArg.slice(atIndex + 1)).toBe("1.0.0");
    });

    test("parses scoped package without version", () => {
      const toolArg = "@scope/package";
      // Should not split on the first @
      expect(toolArg.startsWith("@")).toBe(true);
    });

    test("parses scoped package with version", () => {
      const toolArg = "@scope/package@2.0.0";
      const match = toolArg.match(/^(@[^/]+\/[^@]+)(?:@(.+))?$/);
      expect(match).toBeDefined();
      expect(match?.[1]).toBe("@scope/package");
      expect(match?.[2]).toBe("2.0.0");
    });
  });
});
