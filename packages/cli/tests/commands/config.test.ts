/**
 * Tests for the config command
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { configureConfigCommand } from "../../src/commands/config";

// Test fixtures directory
const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures", "config-cmd");

describe("config command", () => {
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
    test("configures config command on program", () => {
      const program = new Command();
      configureConfigCommand(program);

      const configCmd = program.commands.find((cmd) => cmd.name() === "config");
      expect(configCmd).toBeDefined();
    });

    test("has correct description", () => {
      const program = new Command();
      configureConfigCommand(program);

      const configCmd = program.commands.find((cmd) => cmd.name() === "config");
      expect(configCmd?.description()).toBe("Manage CLI configuration");
    });

    test("has get subcommand", () => {
      const program = new Command();
      configureConfigCommand(program);

      const configCmd = program.commands.find((cmd) => cmd.name() === "config");
      const getCmd = configCmd?.commands.find((cmd) => cmd.name() === "get");
      expect(getCmd).toBeDefined();
    });

    test("has set subcommand", () => {
      const program = new Command();
      configureConfigCommand(program);

      const configCmd = program.commands.find((cmd) => cmd.name() === "config");
      const setCmd = configCmd?.commands.find((cmd) => cmd.name() === "set");
      expect(setCmd).toBeDefined();
    });

    test("has list subcommand", () => {
      const program = new Command();
      configureConfigCommand(program);

      const configCmd = program.commands.find((cmd) => cmd.name() === "config");
      const listCmd = configCmd?.commands.find((cmd) => cmd.name() === "list");
      expect(listCmd).toBeDefined();
    });
  });

  describe("config get subcommand", () => {
    test("has key argument", () => {
      const program = new Command();
      configureConfigCommand(program);

      const configCmd = program.commands.find((cmd) => cmd.name() === "config");
      const getCmd = configCmd?.commands.find((cmd) => cmd.name() === "get");
      const args = getCmd?.registeredArguments ?? [];
      expect(args.length).toBe(1);
      expect(args[0]?.name()).toBe("key");
    });

    test("has --json option", () => {
      const program = new Command();
      configureConfigCommand(program);

      const configCmd = program.commands.find((cmd) => cmd.name() === "config");
      const getCmd = configCmd?.commands.find((cmd) => cmd.name() === "get");
      const opts = getCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });
  });

  describe("config set subcommand", () => {
    test("has key argument", () => {
      const program = new Command();
      configureConfigCommand(program);

      const configCmd = program.commands.find((cmd) => cmd.name() === "config");
      const setCmd = configCmd?.commands.find((cmd) => cmd.name() === "set");
      const args = setCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThanOrEqual(1);
      expect(args[0]?.name()).toBe("key");
    });

    test("has value argument", () => {
      const program = new Command();
      configureConfigCommand(program);

      const configCmd = program.commands.find((cmd) => cmd.name() === "config");
      const setCmd = configCmd?.commands.find((cmd) => cmd.name() === "set");
      const args = setCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThanOrEqual(2);
      expect(args[1]?.name()).toBe("value");
    });

    test("has --json option", () => {
      const program = new Command();
      configureConfigCommand(program);

      const configCmd = program.commands.find((cmd) => cmd.name() === "config");
      const setCmd = configCmd?.commands.find((cmd) => cmd.name() === "set");
      const opts = setCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });
  });

  describe("config list subcommand", () => {
    test("has --json option", () => {
      const program = new Command();
      configureConfigCommand(program);

      const configCmd = program.commands.find((cmd) => cmd.name() === "config");
      const listCmd = configCmd?.commands.find((cmd) => cmd.name() === "list");
      const opts = listCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });
  });

  describe("dot notation key parsing", () => {
    test("parses simple keys", () => {
      const key = "version";
      const parts = key.split(".");
      expect(parts).toEqual(["version"]);
    });

    test("parses nested keys", () => {
      const key = "trust.policy";
      const parts = key.split(".");
      expect(parts).toEqual(["trust", "policy"]);
    });

    test("parses deeply nested keys", () => {
      const key = "registry.auth.token";
      const parts = key.split(".");
      expect(parts).toEqual(["registry", "auth", "token"]);
    });

    test("gets value from nested object", () => {
      const config = {
        trust: {
          policy: "warn",
          publishers: ["alice"],
        },
        cache: {
          maxSizeMb: 1024,
        },
      };

      const getValue = (obj: Record<string, unknown>, key: string): unknown => {
        const parts = key.split(".");
        let current: unknown = obj;
        for (const part of parts) {
          if (current === null || typeof current !== "object") {
            return undefined;
          }
          current = (current as Record<string, unknown>)[part];
        }
        return current;
      };

      expect(getValue(config, "trust.policy")).toBe("warn");
      expect(getValue(config, "cache.maxSizeMb")).toBe(1024);
      expect(getValue(config, "trust.publishers")).toEqual(["alice"]);
      expect(getValue(config, "nonexistent")).toBeUndefined();
    });

    test("sets value in nested object", () => {
      const config: Record<string, unknown> = {
        trust: {
          policy: "warn",
        },
      };

      const setValue = (obj: Record<string, unknown>, key: string, value: unknown): void => {
        const parts = key.split(".");
        let current = obj;
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i] as string;
          if (!(part in current) || typeof current[part] !== "object") {
            current[part] = {};
          }
          current = current[part] as Record<string, unknown>;
        }
        const lastPart = parts[parts.length - 1] as string;
        current[lastPart] = value;
      };

      setValue(config, "trust.policy", "strict");
      expect((config.trust as Record<string, unknown>).policy).toBe("strict");

      setValue(config, "newKey", "value");
      expect(config.newKey).toBe("value");

      setValue(config, "deep.nested.key", 123);
      expect(((config.deep as Record<string, unknown>).nested as Record<string, unknown>).key).toBe(
        123
      );
    });
  });

  describe("value parsing", () => {
    test("parses JSON object values", () => {
      const value = '{"enabled": true}';
      const parsed = JSON.parse(value);
      expect(parsed.enabled).toBe(true);
    });

    test("parses JSON array values", () => {
      const value = '["alice", "bob"]';
      const parsed = JSON.parse(value);
      expect(parsed).toEqual(["alice", "bob"]);
    });

    test("parses number values", () => {
      const value = "1024";
      const parsed = JSON.parse(value);
      expect(parsed).toBe(1024);
    });

    test("parses boolean values", () => {
      expect(JSON.parse("true")).toBe(true);
      expect(JSON.parse("false")).toBe(false);
    });

    test("keeps string values as-is when not valid JSON", () => {
      const value = "simple-string";
      let parsed: unknown = value;
      try {
        parsed = JSON.parse(value);
      } catch {
        // Keep as string
      }
      expect(parsed).toBe("simple-string");
    });

    test("keeps URL values as strings", () => {
      const value = "https://enact.tools";
      let parsed: unknown = value;
      try {
        parsed = JSON.parse(value);
      } catch {
        // Keep as string
      }
      expect(parsed).toBe("https://enact.tools");
    });
  });
});
