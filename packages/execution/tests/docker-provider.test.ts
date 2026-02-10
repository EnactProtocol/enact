/**
 * Tests for the Docker execution provider.
 */

import { describe, expect, test } from "bun:test";
import { DockerExecutionProvider } from "../src/docker-provider";

describe("DockerExecutionProvider", () => {
  describe("instantiation", () => {
    test("creates with default config", () => {
      const provider = new DockerExecutionProvider();
      expect(provider.name).toBe("docker");
    });

    test("creates with custom config", () => {
      const provider = new DockerExecutionProvider({
        defaultTimeout: 60000,
        verbose: true,
        preferredRuntime: "podman",
      });
      expect(provider.name).toBe("docker");
    });
  });

  describe("interface compliance", () => {
    test("implements all ExecutionProvider methods", () => {
      const provider = new DockerExecutionProvider();

      expect(typeof provider.initialize).toBe("function");
      expect(typeof provider.isAvailable).toBe("function");
      expect(typeof provider.getHealth).toBe("function");
      expect(typeof provider.execute).toBe("function");
      expect(typeof provider.exec).toBe("function");
      expect(typeof provider.executeAction).toBe("function");
      expect(typeof provider.shutdown).toBe("function");
    });

    test("initialize resolves without error", async () => {
      const provider = new DockerExecutionProvider();
      await expect(provider.initialize()).resolves.toBeUndefined();
    });

    test("shutdown resolves without error", async () => {
      const provider = new DockerExecutionProvider();
      await expect(provider.shutdown()).resolves.toBeUndefined();
    });

    test("isAvailable returns a boolean", async () => {
      const provider = new DockerExecutionProvider();
      const result = await provider.isAvailable();
      expect(typeof result).toBe("boolean");
    });

    test("getHealth returns valid health object", async () => {
      const provider = new DockerExecutionProvider();
      const health = await provider.getHealth();
      expect(typeof health.healthy).toBe("boolean");
      expect(typeof health.runtime).toBe("string");
      expect(typeof health.consecutiveFailures).toBe("number");
    });
  });

  describe("execute", () => {
    test("returns error when no command in manifest", async () => {
      const provider = new DockerExecutionProvider();
      await provider.initialize();

      const result = await provider.execute(
        {
          enact: "2.0.0",
          name: "@test/tool",
          description: "test",
          version: "1.0.0",
        },
        { params: {} }
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("COMMAND_ERROR");
      expect(result.error?.message).toContain("No command specified");
    });

    test("returns error when no runtime available", async () => {
      // Use an impossible runtime to force unavailability
      const provider = new DockerExecutionProvider({
        preferredRuntime: "nerdctl", // may not be installed
      });

      // Don't initialize — runtime stays null
      const result = await provider.execute(
        {
          enact: "2.0.0",
          name: "@test/tool",
          description: "test",
          version: "1.0.0",
          command: "echo hello",
        },
        { params: {} }
      );

      // Without initialize, runtime is null
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("CONTAINER_ERROR");
    });
  });

  describe("executeAction", () => {
    test("validates inputs against action schema", async () => {
      const provider = new DockerExecutionProvider();
      await provider.initialize();

      const result = await provider.executeAction(
        {
          enact: "2.0.0",
          name: "@test/tool",
          description: "test",
          version: "1.0.0",
        },
        {
          actions: {
            greet: {
              description: "Greet",
              command: ["echo", "hello", "{{name}}"],
              inputSchema: {
                type: "object" as const,
                properties: {
                  name: { type: "string" as const },
                },
                required: ["name"],
              },
            },
          },
        },
        "greet",
        {
          description: "Greet",
          command: ["echo", "hello", "{{name}}"],
          inputSchema: {
            type: "object" as const,
            properties: {
              name: { type: "string" as const },
            },
            required: ["name"],
          },
        },
        { params: {} } // Missing required 'name'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("VALIDATION_ERROR");
    });

    test("returns error for empty command array", async () => {
      const provider = new DockerExecutionProvider();
      await provider.initialize();

      // Skip this test if no runtime
      if (!(await provider.isAvailable())) return;

      const result = await provider.executeAction(
        {
          enact: "2.0.0",
          name: "@test/tool",
          description: "test",
          version: "1.0.0",
        },
        {
          actions: {
            empty: {
              description: "Empty",
              command: "",
            },
          },
        },
        "empty",
        { description: "Empty", command: "" },
        { params: {} }
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("COMMAND_ERROR");
    });
  });

  describe("metadata", () => {
    test("error results include correct metadata", async () => {
      const provider = new DockerExecutionProvider();

      const result = await provider.execute(
        {
          enact: "2.0.0",
          name: "@test/my-tool",
          description: "test",
          version: "1.0.0",
        },
        { params: {} }
      );

      expect(result.metadata).toBeDefined();
      expect(result.metadata.toolName).toBe("@test/my-tool");
      expect(result.metadata.startTime).toBeInstanceOf(Date);
      expect(result.metadata.endTime).toBeInstanceOf(Date);
      expect(typeof result.metadata.durationMs).toBe("number");
      expect(result.metadata.executionId).toMatch(/^docker-/);
    });
  });
});
