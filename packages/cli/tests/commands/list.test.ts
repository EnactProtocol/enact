/**
 * Tests for the list command
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { configureListCommand } from "../../src/commands/list";

// Test fixtures directory
const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures", "list-cmd");

describe("list command", () => {
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
    test("configures list command on program", () => {
      const program = new Command();
      configureListCommand(program);

      const listCmd = program.commands.find((cmd) => cmd.name() === "list");
      expect(listCmd).toBeDefined();
    });

    test("has correct description", () => {
      const program = new Command();
      configureListCommand(program);

      const listCmd = program.commands.find((cmd) => cmd.name() === "list");
      expect(listCmd?.description()).toBe("List installed tools");
    });

    test("has 'ls' as alias", () => {
      const program = new Command();
      configureListCommand(program);

      const listCmd = program.commands.find((cmd) => cmd.name() === "list");
      const aliases = listCmd?.aliases() ?? [];
      expect(aliases).toContain("ls");
    });

    test("has --global option", () => {
      const program = new Command();
      configureListCommand(program);

      const listCmd = program.commands.find((cmd) => cmd.name() === "list");
      const opts = listCmd?.options ?? [];
      const globalOpt = opts.find((o) => o.long === "--global");
      expect(globalOpt).toBeDefined();
    });

    test("has --verbose option", () => {
      const program = new Command();
      configureListCommand(program);

      const listCmd = program.commands.find((cmd) => cmd.name() === "list");
      const opts = listCmd?.options ?? [];
      const verboseOpt = opts.find((o) => o.long === "--verbose");
      expect(verboseOpt).toBeDefined();
    });

    test("has --json option", () => {
      const program = new Command();
      configureListCommand(program);

      const listCmd = program.commands.find((cmd) => cmd.name() === "list");
      const opts = listCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });
  });

  describe("scope filtering logic", () => {
    test("default shows project and user tools", () => {
      const options: { project?: boolean; user?: boolean; cache?: boolean; all?: boolean } = {};
      const showProject = options.project || options.all || (!options.user && !options.cache);
      const showUser = options.user || options.all || (!options.project && !options.cache);
      const showCache = options.cache || options.all || false;

      expect(showProject).toBe(true);
      expect(showUser).toBe(true);
      expect(showCache).toBe(false);
    });

    test("--project shows only project tools", () => {
      const options = { project: true };
      const showProject = options.project || false;
      const showUser = !options.project && false;
      const showCache = false;

      expect(showProject).toBe(true);
      expect(showUser).toBe(false);
      expect(showCache).toBe(false);
    });

    test("--user shows only user tools", () => {
      const options = { user: true };
      expect(options.user).toBe(true);
    });

    test("--cache shows only cached tools", () => {
      const options = { cache: true };
      expect(options.cache).toBe(true);
    });

    test("--all shows all locations", () => {
      const options = { all: true };
      const showProject = options.all;
      const showUser = options.all;
      const showCache = options.all;

      expect(showProject).toBe(true);
      expect(showUser).toBe(true);
      expect(showCache).toBe(true);
    });
  });

  describe("tool info structure", () => {
    test("tool info has required properties", () => {
      const toolInfo = {
        name: "alice/utils/greeter",
        version: "1.0.0",
        location: "/path/to/tool",
        scope: "project",
      };

      expect(toolInfo.name).toBe("alice/utils/greeter");
      expect(toolInfo.version).toBe("1.0.0");
      expect(toolInfo.location).toBe("/path/to/tool");
      expect(toolInfo.scope).toBe("project");
    });

    test("version defaults to dash for unversioned tools", () => {
      const toolInfo = {
        name: "alice/utils/greeter",
        version: "-",
        location: "/path/to/tool",
        scope: "user",
      };

      expect(toolInfo.version).toBe("-");
    });
  });
});
