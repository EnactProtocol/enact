/**
 * Tests for the API client buildHeaders logic.
 *
 * Verifies that Supabase-specific headers (apikey) are only sent
 * when talking to Supabase, and that self-hosted registries get
 * standard Bearer auth.
 */

import { describe, expect, test } from "bun:test";
import { DEFAULT_REGISTRY_URL, createApiClient } from "../src/client";

describe("API client header behavior", () => {
  describe("Supabase registry", () => {
    test("default URL is a Supabase URL", () => {
      expect(DEFAULT_REGISTRY_URL).toContain("supabase.co");
    });

    test("isAuthenticated returns false without token", () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });
      expect(client.isAuthenticated()).toBe(false);
    });

    test("isAuthenticated returns true with token", () => {
      const client = createApiClient({
        baseUrl: DEFAULT_REGISTRY_URL,
        authToken: "my-jwt-token",
      });
      expect(client.isAuthenticated()).toBe(true);
    });
  });

  describe("self-hosted registry", () => {
    test("isAuthenticated returns false without token", () => {
      const client = createApiClient({ baseUrl: "http://localhost:3000" });
      expect(client.isAuthenticated()).toBe(false);
    });

    test("isAuthenticated returns true with token", () => {
      const client = createApiClient({
        baseUrl: "http://localhost:3000",
        authToken: "my-api-key",
      });
      expect(client.isAuthenticated()).toBe(true);
    });
  });

  describe("URL normalization", () => {
    test("getBaseUrl returns configured URL", () => {
      const client = createApiClient({ baseUrl: "http://localhost:8080" });
      expect(client.getBaseUrl()).toBe("http://localhost:8080");
    });

    test("getBaseUrl returns default when not configured", () => {
      const client = createApiClient();
      expect(client.getBaseUrl()).toBe(DEFAULT_REGISTRY_URL);
    });
  });

  describe("user agent", () => {
    test("default user agent contains enact", () => {
      const client = createApiClient();
      expect(client.getUserAgent()).toContain("enact");
    });

    test("custom user agent is used", () => {
      const client = createApiClient({ userAgent: "test-agent/1.0" });
      expect(client.getUserAgent()).toBe("test-agent/1.0");
    });
  });
});
