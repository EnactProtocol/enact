/**
 * Tests for the validate command
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { configureValidateCommand } from "../../src/commands/validate";

// Test fixtures directory
const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures", "validate-cmd");

describe("validate command", () => {
  beforeAll(() => {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
  });

  describe("command configuration", () => {
    test("configures validate command on program", () => {
      const program = new Command();
      configureValidateCommand(program);

      const validateCmd = program.commands.find((cmd) => cmd.name() === "validate");
      expect(validateCmd).toBeDefined();
    });

    test("has correct description", () => {
      const program = new Command();
      configureValidateCommand(program);

      const validateCmd = program.commands.find((cmd) => cmd.name() === "validate");
      expect(validateCmd?.description()).toBe("Validate a SKILL.md file for common issues");
    });

    test("accepts optional path argument", () => {
      const program = new Command();
      configureValidateCommand(program);

      const validateCmd = program.commands.find((cmd) => cmd.name() === "validate");
      const args = validateCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThanOrEqual(1);
      expect(args[0]?.name()).toBe("path");
    });

    test("path argument defaults to current directory", () => {
      const program = new Command();
      configureValidateCommand(program);

      const validateCmd = program.commands.find((cmd) => cmd.name() === "validate");
      const args = validateCmd?.registeredArguments ?? [];
      expect(args[0]?.defaultValue).toBe(".");
    });

    test("has --verbose option", () => {
      const program = new Command();
      configureValidateCommand(program);

      const validateCmd = program.commands.find((cmd) => cmd.name() === "validate");
      const opts = validateCmd?.options ?? [];
      const verboseOpt = opts.find((o) => o.long === "--verbose");
      expect(verboseOpt).toBeDefined();
    });

    test("has --json option", () => {
      const program = new Command();
      configureValidateCommand(program);

      const validateCmd = program.commands.find((cmd) => cmd.name() === "validate");
      const opts = validateCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });
  });
});
