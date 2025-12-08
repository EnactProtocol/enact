/**
 * Tests for authentication functionality
 */

import { beforeEach, describe, expect, test } from "bun:test";
import {
  authenticate,
  exchangeCodeForToken,
  getAuthStatus,
  getCurrentUser,
  getUserProfile,
  initiateLogin,
  logout,
  refreshAccessToken,
  submitFeedback,
} from "../src/auth";
import { createApiClient } from "../src/client";
import { type MockServer, createMockServer } from "./mocks/server";

describe("auth module", () => {
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

  describe("authenticate", () => {
    test("throws error directing to CLI implementation", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });

      await expect(authenticate(client)).rejects.toThrow("must be implemented in the CLI package");
    });
  });

  describe("logout", () => {
    test("clears auth token", () => {
      const client = createApiClient({ authToken: "test-token-123" });
      expect(client.isAuthenticated()).toBe(true);

      logout(client);

      expect(client.isAuthenticated()).toBe(false);
    });
  });

  describe("getAuthStatus", () => {
    test("returns not authenticated when no token", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });

      const status = await getAuthStatus(client);

      expect(status.authenticated).toBe(false);
      expect(status.user).toBeUndefined();
    });

    test("returns authenticated with user info when token valid", async () => {
      const client = createApiClient({ authToken: "valid-token" });

      const status = await getAuthStatus(client);

      expect(status.authenticated).toBe(true);
      expect(status.user).toBeDefined();
      expect(status.user?.username).toBe("alice");
      expect(status.user?.email).toBe("alice@example.com");
      expect(status.user?.namespaces).toBeArray();
    });
  });

  describe("getUserProfile", () => {
    test("gets user profile by username", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });

      const profile = await getUserProfile(client, "alice");

      expect(profile.username).toBe("alice");
      expect(profile.displayName).toBeDefined();
      expect(profile.avatarUrl).toContain("alice");
      expect(profile.createdAt).toBeInstanceOf(Date);
      expect(profile.toolsCount).toBeNumber();
    });

    test("works for any username", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });

      const profile = await getUserProfile(client, "bob");

      expect(profile.username).toBe("bob");
      expect(profile.displayName).toBe("Bob");
    });
  });

  describe("submitFeedback", () => {
    test("submits feedback when authenticated", async () => {
      const client = createApiClient({ authToken: "valid-token" });

      // Should not throw
      await submitFeedback(client, "alice/utils/greeter", 5, "1.2.0", "Great tool!");
    });

    test("works without comment", async () => {
      const client = createApiClient({ authToken: "valid-token" });

      // Should not throw
      await submitFeedback(client, "alice/utils/greeter", 4, "1.2.0");
    });

    test("requires authentication", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });

      await expect(submitFeedback(client, "alice/utils/greeter", 5, "1.2.0")).rejects.toThrow();
    });
  });

  describe("OAuth v2 flow", () => {
    describe("initiateLogin", () => {
      test("starts OAuth flow with GitHub", async () => {
        const client = createApiClient({ baseUrl: "http://localhost" });

        const result = await initiateLogin(client, "github", "http://localhost:3000/callback");

        expect(result).toBeDefined();
        expect(result.auth_url).toBeTruthy();
      });

      test("starts OAuth flow with Google", async () => {
        const client = createApiClient({ baseUrl: "http://localhost" });

        const result = await initiateLogin(client, "google", "http://localhost:3000/callback");

        expect(result).toBeDefined();
        expect(result.auth_url).toBeTruthy();
      });

      test("starts OAuth flow with Microsoft", async () => {
        const client = createApiClient({ baseUrl: "http://localhost" });

        const result = await initiateLogin(client, "microsoft", "http://localhost:3000/callback");

        expect(result).toBeDefined();
        expect(result.auth_url).toBeTruthy();
      });
    });

    describe("exchangeCodeForToken", () => {
      test("exchanges authorization code for tokens", async () => {
        const client = createApiClient({ baseUrl: "http://localhost" });

        const result = await exchangeCodeForToken(client, "github", "auth-code-123");

        expect(result).toBeDefined();
        expect(result.access_token).toBeTruthy();
        expect(result.refresh_token).toBeTruthy();
        expect(result.expires_in).toBeNumber();
        expect(result.user).toBeDefined();
        expect(result.user.username).toBeTruthy();
        expect(result.user.email).toBeTruthy();
      });

      test("works with all OAuth providers", async () => {
        const client = createApiClient({ baseUrl: "http://localhost" });

        for (const provider of ["github", "google", "microsoft"] as const) {
          const result = await exchangeCodeForToken(client, provider, "code-123");
          expect(result.access_token).toBeTruthy();
        }
      });
    });

    describe("refreshAccessToken", () => {
      test("refreshes access token using refresh token", async () => {
        const client = createApiClient({ baseUrl: "http://localhost" });

        const result = await refreshAccessToken(client, "refresh-token-abc");

        expect(result).toBeDefined();
        expect(result.access_token).toBeTruthy();
        expect(result.expires_in).toBeNumber();
      });

      test("returns new access token", async () => {
        const client = createApiClient({ baseUrl: "http://localhost" });

        const result = await refreshAccessToken(client, "old-refresh-token");

        expect(result.access_token).toBeTruthy();
        expect(result.access_token).not.toBe("old-refresh-token");
      });
    });

    describe("getCurrentUser", () => {
      test("fetches current authenticated user", async () => {
        const client = createApiClient({ authToken: "valid-token" });

        const user = await getCurrentUser(client);

        expect(user).toBeDefined();
        expect(user.username).toBeTruthy();
        expect(user.email).toBeTruthy();
        expect(user.namespaces).toBeArray();
      });

      test("requires authentication", async () => {
        const client = createApiClient({ baseUrl: "http://localhost" });

        await expect(getCurrentUser(client)).rejects.toThrow();
      });
    });
  });
});
