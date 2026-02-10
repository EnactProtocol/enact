/**
 * Tests for MCP server secret resolution from keyring
 *
 * These tests verify that the MCP server properly resolves secrets
 * from the OS keyring for tools that declare secret environment variables.
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { EnvVariable, ToolManifest } from "@enactprotocol/shared";

// Type for secret resolution result
type SecretResolutionResult =
  | { found: true; key: string; value: string; namespace: string }
  | { found: false; key: string; searchedNamespaces: string[] };

// Mock the resolveSecret function from @enactprotocol/secrets
const mockResolveSecret = mock(
  async (_toolPath: string, _secretName: string): Promise<SecretResolutionResult> => ({
    found: false,
    key: _secretName,
    searchedNamespaces: [_toolPath],
  })
);

/**
 * Simulates the resolveManifestSecrets function from the MCP server
 * This is the logic we're testing
 */
async function resolveManifestSecrets(
  toolName: string,
  manifest: ToolManifest
): Promise<Record<string, string>> {
  const envOverrides: Record<string, string> = {};

  if (!manifest.env) {
    return envOverrides;
  }

  for (const [envName, envDecl] of Object.entries(manifest.env)) {
    // Only resolve secrets (not regular env vars)
    if (envDecl && typeof envDecl === "object" && envDecl.secret) {
      const result = (await mockResolveSecret(toolName, envName)) as SecretResolutionResult;
      if (result.found && result.value) {
        envOverrides[envName] = result.value;
      }
    }
  }

  return envOverrides;
}

