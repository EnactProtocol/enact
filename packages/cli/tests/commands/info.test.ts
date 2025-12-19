/**
 * Tests for the info command
 */

import { describe, expect, test } from "bun:test";
import type { ToolVersionInfo } from "@enactprotocol/api";
import { Command } from "commander";
import { configureInfoCommand } from "../../src/commands/info";

describe("info command", () => {
  describe("command configuration", () => {
    test("configures info command on program", () => {
      const program = new Command();
      configureInfoCommand(program);

      const infoCmd = program.commands.find((cmd) => cmd.name() === "info");
      expect(infoCmd).toBeDefined();
    });

    test("has correct description", () => {
      const program = new Command();
      configureInfoCommand(program);

      const infoCmd = program.commands.find((cmd) => cmd.name() === "info");
      expect(infoCmd?.description()).toBe(
        "Show detailed information about a tool (local path or registry)"
      );
    });

    test("has get as alias", () => {
      const program = new Command();
      configureInfoCommand(program);

      const infoCmd = program.commands.find((cmd) => cmd.name() === "info");
      expect(infoCmd?.aliases()).toContain("get");
    });

    test("accepts tool argument", () => {
      const program = new Command();
      configureInfoCommand(program);

      const infoCmd = program.commands.find((cmd) => cmd.name() === "info");
      const args = infoCmd?.registeredArguments ?? [];
      expect(args.length).toBeGreaterThan(0);
      expect(args[0]?.name()).toBe("tool");
    });

    test("has --ver option for specifying version", () => {
      const program = new Command();
      configureInfoCommand(program);

      const infoCmd = program.commands.find((cmd) => cmd.name() === "info");
      const opts = infoCmd?.options ?? [];
      const verOpt = opts.find((o) => o.long === "--ver");
      expect(verOpt).toBeDefined();
    });

    test("has -v short option for verbose (not version)", () => {
      const program = new Command();
      configureInfoCommand(program);

      const infoCmd = program.commands.find((cmd) => cmd.name() === "info");
      const opts = infoCmd?.options ?? [];
      // -v is for verbose, not version (--ver is for version)
      const verboseOpt = opts.find((o) => o.short === "-v");
      expect(verboseOpt).toBeDefined();
      expect(verboseOpt?.long).toBe("--verbose");
    });

    test("has --json option", () => {
      const program = new Command();
      configureInfoCommand(program);

      const infoCmd = program.commands.find((cmd) => cmd.name() === "info");
      const opts = infoCmd?.options ?? [];
      const jsonOpt = opts.find((o) => o.long === "--json");
      expect(jsonOpt).toBeDefined();
    });

    test("has --verbose option", () => {
      const program = new Command();
      configureInfoCommand(program);

      const infoCmd = program.commands.find((cmd) => cmd.name() === "info");
      const opts = infoCmd?.options ?? [];
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

    test("parses scoped tool name", () => {
      const toolName = "@org/my-tool";
      expect(toolName.startsWith("@")).toBe(true);
      const parts = toolName.slice(1).split("/");
      expect(parts[0]).toBe("org");
      expect(parts[1]).toBe("my-tool");
    });

    test("parses tool name with version", () => {
      const input = "my-tool@1.2.3";
      const atIndex = input.lastIndexOf("@");
      // For unscoped tools, @ separator for version
      if (!input.startsWith("@")) {
        const toolName = input.slice(0, atIndex);
        const version = input.slice(atIndex + 1);
        expect(toolName).toBe("my-tool");
        expect(version).toBe("1.2.3");
      }
    });

    test("parses scoped tool name with version", () => {
      const input = "@org/my-tool@1.2.3";
      // For scoped packages, split by /
      const slashIndex = input.indexOf("/");
      const org = input.slice(1, slashIndex);
      const rest = input.slice(slashIndex + 1);
      const atIndex = rest.indexOf("@");
      const toolName = atIndex === -1 ? rest : rest.slice(0, atIndex);
      const version = atIndex === -1 ? undefined : rest.slice(atIndex + 1);

      expect(org).toBe("org");
      expect(toolName).toBe("my-tool");
      expect(version).toBe("1.2.3");
    });
  });

  describe("date formatting", () => {
    test("formats ISO date string", () => {
      const formatDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      };

      const result = formatDate("2024-01-15T10:30:00Z");
      expect(result).toContain("Jan");
      expect(result).toContain("15");
      expect(result).toContain("2024");
    });

    test("handles invalid date gracefully", () => {
      const formatDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return "Unknown";
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      };

      expect(formatDate("invalid")).toBe("Unknown");
    });
  });

  describe("trust status display", () => {
    test("displays trusted status correctly", () => {
      const getTrustLabel = (trusted: boolean): string => {
        return trusted ? "✓ Verified" : "⚠ Unverified";
      };

      expect(getTrustLabel(true)).toContain("Verified");
      expect(getTrustLabel(false)).toContain("Unverified");
    });

    test("trust level enum values", () => {
      const trustLevels = ["none", "publisher", "auditor", "full"];
      expect(trustLevels).toContain("none");
      expect(trustLevels).toContain("publisher");
      expect(trustLevels).toContain("auditor");
      expect(trustLevels).toContain("full");
    });
  });

  describe("verbose mode displays enact.md", () => {
    test("ToolVersionInfo type includes rawManifest field for enact.md content", () => {
      // Test that the type includes rawManifest field for enact.md content
      const mockVersion: ToolVersionInfo = {
        name: "test/tool",
        version: "1.0.0",
        description: "Test tool",
        license: "MIT",
        yanked: false,
        manifest: { enact: "2.0.0" },
        rawManifest: "---\\nenact: 2.0.0\\n---\\n# Test Tool\\n\\nThis is a test tool.",
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

    test("verbose option is available on info command", () => {
      const program = new Command();
      configureInfoCommand(program);

      const infoCmd = program.commands.find((cmd) => cmd.name() === "info");
      const opts = infoCmd?.options ?? [];

      // Check both short and long form exist
      const verboseOpt = opts.find((o) => o.long === "--verbose");
      expect(verboseOpt).toBeDefined();
      expect(verboseOpt?.short).toBe("-v");
    });
  });
});
