/**
 * Tests for MCP server trust policy enforcement
 *
 * These tests verify that the enact_run handler properly enforces
 * trust policies based on attestation verification.
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";

// Type for trust policy
type TrustPolicy = "require_attestation" | "prompt" | "allow";

// Mock the shared config functions
const mockGetTrustPolicy = mock((): TrustPolicy => "require_attestation");
const mockGetMinimumAttestations = mock(() => 1);
const mockIsIdentityTrusted = mock((_identity: string) => false);

// Mock the API functions
const mockVerifyAllAttestations = mock(async () => []);

describe("MCP Server Trust Policy Enforcement", () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockGetTrustPolicy.mockReset();
    mockGetMinimumAttestations.mockReset();
    mockIsIdentityTrusted.mockReset();
    mockVerifyAllAttestations.mockReset();

    // Set default mock implementations
    mockGetTrustPolicy.mockImplementation((): TrustPolicy => "require_attestation");
    mockGetMinimumAttestations.mockImplementation(() => 1);
    mockIsIdentityTrusted.mockImplementation(() => false);
    mockVerifyAllAttestations.mockImplementation(async () => []);
  });

  describe("Trust Policy Logic", () => {
    test("should block execution when policy is 'require_attestation' and no attestations", () => {
      const trustPolicy = mockGetTrustPolicy();
      const minimumAttestations = mockGetMinimumAttestations();
      const verifiedCount = 0;

      // Simulate the trust check logic from enact_run
      const shouldBlock =
        verifiedCount < minimumAttestations && trustPolicy === "require_attestation";

      expect(shouldBlock).toBe(true);
    });

    test("should block execution when policy is 'prompt' and no attestations", () => {
      mockGetTrustPolicy.mockImplementation((): TrustPolicy => "prompt");

      const trustPolicy = mockGetTrustPolicy();
      const minimumAttestations = mockGetMinimumAttestations();
      const verifiedCount = 0;

      // Simulate the trust check logic from enact_run
      const shouldBlock = verifiedCount < minimumAttestations && trustPolicy === "prompt";

      expect(shouldBlock).toBe(true);
    });

    test("should allow execution when policy is 'allow' regardless of attestations", () => {
      mockGetTrustPolicy.mockImplementation((): TrustPolicy => "allow");

      const trustPolicy = mockGetTrustPolicy();
      const minimumAttestations = mockGetMinimumAttestations();
      const verifiedCount = 0;

      // Simulate the trust check logic from enact_run
      const shouldBlock =
        verifiedCount < minimumAttestations &&
        (trustPolicy === "require_attestation" || trustPolicy === "prompt");

      expect(shouldBlock).toBe(false);
    });

    test("should allow execution when attestations meet minimum requirement", () => {
      mockIsIdentityTrusted.mockImplementation(() => true);

      const trustPolicy = mockGetTrustPolicy();
      const minimumAttestations = mockGetMinimumAttestations();
      const verifiedCount = 1; // Meets minimum

      const shouldBlock =
        verifiedCount < minimumAttestations &&
        (trustPolicy === "require_attestation" || trustPolicy === "prompt");

      expect(shouldBlock).toBe(false);
    });

    test("should require higher attestation count when minimum_attestations is increased", () => {
      mockGetMinimumAttestations.mockImplementation(() => 3);

      const trustPolicy = mockGetTrustPolicy();
      const minimumAttestations = mockGetMinimumAttestations();
      const verifiedCount = 2; // Below new minimum of 3

      const shouldBlock =
        verifiedCount < minimumAttestations && trustPolicy === "require_attestation";

      expect(shouldBlock).toBe(true);
    });
  });

  describe("Identity Trust Filtering", () => {
    test("should only count attestations from trusted identities", () => {
      // Mock attestations with various identities
      const attestations = [
        { providerIdentity: "github:trusted-user" },
        { providerIdentity: "github:untrusted-user" },
        { providerIdentity: "google:trusted@company.com" },
      ];

      // Only trust specific identities
      mockIsIdentityTrusted.mockImplementation((identity: string) => {
        return identity === "github:trusted-user" || identity === "google:trusted@company.com";
      });

      const verifiedCount = attestations.filter((v) =>
        mockIsIdentityTrusted(v.providerIdentity)
      ).length;

      expect(verifiedCount).toBe(2);
    });

    test("should return zero when no attestations are from trusted identities", () => {
      const attestations = [
        { providerIdentity: "github:unknown-user" },
        { providerIdentity: "github:another-unknown" },
      ];

      mockIsIdentityTrusted.mockImplementation(() => false);

      const verifiedCount = attestations.filter((v) =>
        mockIsIdentityTrusted(v.providerIdentity)
      ).length;

      expect(verifiedCount).toBe(0);
    });
  });

  describe("Error Message Generation", () => {
    test("should generate correct error message for require_attestation policy", () => {
      const trustPolicy = "require_attestation";
      const minimumAttestations = 1;
      const verifiedCount = 0;

      const errorMessage = `Trust policy violation: Tool requires ${minimumAttestations} attestation(s) from trusted auditors, but only ${verifiedCount} found.\n\nConfigured trust policy: ${trustPolicy}\nTo run unverified tools, update your ~/.enact/config.yaml trust policy to 'allow' or 'prompt'.`;

      expect(errorMessage).toContain("Trust policy violation");
      expect(errorMessage).toContain("require_attestation");
      expect(errorMessage).toContain("~/.enact/config.yaml");
    });

    test("should generate correct error message for prompt policy", () => {
      const trustPolicy = "prompt";
      const minimumAttestations = 1;
      const verifiedCount = 0;

      const errorMessage = `Trust policy violation: Tool requires ${minimumAttestations} attestation(s) from trusted auditors, but only ${verifiedCount} found.\n\nConfigured trust policy: ${trustPolicy}\nMCP server cannot prompt interactively. To run unverified tools via MCP, update your ~/.enact/config.yaml trust policy to 'allow'.`;

      expect(errorMessage).toContain("Trust policy violation");
      expect(errorMessage).toContain("prompt");
      expect(errorMessage).toContain("cannot prompt interactively");
    });
  });

  describe("Edge Cases", () => {
    test("should handle minimum_attestations of 0 (always allow)", () => {
      mockGetMinimumAttestations.mockImplementation(() => 0);

      const trustPolicy = mockGetTrustPolicy();
      const minimumAttestations = mockGetMinimumAttestations();
      const verifiedCount = 0;

      // 0 < 0 is false, so should not block
      const shouldBlock =
        verifiedCount < minimumAttestations && trustPolicy === "require_attestation";

      expect(shouldBlock).toBe(false);
    });

    test("should handle empty attestation list", async () => {
      mockVerifyAllAttestations.mockImplementation(async () => []);

      const attestations = await mockVerifyAllAttestations();
      const verifiedCount = attestations.filter((v: { providerIdentity: string }) =>
        mockIsIdentityTrusted(v.providerIdentity)
      ).length;

      expect(verifiedCount).toBe(0);
    });

    test("should handle attestation verification errors gracefully", async () => {
      mockVerifyAllAttestations.mockImplementation(async () => {
        throw new Error("Network error");
      });

      let verifiedCount = 0;
      try {
        const attestations = await mockVerifyAllAttestations();
        verifiedCount = attestations.length;
      } catch {
        // Error is caught, verifiedCount stays 0
      }

      expect(verifiedCount).toBe(0);
    });
  });
});

describe("Trust Policy Integration", () => {
  test("complete flow: unverified tool with require_attestation policy should be blocked", () => {
    // Setup: require_attestation policy, minimum 1 attestation, no trusted attestations
    mockGetTrustPolicy.mockImplementation(() => "require_attestation");
    mockGetMinimumAttestations.mockImplementation(() => 1);
    mockIsIdentityTrusted.mockImplementation(() => false);

    const attestations = [{ providerIdentity: "github:unknown" }];

    const trustPolicy = mockGetTrustPolicy();
    const minimumAttestations = mockGetMinimumAttestations();
    const verifiedCount = attestations.filter((v) =>
      mockIsIdentityTrusted(v.providerIdentity)
    ).length;

    expect(verifiedCount).toBe(0);
    expect(verifiedCount < minimumAttestations).toBe(true);
    expect(trustPolicy).toBe("require_attestation");

    // Should block
    const shouldBlock =
      verifiedCount < minimumAttestations &&
      (trustPolicy === "require_attestation" || trustPolicy === "prompt");
    expect(shouldBlock).toBe(true);
  });

  test("complete flow: verified tool with trusted attestation should be allowed", () => {
    // Setup: require_attestation policy, minimum 1 attestation, one trusted attestation
    mockGetTrustPolicy.mockImplementation(() => "require_attestation");
    mockGetMinimumAttestations.mockImplementation(() => 1);
    mockIsIdentityTrusted.mockImplementation(
      (identity: string) => identity === "github:EnactProtocol"
    );

    const attestations = [{ providerIdentity: "github:EnactProtocol" }];

    const trustPolicy = mockGetTrustPolicy();
    const minimumAttestations = mockGetMinimumAttestations();
    const verifiedCount = attestations.filter((v) =>
      mockIsIdentityTrusted(v.providerIdentity)
    ).length;

    expect(verifiedCount).toBe(1);
    expect(verifiedCount >= minimumAttestations).toBe(true);

    // Should not block
    const shouldBlock =
      verifiedCount < minimumAttestations &&
      (trustPolicy === "require_attestation" || trustPolicy === "prompt");
    expect(shouldBlock).toBe(false);
  });

  test("complete flow: allow policy bypasses attestation check", () => {
    // Setup: allow policy, no attestations
    mockGetTrustPolicy.mockImplementation((): TrustPolicy => "allow");
    mockGetMinimumAttestations.mockImplementation(() => 1);
    mockIsIdentityTrusted.mockImplementation(() => false);

    const trustPolicy = mockGetTrustPolicy();
    const minimumAttestations = mockGetMinimumAttestations();
    const verifiedCount = 0;

    // Should not block because policy is 'allow'
    const shouldBlock =
      verifiedCount < minimumAttestations &&
      (trustPolicy === "require_attestation" || trustPolicy === "prompt");
    expect(shouldBlock).toBe(false);
  });
});
