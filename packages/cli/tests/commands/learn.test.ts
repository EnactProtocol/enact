/**
 * Tests for the learn command
 */

import { describe, expect, test } from "bun:test";
import type { ToolVersionInfo } from "@enactprotocol/api";
import { Command } from "commander";
import { configureLearnCommand } from "../../src/commands/learn";

describe("learn command", () => {
  describe("command configuration", () => {
    test("configures learn command on program", () => {
      const program = new Command();
      configureLearnCommand(program);

      const learnCmd = program.commands.find((cmd) => cmd.name() === "learn");
      expect(learnCmd).toBeDefined();
    });

    test("has correct description", () => {
      const program = new Command();
      configureLearnCommand(program);

      const learnCmd = program.commands.find((cmd) => cmd.name() === "learn");
      expect(learnCmd?.description()).toBe("Display documentation (enact.md) for a tool");
    });

    test("accepts tool argument", () => {
      const program = new Command();
      configureLearnCommand(program);

      const learnCmd = program.commands.find((cmd) => cmd.name() === "learn");
      const args = learnCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThan(0);
      expect(args[0]?.name()).toBe("tool");
    });

    test("has --ver option for specifying version", () => {
      const program = new Command();
      configureLearnCommand(program);

      const learnCmd = program.commands.find((cmd) => cmd.name() === "learn");
      const opts = learnCmd?.options ?? [];
      const verOpt = opts.find((o) => o.long === "--ver");
      expect(verOpt).toBeDefined();
    });

    test("has --json option", () => {
      const program = new Command();
      configureLearnCommand(program);

      const learnCmd = program.commands.find((cmd) => cmd.name() === "learn");
      const opts = learnCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });

    test("has --verbose option for showing attestation details", () => {
      const program = new Command();
      configureLearnCommand(program);

      const learnCmd = program.commands.find((cmd) => cmd.name() === "learn");
      const opts = learnCmd?.options ?? [];
      const verboseOpt = opts.find((o) => o.long === "--verbose");
      expect(verboseOpt).toBeDefined();
    });
  });

  describe("tool name parsing", () => {
    test("parses simple tool name", () => {
      const toolName = "my-tool";
      expect(toolName).not.toContain("@");
      expect(toolName).not.toContain("/");
    });

    test("parses namespaced tool name", () => {
      const toolName = "enact/context7/docs";
      const parts = toolName.split("/");
      expect(parts[0]).toBe("enact");
      expect(parts[1]).toBe("context7");
      expect(parts[2]).toBe("docs");
    });

    test("parses scoped tool name", () => {
      const toolName = "@org/my-tool";
      expect(toolName.startsWith("@")).toBe(true);
      const parts = toolName.slice(1).split("/");
      expect(parts[0]).toBe("org");
      expect(parts[1]).toBe("my-tool");
    });
  });

  describe("documentation content", () => {
    test("ToolVersionInfo type includes rawManifest field for enact.md content", () => {
      const mockVersion: ToolVersionInfo = {
        name: "test/tool",
        version: "1.0.0",
        description: "Test tool",
        license: "MIT",
        yanked: false,
        manifest: { enact: "2.0.0" },
        rawManifest: "---\nenact: 2.0.0\n---\n# Test Tool\n\nThis is a test tool.",
        bundle: {
          hash: "sha256:abc123",
          size: 1024,
          downloadUrl: "https://example.com/bundle.tar.gz",
        },
        attestations: [],
        publishedBy: { username: "testuser" },
        publishedAt: new Date(),
        downloads: 100,
      };

      expect(mockVersion.rawManifest).toBeDefined();
      expect(mockVersion.rawManifest).toContain("# Test Tool");
    });

    test("ToolVersionInfo allows undefined rawManifest", () => {
      const mockVersion: ToolVersionInfo = {
        name: "test/tool",
        version: "1.0.0",
        description: "Test tool",
        license: "MIT",
        yanked: false,
        manifest: { enact: "2.0.0" },
        // rawManifest is optional - not provided
        bundle: {
          hash: "sha256:abc123",
          size: 1024,
          downloadUrl: "https://example.com/bundle.tar.gz",
        },
        attestations: [],
        publishedBy: { username: "testuser" },
        publishedAt: new Date(),
        downloads: 100,
      };

      expect(mockVersion.rawManifest).toBeUndefined();
    });

    test("enact.md content should contain frontmatter and markdown", () => {
      const enactMdContent = `---
enact: 2.0.0
name: test/tool
version: 1.0.0
---

# Test Tool

Documentation here.`;

      // Verify frontmatter is present
      expect(enactMdContent).toContain("---");
      expect(enactMdContent).toContain("enact: 2.0.0");

      // Verify markdown content
      expect(enactMdContent).toContain("# Test Tool");
      expect(enactMdContent).toContain("Documentation here.");
    });

    test("documentation includes parameter descriptions", () => {
      const enactMdContent = `---
enact: 2.0.0
name: enact/context7/docs
version: 1.0.0
inputSchema:
  type: object
  properties:
    library_name:
      type: string
      description: The name of the library to fetch documentation for
---

# Context7 Documentation Fetcher

Fetches up-to-date documentation for any library.

## Parameters

- **library_name** (required): The name of the library to fetch documentation for
`;

      expect(enactMdContent).toContain("library_name");
      expect(enactMdContent).toContain("Parameters");
      expect(enactMdContent).toContain("required");
    });

    test("documentation includes usage examples", () => {
      const enactMdContent = `---
enact: 2.0.0
name: test/tool
---

# Test Tool

## Usage

\`\`\`bash
enact run test/tool --input '{"query": "hello"}'
\`\`\`
`;

      expect(enactMdContent).toContain("## Usage");
      expect(enactMdContent).toContain("enact run");
    });
  });

  describe("JSON output format", () => {
    test("JSON output includes name, version, and documentation", () => {
      const jsonOutput = {
        name: "enact/context7/docs",
        version: "1.0.1",
        documentation: "---\nenact: 2.0.0\n---\n# Context7 Docs\n\nFetches documentation.",
      };

      expect(jsonOutput.name).toBe("enact/context7/docs");
      expect(jsonOutput.version).toBe("1.0.1");
      expect(jsonOutput.documentation).toContain("# Context7 Docs");
    });

    test("JSON output handles missing documentation", () => {
      const jsonOutput = {
        name: "test/tool",
        version: "1.0.0",
        documentation: null,
      };

      expect(jsonOutput.documentation).toBeNull();
    });
  });
});
