/**
 * Tests for CLI types
 */

import { describe, expect, test } from "bun:test";
import { type CommandContext, ExitCode, type GlobalOptions } from "../src/types";

describe("CLI Types", () => {
  describe("ExitCode", () => {
    test("Success is 0", () => {
      expect(ExitCode.Success).toBe(0);
    });

    test("Error is 1", () => {
      expect(ExitCode.Error).toBe(1);
    });

    test("InvalidArgs is 2", () => {
      expect(ExitCode.InvalidArgs).toBe(2);
    });

    test("NotFound is 3", () => {
      expect(ExitCode.NotFound).toBe(3);
    });

    test("PermissionDenied is 4", () => {
      expect(ExitCode.PermissionDenied).toBe(4);
    });

    test("Cancelled is 130 (standard for Ctrl+C)", () => {
      expect(ExitCode.Cancelled).toBe(130);
    });
  });

  describe("GlobalOptions interface", () => {
    test("accepts valid options", () => {
      const options: GlobalOptions = {
        verbose: true,
        json: false,
        quiet: false,
        dryRun: true,
      };

      expect(options.verbose).toBe(true);
      expect(options.json).toBe(false);
      expect(options.quiet).toBe(false);
      expect(options.dryRun).toBe(true);
    });

    test("all properties are optional", () => {
      const options: GlobalOptions = {};
      expect(options.verbose).toBeUndefined();
      expect(options.json).toBeUndefined();
    });
  });

  describe("CommandContext interface", () => {
    test("accepts valid context", () => {
      const ctx: CommandContext = {
        cwd: "/test/path",
        options: { verbose: true },
        isCI: false,
        isInteractive: true,
      };

      expect(ctx.cwd).toBe("/test/path");
      expect(ctx.options.verbose).toBe(true);
      expect(ctx.isCI).toBe(false);
      expect(ctx.isInteractive).toBe(true);
    });

    test("CI environment detection", () => {
      const ciCtx: CommandContext = {
        cwd: "/test",
        options: {},
        isCI: true,
        isInteractive: false,
      };

      expect(ciCtx.isCI).toBe(true);
      expect(ciCtx.isInteractive).toBe(false);
    });
  });
});
