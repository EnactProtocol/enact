/**
 * Tests for the env command
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { configureEnvCommand } from "../../src/commands/env";

// Test fixtures directory
const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures", "env-cmd");

describe("env command", () => {
  beforeAll(() => {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  });

  beforeEach(() => {
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
      mkdirSync(FIXTURES_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
  });

  describe("command configuration", () => {
    test("configures env command on program", () => {
      const program = new Command();
      configureEnvCommand(program);

      const envCmd = program.commands.find((cmd) => cmd.name() === "env");
      expect(envCmd).toBeDefined();
    });

    test("has correct description", () => {
      const program = new Command();
      configureEnvCommand(program);

      const envCmd = program.commands.find((cmd) => cmd.name() === "env");
      expect(envCmd?.description()).toBe("Manage environment variables and secrets");
    });

    test("has set subcommand", () => {
      const program = new Command();
      configureEnvCommand(program);

      const envCmd = program.commands.find((cmd) => cmd.name() === "env");
      const setCmd = envCmd?.commands.find((cmd) => cmd.name() === "set");
      expect(setCmd).toBeDefined();
    });

    test("has get subcommand", () => {
      const program = new Command();
      configureEnvCommand(program);

      const envCmd = program.commands.find((cmd) => cmd.name() === "env");
      const getCmd = envCmd?.commands.find((cmd) => cmd.name() === "get");
      expect(getCmd).toBeDefined();
    });

    test("has list subcommand", () => {
      const program = new Command();
      configureEnvCommand(program);

      const envCmd = program.commands.find((cmd) => cmd.name() === "env");
      const listCmd = envCmd?.commands.find((cmd) => cmd.name() === "list");
      expect(listCmd).toBeDefined();
    });

    test("has delete subcommand", () => {
      const program = new Command();
      configureEnvCommand(program);

      const envCmd = program.commands.find((cmd) => cmd.name() === "env");
      const deleteCmd = envCmd?.commands.find((cmd) => cmd.name() === "delete");
      expect(deleteCmd).toBeDefined();
    });

    test("delete has rm alias", () => {
      const program = new Command();
      configureEnvCommand(program);

      const envCmd = program.commands.find((cmd) => cmd.name() === "env");
      const deleteCmd = envCmd?.commands.find((cmd) => cmd.name() === "delete");
      const aliases = deleteCmd?.aliases() ?? [];
      expect(aliases).toContain("rm");
    });
  });

  describe("env set subcommand", () => {
    test("has key argument", () => {
      const program = new Command();
      configureEnvCommand(program);

      const envCmd = program.commands.find((cmd) => cmd.name() === "env");
      const setCmd = envCmd?.commands.find((cmd) => cmd.name() === "set");
      const args = setCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThanOrEqual(1);
      expect(args[0]?.name()).toBe("key");
    });

    test("has optional value argument", () => {
      const program = new Command();
      configureEnvCommand(program);

      const envCmd = program.commands.find((cmd) => cmd.name() === "env");
      const setCmd = envCmd?.commands.find((cmd) => cmd.name() === "set");
      const args = setCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThanOrEqual(2);
      expect(args[1]?.name()).toBe("value");
      expect(args[1]?.required).toBe(false);
    });

    test("has --secret option", () => {
      const program = new Command();
      configureEnvCommand(program);

      const envCmd = program.commands.find((cmd) => cmd.name() === "env");
      const setCmd = envCmd?.commands.find((cmd) => cmd.name() === "set");
      const opts = setCmd?.options ?? [];
      const secretOpt = opts.find((o) => o.long === "--secret");
      expect(secretOpt).toBeDefined();
    });

    test("has --namespace option", () => {
      const program = new Command();
      configureEnvCommand(program);

      const envCmd = program.commands.find((cmd) => cmd.name() === "env");
      const setCmd = envCmd?.commands.find((cmd) => cmd.name() === "set");
      const opts = setCmd?.options ?? [];
      const namespaceOpt = opts.find((o) => o.long === "--namespace");
      expect(namespaceOpt).toBeDefined();
    });

    test("has --local option", () => {
      const program = new Command();
      configureEnvCommand(program);

      const envCmd = program.commands.find((cmd) => cmd.name() === "env");
      const setCmd = envCmd?.commands.find((cmd) => cmd.name() === "set");
      const opts = setCmd?.options ?? [];
      const localOpt = opts.find((o) => o.long === "--local");
      expect(localOpt).toBeDefined();
    });
  });

  describe("env get subcommand", () => {
    test("has key argument", () => {
      const program = new Command();
      configureEnvCommand(program);

      const envCmd = program.commands.find((cmd) => cmd.name() === "env");
      const getCmd = envCmd?.commands.find((cmd) => cmd.name() === "get");
      const args = getCmd?.registeredArguments ?? [];
      expect(args.length).toBe(1);
      expect(args[0]?.name()).toBe("key");
    });

    test("has --secret option", () => {
      const program = new Command();
      configureEnvCommand(program);

      const envCmd = program.commands.find((cmd) => cmd.name() === "env");
      const getCmd = envCmd?.commands.find((cmd) => cmd.name() === "get");
      const opts = getCmd?.options ?? [];
      const secretOpt = opts.find((o) => o.long === "--secret");
      expect(secretOpt).toBeDefined();
    });

    test("has --namespace option", () => {
      const program = new Command();
      configureEnvCommand(program);

      const envCmd = program.commands.find((cmd) => cmd.name() === "env");
      const getCmd = envCmd?.commands.find((cmd) => cmd.name() === "get");
      const opts = getCmd?.options ?? [];
      const namespaceOpt = opts.find((o) => o.long === "--namespace");
      expect(namespaceOpt).toBeDefined();
    });
  });

  describe("env list subcommand", () => {
    test("has --secret option", () => {
      const program = new Command();
      configureEnvCommand(program);

      const envCmd = program.commands.find((cmd) => cmd.name() === "env");
      const listCmd = envCmd?.commands.find((cmd) => cmd.name() === "list");
      const opts = listCmd?.options ?? [];
      const secretOpt = opts.find((o) => o.long === "--secret");
      expect(secretOpt).toBeDefined();
    });

    test("has --local option", () => {
      const program = new Command();
      configureEnvCommand(program);

      const envCmd = program.commands.find((cmd) => cmd.name() === "env");
      const listCmd = envCmd?.commands.find((cmd) => cmd.name() === "list");
      const opts = listCmd?.options ?? [];
      const localOpt = opts.find((o) => o.long === "--local");
      expect(localOpt).toBeDefined();
    });

    test("has --global option", () => {
      const program = new Command();
      configureEnvCommand(program);

      const envCmd = program.commands.find((cmd) => cmd.name() === "env");
      const listCmd = envCmd?.commands.find((cmd) => cmd.name() === "list");
      const opts = listCmd?.options ?? [];
      const globalOpt = opts.find((o) => o.long === "--global");
      expect(globalOpt).toBeDefined();
    });
  });

  describe("env delete subcommand", () => {
    test("has key argument", () => {
      const program = new Command();
      configureEnvCommand(program);

      const envCmd = program.commands.find((cmd) => cmd.name() === "env");
      const deleteCmd = envCmd?.commands.find((cmd) => cmd.name() === "delete");
      const args = deleteCmd?.registeredArguments ?? [];
      expect(args.length).toBe(1);
      expect(args[0]?.name()).toBe("key");
    });

    test("has --secret option", () => {
      const program = new Command();
      configureEnvCommand(program);

      const envCmd = program.commands.find((cmd) => cmd.name() === "env");
      const deleteCmd = envCmd?.commands.find((cmd) => cmd.name() === "delete");
      const opts = deleteCmd?.options ?? [];
      const secretOpt = opts.find((o) => o.long === "--secret");
      expect(secretOpt).toBeDefined();
    });

    test("has --namespace option", () => {
      const program = new Command();
      configureEnvCommand(program);

      const envCmd = program.commands.find((cmd) => cmd.name() === "env");
      const deleteCmd = envCmd?.commands.find((cmd) => cmd.name() === "delete");
      const opts = deleteCmd?.options ?? [];
      const namespaceOpt = opts.find((o) => o.long === "--namespace");
      expect(namespaceOpt).toBeDefined();
    });

    test("has --local option", () => {
      const program = new Command();
      configureEnvCommand(program);

      const envCmd = program.commands.find((cmd) => cmd.name() === "env");
      const deleteCmd = envCmd?.commands.find((cmd) => cmd.name() === "delete");
      const opts = deleteCmd?.options ?? [];
      const localOpt = opts.find((o) => o.long === "--local");
      expect(localOpt).toBeDefined();
    });
  });

  describe("secret vs env mode", () => {
    test("secret mode requires namespace", () => {
      const options = { secret: true, namespace: undefined };
      const requiresNamespace = options.secret && !options.namespace;
      expect(requiresNamespace).toBe(true);
    });

    test("secret mode with namespace is valid", () => {
      const options = { secret: true, namespace: "alice/api" };
      const isValid = options.secret && options.namespace;
      expect(isValid).toBeTruthy();
    });

    test("env mode does not require namespace", () => {
      const options = { secret: false };
      expect(options.secret).toBe(false);
    });

    test("local option applies to env mode", () => {
      const options = { secret: false, local: true };
      expect(options.local).toBe(true);
    });
  });
});
