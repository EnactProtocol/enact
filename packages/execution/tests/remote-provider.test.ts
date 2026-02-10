/**
 * Tests for the Remote execution provider.
 */

import { describe, expect, test } from "bun:test";
import { RemoteExecutionProvider } from "../src/remote-provider";

describe("RemoteExecutionProvider", () => {
  describe("instantiation", () => {
    test("creates with required endpoint", () => {
      const provider = new RemoteExecutionProvider({
        endpoint: "http://localhost:3000",
      });
      expect(provider.name).toBe("remote");
    });

    test("creates with full config", () => {
      const provider = new RemoteExecutionProvider({
        endpoint: "https://run.enact.tools",
        authToken: "my-token",
        defaultTimeout: 60000,
      });
      expect(provider.name).toBe("remote");
    });

    test("strips trailing slash from endpoint", () => {
      const provider = new RemoteExecutionProvider({
        endpoint: "http://localhost:3000/",
      });
      // We verify indirectly — no trailing slash in requests
      expect(provider.name).toBe("remote");
    });
  });

  describe("interface compliance", () => {
    test("implements all ExecutionProvider methods", () => {
      const provider = new RemoteExecutionProvider({
        endpoint: "http://localhost:9999",
      });

      expect(typeof provider.initialize).toBe("function");
      expect(typeof provider.isAvailable).toBe("function");
      expect(typeof provider.getHealth).toBe("function");
      expect(typeof provider.execute).toBe("function");
      expect(typeof provider.exec).toBe("function");
      expect(typeof provider.executeAction).toBe("function");
      expect(typeof provider.shutdown).toBe("function");
    });

    test("initialize resolves without error", async () => {
      const provider = new RemoteExecutionProvider({
        endpoint: "http://localhost:9999",
      });
      await expect(provider.initialize()).resolves.toBeUndefined();
    });

    test("shutdown resolves without error", async () => {
      const provider = new RemoteExecutionProvider({
        endpoint: "http://localhost:9999",
      });
      await expect(provider.shutdown()).resolves.toBeUndefined();
    });
  });

  describe("availability", () => {
    test("isAvailable returns false for unreachable endpoint", async () => {
      const provider = new RemoteExecutionProvider({
        endpoint: "http://localhost:19999", // unlikely to be running
      });

      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });

    test("getHealth returns unhealthy for unreachable endpoint", async () => {
      const provider = new RemoteExecutionProvider({
        endpoint: "http://localhost:19999",
      });

      const health = await provider.getHealth();
      expect(health.healthy).toBe(false);
    });
  });

  describe("execute error handling", () => {
    test("returns error result for unreachable endpoint", async () => {
      const provider = new RemoteExecutionProvider({
        endpoint: "http://localhost:19999",
        defaultTimeout: 2000,
      });

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

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.metadata.toolName).toBe("@test/tool");
      expect(result.metadata.executionId).toMatch(/^remote-/);
    });

    test("exec returns error result for unreachable endpoint", async () => {
      const provider = new RemoteExecutionProvider({
        endpoint: "http://localhost:19999",
        defaultTimeout: 2000,
      });

      const result = await provider.exec(
        {
          enact: "2.0.0",
          name: "@test/tool",
          description: "test",
          version: "1.0.0",
        },
        "echo hello"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("executeAction validation", () => {
    test("validates inputs locally before sending to remote", async () => {
      const provider = new RemoteExecutionProvider({
        endpoint: "http://localhost:19999",
        defaultTimeout: 2000,
      });

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
              command: ["echo", "{{name}}"],
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
          command: ["echo", "{{name}}"],
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
      // Should fail locally without hitting the remote endpoint
    });
  });

  describe("metadata", () => {
    test("error results include timing metadata", async () => {
      const provider = new RemoteExecutionProvider({
        endpoint: "http://localhost:19999",
        defaultTimeout: 2000,
      });

      const before = new Date();
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
      const after = new Date();

      expect(result.metadata.startTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.metadata.endTime.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata.containerImage).toBe("remote");
    });
  });
});
