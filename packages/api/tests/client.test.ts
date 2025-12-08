/**
 * Tests for EnactApiClient
 */

import { beforeEach, describe, expect, test } from "bun:test";
import {
  ApiRequestError,
  DEFAULT_REGISTRY_URL,
  EnactApiClient,
  createApiClient,
} from "../src/client";
import { type MockServer, createMockServer } from "./mocks/server";

describe("EnactApiClient", () => {
  let mockServer: MockServer;

  beforeEach(() => {
    mockServer = createMockServer();
    // Intercept fetch calls and route to mock server
    // @ts-expect-error - We're replacing fetch with a simpler version for testing
    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const request = new Request(url, init);
      return mockServer.fetch(request);
    };
  });

  // Restore original fetch after tests
  // Note: afterEach not strictly needed since we reset in beforeEach

  describe("constructor", () => {
    test("uses default registry URL", () => {
      const client = new EnactApiClient();
      expect(client.getAuthToken()).toBeUndefined();
    });

    test("accepts custom options", () => {
      const client = new EnactApiClient({
        baseUrl: "https://custom.registry.com/api",
        authToken: "test-token",
        timeout: 60000,
        retries: 5,
        userAgent: "test-agent/1.0",
      });
      expect(client.getAuthToken()).toBe("test-token");
      expect(client.isAuthenticated()).toBe(true);
    });
  });

  describe("createApiClient", () => {
    test("creates client with default options", () => {
      const client = createApiClient();
      expect(client).toBeInstanceOf(EnactApiClient);
      expect(client.isAuthenticated()).toBe(false);
    });

    test("creates client with custom options", () => {
      const client = createApiClient({ authToken: "my-token" });
      expect(client.isAuthenticated()).toBe(true);
    });
  });

  describe("authentication", () => {
    test("setAuthToken updates token", () => {
      const client = new EnactApiClient();
      expect(client.isAuthenticated()).toBe(false);

      client.setAuthToken("new-token");
      expect(client.getAuthToken()).toBe("new-token");
      expect(client.isAuthenticated()).toBe(true);

      client.setAuthToken(undefined);
      expect(client.isAuthenticated()).toBe(false);
    });

    test("isAuthenticated returns correct state", () => {
      const client = new EnactApiClient();
      expect(client.isAuthenticated()).toBe(false);

      client.setAuthToken("token");
      expect(client.isAuthenticated()).toBe(true);

      client.setAuthToken(undefined);
      expect(client.isAuthenticated()).toBe(false);
    });
  });

  describe("GET requests", () => {
    test("makes successful GET request", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });
      const response = await client.get<{ tools: unknown[]; total: number }>(
        "/tools/search?q=test"
      );

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(response.data.tools).toBeArray();
    });

    test("includes rate limit info in response", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });
      const response = await client.get("/tools/search?q=test");

      expect(response.rateLimit).toBeDefined();
      expect(response.rateLimit?.limit).toBe(1000);
      expect(response.rateLimit?.remaining).toBeNumber();
      expect(response.rateLimit?.reset).toBeNumber();
    });

    test("handles 404 errors", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      try {
        await client.get("/tools/nonexistent/tool");
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiRequestError);
        const apiError = error as ApiRequestError;
        expect(apiError.status).toBe(404);
        expect(apiError.code).toBe("not_found");
      }
    });

    test("handles 401 unauthorized", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      try {
        await client.get("/users/me");
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiRequestError);
        const apiError = error as ApiRequestError;
        expect(apiError.status).toBe(401);
        expect(apiError.code).toBe("unauthorized");
      }
    });

    test("succeeds with auth token", async () => {
      const client = createApiClient({
        baseUrl: DEFAULT_REGISTRY_URL,
        authToken: "valid-token",
      });

      const response = await client.get("/users/me");
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
    });
  });

  describe("POST requests", () => {
    test("makes successful POST request with body", async () => {
      const client = createApiClient({
        baseUrl: DEFAULT_REGISTRY_URL,
        authToken: "valid-token",
      });

      const response = await client.post("/tools/alice/test", {
        manifest: { name: "alice/test", version: "1.0.0" },
      });

      expect(response.status).toBe(201);
      expect(response.data).toBeDefined();
    });

    test("fails POST without auth", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      try {
        await client.post("/tools/alice/test", {});
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiRequestError);
        const apiError = error as ApiRequestError;
        expect(apiError.status).toBe(401);
      }
    });
  });

  describe("PUT requests", () => {
    test("makes successful PUT request with body", async () => {
      const client = createApiClient({
        baseUrl: DEFAULT_REGISTRY_URL,
        authToken: "valid-token",
      });

      const response = await client.put("/users/me/trust", {
        trusted_auditors: ["security@example.com"],
      });

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
    });

    test("fails PUT without auth", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      try {
        await client.put("/users/me/trust", {});
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiRequestError);
        const apiError = error as ApiRequestError;
        expect(apiError.status).toBe(401);
      }
    });
  });

  describe("DELETE requests", () => {
    test("makes successful DELETE request", async () => {
      const client = createApiClient({
        baseUrl: DEFAULT_REGISTRY_URL,
        authToken: "valid-token",
      });

      const response = await client.delete("/tools/alice/test");
      expect(response.status).toBe(204);
    });

    test("fails DELETE without auth", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });

      try {
        await client.delete("/tools/alice/test");
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiRequestError);
        const apiError = error as ApiRequestError;
        expect(apiError.status).toBe(401);
      }
    });
  });

  describe("download", () => {
    test("downloads file successfully", async () => {
      const client = createApiClient({ baseUrl: DEFAULT_REGISTRY_URL });
      const response = await client.download("/tools/alice/utils/greeter/versions/1.2.0/bundle");

      expect(response.ok).toBe(true);
      expect(response.headers.get("Content-Type")).toBe("application/gzip");

      const data = await response.arrayBuffer();
      expect(data.byteLength).toBeGreaterThan(0);
    });
  });

  describe("rate limiting", () => {
    test("handles rate limit exhaustion", async () => {
      mockServer.setRateLimit(0);

      const client = createApiClient({
        baseUrl: DEFAULT_REGISTRY_URL,
        retries: 0, // Disable retries for this test
      });

      try {
        await client.get("/tools/search?q=test");
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiRequestError);
        const apiError = error as ApiRequestError;
        expect(apiError.status).toBe(429);
        expect(apiError.code).toBe("rate_limited");
      }
    });
  });

  describe("error handling", () => {
    test("ApiRequestError has correct properties", () => {
      const error = new ApiRequestError("Test error", 400, "bad_request", {
        error: { code: "bad_request", message: "Test error" },
      });

      expect(error.message).toBe("Test error");
      expect(error.status).toBe(400);
      expect(error.code).toBe("bad_request");
      expect(error.response).toBeDefined();
      expect(error.name).toBe("ApiRequestError");
    });

    test("handles network errors", async () => {
      // Override fetch to simulate network error
      // @ts-expect-error - Simplified fetch mock for testing
      globalThis.fetch = async () => {
        throw new Error("Network error");
      };

      const client = createApiClient({
        baseUrl: DEFAULT_REGISTRY_URL,
        retries: 0,
      });

      try {
        await client.get("/tools/search?q=test");
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiRequestError);
        const apiError = error as ApiRequestError;
        expect(apiError.code).toBe("network_error");
      }
    });
  });
});

describe("DEFAULT_REGISTRY_URL", () => {
  test("has correct value", () => {
    expect(DEFAULT_REGISTRY_URL).toBe("https://siikwkfgsmouioodghho.supabase.co/functions/v1");
  });
});
