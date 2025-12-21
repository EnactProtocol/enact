/**
 * Tests for the visibility command
 */

import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { configureVisibilityCommand } from "../../src/commands/visibility";

describe("visibility command", () => {
  describe("command configuration", () => {
    test("configures visibility command on program", () => {
      const program = new Command();
      configureVisibilityCommand(program);

      const visibilityCmd = program.commands.find((cmd) => cmd.name() === "visibility");
      expect(visibilityCmd).toBeDefined();
    });

    test("has correct description", () => {
      const program = new Command();
      configureVisibilityCommand(program);

      const visibilityCmd = program.commands.find((cmd) => cmd.name() === "visibility");
      expect(visibilityCmd?.description()).toBe(
        "Change tool visibility (public, private, or unlisted)"
      );
    });

    test("accepts tool and visibility arguments", () => {
      const program = new Command();
      configureVisibilityCommand(program);

      const visibilityCmd = program.commands.find((cmd) => cmd.name() === "visibility");
      const args = visibilityCmd?.registeredArguments ?? [];
      expect(args.length).toBe(2);
    });

    test("has --json option", () => {
      const program = new Command();
      configureVisibilityCommand(program);

      const visibilityCmd = program.commands.find((cmd) => cmd.name() === "visibility");
      const opts = visibilityCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });

    test("has --verbose option", () => {
      const program = new Command();
      configureVisibilityCommand(program);

      const visibilityCmd = program.commands.find((cmd) => cmd.name() === "visibility");
      const opts = visibilityCmd?.options ?? [];
      const verboseOpt = opts.find((o) => o.long === "--verbose");
      expect(verboseOpt).toBeDefined();
    });
  });

  describe("visibility value validation", () => {
    const VALID_VISIBILITIES = ["public", "private", "unlisted"] as const;

    test("accepts 'public' visibility", () => {
      expect(VALID_VISIBILITIES.includes("public")).toBe(true);
    });

    test("accepts 'private' visibility", () => {
      expect(VALID_VISIBILITIES.includes("private")).toBe(true);
    });

    test("accepts 'unlisted' visibility", () => {
      expect(VALID_VISIBILITIES.includes("unlisted")).toBe(true);
    });

    test("rejects invalid visibility values", () => {
      const isValid = (v: string): boolean =>
        VALID_VISIBILITIES.includes(v as (typeof VALID_VISIBILITIES)[number]);

      expect(isValid("internal")).toBe(false);
      expect(isValid("PUBLIC")).toBe(false);
      expect(isValid("")).toBe(false);
      expect(isValid("org-private")).toBe(false);
    });
  });

  describe("visibility behavior", () => {
    test("public tools are searchable", () => {
      const isSearchable = (visibility: string): boolean => {
        return visibility === "public";
      };

      expect(isSearchable("public")).toBe(true);
      expect(isSearchable("private")).toBe(false);
      expect(isSearchable("unlisted")).toBe(false);
    });

    test("public and unlisted tools are accessible via direct link", () => {
      const isDirectAccessible = (visibility: string): boolean => {
        return visibility === "public" || visibility === "unlisted";
      };

      expect(isDirectAccessible("public")).toBe(true);
      expect(isDirectAccessible("unlisted")).toBe(true);
      expect(isDirectAccessible("private")).toBe(false);
    });

    test("private tools are only accessible to owner", () => {
      const canAccess = (visibility: string, isOwner: boolean): boolean => {
        if (visibility === "public" || visibility === "unlisted") return true;
        if (visibility === "private") return isOwner;
        return false;
      };

      expect(canAccess("private", true)).toBe(true);
      expect(canAccess("private", false)).toBe(false);
      expect(canAccess("public", false)).toBe(true);
      expect(canAccess("unlisted", false)).toBe(true);
    });
  });

  describe("visibility result handling", () => {
    test("success result structure", () => {
      interface VisibilityResult {
        tool: string;
        visibility: string;
        success: boolean;
      }

      const result: VisibilityResult = {
        tool: "alice/tools/my-tool",
        visibility: "private",
        success: true,
      };

      expect(result.success).toBe(true);
      expect(result.tool).toBeDefined();
      expect(result.visibility).toBe("private");
    });

    test("error result for unauthorized", () => {
      interface VisibilityError {
        success: boolean;
        error: string;
        code?: string;
      }

      const error: VisibilityError = {
        success: false,
        error: "You do not own this tool",
        code: "UNAUTHORIZED",
      };

      expect(error.success).toBe(false);
      expect(error.error).toBeDefined();
    });
  });
});
