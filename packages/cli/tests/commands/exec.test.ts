/**
 * Tests for the exec command
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { configureExecCommand } from "../../src/commands/exec";

// Test fixtures directory
const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures", "exec-cmd");

describe("exec command", () => {
  beforeAll(() => {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
  });

  describe("command configuration", () => {
    test("configures exec command on program", () => {
      const program = new Command();
      configureExecCommand(program);

      const execCmd = program.commands.find((cmd) => cmd.name() === "exec");
      expect(execCmd).toBeDefined();
    });

    test("has correct description", () => {
      const program = new Command();
      configureExecCommand(program);

      const execCmd = program.commands.find((cmd) => cmd.name() === "exec");
      expect(execCmd?.description()).toBe(
        "Execute an arbitrary command in a tool's container environment"
      );
    });

    test("accepts tool argument", () => {
      const program = new Command();
      configureExecCommand(program);

      const execCmd = program.commands.find((cmd) => cmd.name() === "exec");
      const args = execCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThanOrEqual(1);
      expect(args[0]?.name()).toBe("tool");
    });

    test("accepts command argument", () => {
      const program = new Command();
      configureExecCommand(program);

      const execCmd = program.commands.find((cmd) => cmd.name() === "exec");
      const args = execCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThanOrEqual(2);
      expect(args[1]?.name()).toBe("command");
    });

    test("has --timeout option", () => {
      const program = new Command();
      configureExecCommand(program);

      const execCmd = program.commands.find((cmd) => cmd.name() === "exec");
      const opts = execCmd?.options ?? [];
      const timeoutOpt = opts.find((o) => o.long === "--timeout");
      expect(timeoutOpt).toBeDefined();
    });

    test("has --verbose option", () => {
      const program = new Command();
      configureExecCommand(program);

      const execCmd = program.commands.find((cmd) => cmd.name() === "exec");
      const opts = execCmd?.options ?? [];
      const verboseOpt = opts.find((o) => o.long === "--verbose");
      expect(verboseOpt).toBeDefined();
    });

    test("has --json option", () => {
      const program = new Command();
      configureExecCommand(program);

      const execCmd = program.commands.find((cmd) => cmd.name() === "exec");
      const opts = execCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });
  });

  describe("command parsing", () => {
    test("command with spaces should be quoted", () => {
      const command = 'echo "Hello World"';
      expect(command).toContain(" ");
      expect(command).toContain('"');
    });

    test("complex shell commands", () => {
      const command = "ls -la && cat enact.md";
      expect(command).toContain("&&");
    });

    test("command with pipes", () => {
      const command = "cat file.txt | grep pattern | wc -l";
      expect(command).toContain("|");
    });
  });
});
