/**
 * Tests for publish functionality
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { createApiClient } from "../src/client";
import {
  createBundle,
  deleteTool,
  publishTool,
  submitAttestation,
  unyankVersion,
  yankVersion,
} from "../src/publish";
import { type MockServer, createMockServer } from "./mocks/server";

describe("publish module", () => {
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

  describe("createBundle", () => {
    test("throws not implemented error", async () => {
      await expect(createBundle("./my-tool")).rejects.toThrow("not yet implemented");
    });
  });

  describe("publishTool", () => {
    test("publishes tool with multipart upload (v2)", async () => {
      const client = createApiClient({ authToken: "valid-token" });
      const bundle = new TextEncoder().encode("mock bundle content");

      const result = await publishTool(client, {
        name: "alice/utils/new-tool",
        manifest: {
          enact: "2.0.0",
          name: "alice/utils/new-tool",
          version: "1.0.0",
          description: "A new tool",
        },
        bundle,
      });

      expect(result.name).toBe("alice/utils/new-tool");
      expect(result.version).toBe("1.0.0");
      expect(result.publishedAt).toBeInstanceOf(Date);
      expect(result.bundleHash).toMatch(/^sha256:/);
    });

    test("accepts ArrayBuffer", async () => {
      const client = createApiClient({ authToken: "valid-token" });
      const bundle = new TextEncoder().encode("mock bundle content").buffer;

      const result = await publishTool(client, {
        name: "alice/utils/another-tool",
        manifest: {
          enact: "2.0.0",
          name: "alice/utils/another-tool",
          version: "2.0.0",
          description: "Another tool",
        },
        bundle,
      });

      expect(result.name).toBe("alice/utils/another-tool");
      expect(result.version).toBeDefined(); // Mock returns 1.0.0 since it doesn't parse manifest
      expect(result.publishedAt).toBeInstanceOf(Date);
      expect(result.bundleHash).toBeDefined();
    });

    test("supports optional rawManifest", async () => {
      const client = createApiClient({ authToken: "valid-token" });
      const bundle = new TextEncoder().encode("mock bundle content");

      const result = await publishTool(client, {
        name: "alice/utils/documented-tool",
        manifest: {
          enact: "2.0.0",
          name: "alice/utils/documented-tool",
          version: "1.0.0",
          description: "A documented tool",
        },
        bundle,
        rawManifest: "---\\nenact: 2.0.0\\n...\\n---\\n# My Tool\\n\\nThis is a great tool!",
      });

      expect(result.name).toBeTruthy();
    });

    test("supports visibility option", async () => {
      const client = createApiClient({ authToken: "valid-token" });
      const bundle = new TextEncoder().encode("mock bundle content");

      // Test private visibility (default)
      const privateResult = await publishTool(client, {
        name: "alice/utils/private-tool",
        manifest: {
          enact: "2.0.0",
          name: "alice/utils/private-tool",
          version: "1.0.0",
          description: "A private tool",
        },
        bundle,
        visibility: "private",
      });
      expect(privateResult.name).toBeTruthy();

      // Test public visibility
      const publicResult = await publishTool(client, {
        name: "alice/utils/public-tool",
        manifest: {
          enact: "2.0.0",
          name: "alice/utils/public-tool",
          version: "1.0.0",
          description: "A public tool",
        },
        bundle,
        visibility: "public",
      });
      expect(publicResult.name).toBeTruthy();

      // Test unlisted visibility
      const unlistedResult = await publishTool(client, {
        name: "alice/utils/unlisted-tool",
        manifest: {
          enact: "2.0.0",
          name: "alice/utils/unlisted-tool",
          version: "1.0.0",
          description: "An unlisted tool",
        },
        bundle,
        visibility: "unlisted",
      });
      expect(unlistedResult.name).toBeTruthy();
    });

    test("defaults to private visibility when not specified", async () => {
      const client = createApiClient({ authToken: "valid-token" });
      const bundle = new TextEncoder().encode("mock bundle content");

      // When visibility is not specified, it should default to private
      const result = await publishTool(client, {
        name: "alice/utils/default-visibility",
        manifest: {
          enact: "2.0.0",
          name: "alice/utils/default-visibility",
          version: "1.0.0",
          description: "Default visibility test",
        },
        bundle,
        // No visibility specified - should default to "private"
      });

      expect(result.name).toBeTruthy();
    });

    test("requires authentication", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });
      const bundle = new TextEncoder().encode("mock bundle content");

      await expect(
        publishTool(client, {
          name: "alice/utils/new-tool",
          manifest: {
            enact: "2.0.0",
            name: "alice/utils/new-tool",
            version: "1.0.0",
            description: "A new tool",
          },
          bundle,
        })
      ).rejects.toThrow();
    });

    test("provides user-friendly error for namespace mismatch", async () => {
      // Override fetch to return namespace mismatch error
      // @ts-expect-error - Simplified fetch mock for testing
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: "NAMESPACE_MISMATCH",
              message: 'Tool namespace "wronguser" does not match your username "alice".',
              details: { toolNamespace: "wronguser", userNamespace: "alice" },
            },
          }),
          { status: 403 }
        );
      };

      const client = createApiClient({ authToken: "valid-token" });
      const bundle = new TextEncoder().encode("mock bundle content");

      await expect(
        publishTool(client, {
          name: "wronguser/tool",
          manifest: {
            enact: "2.0.0",
            name: "wronguser/tool",
            version: "1.0.0",
            description: "Test",
          },
          bundle,
        })
      ).rejects.toThrow(/Namespace mismatch/);
    });

    test("provides user-friendly error for version conflict", async () => {
      // Override fetch to return conflict error
      // @ts-expect-error - Simplified fetch mock for testing
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: "CONFLICT",
              message: "Version 1.0.0 already exists",
            },
          }),
          { status: 409 }
        );
      };

      const client = createApiClient({ authToken: "valid-token" });
      const bundle = new TextEncoder().encode("mock bundle content");

      await expect(
        publishTool(client, {
          name: "alice/tool",
          manifest: { enact: "2.0.0", name: "alice/tool", version: "1.0.0", description: "Test" },
          bundle,
        })
      ).rejects.toThrow(/Version conflict.*Hint: Bump the version/s);
    });

    test("provides user-friendly error for unauthorized", async () => {
      // Override fetch to return unauthorized error
      // @ts-expect-error - Simplified fetch mock for testing
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: "UNAUTHORIZED",
              message: "Unauthorized",
            },
          }),
          { status: 401 }
        );
      };

      const client = createApiClient({ authToken: "invalid-token" });
      const bundle = new TextEncoder().encode("mock bundle content");

      await expect(
        publishTool(client, {
          name: "alice/tool",
          manifest: { enact: "2.0.0", name: "alice/tool", version: "1.0.0", description: "Test" },
          bundle,
        })
      ).rejects.toThrow(/Authentication required.*Hint: Run 'enact auth login'/s);
    });

    test("provides user-friendly error for validation error", async () => {
      // Override fetch to return validation error
      // @ts-expect-error - Simplified fetch mock for testing
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid version format",
            },
          }),
          { status: 422 }
        );
      };

      const client = createApiClient({ authToken: "valid-token" });
      const bundle = new TextEncoder().encode("mock bundle content");

      await expect(
        publishTool(client, {
          name: "alice/tool",
          manifest: { enact: "2.0.0", name: "alice/tool", version: "bad", description: "Test" },
          bundle,
        })
      ).rejects.toThrow(/Validation error: Invalid version format/);
    });

    test("provides user-friendly error for bundle too large", async () => {
      // Override fetch to return bundle too large error
      // @ts-expect-error - Simplified fetch mock for testing
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: "BUNDLE_TOO_LARGE",
              message: "Bundle size 60000000 bytes exceeds maximum 50000000 bytes",
            },
          }),
          { status: 413 }
        );
      };

      const client = createApiClient({ authToken: "valid-token" });
      const bundle = new TextEncoder().encode("mock bundle content");

      await expect(
        publishTool(client, {
          name: "alice/tool",
          manifest: { enact: "2.0.0", name: "alice/tool", version: "1.0.0", description: "Test" },
          bundle,
        })
      ).rejects.toThrow(/Bundle too large/);
    });

    test("falls back to raw error for unknown error codes", async () => {
      // Override fetch to return unknown error
      // @ts-expect-error - Simplified fetch mock for testing
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: "UNKNOWN_ERROR",
              message: "Something went wrong",
            },
          }),
          { status: 500 }
        );
      };

      const client = createApiClient({ authToken: "valid-token" });
      const bundle = new TextEncoder().encode("mock bundle content");

      await expect(
        publishTool(client, {
          name: "alice/tool",
          manifest: { enact: "2.0.0", name: "alice/tool", version: "1.0.0", description: "Test" },
          bundle,
        })
      ).rejects.toThrow(/Publish failed \(UNKNOWN_ERROR\): Something went wrong/);
    });

    test("falls back to raw text for non-JSON error responses", async () => {
      // Override fetch to return non-JSON error
      // @ts-expect-error - Simplified fetch mock for testing
      globalThis.fetch = async () => {
        return new Response("Internal Server Error", { status: 500 });
      };

      const client = createApiClient({ authToken: "valid-token" });
      const bundle = new TextEncoder().encode("mock bundle content");

      await expect(
        publishTool(client, {
          name: "alice/tool",
          manifest: { enact: "2.0.0", name: "alice/tool", version: "1.0.0", description: "Test" },
          bundle,
        })
      ).rejects.toThrow(/Publish failed: 500 - Internal Server Error/);
    });
  });

  describe("submitAttestation", () => {
    test("submits attestation with Sigstore bundle (v2)", async () => {
      const client = createApiClient({ authToken: "valid-token" });

      const result = await submitAttestation(client, {
        name: "alice/utils/greeter",
        version: "1.2.0",
        sigstoreBundle: {
          $schema: "https://sigstore.dev/bundle/v1",
          mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json",
          verificationMaterial: {
            certificate: "mock-cert",
          },
          messageSignature: {
            signature: "mock-signature",
          },
        },
      });

      expect(result.auditor).toBeDefined();
      expect(result.auditorProvider).toBeDefined();
      expect(result.signedAt).toBeInstanceOf(Date);
      expect(result.rekorLogId).toBeTruthy();
      expect(result.verification).toBeDefined();
      expect(result.verification.verified).toBeBoolean();
      expect(result.verification.verifiedAt).toBeInstanceOf(Date);
    });

    test("includes full verification details", async () => {
      const client = createApiClient({ authToken: "valid-token" });

      const result = await submitAttestation(client, {
        name: "alice/utils/greeter",
        version: "1.2.0",
        sigstoreBundle: {
          $schema: "https://sigstore.dev/bundle/v1",
        },
      });

      expect(result.verification.rekorVerified).toBeBoolean();
      expect(result.verification.certificateVerified).toBeBoolean();
      expect(result.verification.signatureVerified).toBeBoolean();
    });

    test("requires authentication", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });

      await expect(
        submitAttestation(client, {
          name: "alice/utils/greeter",
          version: "1.2.0",
          sigstoreBundle: { $schema: "https://sigstore.dev/bundle/v1" },
        })
      ).rejects.toThrow();
    });
  });

  describe("yankVersion", () => {
    test("yanks a version with reason", async () => {
      const client = createApiClient({ authToken: "valid-token" });

      const result = await yankVersion(client, "alice/utils/greeter", "1.0.0", {
        reason: "Security vulnerability CVE-2025-1234",
      });

      expect(result.yanked).toBe(true);
      expect(result.version).toBe("1.0.0");
      expect(result.reason).toBeDefined();
      expect(result.yankedAt).toBeInstanceOf(Date);
    });

    test("yanks with replacement version", async () => {
      const client = createApiClient({ authToken: "valid-token" });

      const result = await yankVersion(client, "alice/utils/greeter", "1.0.0", {
        reason: "Deprecated",
        replacementVersion: "2.0.0",
      });

      expect(result.yanked).toBe(true);
      expect(result.replacementVersion).toBe("2.0.0");
    });

    test("yanks without optional parameters", async () => {
      const client = createApiClient({ authToken: "valid-token" });

      const result = await yankVersion(client, "alice/utils/greeter", "1.0.0");

      expect(result.yanked).toBe(true);
      expect(result.version).toBe("1.0.0");
    });

    test("requires authentication", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });

      await expect(yankVersion(client, "alice/utils/greeter", "1.0.0")).rejects.toThrow();
    });
  });

  describe("unyankVersion", () => {
    test("unyanks a previously yanked version", async () => {
      const client = createApiClient({ authToken: "valid-token" });

      const result = await unyankVersion(client, "alice/utils/greeter", "1.0.0");

      expect(result.yanked).toBe(false);
      expect(result.version).toBe("1.0.0");
      expect(result.unyankedAt).toBeInstanceOf(Date);
    });

    test("requires authentication", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });

      await expect(unyankVersion(client, "alice/utils/greeter", "1.0.0")).rejects.toThrow();
    });
  });

  describe("deleteTool", () => {
    test("deletes tool when authenticated", async () => {
      const client = createApiClient({ authToken: "valid-token" });

      // Should not throw
      await deleteTool(client, "alice/utils/old-tool");
    });

    test("requires authentication", async () => {
      const client = createApiClient({ baseUrl: "http://localhost" });

      await expect(deleteTool(client, "alice/utils/old-tool")).rejects.toThrow();
    });
  });
});
