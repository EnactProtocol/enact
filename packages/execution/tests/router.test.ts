/**
 * Tests for the execution router — config-driven backend selection.
 */

import { describe, expect, test } from "bun:test";
import type { EngineHealth, ExecutionProvider, ExecutionResult } from "@enactprotocol/shared";
import { ExecutionRouter } from "../src/router";

// ---------------------------------------------------------------------------
// Mock providers
// ---------------------------------------------------------------------------

function mockProvider(name: string, available = true): ExecutionProvider {
  return {
    name,
    initialize: async () => {
      /* no-op */
    },
    isAvailable: async () => available,
    getHealth: async (): Promise<EngineHealth> => ({
      healthy: available,
      runtime: "docker",
      consecutiveFailures: 0,
    }),
    execute: async (): Promise<ExecutionResult> => ({
      success: true,
      output: { stdout: `executed by ${name}`, stderr: "", exitCode: 0 },
      metadata: {
        toolName: "test",
        containerImage: name,
        startTime: new Date(),
        endTime: new Date(),
        durationMs: 0,
        cached: false,
        executionId: "test",
      },
    }),
    exec: async (): Promise<ExecutionResult> => ({
      success: true,
      output: { stdout: "", stderr: "", exitCode: 0 },
      metadata: {
        toolName: "test",
        containerImage: name,
        startTime: new Date(),
        endTime: new Date(),
        durationMs: 0,
        cached: false,
        executionId: "test",
      },
    }),
    executeAction: async (): Promise<ExecutionResult> => ({
      success: true,
      output: { stdout: "", stderr: "", exitCode: 0 },
      metadata: {
        toolName: "test",
        containerImage: name,
        startTime: new Date(),
        endTime: new Date(),
        durationMs: 0,
        cached: false,
        executionId: "test",
      },
    }),
    shutdown: async () => {
      /* no-op */
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ExecutionRouter", () => {
  describe("provider registration", () => {
    test("registers and selects a provider by name", async () => {
      const router = new ExecutionRouter({ default: "local" });
      router.registerProvider("local", mockProvider("local"));

      const provider = await router.selectProvider("@test/tool");
      expect(provider.name).toBe("local");
    });

    test("supports multiple providers", async () => {
      const router = new ExecutionRouter({ default: "docker" });
      router.registerProvider("local", mockProvider("local"));
      router.registerProvider("docker", mockProvider("docker"));

      const provider = await router.selectProvider("@test/tool");
      expect(provider.name).toBe("docker");
    });
  });

  describe("default backend selection", () => {
    test("uses configured default backend", async () => {
      const router = new ExecutionRouter({ default: "docker" });
      router.registerProvider("local", mockProvider("local"));
      router.registerProvider("docker", mockProvider("docker"));

      const provider = await router.selectProvider("@test/tool");
      expect(provider.name).toBe("docker");
    });

    test("falls back to 'container' alias when no default set", async () => {
      const router = new ExecutionRouter();
      router.registerProvider("local", mockProvider("local"));
      router.registerProvider("docker", mockProvider("docker"));

      // Default is "container" which resolves to docker
      const provider = await router.selectProvider("@test/tool");
      expect(provider.name).toBe("docker");
    });

    test("container alias tries docker first, then dagger", async () => {
      const router = new ExecutionRouter({ default: "container" });
      // Docker unavailable, dagger available
      router.registerProvider("docker", mockProvider("docker", false));
      router.registerProvider("dagger", mockProvider("dagger", true));
      router.registerProvider("local", mockProvider("local"));

      const provider = await router.selectProvider("@test/tool");
      expect(provider.name).toBe("dagger");
    });
  });

  describe("fallback behavior", () => {
    test("falls back when default is unavailable", async () => {
      const router = new ExecutionRouter({
        default: "docker",
        fallback: "local",
      });
      router.registerProvider("docker", mockProvider("docker", false));
      router.registerProvider("local", mockProvider("local"));

      const provider = await router.selectProvider("@test/tool");
      expect(provider.name).toBe("local");
    });

    test("falls to local as last resort when both default and fallback unavailable", async () => {
      const router = new ExecutionRouter({
        default: "docker",
        fallback: "remote",
      });
      router.registerProvider("docker", mockProvider("docker", false));
      router.registerProvider("remote", mockProvider("remote", false));
      router.registerProvider("local", mockProvider("local"));

      const provider = await router.selectProvider("@test/tool");
      expect(provider.name).toBe("local");
    });

    test("throws when no providers are available", async () => {
      const router = new ExecutionRouter({ default: "docker" });
      router.registerProvider("docker", mockProvider("docker", false));

      await expect(router.selectProvider("@test/tool")).rejects.toThrow(
        "No execution provider available"
      );
    });
  });

  describe("trusted_scopes", () => {
    test("uses local for tools matching trusted scope", async () => {
      const router = new ExecutionRouter({
        default: "docker",
        trusted_scopes: ["@my-org/*"],
      });
      router.registerProvider("local", mockProvider("local"));
      router.registerProvider("docker", mockProvider("docker"));

      const provider = await router.selectProvider("@my-org/some-tool");
      expect(provider.name).toBe("local");
    });

    test("uses default for tools NOT matching trusted scope", async () => {
      const router = new ExecutionRouter({
        default: "docker",
        trusted_scopes: ["@my-org/*"],
      });
      router.registerProvider("local", mockProvider("local"));
      router.registerProvider("docker", mockProvider("docker"));

      const provider = await router.selectProvider("@other-org/tool");
      expect(provider.name).toBe("docker");
    });

    test("supports exact match in trusted_scopes", async () => {
      const router = new ExecutionRouter({
        default: "docker",
        trusted_scopes: ["@specific/tool"],
      });
      router.registerProvider("local", mockProvider("local"));
      router.registerProvider("docker", mockProvider("docker"));

      const exact = await router.selectProvider("@specific/tool");
      expect(exact.name).toBe("local");

      const other = await router.selectProvider("@specific/other");
      expect(other.name).toBe("docker");
    });

    test("supports multiple trusted_scopes", async () => {
      const router = new ExecutionRouter({
        default: "docker",
        trusted_scopes: ["@org-a/*", "@org-b/*"],
      });
      router.registerProvider("local", mockProvider("local"));
      router.registerProvider("docker", mockProvider("docker"));

      const a = await router.selectProvider("@org-a/tool");
      expect(a.name).toBe("local");

      const b = await router.selectProvider("@org-b/tool");
      expect(b.name).toBe("local");

      const c = await router.selectProvider("@org-c/tool");
      expect(c.name).toBe("docker");
    });

    test("empty trusted_scopes does not affect routing", async () => {
      const router = new ExecutionRouter({
        default: "docker",
        trusted_scopes: [],
      });
      router.registerProvider("local", mockProvider("local"));
      router.registerProvider("docker", mockProvider("docker"));

      const provider = await router.selectProvider("@my-org/tool");
      expect(provider.name).toBe("docker");
    });
  });

  describe("CLI flag overrides", () => {
    test("forceLocal overrides all routing", async () => {
      const router = new ExecutionRouter({ default: "docker" });
      router.registerProvider("local", mockProvider("local"));
      router.registerProvider("docker", mockProvider("docker"));

      const provider = await router.selectProvider("@test/tool", {
        forceLocal: true,
      });
      expect(provider.name).toBe("local");
    });

    test("forceRemote overrides all routing", async () => {
      const router = new ExecutionRouter({ default: "docker" });
      router.registerProvider("local", mockProvider("local"));
      router.registerProvider("docker", mockProvider("docker"));
      router.registerProvider("remote", mockProvider("remote"));

      const provider = await router.selectProvider("@test/tool", {
        forceRemote: true,
      });
      expect(provider.name).toBe("remote");
    });

    test("forceLocal overrides even trusted_scopes", async () => {
      const router = new ExecutionRouter({
        default: "docker",
        trusted_scopes: ["@my-org/*"],
      });
      router.registerProvider("local", mockProvider("local"));
      router.registerProvider("docker", mockProvider("docker"));

      // Even for untrusted tool, forceLocal wins
      const provider = await router.selectProvider("@untrusted/tool", {
        forceLocal: true,
      });
      expect(provider.name).toBe("local");
    });
  });
});
