/**
 * Tests for the Local execution provider.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  LocalExecutionProvider,
  hasContainerfile,
  selectExecutionMode,
} from "../src/local-provider";

const FIXTURES_DIR = join(import.meta.dir, "fixtures", "local-provider");

describe("LocalExecutionProvider", () => {
  describe("instantiation", () => {
    test("creates with default config", () => {
      const provider = new LocalExecutionProvider();
      expect(provider.name).toBe("local");
    });

    test("creates with custom config", () => {
      const provider = new LocalExecutionProvider({
        defaultTimeout: 60000,
        verbose: true,
        workdir: "/tmp/test",
      });
      expect(provider.name).toBe("local");
    });
  });

  describe("interface compliance", () => {
    test("implements all ExecutionProvider methods", () => {
      const provider = new LocalExecutionProvider();
      expect(typeof provider.initialize).toBe("function");
      expect(typeof provider.isAvailable).toBe("function");
      expect(typeof provider.getHealth).toBe("function");
      expect(typeof provider.execute).toBe("function");
      expect(typeof provider.exec).toBe("function");
      expect(typeof provider.executeAction).toBe("function");
      expect(typeof provider.shutdown).toBe("function");
    });

    test("initialize resolves without error", async () => {
      const provider = new LocalExecutionProvider();
      await expect(provider.initialize()).resolves.toBeUndefined();
    });

    test("shutdown resolves without error", async () => {
      const provider = new LocalExecutionProvider();
      await expect(provider.shutdown()).resolves.toBeUndefined();
    });

    test("isAvailable always returns true", async () => {
      const provider = new LocalExecutionProvider();
      expect(await provider.isAvailable()).toBe(true);
    });

    test("getHealth returns healthy", async () => {
      const provider = new LocalExecutionProvider();
      const health = await provider.getHealth();
      expect(health.healthy).toBe(true);
      expect(health.consecutiveFailures).toBe(0);
    });
  });

  describe("execute", () => {
    test("runs a simple echo command", async () => {
      const provider = new LocalExecutionProvider();
      const result = await provider.execute(
        { name: "@test/echo", description: "test", command: "echo hello" },
        { params: {} }
      );
      expect(result.success).toBe(true);
      expect(result.output.stdout.trim()).toBe("hello");
      expect(result.output.exitCode).toBe(0);
    });

    test("returns error when no command in manifest", async () => {
      const provider = new LocalExecutionProvider();
      const result = await provider.execute(
        { name: "@test/no-cmd", description: "test" },
        { params: {} }
      );
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("COMMAND_ERROR");
      expect(result.error?.message).toContain("No command");
    });

    test("reports failure for command with non-zero exit", async () => {
      const provider = new LocalExecutionProvider();
      const result = await provider.execute(
        { name: "@test/fail", description: "test", command: "false" },
        { params: {} }
      );
      expect(result.success).toBe(false);
      expect(result.output.exitCode).not.toBe(0);
    });

    test("returns COMMAND_ERROR for non-existent command", async () => {
      const provider = new LocalExecutionProvider();
      const result = await provider.execute(
        { name: "@test/bad", description: "test", command: "nonexistent_command_xyz" },
        { params: {} }
      );
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("COMMAND_ERROR");
    });
  });

  describe("exec", () => {
    test("runs a raw command string", async () => {
      const provider = new LocalExecutionProvider();
      const result = await provider.exec({ name: "@test/tool", description: "test" }, "echo world");
      expect(result.success).toBe(true);
      expect(result.output.stdout.trim()).toBe("world");
    });
  });

  describe("executeAction", () => {
    test("validates inputs against action schema", async () => {
      const provider = new LocalExecutionProvider();
      const result = await provider.executeAction(
        { name: "@test/tool", description: "test" },
        {
          actions: {
            greet: {
              description: "Greet someone",
              command: ["echo", "{{name}}"],
              inputSchema: {
                type: "object" as const,
                properties: { name: { type: "string" as const } },
                required: ["name"],
              },
            },
          },
        },
        "greet",
        {
          description: "Greet someone",
          command: ["echo", "{{name}}"],
          inputSchema: {
            type: "object" as const,
            properties: { name: { type: "string" as const } },
            required: ["name"],
          },
        },
        { params: {} } // Missing required 'name'
      );
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("VALIDATION_ERROR");
    });

    test("executes action with valid inputs", async () => {
      const provider = new LocalExecutionProvider();
      const result = await provider.executeAction(
        { name: "@test/tool", description: "test" },
        {
          actions: {
            greet: {
              description: "Greet someone",
              command: ["echo", "{{name}}"],
              inputSchema: {
                type: "object" as const,
                properties: { name: { type: "string" as const } },
                required: ["name"],
              },
            },
          },
        },
        "greet",
        {
          description: "Greet someone",
          command: ["echo", "{{name}}"],
          inputSchema: {
            type: "object" as const,
            properties: { name: { type: "string" as const } },
            required: ["name"],
          },
        },
        { params: { name: "Alice" } }
      );
      expect(result.success).toBe(true);
      expect(result.output.stdout.trim()).toBe("Alice");
    });
  });

  describe("metadata", () => {
    test("results include timing metadata", async () => {
      const provider = new LocalExecutionProvider();
      const before = new Date();
      const result = await provider.execute(
        { name: "@test/tool", description: "test", command: "echo timing" },
        { params: {} }
      );
      const after = new Date();

      expect(result.metadata.startTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.metadata.endTime.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata.containerImage).toBe("local");
      expect(result.metadata.executionId).toMatch(/^local-/);
    });
  });
});

describe("hasContainerfile", () => {
  test("returns false for directory without container file", () => {
    const dir = join(FIXTURES_DIR, "no-containerfile");
    mkdirSync(dir, { recursive: true });
    expect(hasContainerfile(dir)).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  test("returns true for directory with Containerfile", () => {
    const dir = join(FIXTURES_DIR, "with-containerfile");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "Containerfile"), "FROM alpine");
    expect(hasContainerfile(dir)).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  test("returns true for directory with Dockerfile", () => {
    const dir = join(FIXTURES_DIR, "with-dockerfile");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "Dockerfile"), "FROM alpine");
    expect(hasContainerfile(dir)).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("selectExecutionMode", () => {
  test("returns local when --local flag is set", () => {
    expect(selectExecutionMode("/tmp", { local: true })).toBe("local");
  });

  test("returns container when --container flag is set", () => {
    expect(selectExecutionMode("/tmp", { container: true })).toBe("container");
  });

  test("returns local when no Containerfile exists", () => {
    const dir = join(FIXTURES_DIR, "no-cf-mode");
    mkdirSync(dir, { recursive: true });
    expect(selectExecutionMode(dir, {})).toBe("local");
    rmSync(dir, { recursive: true, force: true });
  });

  test("returns container when Containerfile exists", () => {
    const dir = join(FIXTURES_DIR, "cf-mode");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "Containerfile"), "FROM alpine");
    expect(selectExecutionMode(dir, {})).toBe("container");
    rmSync(dir, { recursive: true, force: true });
  });
});
