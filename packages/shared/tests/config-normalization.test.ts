/**
 * Tests for config normalization — alias fields added in the README update.
 *
 * TrustConfig aliases: require_signatures → policy, trusted_publishers → auditors
 * ExecutionConfig routing: default, fallback, trusted_scopes
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import yaml from "js-yaml";
import {
  DEFAULT_CONFIG,
  getTrustPolicy,
  getTrustedIdentities,
  loadConfig,
  saveConfig,
} from "../src/config";

describe("config normalization", () => {
  describe("TrustConfig aliases", () => {
    test("require_signatures: true sets policy to require_attestation", () => {
      const configPath = join(homedir(), ".enact", "config.yaml");
      mkdirSync(join(homedir(), ".enact"), { recursive: true });
      writeFileSync(
        configPath,
        yaml.dump({
          trust: {
            require_signatures: true,
          },
        }),
        "utf-8"
      );

      const config = loadConfig();
      expect(config.trust?.policy).toBe("require_attestation");
    });

    test("require_signatures: false sets policy to allow", () => {
      const configPath = join(homedir(), ".enact", "config.yaml");
      writeFileSync(
        configPath,
        yaml.dump({
          trust: {
            require_signatures: false,
          },
        }),
        "utf-8"
      );

      const config = loadConfig();
      expect(config.trust?.policy).toBe("allow");
    });

    test("explicit policy takes precedence over require_signatures", () => {
      const configPath = join(homedir(), ".enact", "config.yaml");
      writeFileSync(
        configPath,
        yaml.dump({
          trust: {
            policy: "prompt",
            require_signatures: true,
          },
        }),
        "utf-8"
      );

      const config = loadConfig();
      // When policy is explicitly set, require_signatures should not override it
      expect(config.trust?.policy).toBe("prompt");
    });

    test("trusted_publishers merges into auditors", () => {
      const configPath = join(homedir(), ".enact", "config.yaml");
      writeFileSync(
        configPath,
        yaml.dump({
          trust: {
            auditors: ["github:existing-user"],
            trusted_publishers: ["@my-org"],
          },
        }),
        "utf-8"
      );

      const config = loadConfig();
      expect(config.trust?.auditors).toContain("github:existing-user");
      expect(config.trust?.auditors).toContain("@my-org");
    });

    test("trusted_publishers does not create duplicates", () => {
      const configPath = join(homedir(), ".enact", "config.yaml");
      writeFileSync(
        configPath,
        yaml.dump({
          trust: {
            auditors: ["@my-org", "github:alice"],
            trusted_publishers: ["@my-org"],
          },
        }),
        "utf-8"
      );

      const config = loadConfig();
      const orgCount = config.trust?.auditors?.filter((a) => a === "@my-org").length;
      expect(orgCount).toBe(1);
    });

    test("trusted_publishers works without existing auditors", () => {
      const configPath = join(homedir(), ".enact", "config.yaml");
      writeFileSync(
        configPath,
        yaml.dump({
          trust: {
            trusted_publishers: ["@my-org", "@other-org"],
          },
        }),
        "utf-8"
      );

      const config = loadConfig();
      // Should merge with default auditors
      expect(config.trust?.auditors).toContain("@my-org");
      expect(config.trust?.auditors).toContain("@other-org");
    });

    test("getTrustPolicy respects require_signatures alias", () => {
      const configPath = join(homedir(), ".enact", "config.yaml");
      writeFileSync(
        configPath,
        yaml.dump({
          trust: {
            require_signatures: true,
          },
        }),
        "utf-8"
      );

      expect(getTrustPolicy()).toBe("require_attestation");
    });

    test("getTrustedIdentities includes trusted_publishers", () => {
      const configPath = join(homedir(), ".enact", "config.yaml");
      writeFileSync(
        configPath,
        yaml.dump({
          trust: {
            auditors: ["github:alice"],
            trusted_publishers: ["@acme"],
          },
        }),
        "utf-8"
      );

      const identities = getTrustedIdentities();
      expect(identities).toContain("github:alice");
      expect(identities).toContain("@acme");
    });
  });

  describe("ExecutionConfig routing fields", () => {
    test("default execution backend is preserved", () => {
      const configPath = join(homedir(), ".enact", "config.yaml");
      writeFileSync(
        configPath,
        yaml.dump({
          execution: {
            default: "docker",
          },
        }),
        "utf-8"
      );

      const config = loadConfig();
      expect(config.execution?.default).toBe("docker");
    });

    test("fallback execution backend is preserved", () => {
      const configPath = join(homedir(), ".enact", "config.yaml");
      writeFileSync(
        configPath,
        yaml.dump({
          execution: {
            default: "container",
            fallback: "remote",
          },
        }),
        "utf-8"
      );

      const config = loadConfig();
      expect(config.execution?.default).toBe("container");
      expect(config.execution?.fallback).toBe("remote");
    });

    test("trusted_scopes is preserved as array", () => {
      const configPath = join(homedir(), ".enact", "config.yaml");
      writeFileSync(
        configPath,
        yaml.dump({
          execution: {
            default: "container",
            fallback: "remote",
            trusted_scopes: ["@my-org/*", "@internal/*"],
          },
        }),
        "utf-8"
      );

      const config = loadConfig();
      expect(config.execution?.trusted_scopes).toEqual(["@my-org/*", "@internal/*"]);
    });

    test("routing fields coexist with existing fields", () => {
      const configPath = join(homedir(), ".enact", "config.yaml");
      writeFileSync(
        configPath,
        yaml.dump({
          execution: {
            defaultTimeout: "1m",
            verbose: true,
            default: "docker",
            fallback: "local",
            trusted_scopes: ["@my-org/*"],
          },
        }),
        "utf-8"
      );

      const config = loadConfig();
      expect(config.execution?.defaultTimeout).toBe("1m");
      expect(config.execution?.verbose).toBe(true);
      expect(config.execution?.default).toBe("docker");
      expect(config.execution?.fallback).toBe("local");
      expect(config.execution?.trusted_scopes).toEqual(["@my-org/*"]);
    });

    test("missing routing fields default to undefined", () => {
      saveConfig({ ...DEFAULT_CONFIG });
      const config = loadConfig();
      expect(config.execution?.default).toBeUndefined();
      expect(config.execution?.fallback).toBeUndefined();
      expect(config.execution?.trusted_scopes).toBeUndefined();
    });
  });

  describe("full README-style config", () => {
    test("parses complete README example correctly", () => {
      const configPath = join(homedir(), ".enact", "config.yaml");
      writeFileSync(
        configPath,
        yaml.dump({
          trust: {
            require_signatures: true,
            trusted_publishers: ["@my-org"],
          },
          execution: {
            default: "container",
            fallback: "remote",
            trusted_scopes: ["@my-org/*"],
          },
        }),
        "utf-8"
      );

      const config = loadConfig();

      // Trust
      expect(config.trust?.policy).toBe("require_attestation");
      expect(config.trust?.auditors).toContain("@my-org");

      // Execution
      expect(config.execution?.default).toBe("container");
      expect(config.execution?.fallback).toBe("remote");
      expect(config.execution?.trusted_scopes).toEqual(["@my-org/*"]);
    });
  });
});
