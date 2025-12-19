import { describe, expect, test } from "bun:test";
import type {
  Author,
  EnvVariable,
  PackageManifest,
  ParsedManifest,
  ResourceRequirements,
  ToolAnnotations,
  ToolExample,
  ToolManifest,
  ToolResolution,
  ValidationError,
  ValidationResult,
  ValidationWarning,
} from "../src/types/manifest";
import { MANIFEST_FILES, PACKAGE_MANIFEST_FILE } from "../src/types/manifest";

describe("manifest types", () => {
  describe("ToolManifest", () => {
    test("accepts minimal valid manifest", () => {
      const manifest: ToolManifest = {
        name: "org/tool",
        description: "A test tool",
      };

      expect(manifest.name).toBe("org/tool");
      expect(manifest.description).toBe("A test tool");
    });

    test("accepts full manifest with all fields", () => {
      const manifest: ToolManifest = {
        name: "acme/utils/greeter",
        description: "Greets users by name",
        enact: "2.0.0",
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
            description: "API key for service",
            secret: true,
          },
          LOG_LEVEL: {
            description: "Logging level",
            default: "info",
          },
        },
        annotations: {
          title: "Greeter Tool",
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        resources: {
          memory: "512Mi",
          disk: "1Gi",
        },
        doc: "Extended documentation here",
        authors: [
          {
            name: "Alice",
            email: "alice@example.com",
            url: "https://example.com",
          },
        ],
        examples: [
          {
            input: { name: "World" },
            output: { message: "Hello World" },
            description: "Basic greeting",
          },
        ],
        "x-custom-field": "custom value",
      };

      expect(manifest.name).toBe("acme/utils/greeter");
      expect(manifest.enact).toBe("2.0.0");
      expect(manifest.env?.API_KEY?.secret).toBe(true);
      expect(manifest.annotations?.readOnlyHint).toBe(true);
      expect(manifest["x-custom-field"]).toBe("custom value");
    });

    test("supports custom x- prefixed fields", () => {
      const manifest: ToolManifest = {
        name: "org/tool",
        description: "Test",
        "x-internal-id": "12345",
        "x-team-owner": "platform",
        "x-nested": { foo: "bar" },
      };

      expect(manifest["x-internal-id"]).toBe("12345");
      expect(manifest["x-team-owner"]).toBe("platform");
      expect(manifest["x-nested"]).toEqual({ foo: "bar" });
    });
  });

  describe("EnvVariable", () => {
    test("supports secret variables", () => {
      const envVar: EnvVariable = {
        description: "API authentication token",
        secret: true,
      };

      expect(envVar.secret).toBe(true);
      expect(envVar.default).toBeUndefined();
    });

    test("supports non-secret variables with defaults", () => {
      const envVar: EnvVariable = {
        description: "Logging level",
        secret: false,
        default: "info",
      };

      expect(envVar.secret).toBe(false);
      expect(envVar.default).toBe("info");
    });
  });

  describe("Author", () => {
    test("requires name field", () => {
      const author: Author = {
        name: "Alice Developer",
      };

      expect(author.name).toBe("Alice Developer");
    });

    test("supports optional email and url", () => {
      const author: Author = {
        name: "Bob",
        email: "bob@example.com",
        url: "https://bob.dev",
      };

      expect(author.email).toBe("bob@example.com");
      expect(author.url).toBe("https://bob.dev");
    });
  });

  describe("ToolAnnotations", () => {
    test("all fields are optional", () => {
      const annotations: ToolAnnotations = {};
      expect(annotations.title).toBeUndefined();
    });

    test("supports all behavior hints", () => {
      const annotations: ToolAnnotations = {
        title: "My Tool",
        readOnlyHint: true,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      };

      expect(annotations.title).toBe("My Tool");
      expect(annotations.readOnlyHint).toBe(true);
      expect(annotations.destructiveHint).toBe(true);
      expect(annotations.idempotentHint).toBe(false);
      expect(annotations.openWorldHint).toBe(true);
    });
  });

  describe("ResourceRequirements", () => {
    test("supports memory, gpu, and disk", () => {
      const resources: ResourceRequirements = {
        memory: "2Gi",
        gpu: "24Gi",
        disk: "100Gi",
      };

      expect(resources.memory).toBe("2Gi");
      expect(resources.gpu).toBe("24Gi");
      expect(resources.disk).toBe("100Gi");
    });
  });

  describe("ToolExample", () => {
    test("supports input and output", () => {
      const example: ToolExample = {
        input: { file: "data.csv", operation: "validate" },
        output: { status: "success", valid: true },
        description: "Validate CSV file",
      };

      expect(example.input).toEqual({ file: "data.csv", operation: "validate" });
      expect(example.output).toEqual({ status: "success", valid: true });
      expect(example.description).toBe("Validate CSV file");
    });

    test("supports examples without input (no-arg tools)", () => {
      const example: ToolExample = {
        output: { timestamp: "2025-01-29T00:00:00Z" },
        description: "Returns current timestamp",
      };

      expect(example.input).toBeUndefined();
      expect(example.output).toBeDefined();
    });
  });

  describe("PackageManifest", () => {
    test("supports shared configuration", () => {
      const pkg: PackageManifest = {
        enact: "2.0.0",
        env: {
          API_TOKEN: {
            description: "Shared API token",
            secret: true,
          },
        },
        authors: [{ name: "Team" }],
        license: "MIT",
        "x-org-id": "acme",
      };

      expect(pkg.enact).toBe("2.0.0");
      expect(pkg.env?.API_TOKEN?.secret).toBe(true);
      expect(pkg.authors?.[0]?.name).toBe("Team");
      expect(pkg["x-org-id"]).toBe("acme");
    });
  });

  describe("ParsedManifest", () => {
    test("contains manifest and format", () => {
      const parsed: ParsedManifest = {
        manifest: {
          name: "org/tool",
          description: "Test",
        },
        format: "yaml",
      };

      expect(parsed.manifest.name).toBe("org/tool");
      expect(parsed.format).toBe("yaml");
      expect(parsed.body).toBeUndefined();
    });

    test("contains body for markdown format", () => {
      const parsed: ParsedManifest = {
        manifest: {
          name: "org/tool",
          description: "Test",
        },
        body: "# Tool Name\n\nDocumentation here.",
        format: "md",
      };

      expect(parsed.format).toBe("md");
      expect(parsed.body).toContain("# Tool Name");
    });
  });

  describe("ValidationResult", () => {
    test("represents valid result", () => {
      const result: ValidationResult = {
        valid: true,
      };

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    test("represents invalid result with errors", () => {
      const error: ValidationError = {
        path: "name",
        message: "Name is required",
        code: "REQUIRED",
      };

      const warning: ValidationWarning = {
        path: "version",
        message: "Version is recommended",
        code: "MISSING_RECOMMENDED",
      };

      const result: ValidationResult = {
        valid: false,
        errors: [error],
        warnings: [warning],
      };

      expect(result.valid).toBe(false);
      expect(result.errors?.length).toBe(1);
      expect(result.errors?.[0]?.code).toBe("REQUIRED");
      expect(result.warnings?.length).toBe(1);
    });
  });

  describe("ToolResolution", () => {
    test("contains all resolution info", () => {
      const resolution: ToolResolution = {
        manifest: {
          name: "org/tool",
          description: "Test",
        },
        sourceDir: "/home/user/.enact/tools/org/tool",
        location: "user",
        manifestPath: "/home/user/.enact/tools/org/tool/enact.yaml",
        version: "1.0.0",
      };

      expect(resolution.location).toBe("user");
      expect(resolution.version).toBe("1.0.0");
    });

    test("supports all location types", () => {
      const locations: ToolResolution["location"][] = [
        "file",
        "project",
        "user",
        "cache",
        "registry",
      ];

      for (const loc of locations) {
        const resolution: ToolResolution = {
          manifest: { name: "test", description: "test" },
          sourceDir: "/test",
          location: loc,
          manifestPath: "/test/enact.yaml",
        };
        expect(resolution.location).toBe(loc);
      }
    });
  });

  describe("constants", () => {
    test("MANIFEST_FILES contains expected files", () => {
      expect(MANIFEST_FILES).toContain("SKILL.md");
      expect(MANIFEST_FILES).toContain("enact.md");
      expect(MANIFEST_FILES).toContain("enact.yaml");
      expect(MANIFEST_FILES).toContain("enact.yml");
      expect(MANIFEST_FILES.length).toBe(4);
    });

    test("PACKAGE_MANIFEST_FILE is correct", () => {
      expect(PACKAGE_MANIFEST_FILE).toBe("enact-package.yaml");
    });
  });
});
