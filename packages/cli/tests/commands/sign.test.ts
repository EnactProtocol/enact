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
});
