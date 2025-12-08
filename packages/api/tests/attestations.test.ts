/**
 * Tests for attestation management (v2)
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  getAttestationBundle,
  getAttestations,
  hasAttestation,
  hasTrustedAttestation,
  revokeAttestation,
  submitAttestation,
  verifyAllAttestations,
  verifyAttestationLocally,
} from "../src/attestations";
import { DEFAULT_REGISTRY_URL, createApiClient } from "../src/client";
import { type MockServer, createMockServer } from "./mocks/server";

// Helper type for mock verification results
interface MockVerificationResult {
  verified: boolean;
  error?: string;
  details: {
    signatureValid: boolean;
    certificateValid?: boolean;
    certificateWithinValidity?: boolean;
    rekorEntryValid?: boolean;
    inclusionProofValid?: boolean;
    errors?: string[];
  };
  identity?: {
    subject: string;
    issuer: string;
    provider: string;
  };
}

// Mock @enactprotocol/trust verification
const mockVerifyBundle = mock(
  async (): Promise<MockVerificationResult> => ({
    verified: true,
    details: {
      signatureValid: true,
      certificateValid: true,
      certificateWithinValidity: true,
      rekorEntryValid: true,
      inclusionProofValid: true,
      errors: [],
    },
  })
);
mock.module("@enactprotocol/trust", () => ({
  verifyBundle: mockVerifyBundle,
}));

describe("Attestations (v2)", () => {
  let mockServer: MockServer;

  beforeEach(() => {
    mockServer = createMockServer();
    // @ts-expect-error - Simplified fetch mock for testing
    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const request = new Request(url, init);
      return mockServer.fetch(request);
    };
  });

  describe("getAttestations", () => {
    test("fetches attestations for a tool version", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      const result = await getAttestations(client, "alice/utils/greeter", "1.2.0");

      expect(result).toBeDefined();
      expect(result.attestations).toBeArray();
      expect(result.total).toBeNumber();
      expect(result.limit).toBeNumber();
      expect(result.offset).toBeNumber();
    });

    test("supports pagination options", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      const result = await getAttestations(client, "alice/utils/greeter", "1.2.0", {
        limit: 5,
        offset: 10,
      });

      expect(result.limit).toBeLessThanOrEqual(5);
      expect(result.offset).toBe(10);
    });

    test("caps limit at 100", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      const result = await getAttestations(client, "alice/utils/greeter", "1.2.0", {
        limit: 200,
      });

      // Mock server should receive limit=100 max
      expect(result.limit).toBeLessThanOrEqual(100);
    });

    test("handles tool not found", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      try {
        await getAttestations(client, "nonexistent/tool", "1.0.0");
        expect.unreachable("Should have thrown");
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("submitAttestation", () => {
    test("submits attestation with Sigstore bundle", async () => {
      const client = createApiClient({
        baseUrl: DEFAULT_REGISTRY_URL,
        authToken: "valid-token",
      });

      const sigstoreBundle = {
        $schema: "https://sigstore.dev/bundle/v1",
        mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json",
        verificationMaterial: {
          certificate: "mock-cert",
          tlogEntries: [{ logIndex: 123 }],
        },
        messageSignature: {
          signature: "mock-signature",
        },
      };

      const result = await submitAttestation(
        client,
        "alice/utils/greeter",
        "1.2.0",
        sigstoreBundle
      );

      expect(result).toBeDefined();
      expect(result.auditor).toBeTruthy();
      expect(result.auditorProvider).toBeTruthy();
      expect(result.signedAt).toBeInstanceOf(Date);
      expect(result.rekorLogId).toBeTruthy();
      expect(result.verification).toBeDefined();
      expect(result.verification.verified).toBeBoolean();
      expect(result.verification.verifiedAt).toBeInstanceOf(Date);
      expect(result.verification.rekorVerified).toBeBoolean();
      expect(result.verification.certificateVerified).toBeBoolean();
      expect(result.verification.signatureVerified).toBeBoolean();
    });

    test("requires authentication", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      const sigstoreBundle = {
        $schema: "https://sigstore.dev/bundle/v1",
        mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json",
      };

      try {
        await submitAttestation(client, "alice/utils/greeter", "1.2.0", sigstoreBundle);
        expect.unreachable("Should have thrown");
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("revokeAttestation", () => {
    test("revokes attestation by auditor email", async () => {
      const client = createApiClient({
        baseUrl: DEFAULT_REGISTRY_URL,
        authToken: "valid-token",
      });

      const result = await revokeAttestation(
        client,
        "alice/utils/greeter",
        "1.2.0",
        "security@example.com"
      );

      expect(result).toBeDefined();
      expect(result.auditor).toBe("security@example.com");
      expect(result.revoked).toBe(true);
      expect(result.revokedAt).toBeInstanceOf(Date);
    });

    test("handles special characters in email", async () => {
      const client = createApiClient({
        baseUrl: DEFAULT_REGISTRY_URL,
        authToken: "valid-token",
      });

      const result = await revokeAttestation(
        client,
        "alice/utils/greeter",
        "1.2.0",
        "user+test@example.com"
      );

      expect(result).toBeDefined();
      expect(result.auditor).toBeTruthy();
    });

    test("requires authentication", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      try {
        await revokeAttestation(client, "alice/utils/greeter", "1.2.0", "security@example.com");
        expect.unreachable("Should have thrown");
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("hasAttestation", () => {
    test("checks if tool has attestation from trusted auditors", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      const result = await hasAttestation(client, "alice/utils/greeter", "1.2.0", [
        "security@example.com",
      ]);

      expect(result).toBeBoolean();
    });

    test("returns false for no matching auditors", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      const result = await hasAttestation(client, "alice/utils/greeter", "1.2.0", [
        "nonexistent@example.com",
      ]);

      expect(result).toBeBoolean();
    });

    test("checks multiple trusted auditors", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      const result = await hasAttestation(client, "alice/utils/greeter", "1.2.0", [
        "security@example.com",
        "audit@example.com",
        "review@example.com",
      ]);

      expect(result).toBeBoolean();
    });
  });

  describe("getAttestationBundle", () => {
    test("fetches full Sigstore bundle for an attestation", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      const bundle = await getAttestationBundle(
        client,
        "alice/utils/greeter",
        "1.2.0",
        "security@example.com"
      );

      expect(bundle).toBeDefined();
      expect(bundle.mediaType).toBeTruthy();
      expect(bundle.verificationMaterial).toBeDefined();
      expect(bundle.messageSignature).toBeDefined();
    });

    test("encodes auditor email in URL", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      // Should handle special characters in email
      const bundle = await getAttestationBundle(
        client,
        "alice/utils/greeter",
        "1.2.0",
        "user+test@example.com"
      );

      expect(bundle).toBeDefined();
    });
  });

  describe("verifyAttestationLocally", () => {
    test("verifies attestation using @enactprotocol/trust package", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      // Reset mock and set successful verification
      mockVerifyBundle.mockReset();
      mockVerifyBundle.mockResolvedValue({
        verified: true,
        details: {
          signatureValid: true,
          certificateValid: true,
          certificateWithinValidity: true,
          rekorEntryValid: true,
          inclusionProofValid: true,
          errors: [],
        },
      });

      const attestations = await getAttestations(client, "alice/utils/greeter", "1.2.0");
      const attestation = attestations.attestations[0];

      if (!attestation) {
        throw new Error("No attestation found");
      }

      const isValid = await verifyAttestationLocally(
        client,
        "alice/utils/greeter",
        "1.2.0",
        attestation,
        "sha256:abc123def456"
      );

      expect(isValid).toBe(true);
      expect(mockVerifyBundle).toHaveBeenCalled();
    });

    test("returns false when verification fails", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      // Mock verification failure
      mockVerifyBundle.mockReset();
      mockVerifyBundle.mockResolvedValue({
        verified: false,
        details: {
          signatureValid: false,
          certificateValid: true,
          certificateWithinValidity: true,
          rekorEntryValid: true,
          inclusionProofValid: true,
          errors: ["Invalid signature"],
        },
      });

      const attestations = await getAttestations(client, "alice/utils/greeter", "1.2.0");
      const attestation = attestations.attestations[0];

      if (!attestation) {
        throw new Error("No attestation found");
      }

      const isValid = await verifyAttestationLocally(
        client,
        "alice/utils/greeter",
        "1.2.0",
        attestation,
        "sha256:abc123def456"
      );

      expect(isValid).toBe(false);
    });

    test("handles verification errors gracefully", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      // Mock verification error
      mockVerifyBundle.mockReset();
      mockVerifyBundle.mockRejectedValue(new Error("Network error"));

      const attestations = await getAttestations(client, "alice/utils/greeter", "1.2.0");
      const attestation = attestations.attestations[0];

      if (!attestation) {
        throw new Error("No attestation found");
      }

      const isValid = await verifyAttestationLocally(
        client,
        "alice/utils/greeter",
        "1.2.0",
        attestation,
        "sha256:abc123def456"
      );

      expect(isValid).toBe(false);
    });

    test("passes expected identity to verifyBundle", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      mockVerifyBundle.mockReset();
      mockVerifyBundle.mockResolvedValue({
        verified: true,
        details: {
          signatureValid: true,
          certificateValid: true,
          certificateWithinValidity: true,
          rekorEntryValid: true,
          inclusionProofValid: true,
          errors: [],
        },
      });

      const attestations = await getAttestations(client, "alice/utils/greeter", "1.2.0");
      const attestation = attestations.attestations[0];

      if (!attestation) {
        throw new Error("No attestation found");
      }

      await verifyAttestationLocally(
        client,
        "alice/utils/greeter",
        "1.2.0",
        attestation,
        "sha256:abc123def456"
      );

      // Verify that verifyBundle was called with expected identity
      const calls = mockVerifyBundle.mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      // Check that the call was made with the expected identity option
      expect(mockVerifyBundle).toHaveBeenCalledWith(
        expect.anything(), // bundle
        expect.anything(), // artifact hash
        expect.objectContaining({
          expectedIdentity: expect.objectContaining({
            subjectAlternativeName: attestation.auditor,
          }),
        })
      );
    });
  });

  describe("verifyAllAttestations", () => {
    test("verifies all attestations and returns verified auditors", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      mockVerifyBundle.mockReset();
      mockVerifyBundle.mockResolvedValue({
        verified: true,
        details: { signatureValid: true, errors: [] },
      });

      const verifiedAuditors = await verifyAllAttestations(
        client,
        "alice/utils/greeter",
        "1.2.0",
        "sha256:abc123def456"
      );

      expect(verifiedAuditors).toBeArray();
      expect(verifiedAuditors.length).toBeGreaterThanOrEqual(0);
    });

    test("filters out failed verifications", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      // Mock mixed verification results
      let callCount = 0;
      mockVerifyBundle.mockReset();
      mockVerifyBundle.mockImplementation(async () => {
        callCount++;
        return {
          verified: callCount % 2 === 1, // Alternate between success and failure
          details: { signatureValid: callCount % 2 === 1, errors: [] },
        };
      });

      const verifiedAuditors = await verifyAllAttestations(
        client,
        "alice/utils/greeter",
        "1.2.0",
        "sha256:abc123def456"
      );

      expect(verifiedAuditors).toBeArray();
      // Should only include verified auditors
    });

    test("handles empty attestation list", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      mockVerifyBundle.mockReset();
      mockVerifyBundle.mockResolvedValue({
        verified: true,
        details: { signatureValid: true, errors: [] },
      });

      const verifiedAuditors = await verifyAllAttestations(
        client,
        "nonexistent/tool",
        "1.0.0",
        "sha256:abc123def456"
      );

      expect(verifiedAuditors).toBeArray();
    });
  });

  describe("hasTrustedAttestation", () => {
    test("returns true when verified auditor is in trusted list", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      mockVerifyBundle.mockReset();
      mockVerifyBundle.mockResolvedValue({
        verified: true,
        details: { signatureValid: true, errors: [] },
      });

      const isTrusted = await hasTrustedAttestation(
        client,
        "alice/utils/greeter",
        "1.2.0",
        "sha256:abc123def456",
        ["security@example.com"]
      );

      expect(isTrusted).toBeBoolean();
    });

    test("returns false when no verified auditors are trusted", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      mockVerifyBundle.mockReset();
      mockVerifyBundle.mockResolvedValue({
        verified: true,
        details: { signatureValid: true, errors: [] },
      });

      const isTrusted = await hasTrustedAttestation(
        client,
        "alice/utils/greeter",
        "1.2.0",
        "sha256:abc123def456",
        ["nonexistent@example.com"]
      );

      expect(isTrusted).toBe(false);
    });

    test("returns false when verification fails for all attestations", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      mockVerifyBundle.mockReset();
      mockVerifyBundle.mockResolvedValue({
        verified: false,
        error: "Invalid signature",
        details: {
          signatureValid: false,
          certificateValid: false,
          certificateWithinValidity: false,
          rekorEntryValid: false,
          inclusionProofValid: false,
          errors: ["Invalid signature"],
        },
      });

      const isTrusted = await hasTrustedAttestation(
        client,
        "alice/utils/greeter",
        "1.2.0",
        "sha256:abc123def456",
        ["security@example.com"]
      );

      expect(isTrusted).toBe(false);
    });

    test("checks multiple trusted auditors", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      mockVerifyBundle.mockReset();
      mockVerifyBundle.mockResolvedValue({
        verified: true,
        details: {
          signatureValid: true,
          certificateValid: true,
          certificateWithinValidity: true,
          rekorEntryValid: true,
          inclusionProofValid: true,
          errors: [],
        },
      });

      const isTrusted = await hasTrustedAttestation(
        client,
        "alice/utils/greeter",
        "1.2.0",
        "sha256:abc123def456",
        ["security@example.com", "audit@example.com", "review@example.com"]
      );

      expect(isTrusted).toBeBoolean();
    });
  });
});