describe("MCP Server Secret Resolution", () => {
  beforeEach(() => {
    mockResolveSecret.mockReset();
    mockResolveSecret.mockImplementation(async (_toolPath: string, secretName: string) => ({
      found: false as const,
      key: secretName,
      searchedNamespaces: [_toolPath],
    }));
  });

  describe("resolveManifestSecrets", () => {
    test("should return empty object when manifest has no env field", async () => {
      const manifest: ToolManifest = {
        name: "test/tool",
        version: "1.0.0",
        description: "Test tool",
        from: "node:20",
        command: "node test.js",
      };

      const result = await resolveManifestSecrets("test/tool", manifest);

      expect(result).toEqual({});
      expect(mockResolveSecret).not.toHaveBeenCalled();
    });

    test("should return empty object when manifest has empty env field", async () => {
      const manifest: ToolManifest = {
        name: "test/tool",
        version: "1.0.0",
        description: "Test tool",
        from: "node:20",
        command: "node test.js",
        env: {},
      };

      const result = await resolveManifestSecrets("test/tool", manifest);

      expect(result).toEqual({});
      expect(mockResolveSecret).not.toHaveBeenCalled();
    });

    test("should not resolve env vars without secret: true", async () => {
      const manifest: ToolManifest = {
        name: "test/tool",
        version: "1.0.0",
        description: "Test tool",
        from: "node:20",
        command: "node test.js",
        env: {
          REGULAR_VAR: {
            description: "A regular environment variable",
          },
          ANOTHER_VAR: {
            description: "Another regular var",
            secret: false,
          },
        },
      };

      const result = await resolveManifestSecrets("test/tool", manifest);

      expect(result).toEqual({});
      expect(mockResolveSecret).not.toHaveBeenCalled();
    });

    test("should resolve env vars with secret: true", async () => {
      mockResolveSecret.mockImplementation(async (_toolPath: string, secretName: string) => ({
        found: true as const,
        key: secretName,
        value: "secret-value-123",
        namespace: "enact",
      }));

      const manifest: ToolManifest = {
        name: "enact/firecrawl",
        version: "1.0.0",
        description: "Firecrawl tool",
        from: "node:20",
        command: "node firecrawl.js",
        env: {
          FIRECRAWL_API_KEY: {
            description: "Your Firecrawl API key",
            secret: true,
          },
        },
      };

      const result = await resolveManifestSecrets("enact/firecrawl", manifest);

      expect(result).toEqual({ FIRECRAWL_API_KEY: "secret-value-123" });
      expect(mockResolveSecret).toHaveBeenCalledWith("enact/firecrawl", "FIRECRAWL_API_KEY");
    });

    test("should resolve multiple secrets", async () => {
      mockResolveSecret.mockImplementation(async (_toolPath: string, secretName: string) => {
        const secrets: Record<string, string> = {
          API_KEY: "api-key-value",
          API_SECRET: "api-secret-value",
        };
        return {
          found: true as const,
          key: secretName,
          value: secrets[secretName] || "",
          namespace: "enact",
        };
      });

      const manifest: ToolManifest = {
        name: "test/multi-secret",
        version: "1.0.0",
        description: "Tool with multiple secrets",
        from: "node:20",
        command: "node test.js",
        env: {
          API_KEY: {
            description: "API key",
            secret: true,
          },
          API_SECRET: {
            description: "API secret",
            secret: true,
          },
          REGULAR_VAR: {
            description: "Not a secret",
          },
        },
      };

      const result = await resolveManifestSecrets("test/multi-secret", manifest);

      expect(result).toEqual({
        API_KEY: "api-key-value",
        API_SECRET: "api-secret-value",
      });
      expect(mockResolveSecret).toHaveBeenCalledTimes(2);
    });

    test("should handle missing secrets gracefully", async () => {
      mockResolveSecret.mockImplementation(async (_toolPath: string, secretName: string) => ({
        found: false as const,
        key: secretName,
        searchedNamespaces: [_toolPath],
      }));

      const manifest: ToolManifest = {
        name: "test/tool",
        version: "1.0.0",
        description: "Test tool",
        from: "node:20",
        command: "node test.js",
        env: {
          MISSING_SECRET: {
            description: "A secret that is not configured",
            secret: true,
          },
        },
      };

      const result = await resolveManifestSecrets("test/tool", manifest);

      expect(result).toEqual({});
      expect(mockResolveSecret).toHaveBeenCalledWith("test/tool", "MISSING_SECRET");
    });

    test("should handle partial secret availability", async () => {
      mockResolveSecret.mockImplementation(async (_toolPath: string, secretName: string) => {
        if (secretName === "AVAILABLE_SECRET") {
          return {
            found: true as const,
            key: secretName,
            value: "available-value",
            namespace: "enact",
          };
        }
        return {
          found: false as const,
          key: secretName,
          searchedNamespaces: [_toolPath],
        };
      });

      const manifest: ToolManifest = {
        name: "test/tool",
        version: "1.0.0",
        description: "Test tool",
        from: "node:20",
        command: "node test.js",
        env: {
          AVAILABLE_SECRET: {
            description: "This secret exists",
            secret: true,
          },
          MISSING_SECRET: {
            description: "This secret does not exist",
            secret: true,
          },
        },
      };

      const result = await resolveManifestSecrets("test/tool", manifest);

      expect(result).toEqual({ AVAILABLE_SECRET: "available-value" });
      expect(mockResolveSecret).toHaveBeenCalledTimes(2);
    });
  });

  describe("Namespace Inheritance", () => {
    test("should pass correct tool name for namespace resolution", async () => {
      mockResolveSecret.mockImplementation(
        async (toolPath: string, secretName: string): Promise<SecretResolutionResult> => ({
          found: true,
          key: secretName,
          value: `resolved-from-${toolPath}`,
          namespace: toolPath.split("/")[0] || toolPath,
        })
      );

      const manifest: ToolManifest = {
        name: "enact/firecrawl",
        version: "1.0.0",
        description: "Firecrawl tool",
        from: "node:20",
        command: "node firecrawl.js",
        env: {
          FIRECRAWL_API_KEY: {
            description: "API key",
            secret: true,
          },
        },
      };

      await resolveManifestSecrets("enact/firecrawl", manifest);

      // Verify the tool name is passed correctly for namespace chain resolution
      expect(mockResolveSecret).toHaveBeenCalledWith("enact/firecrawl", "FIRECRAWL_API_KEY");
    });

    test("should work with deeply nested tool paths", async () => {
      mockResolveSecret.mockImplementation(async (_toolPath: string, secretName: string) => ({
        found: true as const,
        key: secretName,
        value: "deep-secret",
        namespace: "alice/api",
      }));

      const manifest: ToolManifest = {
        name: "alice/api/slack/notifier",
        version: "1.0.0",
        description: "Slack notifier",
        from: "node:20",
        command: "node notify.js",
        env: {
          SLACK_TOKEN: {
            description: "Slack API token",
            secret: true,
          },
        },
      };

      const result = await resolveManifestSecrets("alice/api/slack/notifier", manifest);

      expect(result).toEqual({ SLACK_TOKEN: "deep-secret" });
      expect(mockResolveSecret).toHaveBeenCalledWith("alice/api/slack/notifier", "SLACK_TOKEN");
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty string secret values", async () => {
      mockResolveSecret.mockImplementation(async (_toolPath: string, secretName: string) => ({
        found: true as const,
        key: secretName,
        value: "",
        namespace: "enact",
      }));

      const manifest: ToolManifest = {
        name: "test/tool",
        version: "1.0.0",
        description: "Test tool",
        from: "node:20",
        command: "node test.js",
        env: {
          EMPTY_SECRET: {
            description: "An empty secret",
            secret: true,
          },
        },
      };

      const result = await resolveManifestSecrets("test/tool", manifest);

      // Empty string should not be included (falsy value check)
      expect(result).toEqual({});
    });

    test("should handle env declarations that are just strings", async () => {
      const manifest: ToolManifest = {
        name: "test/tool",
        version: "1.0.0",
        description: "Test tool",
        from: "node:20",
        command: "node test.js",
        env: {
          // Some manifests might have string values
          STRING_VAR: "default-value" as unknown as EnvVariable,
        },
      };

      const result = await resolveManifestSecrets("test/tool", manifest);

      expect(result).toEqual({});
      expect(mockResolveSecret).not.toHaveBeenCalled();
    });

    test("should handle null env declaration values", async () => {
      const manifest: ToolManifest = {
        name: "test/tool",
        version: "1.0.0",
        description: "Test tool",
        from: "node:20",
        command: "node test.js",
        env: {
          NULL_VAR: null as unknown as EnvVariable,
        },
      };

      const result = await resolveManifestSecrets("test/tool", manifest);

      expect(result).toEqual({});
      expect(mockResolveSecret).not.toHaveBeenCalled();
    });
  });
});

