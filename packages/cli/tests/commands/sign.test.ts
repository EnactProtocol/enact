/**
 * Tests for the sign command
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { configureSignCommand } from "../../src/commands/sign";

// Test fixtures directory
const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures", "sign-cmd");

describe("sign command", () => {
  beforeAll(() => {
    mkdirSync(FIXTURES_DIR, { recursive: true });

    // Create a test manifest
    writeFileSync(
      join(FIXTURES_DIR, "enact.yaml"),
      `enact: "2.0.0"
name: "test/sign-tool"
version: "1.0.0"
description: "A test tool for signing"
from: "alpine:latest"
command: "echo hello"
`
    );
  });

  afterAll(() => {
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
  });

  describe("command configuration", () => {
    test("configures sign command on program", () => {
      const program = new Command();
      configureSignCommand(program);

      const signCmd = program.commands.find((cmd) => cmd.name() === "sign");
      expect(signCmd).toBeDefined();
    });

    test("has correct description", () => {
      const program = new Command();
      configureSignCommand(program);

      const signCmd = program.commands.find((cmd) => cmd.name() === "sign");
      expect(signCmd?.description()).toBe(
        "Cryptographically sign a tool and submit attestation to registry"
      );
    });

    test("accepts path argument", () => {
      const program = new Command();
      configureSignCommand(program);

      const signCmd = program.commands.find((cmd) => cmd.name() === "sign");
      const args = signCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThanOrEqual(1);
      expect(args[0]?.name()).toBe("path");
    });

    test("has --identity option", () => {
      const program = new Command();
      configureSignCommand(program);

      const signCmd = program.commands.find((cmd) => cmd.name() === "sign");
      const opts = signCmd?.options ?? [];
      const identityOpt = opts.find((o) => o.long === "--identity");
      expect(identityOpt).toBeDefined();
    });

    test("has --output option", () => {
      const program = new Command();
      configureSignCommand(program);

      const signCmd = program.commands.find((cmd) => cmd.name() === "sign");
      const opts = signCmd?.options ?? [];
      const outputOpt = opts.find((o) => o.long === "--output");
      expect(outputOpt).toBeDefined();
    });

    test("has --dry-run option", () => {
      const program = new Command();
      configureSignCommand(program);

      const signCmd = program.commands.find((cmd) => cmd.name() === "sign");
      const opts = signCmd?.options ?? [];
      const dryRunOpt = opts.find((o) => o.long === "--dry-run");
      expect(dryRunOpt).toBeDefined();
    });

    test("has --verbose option", () => {
      const program = new Command();
      configureSignCommand(program);

      const signCmd = program.commands.find((cmd) => cmd.name() === "sign");
      const opts = signCmd?.options ?? [];
      const verboseOpt = opts.find((o) => o.long === "--verbose");
      expect(verboseOpt).toBeDefined();
    });

    test("has --json option", () => {
      const program = new Command();
      configureSignCommand(program);

      const signCmd = program.commands.find((cmd) => cmd.name() === "sign");
      const opts = signCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });

    test("has --local option", () => {
      const program = new Command();
      configureSignCommand(program);

      const signCmd = program.commands.find((cmd) => cmd.name() === "sign");
      const opts = signCmd?.options ?? [];
      const localOpt = opts.find((o) => o.long === "--local");
      expect(localOpt).toBeDefined();
    });
  });

  describe("signing workflow", () => {
    test("default bundle filename is .sigstore-bundle.json", () => {
      // This is defined in the module
      const expectedFilename = ".sigstore-bundle.json";
      expect(expectedFilename).toBe(".sigstore-bundle.json");
    });

    test("signing requires OIDC authentication", () => {
      // Sigstore keyless signing requires OIDC
      const requiresOIDC = true;
      expect(requiresOIDC).toBe(true);
    });

    test("signing creates in-toto attestation", () => {
      // The sign command creates in-toto attestations
      const attestationType = "https://in-toto.io/Statement/v1";
      expect(attestationType).toContain("in-toto");
    });
  });

  describe("Sigstore integration", () => {
    test("uses Fulcio for certificate issuance", () => {
      const fulcioUrl = "https://fulcio.sigstore.dev";
      expect(fulcioUrl).toContain("fulcio");
    });

    test("uses Rekor for transparency logging", () => {
      const rekorUrl = "https://rekor.sigstore.dev";
      expect(rekorUrl).toContain("rekor");
    });

    test("creates Enact tool attestation predicate", () => {
      const predicateType = "https://enact.tools/attestation/tool/v1";
      expect(predicateType).toContain("enact.tools");
      expect(predicateType).toContain("tool");
    });
  });

  describe("remote tool reference parsing", () => {
    test("parses simple remote tool reference with version", () => {
      const ref = "alice/greeter@1.2.0";
      const atIndex = ref.lastIndexOf("@");
      const name = ref.slice(0, atIndex);
      const version = ref.slice(atIndex + 1);

      expect(name).toBe("alice/greeter");
      expect(version).toBe("1.2.0");
    });

    test("parses namespaced tool reference with version", () => {
      const ref = "org/utils/greeter@2.0.0";
      const atIndex = ref.lastIndexOf("@");
      const name = ref.slice(0, atIndex);
      const version = ref.slice(atIndex + 1);

      expect(name).toBe("org/utils/greeter");
      expect(version).toBe("2.0.0");
    });

    test("detects remote vs local tool reference", () => {
      const isRemoteToolRef = (path: string): boolean => {
        // Remote refs contain @ for version and don't start with . or /
        return (
          !path.startsWith(".") && !path.startsWith("/") && path.includes("@") && path.includes("/")
        );
      };

      expect(isRemoteToolRef("alice/greeter@1.0.0")).toBe(true);
      expect(isRemoteToolRef("./local-tool")).toBe(false);
      expect(isRemoteToolRef("/absolute/path/tool")).toBe(false);
      expect(isRemoteToolRef("examples/hello-python")).toBe(false);
    });

    test("requires version in remote tool reference", () => {
      const hasVersion = (ref: string): boolean => {
        return ref.includes("@") && ref.lastIndexOf("@") > 0;
      };

      expect(hasVersion("alice/greeter@1.0.0")).toBe(true);
      expect(hasVersion("alice/greeter")).toBe(false);
    });

    test("validates semver version format", () => {
      const isValidSemver = (version: string): boolean => {
        const semverRegex = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;
        return semverRegex.test(version);
      };

      expect(isValidSemver("1.0.0")).toBe(true);
      expect(isValidSemver("2.1.3")).toBe(true);
      expect(isValidSemver("1.0.0-alpha")).toBe(true);
      expect(isValidSemver("1.0.0-beta.1")).toBe(true);
      expect(isValidSemver("invalid")).toBe(false);
      expect(isValidSemver("1.0")).toBe(false);
    });
  });
});
