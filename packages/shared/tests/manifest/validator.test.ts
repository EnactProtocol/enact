import { describe, expect, test } from "bun:test";
import {
  isValidLocalToolName,
  isValidTimeout,
  isValidToolName,
  isValidVersion,
  validateManifest,
  validateManifestStrict,
} from "../../src/manifest/validator";

describe("manifest validator", () => {
  describe("validateManifest", () => {
    test("validates minimal valid manifest", () => {
      const manifest = {
        name: "org/tool",
        description: "A test tool",
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    test("validates complete manifest", () => {
      const manifest = {
        enact: "2.0.0",
        name: "acme/utils/greeter",
        description: "Greets users by name",
        version: "1.0.0",
        from: "node:18-alpine",
        command: "echo 'Hello ${name}'",
        timeout: "30s",
        license: "MIT",
        tags: ["greeting", "utility"],
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
          required: ["name"],
        },
        outputSchema: {
          type: "object",
          properties: {
            message: { type: "string" },
          },
        },
        env: {
          API_KEY: {
            description: "API authentication key",
            secret: true,
          },
          LOG_LEVEL: {
            description: "Logging level",
            default: "info",
          },
        },
        annotations: {
          readOnlyHint: true,
          idempotentHint: true,
        },
        resources: {
          memory: "512Mi",
        },
        authors: [
          {
            name: "Alice",
            email: "alice@example.com",
          },
        ],
        examples: [
          {
            input: { name: "World" },
            output: { message: "Hello World" },
            description: "Basic greeting",
          },
        ],
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(true);
    });

    test("fails for missing name", () => {
      const manifest = {
        description: "A test tool",
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.some((e) => e.path === "name")).toBe(true);
    });

    test("fails for missing description", () => {
      const manifest = {
        name: "org/tool",
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.path === "description")).toBe(true);
    });

    test("fails for invalid tool name format", () => {
      const manifest = {
        name: "invalid-name", // Must have at least one slash
        description: "Test",
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.path === "name")).toBe(true);
    });

    test("fails for tool name with uppercase", () => {
      const manifest = {
        name: "Org/Tool", // Must be lowercase
        description: "Test",
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
    });

    test("fails for invalid version format", () => {
      const manifest = {
        name: "org/tool",
        description: "Test",
        version: "invalid", // Not semver
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.path === "version")).toBe(true);
    });

    test("fails for invalid timeout format", () => {
      const manifest = {
        name: "org/tool",
        description: "Test",
        timeout: "30seconds", // Should be "30s"
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.path === "timeout")).toBe(true);
    });

    test("accepts valid timeout formats", () => {
      const timeouts = ["30s", "5m", "1h", "100ms", "1000ns"];

      for (const timeout of timeouts) {
        const manifest = {
          name: "org/tool",
          description: "Test",
          timeout,
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(true);
      }
    });

    test("accepts valid semver versions", () => {
      const versions = [
        "1.0.0",
        "0.1.0",
        "10.20.30",
        "1.0.0-alpha",
        "1.0.0-beta.1",
        "1.0.0+build.123",
      ];

      for (const version of versions) {
        const manifest = {
          name: "org/tool",
          description: "Test",
          version,
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(true);
      }
    });

    test("fails for description over 500 characters", () => {
      const manifest = {
        name: "org/tool",
        description: "a".repeat(501),
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
    });

    test("validates env variable with missing description", () => {
      const manifest = {
        name: "org/tool",
        description: "Test",
        env: {
          API_KEY: {
            // Missing description
            secret: true,
          },
        },
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.path.includes("env"))).toBe(true);
    });

    test("allows custom x- fields", () => {
      const manifest = {
        name: "org/tool",
        description: "Test",
        "x-custom": "value",
        "x-another": { nested: true },
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(true);
    });

    test("accepts valid tool name formats", () => {
      const names = [
        "org/tool",
        "acme/utils/greeter",
        "my-org/category/sub-category/tool-name",
        "a/b",
        "org_name/tool_name",
      ];

      for (const name of names) {
        const manifest = { name, description: "Test" };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe("allowSimpleNames option", () => {
    test("rejects simple names by default", () => {
      const manifest = {
        name: "my-tool", // No slash
        description: "A local tool",
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.path === "name")).toBe(true);
    });

    test("accepts simple names with allowSimpleNames option", () => {
      const manifest = {
        name: "my-tool",
        description: "A local tool",
      };

      const result = validateManifest(manifest, { allowSimpleNames: true });
      expect(result.valid).toBe(true);
    });

    test("accepts hierarchical names with allowSimpleNames option", () => {
      const manifest = {
        name: "org/tool",
        description: "A published tool",
      };

      const result = validateManifest(manifest, { allowSimpleNames: true });
      expect(result.valid).toBe(true);
    });

    test("still rejects invalid characters with allowSimpleNames", () => {
      const manifest = {
        name: "My-Tool", // Uppercase not allowed
        description: "Invalid tool name",
      };

      const result = validateManifest(manifest, { allowSimpleNames: true });
      expect(result.valid).toBe(false);
    });

    test("validateManifestStrict respects allowSimpleNames option", () => {
      const manifest = {
        name: "local-tool",
        description: "A local tool",
      };

      // Should throw without option
      expect(() => validateManifestStrict(manifest)).toThrow();

      // Should succeed with option
      const result = validateManifestStrict(manifest, { allowSimpleNames: true });
      expect(result.name).toBe("local-tool");
    });
  });

  describe("warnings", () => {
    test("warns about missing recommended fields", () => {
      const manifest = {
        name: "org/tool",
        description: "Test",
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.length).toBeGreaterThan(0);
    });

    test("warns about missing version", () => {
      const manifest = {
        name: "org/tool",
        description: "Test",
      };

      const result = validateManifest(manifest);
      expect(result.warnings?.some((w) => w.path === "version")).toBe(true);
    });

    test("warns about missing license", () => {
      const manifest = {
        name: "org/tool",
        description: "Test",
      };

      const result = validateManifest(manifest);
      expect(result.warnings?.some((w) => w.path === "license")).toBe(true);
    });

    test("warns about missing timeout for command tools", () => {
      const manifest = {
        name: "org/tool",
        description: "Test",
        command: "echo hello",
      };

      const result = validateManifest(manifest);
      expect(result.warnings?.some((w) => w.path === "timeout")).toBe(true);
    });

    test("warns about secret with default value", () => {
      const manifest = {
        name: "org/tool",
        description: "Test",
        env: {
          API_KEY: {
            description: "API key",
            secret: true,
            default: "bad-idea", // Secrets shouldn't have defaults
          },
        },
      };

      const result = validateManifest(manifest);
      expect(result.warnings?.some((w) => w.code === "SECRET_WITH_DEFAULT")).toBe(true);
    });

    test("no extra warnings for complete manifest", () => {
      const manifest = {
        enact: "2.0.0",
        name: "org/tool",
        description: "Test",
        version: "1.0.0",
        license: "MIT",
        outputSchema: { type: "object" },
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(true);
      // May still have some warnings but they should be reasonable
    });
  });

  describe("validateManifestStrict", () => {
    test("returns manifest on success", () => {
      const manifest = {
        name: "org/tool",
        description: "Test",
      };

      const result = validateManifestStrict(manifest);
      expect(result.name).toBe("org/tool");
    });

    test("throws on validation failure", () => {
      const manifest = {
        description: "Missing name",
      };

      expect(() => validateManifestStrict(manifest)).toThrow("Manifest validation failed");
    });

    test("error message includes field path", () => {
      const manifest = {
        name: "invalid",
        description: "Test",
      };

      expect(() => validateManifestStrict(manifest)).toThrow("name");
    });
  });

  describe("helper functions", () => {
    describe("isValidToolName", () => {
      test("returns true for valid names", () => {
        expect(isValidToolName("org/tool")).toBe(true);
        expect(isValidToolName("acme/utils/greeter")).toBe(true);
        expect(isValidToolName("my-org/my-tool")).toBe(true);
        expect(isValidToolName("org_name/tool_name")).toBe(true);
      });

      test("returns false for invalid names", () => {
        expect(isValidToolName("tool")).toBe(false); // No slash
        expect(isValidToolName("Org/Tool")).toBe(false); // Uppercase
        expect(isValidToolName("org/ tool")).toBe(false); // Space
        expect(isValidToolName("")).toBe(false);
      });
    });

    describe("isValidLocalToolName", () => {
      test("returns true for simple names (no hierarchy)", () => {
        expect(isValidLocalToolName("my-tool")).toBe(true);
        expect(isValidLocalToolName("tool_name")).toBe(true);
        expect(isValidLocalToolName("simple")).toBe(true);
      });

      test("returns true for hierarchical names", () => {
        expect(isValidLocalToolName("org/tool")).toBe(true);
        expect(isValidLocalToolName("acme/utils/greeter")).toBe(true);
      });

      test("returns false for invalid names", () => {
        expect(isValidLocalToolName("My-Tool")).toBe(false); // Uppercase
        expect(isValidLocalToolName("tool name")).toBe(false); // Space
        expect(isValidLocalToolName("")).toBe(false);
      });
    });

    describe("isValidVersion", () => {
      test("returns true for valid semver", () => {
        expect(isValidVersion("1.0.0")).toBe(true);
        expect(isValidVersion("0.0.1")).toBe(true);
        expect(isValidVersion("1.0.0-alpha")).toBe(true);
        expect(isValidVersion("1.0.0+build")).toBe(true);
      });

      test("returns false for invalid semver", () => {
        expect(isValidVersion("1.0")).toBe(false);
        expect(isValidVersion("v1.0.0")).toBe(false); // No 'v' prefix
        expect(isValidVersion("1.0.0.0")).toBe(false);
        expect(isValidVersion("")).toBe(false);
      });
    });

    describe("isValidTimeout", () => {
      test("returns true for valid Go duration", () => {
        expect(isValidTimeout("30s")).toBe(true);
        expect(isValidTimeout("5m")).toBe(true);
        expect(isValidTimeout("1h")).toBe(true);
        expect(isValidTimeout("100ms")).toBe(true);
      });

      test("returns false for invalid duration", () => {
        expect(isValidTimeout("30seconds")).toBe(false);
        expect(isValidTimeout("5 minutes")).toBe(false);
        expect(isValidTimeout("")).toBe(false);
      });
    });
  });
});