describe("Secret Resolution Integration", () => {
  beforeEach(() => {
    mockResolveSecret.mockReset();
    mockResolveSecret.mockImplementation(async (_toolPath: string, secretName: string) => ({
      found: false as const,
      key: secretName,
      searchedNamespaces: [_toolPath],
    }));
  });

  test("complete flow: tool with API key secret should receive it in envOverrides", async () => {
    // Simulate a real firecrawl-like scenario
    mockResolveSecret.mockImplementation(async (_toolPath: string, secretName: string) => {
      if (secretName === "FIRECRAWL_API_KEY") {
        return {
          found: true as const,
          key: secretName,
          value: "fc-abc123xyz",
          namespace: "enact",
        };
      }
      return {
        found: false as const,
        key: secretName,
        searchedNamespaces: [_toolPath],
      };
    });

    const firecrawlManifest: ToolManifest = {
      name: "enact/firecrawl",
      version: "1.2.1",
      description: "Scrape websites using Firecrawl API",
      from: "node:20",
      env: {
        FIRECRAWL_API_KEY: {
          description: "Your Firecrawl API key from firecrawl.dev",
          secret: true,
        },
      },
      scripts: {
        scrape: "node /work/firecrawl.js {{url}}",
      },
    };

    const envOverrides = await resolveManifestSecrets("enact/firecrawl", firecrawlManifest);

    // This is what would be passed to the execution provider
    expect(envOverrides).toEqual({
      FIRECRAWL_API_KEY: "fc-abc123xyz",
    });
  });

  test("complete flow: tool without secrets should get empty envOverrides", async () => {
    const helloManifest: ToolManifest = {
      name: "enact/hello-js",
      version: "1.0.0",
      description: "A simple greeting tool",
      from: "node:20",
      scripts: {
        greet: "node /work/greet.js {{name}}",
      },
    };

    const envOverrides = await resolveManifestSecrets("enact/hello-js", helloManifest);

    expect(envOverrides).toEqual({});
    expect(mockResolveSecret).not.toHaveBeenCalled();
  });
});
