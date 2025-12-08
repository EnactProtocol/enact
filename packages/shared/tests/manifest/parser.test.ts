import { describe, expect, test } from "bun:test";
import {
  ManifestParseError,
  detectFormat,
  extractFrontmatter,
  parseManifest,
  parseManifestAuto,
  parseYaml,
} from "../../src/manifest/parser";

describe("manifest parser", () => {
  describe("parseYaml", () => {
    test("parses valid YAML object", () => {
      const yaml = `
name: org/tool
description: A test tool
version: "1.0.0"
`;
      const result = parseYaml(yaml);
      expect(result.name).toBe("org/tool");
      expect(result.description).toBe("A test tool");
      expect(result.version).toBe("1.0.0");
    });

    test("parses nested YAML", () => {
      const yaml = `
name: org/tool
inputSchema:
  type: object
  properties:
    name:
      type: string
`;
      const result = parseYaml(yaml);
      expect(result.inputSchema).toBeDefined();
      const schema = result.inputSchema as Record<string, unknown>;
      expect(schema.type).toBe("object");
    });

    test("parses arrays in YAML", () => {
      const yaml = `
tags:
  - text
  - analysis
  - nlp
`;
      const result = parseYaml(yaml);
      expect(result.tags).toEqual(["text", "analysis", "nlp"]);
    });

    test("throws ManifestParseError on invalid YAML", () => {
      const invalidYaml = `
name: [unclosed bracket
`;
      expect(() => parseYaml(invalidYaml)).toThrow(ManifestParseError);
    });

    test("throws ManifestParseError on empty content", () => {
      expect(() => parseYaml("")).toThrow(ManifestParseError);
      expect(() => parseYaml("   \n  \n  ")).toThrow(ManifestParseError);
    });

    test("throws ManifestParseError on null YAML", () => {
      expect(() => parseYaml("null")).toThrow(ManifestParseError);
    });

    test("throws ManifestParseError on array YAML", () => {
      const arrayYaml = `
- item1
- item2
`;
      expect(() => parseYaml(arrayYaml)).toThrow(ManifestParseError);
      expect(() => parseYaml(arrayYaml)).toThrow("must be an object");
    });

    test("throws ManifestParseError on primitive YAML", () => {
      expect(() => parseYaml("just a string")).toThrow(ManifestParseError);
      expect(() => parseYaml("42")).toThrow(ManifestParseError);
    });
  });

  describe("extractFrontmatter", () => {
    test("extracts frontmatter and body from valid markdown", () => {
      const content = `---
name: org/tool
description: Test
---

# Tool Documentation

This is the body.
`;
      const result = extractFrontmatter(content);
      expect(result).not.toBeNull();
      expect(result?.frontmatter).toContain("name: org/tool");
      expect(result?.body).toContain("# Tool Documentation");
    });

    test("handles empty body", () => {
      const content = `---
name: org/tool
---
`;
      const result = extractFrontmatter(content);
      expect(result).not.toBeNull();
      expect(result?.frontmatter).toBe("name: org/tool");
      expect(result?.body).toBe("");
    });

    test("handles multiline frontmatter", () => {
      const content = `---
name: org/tool
description: >
  A very long description
  that spans multiple lines
tags:
  - one
  - two
---

Body content here.
`;
      const result = extractFrontmatter(content);
      expect(result).not.toBeNull();
      expect(result?.frontmatter).toContain("name: org/tool");
      expect(result?.frontmatter).toContain("tags:");
    });

    test("returns null for missing frontmatter", () => {
      const content = `# Just Markdown

No frontmatter here.
`;
      const result = extractFrontmatter(content);
      expect(result).toBeNull();
    });

    test("returns null for unclosed frontmatter", () => {
      const content = `---
name: org/tool
description: No closing delimiter
`;
      const result = extractFrontmatter(content);
      expect(result).toBeNull();
    });

    test("handles Windows line endings (CRLF)", () => {
      const content = "---\r\nname: org/tool\r\n---\r\n\r\nBody here.";
      const result = extractFrontmatter(content);
      expect(result).not.toBeNull();
      expect(result?.frontmatter).toBe("name: org/tool");
    });
  });

  describe("parseManifest", () => {
    describe("YAML format", () => {
      test("parses valid YAML manifest", () => {
        const yaml = `
name: org/tool
description: A test tool
`;
        const result = parseManifest(yaml, "yaml");
        expect(result.manifest.name).toBe("org/tool");
        expect(result.manifest.description).toBe("A test tool");
        expect(result.format).toBe("yaml");
        expect(result.body).toBeUndefined();
      });

      test("parses complete YAML manifest", () => {
        const yaml = `
enact: "2.0.0"
name: acme/utils/greeter
description: Greets users
version: "1.0.0"
from: node:18-alpine
command: "echo 'Hello \${name}'"
timeout: 30s
license: MIT
tags:
  - greeting
  - utility
inputSchema:
  type: object
  properties:
    name:
      type: string
  required:
    - name
`;
        const result = parseManifest(yaml, "yaml");
        expect(result.manifest.enact).toBe("2.0.0");
        expect(result.manifest.name).toBe("acme/utils/greeter");
        expect(result.manifest.from).toBe("node:18-alpine");
        expect(result.manifest.tags).toContain("greeting");
      });

      test("throws on empty YAML", () => {
        expect(() => parseManifest("", "yaml")).toThrow(ManifestParseError);
        expect(() => parseManifest("", "yaml")).toThrow("empty");
      });

      test("throws on invalid YAML", () => {
        const invalidYaml = "name: [\nunbalanced";
        expect(() => parseManifest(invalidYaml, "yaml")).toThrow(ManifestParseError);
      });
    });

    describe("Markdown format", () => {
      test("parses valid markdown with frontmatter", () => {
        const md = `---
name: org/tool
description: A test tool
---

# Tool Name

Documentation here.
`;
        const result = parseManifest(md, "md");
        expect(result.manifest.name).toBe("org/tool");
        expect(result.format).toBe("md");
        expect(result.body).toContain("# Tool Name");
      });

      test("parses markdown with empty body", () => {
        const md = `---
name: org/tool
description: Test
---
`;
        const result = parseManifest(md, "md");
        expect(result.manifest.name).toBe("org/tool");
        expect(result.body).toBeUndefined(); // Empty string becomes undefined
      });

      test("throws on missing frontmatter", () => {
        const md = `# Just Markdown

No frontmatter here.
`;
        expect(() => parseManifest(md, "md")).toThrow(ManifestParseError);
        expect(() => parseManifest(md, "md")).toThrow("frontmatter");
      });

      test("throws on empty frontmatter", () => {
        const md = `---
---

Body only.
`;
        expect(() => parseManifest(md, "md")).toThrow(ManifestParseError);
        expect(() => parseManifest(md, "md")).toThrow("frontmatter");
      });

      test("throws on invalid YAML in frontmatter", () => {
        const md = `---
name: [unclosed
---

Body here.
`;
        expect(() => parseManifest(md, "md")).toThrow(ManifestParseError);
      });
    });
  });

  describe("detectFormat", () => {
    test("detects .yaml extension", () => {
      expect(detectFormat("enact.yaml")).toBe("yaml");
      expect(detectFormat("tool.yaml")).toBe("yaml");
      expect(detectFormat("/path/to/enact.yaml")).toBe("yaml");
    });

    test("detects .yml extension", () => {
      expect(detectFormat("enact.yml")).toBe("yaml");
      expect(detectFormat("/path/to/tool.yml")).toBe("yaml");
    });

    test("detects .md extension", () => {
      expect(detectFormat("enact.md")).toBe("md");
      expect(detectFormat("tool.md")).toBe("md");
      expect(detectFormat("/path/to/enact.md")).toBe("md");
    });

    test("is case insensitive", () => {
      expect(detectFormat("enact.YAML")).toBe("yaml");
      expect(detectFormat("enact.YML")).toBe("yaml");
      expect(detectFormat("enact.MD")).toBe("md");
      expect(detectFormat("enact.Md")).toBe("md");
    });

    test("throws on unknown extension", () => {
      expect(() => detectFormat("enact.txt")).toThrow(ManifestParseError);
      expect(() => detectFormat("enact.json")).toThrow(ManifestParseError);
      expect(() => detectFormat("enact")).toThrow(ManifestParseError);
    });
  });

  describe("parseManifestAuto", () => {
    test("parses YAML file automatically", () => {
      const yaml = `
name: org/tool
description: Test
`;
      const result = parseManifestAuto(yaml, "enact.yaml");
      expect(result.manifest.name).toBe("org/tool");
      expect(result.format).toBe("yaml");
    });

    test("parses Markdown file automatically", () => {
      const md = `---
name: org/tool
description: Test
---

# Docs
`;
      const result = parseManifestAuto(md, "enact.md");
      expect(result.manifest.name).toBe("org/tool");
      expect(result.format).toBe("md");
    });

    test("throws on unknown file type", () => {
      expect(() => parseManifestAuto("content", "file.txt")).toThrow(ManifestParseError);
    });
  });

  describe("ManifestParseError", () => {
    test("has correct name", () => {
      const error = new ManifestParseError("test error");
      expect(error.name).toBe("ManifestParseError");
    });

    test("preserves original error", () => {
      const original = new Error("original");
      const error = new ManifestParseError("wrapped", original);
      expect(error.originalError).toBe(original);
    });

    test("message is preserved", () => {
      const error = new ManifestParseError("custom message");
      expect(error.message).toBe("custom message");
    });
  });
});
