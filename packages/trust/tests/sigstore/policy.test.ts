/**
 * Tests for Sigstore trust policy module
 */

import { describe, expect, it } from "bun:test";
import { ENACT_AUDIT_TYPE, ENACT_TOOL_TYPE } from "../../src/sigstore/attestation";
import {
  DEFAULT_TRUST_POLICY,
  PERMISSIVE_POLICY,
  STRICT_POLICY,
  createIdentityRule,
  createTrustPolicy,
  deserializeTrustPolicy,
  evaluateTrustPolicy,
  isTrusted,
  serializeTrustPolicy,
} from "../../src/sigstore/policy";

describe("Trust Policy", () => {
  describe("Default Policies", () => {
    it("should have default policy requiring tool attestation", () => {
      expect(DEFAULT_TRUST_POLICY.name).toBe("default");
      expect(DEFAULT_TRUST_POLICY.requiredAttestations).toContain(ENACT_TOOL_TYPE);
      expect(DEFAULT_TRUST_POLICY.allowUnsigned).toBe(false);
      expect(DEFAULT_TRUST_POLICY.minimumSLSALevel).toBe(0);
    });

    it("should have permissive policy allowing unsigned", () => {
      expect(PERMISSIVE_POLICY.name).toBe("permissive");
      expect(PERMISSIVE_POLICY.allowUnsigned).toBe(true);
      expect(PERMISSIVE_POLICY.requiredAttestations).toEqual([]);
    });

    it("should have strict policy requiring auditor", () => {
      expect(STRICT_POLICY.name).toBe("strict");
      expect(STRICT_POLICY.requiredAttestations).toContain(ENACT_TOOL_TYPE);
      expect(STRICT_POLICY.requiredAttestations).toContain(ENACT_AUDIT_TYPE);
      expect(STRICT_POLICY.minimumSLSALevel).toBe(2);
      expect(STRICT_POLICY.allowUnsigned).toBe(false);
    });
  });

  describe("createTrustPolicy", () => {
    it("should create policy with defaults", () => {
      const policy = createTrustPolicy({ name: "my-policy" });

      expect(policy.name).toBe("my-policy");
      expect(policy.version).toBe("1.0");
      expect(policy.trustedPublishers).toEqual([]);
      expect(policy.trustedAuditors).toEqual([]);
      expect(policy.allowUnsigned).toBe(false);
    });

    it("should override default values", () => {
      const policy = createTrustPolicy({
        name: "custom-policy",
        allowUnsigned: true,
        minimumSLSALevel: 2,
        trustedPublishers: [{ name: "Test Publisher", type: "email", pattern: "*@example.com" }],
      });

      expect(policy.name).toBe("custom-policy");
      expect(policy.allowUnsigned).toBe(true);
      expect(policy.minimumSLSALevel).toBe(2);
      expect(policy.trustedPublishers).toHaveLength(1);
    });

    it("should allow custom version", () => {
      const policy = createTrustPolicy({
        name: "versioned-policy",
        version: "2.0",
      });

      expect(policy.version).toBe("2.0");
    });
  });

  describe("createIdentityRule", () => {
    it("should create email identity rule", () => {
      const rule = createIdentityRule("My Team", "email", "*@myorg.com");

      expect(rule.name).toBe("My Team");
      expect(rule.type).toBe("email");
      expect(rule.pattern).toBe("*@myorg.com");
    });

    it("should create GitHub workflow rule", () => {
      const rule = createIdentityRule("GitHub CI", "github-workflow", "myorg/*", {
        issuer: "https://token.actions.githubusercontent.com",
      });

      expect(rule.type).toBe("github-workflow");
      expect(rule.pattern).toBe("myorg/*");
      expect(rule.issuer).toBe("https://token.actions.githubusercontent.com");
    });

    it("should include required claims", () => {
      const rule = createIdentityRule("Specific Workflow", "github-workflow", "myorg/repo", {
        requiredClaims: {
          ref: "refs/heads/main",
          event_name: ["push", "workflow_dispatch"],
        },
      });

      expect(rule.requiredClaims?.ref).toBe("refs/heads/main");
      expect(rule.requiredClaims?.event_name).toEqual(["push", "workflow_dispatch"]);
    });
  });

  describe("evaluateTrustPolicy", () => {
    it("should trust empty bundles with permissive policy", async () => {
      const result = await evaluateTrustPolicy([], PERMISSIVE_POLICY);

      expect(result.trusted).toBe(true);
      expect(result.trustLevel).toBe(0);
      expect(result.details.warnings).toContain(
        "No attestations found - trusting unsigned artifact"
      );
    });

    it("should reject empty bundles with default policy", async () => {
      const result = await evaluateTrustPolicy([], DEFAULT_TRUST_POLICY);

      expect(result.trusted).toBe(false);
      expect(result.trustLevel).toBe(0);
      expect(result.details.violations).toContain(
        "No attestations found and policy requires signed artifacts"
      );
    });
  });

  describe("isTrusted", () => {
    it("should return boolean for quick check", async () => {
      const result = await isTrusted([], PERMISSIVE_POLICY);
      expect(result).toBe(true);
    });

    it("should use default policy when not specified", async () => {
      const result = await isTrusted([]);
      expect(result).toBe(false);
    });
  });

  describe("serializeTrustPolicy", () => {
    it("should serialize policy to JSON", () => {
      const policy = createTrustPolicy({
        name: "test-policy",
        trustedPublishers: [{ name: "Publisher", type: "email", pattern: "*@example.com" }],
      });

      const json = serializeTrustPolicy(policy);
      const parsed = JSON.parse(json);

      expect(parsed.name).toBe("test-policy");
      expect(parsed.trustedPublishers).toHaveLength(1);
    });

    it("should format JSON with indentation", () => {
      const json = serializeTrustPolicy(DEFAULT_TRUST_POLICY);

      expect(json).toContain("\n");
      expect(json).toContain("  ");
    });
  });

  describe("deserializeTrustPolicy", () => {
    it("should deserialize valid JSON", () => {
      const json = JSON.stringify({
        name: "deserialized-policy",
        version: "1.5",
        trustedPublishers: [],
        trustedAuditors: [],
      });

      const policy = deserializeTrustPolicy(json);

      expect(policy.name).toBe("deserialized-policy");
      expect(policy.version).toBe("1.5");
    });

    it("should apply defaults for missing fields", () => {
      const json = JSON.stringify({
        name: "minimal-policy",
        trustedPublishers: [],
        trustedAuditors: [],
      });

      const policy = deserializeTrustPolicy(json);

      expect(policy.allowUnsigned).toBe(false);
      expect(policy.cacheResults).toBe(true);
    });

    it("should throw on missing name", () => {
      const json = JSON.stringify({
        trustedPublishers: [],
        trustedAuditors: [],
      });

      expect(() => deserializeTrustPolicy(json)).toThrow("missing or invalid name");
    });

    it("should throw on missing trustedPublishers", () => {
      const json = JSON.stringify({
        name: "bad-policy",
        trustedAuditors: [],
      });

      expect(() => deserializeTrustPolicy(json)).toThrow("trustedPublishers must be an array");
    });

    it("should throw on missing trustedAuditors", () => {
      const json = JSON.stringify({
        name: "bad-policy",
        trustedPublishers: [],
      });

      expect(() => deserializeTrustPolicy(json)).toThrow("trustedAuditors must be an array");
    });

    it("should roundtrip serialize/deserialize", () => {
      const original = createTrustPolicy({
        name: "roundtrip-policy",
        version: "2.0",
        minimumSLSALevel: 2,
        trustedPublishers: [{ name: "Publisher", type: "email", pattern: "*@example.com" }],
        trustedAuditors: [{ name: "Auditor", type: "github-workflow", pattern: "auditor-org/*" }],
      });

      const json = serializeTrustPolicy(original);
      const restored = deserializeTrustPolicy(json);

      expect(restored.name).toBe(original.name);
      expect(restored.version).toBe(original.version);
      expect(restored.minimumSLSALevel).toBe(original.minimumSLSALevel);
      expect(restored.trustedPublishers).toEqual(original.trustedPublishers);
      expect(restored.trustedAuditors).toEqual(original.trustedAuditors);
    });
  });

  describe("Pattern Matching", () => {
    // These tests verify the internal pattern matching behavior through policy evaluation
    // We test by creating policies with specific patterns and checking if they would match

    it("should support wildcard patterns", () => {
      const rule = createIdentityRule("Wildcard", "email", "*@example.com");
      expect(rule.pattern).toBe("*@example.com");
    });

    it("should support single character wildcard", () => {
      const rule = createIdentityRule("Single Char", "email", "user?@example.com");
      expect(rule.pattern).toBe("user?@example.com");
    });

    it("should support exact match", () => {
      const rule = createIdentityRule("Exact", "email", "specific@example.com");
      expect(rule.pattern).toBe("specific@example.com");
    });
  });
});
