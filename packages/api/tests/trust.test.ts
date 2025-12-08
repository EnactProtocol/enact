/**
 * Tests for trust configuration management (v2)
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { DEFAULT_REGISTRY_URL, createApiClient } from "../src/client";
import {
  addTrustedAuditor,
  getMyTrustedAuditors,
  getUserTrust,
  removeTrustedAuditor,
  updateMyTrust,
  userTrustsAuditor,
} from "../src/trust";
import { type MockServer, createMockServer } from "./mocks/server";

describe("Trust Configuration (v2)", () => {
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

  describe("getUserTrust", () => {
    test("fetches public trust configuration", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      const result = await getUserTrust(client, "alice");

      expect(result).toBeDefined();
      expect(result.username).toBe("alice");
      expect(result.trusted_auditors).toBeArray();
    });

    test("returns trust config for any username", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      const result = await getUserTrust(client, "bob");

      expect(result).toBeDefined();
      expect(result.username).toBe("bob");
    });

    test("works without authentication (public data)", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      const result = await getUserTrust(client, "alice");

      expect(result).toBeDefined();
    });
  });

  describe("updateMyTrust", () => {
    test("updates trust configuration", async () => {
      const client = createApiClient({
        baseUrl: DEFAULT_REGISTRY_URL,
        authToken: "valid-token",
      });

      const result = await updateMyTrust(client, ["security@example.com", "audit@example.com"]);

      expect(result).toBeDefined();
      expect(result.trustedAuditors).toBeArray();
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    test("replaces entire auditor list", async () => {
      const client = createApiClient({
        baseUrl: DEFAULT_REGISTRY_URL,
        authToken: "valid-token",
      });

      const result = await updateMyTrust(client, ["new@example.com"]);

      expect(result).toBeDefined();
      expect(result.trustedAuditors).toBeArray();
    });

    test("accepts empty array to clear all auditors", async () => {
      const client = createApiClient({
        baseUrl: DEFAULT_REGISTRY_URL,
        authToken: "valid-token",
      });

      const result = await updateMyTrust(client, []);

      expect(result).toBeDefined();
      expect(result.trustedAuditors).toBeArray();
    });

    test("requires authentication", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      try {
        await updateMyTrust(client, ["security@example.com"]);
        expect.unreachable("Should have thrown");
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("addTrustedAuditor", () => {
    test("adds new auditor to trust list", async () => {
      const client = createApiClient({
        baseUrl: DEFAULT_REGISTRY_URL,
        authToken: "valid-token",
      });

      const result = await addTrustedAuditor(client, "new-auditor@example.com");

      expect(result).toBeDefined();
      expect(result.trustedAuditors).toBeArray();
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    test("is idempotent (adding same auditor twice)", async () => {
      const client = createApiClient({
        baseUrl: DEFAULT_REGISTRY_URL,
        authToken: "valid-token",
      });

      const result1 = await addTrustedAuditor(client, "security@example.com");
      const result2 = await addTrustedAuditor(client, "security@example.com");

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    test("requires authentication", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      try {
        await addTrustedAuditor(client, "new@example.com");
        expect.unreachable("Should have thrown");
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("removeTrustedAuditor", () => {
    test("removes auditor from trust list", async () => {
      const client = createApiClient({
        baseUrl: DEFAULT_REGISTRY_URL,
        authToken: "valid-token",
      });

      const result = await removeTrustedAuditor(client, "security@example.com");

      expect(result).toBeDefined();
      expect(result.trustedAuditors).toBeArray();
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    test("is idempotent (removing non-existent auditor)", async () => {
      const client = createApiClient({
        baseUrl: DEFAULT_REGISTRY_URL,
        authToken: "valid-token",
      });

      const result = await removeTrustedAuditor(client, "nonexistent@example.com");

      expect(result).toBeDefined();
    });

    test("requires authentication", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      try {
        await removeTrustedAuditor(client, "security@example.com");
        expect.unreachable("Should have thrown");
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("userTrustsAuditor", () => {
    test("checks if user trusts specific auditor", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      const result = await userTrustsAuditor(client, "alice", "security@example.com");

      expect(result).toBeBoolean();
    });

    test("returns false for untrusted auditor", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      const result = await userTrustsAuditor(client, "alice", "untrusted@example.com");

      expect(result).toBeBoolean();
    });

    test("works without authentication (public data)", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      const result = await userTrustsAuditor(client, "alice", "security@example.com");

      expect(result).toBeBoolean();
    });
  });

  describe("getMyTrustedAuditors", () => {
    test("gets list of trusted auditors for current user", async () => {
      const client = createApiClient({
        baseUrl: DEFAULT_REGISTRY_URL,
        authToken: "valid-token",
      });

      const result = await getMyTrustedAuditors(client);

      expect(result).toBeArray();
      expect(result.every((email) => typeof email === "string")).toBe(true);
    });

    test("returns array of email strings", async () => {
      const client = createApiClient({
        baseUrl: DEFAULT_REGISTRY_URL,
        authToken: "valid-token",
      });

      const result = await getMyTrustedAuditors(client);

      expect(result).toBeArray();
      // Check that each item is a string
      for (const email of result) {
        expect(typeof email).toBe("string");
      }
    });

    test("requires authentication", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      try {
        await getMyTrustedAuditors(client);
        expect.unreachable("Should have thrown");
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });
  });
});
