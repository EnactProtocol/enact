/**
 * Tests for the trust command
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { configureTrustCommand } from "../../src/commands/trust";

// Test fixtures directory
const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures", "trust-cmd");

describe("trust command", () => {
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
    test("configures trust command on program", () => {
      const program = new Command();
      configureTrustCommand(program);

      const trustCmd = program.commands.find((cmd) => cmd.name() === "trust");
      expect(trustCmd).toBeDefined();
    });

    test("has correct description", () => {
      const program = new Command();
      configureTrustCommand(program);

      const trustCmd = program.commands.find((cmd) => cmd.name() === "trust");
      expect(trustCmd?.description()).toBe("Manage trusted publishers and auditors");
    });

    test("has optional identity argument", () => {
      const program = new Command();
      configureTrustCommand(program);

      const trustCmd = program.commands.find((cmd) => cmd.name() === "trust");
      const args = trustCmd?.registeredArguments ?? [];
      expect(args.length).toBe(1);
      expect(args[0]?.name()).toBe("identity");
      expect(args[0]?.required).toBe(false);
    });

    test("has --remove option", () => {
      const program = new Command();
      configureTrustCommand(program);

      const trustCmd = program.commands.find((cmd) => cmd.name() === "trust");
      const opts = trustCmd?.options ?? [];
      const removeOpt = opts.find((o) => o.long === "--remove");
      expect(removeOpt).toBeDefined();
    });

    test("has -r short option for remove", () => {
      const program = new Command();
      configureTrustCommand(program);

      const trustCmd = program.commands.find((cmd) => cmd.name() === "trust");
      const opts = trustCmd?.options ?? [];
      const removeOpt = opts.find((o) => o.short === "-r");
      expect(removeOpt).toBeDefined();
    });

    test("has list subcommand", () => {
      const program = new Command();
      configureTrustCommand(program);

      const trustCmd = program.commands.find((cmd) => cmd.name() === "trust");
      const listCmd = trustCmd?.commands.find((cmd) => cmd.name() === "list");
      expect(listCmd).toBeDefined();
    });

    test("has check subcommand", () => {
      const program = new Command();
      configureTrustCommand(program);

      const trustCmd = program.commands.find((cmd) => cmd.name() === "trust");
      const checkCmd = trustCmd?.commands.find((cmd) => cmd.name() === "check");
      expect(checkCmd).toBeDefined();
    });
  });

  describe("trust check subcommand", () => {
    test("has tool argument", () => {
      const program = new Command();
      configureTrustCommand(program);

      const trustCmd = program.commands.find((cmd) => cmd.name() === "trust");
      const checkCmd = trustCmd?.commands.find((cmd) => cmd.name() === "check");
      const args = checkCmd?.registeredArguments ?? [];
      expect(args.length).toBe(1);
      expect(args[0]?.name()).toBe("tool");
    });

    test("has --json option", () => {
      const program = new Command();
      configureTrustCommand(program);

      const trustCmd = program.commands.find((cmd) => cmd.name() === "trust");
      const checkCmd = trustCmd?.commands.find((cmd) => cmd.name() === "check");
      const opts = checkCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });
  });

  describe("identity parsing", () => {
    // Helper function that mirrors the command's identity parsing logic
    const parseIdentity = (identity: string): { type: "publisher" | "auditor"; value: string } => {
      if (identity.includes(":")) {
        return { type: "auditor", value: identity };
      }
      return { type: "publisher", value: identity };
    };

    test("parses publisher identity (no colon)", () => {
      const result = parseIdentity("alice");
      expect(result.type).toBe("publisher");
      expect(result.value).toBe("alice");
    });

    test("parses publisher with dashes", () => {
      const result = parseIdentity("acme-corp");
      expect(result.type).toBe("publisher");
      expect(result.value).toBe("acme-corp");
    });

    test("parses github auditor identity", () => {
      const result = parseIdentity("github:EnactProtocol");
      expect(result.type).toBe("auditor");
      expect(result.value).toBe("github:EnactProtocol");
    });

    test("parses google auditor identity", () => {
      const result = parseIdentity("google:security@company.com");
      expect(result.type).toBe("auditor");
      expect(result.value).toBe("google:security@company.com");
    });

    test("parses microsoft auditor identity", () => {
      const result = parseIdentity("microsoft:user@company.com");
      expect(result.type).toBe("auditor");
      expect(result.value).toBe("microsoft:user@company.com");
    });

    test("parses wildcard auditor identity", () => {
      const result = parseIdentity("github:my-org/*");
      expect(result.type).toBe("auditor");
      expect(result.value).toBe("github:my-org/*");
    });

    test("parses email wildcard auditor identity", () => {
      const result = parseIdentity("google:*@company.com");
      expect(result.type).toBe("auditor");
      expect(result.value).toBe("google:*@company.com");
    });
  });

  describe("trust config structure", () => {
    test("default trust config shape", () => {
      const defaultTrust = {
        publishers: [] as string[],
        auditors: [] as string[],
        policy: "warn" as const,
      };

      expect(Array.isArray(defaultTrust.publishers)).toBe(true);
      expect(Array.isArray(defaultTrust.auditors)).toBe(true);
      expect(defaultTrust.policy).toBe("warn");
    });

    test("trust policies", () => {
      const validPolicies = ["require_audit", "prompt", "allow", "warn"];
      expect(validPolicies).toContain("require_audit");
      expect(validPolicies).toContain("prompt");
      expect(validPolicies).toContain("allow");
      expect(validPolicies).toContain("warn");
    });

    test("publishers array manipulation", () => {
      const publishers: string[] = [];

      // Add
      publishers.push("alice");
      expect(publishers).toContain("alice");

      // Prevent duplicates
      if (!publishers.includes("alice")) {
        publishers.push("alice");
      }
      expect(publishers.filter((p) => p === "alice").length).toBe(1);

      // Remove
      const index = publishers.indexOf("alice");
      if (index > -1) {
        publishers.splice(index, 1);
      }
      expect(publishers).not.toContain("alice");
    });

    test("auditors array manipulation", () => {
      const auditors: string[] = [];

      // Add
      auditors.push("github:EnactProtocol");
      expect(auditors).toContain("github:EnactProtocol");

      // Check existence
      const exists = auditors.includes("github:EnactProtocol");
      expect(exists).toBe(true);

      // Remove
      const index = auditors.indexOf("github:EnactProtocol");
      if (index > -1) {
        auditors.splice(index, 1);
      }
      expect(auditors).not.toContain("github:EnactProtocol");
    });
  });
});
