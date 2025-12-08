/**
 * Tests for Sigstore signing module
 */

import { describe, expect, it } from "bun:test";
import {
  FULCIO_PUBLIC_URL,
  OIDC_ISSUERS,
  REKOR_PUBLIC_URL,
  TSA_PUBLIC_URL,
  detectOIDCProvider,
  extractCertificateFromBundle,
  extractIdentityFromBundle,
  extractOIDCIdentity,
  getOIDCTokenFromEnvironment,
} from "../../src/sigstore/signing";
import type { SigstoreBundle } from "../../src/sigstore/types";

// Helper to create test bundles - using unknown to bypass complex sigstore types
function createTestBundle(overrides: Record<string, unknown> = {}): SigstoreBundle {
  return {
    mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json",
    verificationMaterial: {
      tlogEntries: [],
      timestampVerificationData: undefined,
    },
    ...overrides,
  } as unknown as SigstoreBundle;
}

describe("Sigstore Signing", () => {
  describe("Constants", () => {
    it("should export correct Fulcio URL", () => {
      expect(FULCIO_PUBLIC_URL).toBe("https://fulcio.sigstore.dev");
    });

    it("should export correct Rekor URL", () => {
      expect(REKOR_PUBLIC_URL).toBe("https://rekor.sigstore.dev");
    });

    it("should export correct TSA URL", () => {
      expect(TSA_PUBLIC_URL).toBe("https://timestamp.sigstore.dev");
    });

    it("should export OIDC issuer URLs for all providers", () => {
      expect(OIDC_ISSUERS.github).toBe("https://token.actions.githubusercontent.com");
      expect(OIDC_ISSUERS.google).toBe("https://accounts.google.com");
      expect(OIDC_ISSUERS.microsoft).toBe("https://login.microsoftonline.com");
      expect(OIDC_ISSUERS.gitlab).toBe("https://gitlab.com");
      expect(OIDC_ISSUERS.custom).toBe("");
    });
  });

  describe("detectOIDCProvider", () => {
    it("should detect GitHub provider", () => {
      expect(detectOIDCProvider("https://token.actions.githubusercontent.com")).toBe("github");
    });

    it("should detect Google provider", () => {
      expect(detectOIDCProvider("https://accounts.google.com")).toBe("google");
    });

    it("should detect Microsoft provider", () => {
      expect(detectOIDCProvider("https://login.microsoftonline.com/tenant")).toBe("microsoft");
    });

    it("should detect GitLab provider", () => {
      expect(detectOIDCProvider("https://gitlab.com")).toBe("gitlab");
    });

    it("should return custom for unknown issuers", () => {
      expect(detectOIDCProvider("https://unknown-issuer.com")).toBe("custom");
    });
  });

  describe("extractOIDCIdentity", () => {
    // Create a valid JWT token for testing
    function createTestJWT(claims: Record<string, unknown>): string {
      const header = { alg: "RS256", typ: "JWT" };
      const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
      const payloadB64 = Buffer.from(JSON.stringify(claims)).toString("base64url");
      const signature = "fake-signature";
      return `${headerB64}.${payloadB64}.${signature}`;
    }

    it("should extract identity from GitHub OIDC token", () => {
      const token = createTestJWT({
        iss: "https://token.actions.githubusercontent.com",
        sub: "repo:owner/repo:ref:refs/heads/main",
        email: "test@example.com",
        repository: "owner/repo",
        ref: "refs/heads/main",
        event_name: "push",
      });

      const identity = extractOIDCIdentity(token);

      expect(identity.provider).toBe("github");
      expect(identity.issuer).toBe("https://token.actions.githubusercontent.com");
      expect(identity.email).toBe("test@example.com");
      expect(identity.workflowRepository).toBe("owner/repo");
      expect(identity.workflowRef).toBe("refs/heads/main");
      expect(identity.workflowTrigger).toBe("push");
    });

    it("should extract identity from Google OIDC token", () => {
      const token = createTestJWT({
        iss: "https://accounts.google.com",
        sub: "123456789",
        email: "user@gmail.com",
      });

      const identity = extractOIDCIdentity(token);

      expect(identity.provider).toBe("google");
      expect(identity.issuer).toBe("https://accounts.google.com");
      expect(identity.subject).toBe("123456789");
      expect(identity.email).toBe("user@gmail.com");
    });

    it("should throw on invalid JWT format", () => {
      expect(() => extractOIDCIdentity("not-a-jwt")).toThrow("Invalid JWT format");
    });

    it("should throw on invalid JWT with only two parts", () => {
      expect(() => extractOIDCIdentity("header.payload")).toThrow("Invalid JWT format");
    });

    it("should throw on invalid payload", () => {
      const invalidToken = "aGVhZGVy.aW52YWxpZA==.c2lnbmF0dXJl";
      expect(() => extractOIDCIdentity(invalidToken)).toThrow("Failed to decode JWT payload");
    });
  });

  describe("getOIDCTokenFromEnvironment", () => {
    it("should return undefined for github without env var", () => {
      const originalEnv = process.env.ACTIONS_ID_TOKEN;
      process.env.ACTIONS_ID_TOKEN = undefined;

      const token = getOIDCTokenFromEnvironment("github");
      expect(token).toBeUndefined();

      if (originalEnv) process.env.ACTIONS_ID_TOKEN = originalEnv;
    });

    it("should return undefined for gitlab without env vars", () => {
      const originalV2 = process.env.CI_JOB_JWT_V2;
      const originalV1 = process.env.CI_JOB_JWT;
      process.env.CI_JOB_JWT_V2 = undefined;
      process.env.CI_JOB_JWT = undefined;

      const token = getOIDCTokenFromEnvironment("gitlab");
      expect(token).toBeUndefined();

      if (originalV2) process.env.CI_JOB_JWT_V2 = originalV2;
      if (originalV1) process.env.CI_JOB_JWT = originalV1;
    });

    it("should return undefined for custom provider", () => {
      const token = getOIDCTokenFromEnvironment("custom");
      expect(token).toBeUndefined();
    });
  });

  describe("extractCertificateFromBundle", () => {
    it("should return undefined for bundle without certificate", () => {
      const bundle = createTestBundle();

      const cert = extractCertificateFromBundle(bundle);
      expect(cert).toBeUndefined();
    });

    it("should extract certificate from bundle with rawBytes", () => {
      const rawBytes = Buffer.from("test-certificate-data").toString("base64");

      const bundle = createTestBundle({
        verificationMaterial: {
          certificate: { rawBytes },
          tlogEntries: [],
          timestampVerificationData: undefined,
        },
      });

      const cert = extractCertificateFromBundle(bundle);

      expect(cert).toBeDefined();
      expect(cert?.certificateChain).toHaveLength(1);
      expect(cert?.certificateChain[0]).toContain("-----BEGIN CERTIFICATE-----");
      expect(cert?.certificateChain[0]).toContain("-----END CERTIFICATE-----");
      expect(cert?.issuer).toBe("sigstore");
    });
  });

  describe("extractIdentityFromBundle", () => {
    it("should return undefined for bundle without certificate", () => {
      const bundle = createTestBundle();

      const identity = extractIdentityFromBundle(bundle);
      expect(identity).toBeUndefined();
    });

    it("should return identity from bundle with certificate", () => {
      const rawBytes = Buffer.from("test-certificate-data").toString("base64");

      const bundle = createTestBundle({
        verificationMaterial: {
          certificate: { rawBytes },
          tlogEntries: [],
          timestampVerificationData: undefined,
        },
      });

      const identity = extractIdentityFromBundle(bundle);

      // The simplified implementation returns a default identity
      expect(identity).toBeDefined();
      expect(identity?.provider).toBe("custom");
    });
  });
});
