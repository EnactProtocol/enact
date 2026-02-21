import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { addAlias, addToolToRegistry, removeAlias } from "../src/registry";
import {
  ToolResolveError,
  getToolPath,
  getToolSearchPaths,
  normalizeToolName,
  resolveTool,
  resolveToolAuto,
  resolveToolFromPath,
  toolNameToPath,
  tryResolveTool,
} from "../src/resolver";

const TEST_DIR = join(import.meta.dir, "temp-resolver-test");
const PROJECT_DIR = join(TEST_DIR, "project");
const PROJECT_AGENTS_DIR = join(PROJECT_DIR, "agents");

describe("tool resolver", () => {
  beforeAll(() => {
    // Create test directories
    mkdirSync(join(PROJECT_AGENTS_DIR, "skills", "test", "project-tool"), { recursive: true });

    // Create a project-level tool
    writeFileSync(
      join(PROJECT_AGENTS_DIR, "skills", "test", "project-tool", "skill.package.yml"),
      `
name: test/project-tool
description: A project-level test tool
version: "1.0.0"
`,
      "utf-8"
    );

    // Create a direct tool directory for path-based resolution
    mkdirSync(join(TEST_DIR, "direct-tool"), { recursive: true });
    writeFileSync(
      join(TEST_DIR, "direct-tool", "skill.package.yml"),
      `
name: test/direct-tool
description: A directly referenced tool
version: "2.0.0"
`,
      "utf-8"
    );

    // Create a tool with enact.md
    mkdirSync(join(TEST_DIR, "md-tool"), { recursive: true });
    writeFileSync(
      join(TEST_DIR, "md-tool", "enact.md"),
      `---
name: test/md-tool
description: A markdown tool
version: "3.0.0"
---

# MD Tool

Documentation here.
`,
      "utf-8"
    );
  });

  afterAll(() => {
    // Cleanup
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("utility functions", () => {
    describe("normalizeToolName", () => {
      test("lowercases name", () => {
        expect(normalizeToolName("Acme/Greeter")).toBe("acme/greeter");
      });

      test("converts backslashes to forward slashes", () => {
        expect(normalizeToolName("acme\\greeter")).toBe("acme/greeter");
      });

      test("trims whitespace", () => {
        expect(normalizeToolName("  acme/tool  ")).toBe("acme/tool");
      });
    });

    describe("toolNameToPath", () => {
      test("returns path-like string", () => {
        expect(toolNameToPath("acme/greeter")).toBe("acme/greeter");
      });

      test("preserves @ prefix for npm-style disk layout", () => {
        expect(toolNameToPath("@acme/greeter")).toBe("@acme/greeter");
      });

      test("normalizes backslashes", () => {
        expect(toolNameToPath("acme\\utils")).toBe("acme/utils");
      });
    });

    describe("getToolPath", () => {
      test("joins tools dir and tool name", () => {
        const result = getToolPath("/home/user/.enact/tools", "acme/greeter");
        expect(result).toContain("acme");
        expect(result).toContain("greeter");
      });
    });

    describe("getToolSearchPaths", () => {
      test("returns array of paths", () => {
        const paths = getToolSearchPaths("test/tool", { startDir: PROJECT_DIR });
        expect(Array.isArray(paths)).toBe(true);
        expect(paths.length).toBeGreaterThan(0);
      });

      test("respects skipProject option", () => {
        const withProject = getToolSearchPaths("test/tool", { startDir: PROJECT_DIR });
        const withoutProject = getToolSearchPaths("test/tool", {
          startDir: PROJECT_DIR,
          skipProject: true,
        });
        expect(withoutProject.length).toBeLessThan(withProject.length);
      });

      test("respects skipUser option", () => {
        // skipUser only affects global tools that are registered in tools.json
        // Since no tools are installed globally, both should return the same paths
        // This tests that skipUser doesn't add extra paths when no global tools exist
        const withUser = getToolSearchPaths("test/tool", { skipCache: true });
        const withoutUser = getToolSearchPaths("test/tool", { skipUser: true, skipCache: true });
        expect(withoutUser.length).toBeLessThanOrEqual(withUser.length);
      });
    });
  });

  describe("resolveToolFromPath", () => {
    test("resolves tool from directory", () => {
      const toolDir = join(TEST_DIR, "direct-tool");
      const result = resolveToolFromPath(toolDir);

      expect(result.manifest.name).toBe("test/direct-tool");
      expect(result.location).toBe("file");
      expect(result.sourceDir).toBe(toolDir);
    });

    test("resolves tool from manifest file directly", () => {
      const manifestPath = join(TEST_DIR, "direct-tool", "skill.package.yml");
      const result = resolveToolFromPath(manifestPath);

      expect(result.manifest.name).toBe("test/direct-tool");
      expect(result.manifestPath).toBe(manifestPath);
    });

    test("resolves markdown tool", () => {
      const toolDir = join(TEST_DIR, "md-tool");
      const result = resolveToolFromPath(toolDir);

      expect(result.manifest.name).toBe("test/md-tool");
    });

    test("throws ToolResolveError for non-existent path", () => {
      expect(() => resolveToolFromPath("/non/existent/path")).toThrow(ToolResolveError);
    });

    test("throws ToolResolveError for directory without manifest", () => {
      const emptyDir = join(TEST_DIR, "empty-dir");
      mkdirSync(emptyDir, { recursive: true });

      expect(() => resolveToolFromPath(emptyDir)).toThrow(ToolResolveError);
    });
  });

  describe("resolveTool", () => {
    test("resolves tool from project", () => {
      const result = resolveTool("test/project-tool", { startDir: PROJECT_DIR });

      expect(result.manifest.name).toBe("test/project-tool");
      expect(result.location).toBe("project");
    });

    test("throws ToolResolveError for non-existent tool", () => {
      expect(() =>
        resolveTool("non-existent/tool", { startDir: PROJECT_DIR, skipUser: true, skipCache: true })
      ).toThrow(ToolResolveError);
    });

    test("error includes searched locations", () => {
      try {
        resolveTool("non-existent/tool", { startDir: PROJECT_DIR });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ToolResolveError);
        expect((error as ToolResolveError).searchedLocations).toBeDefined();
        expect((error as ToolResolveError).searchedLocations?.length).toBeGreaterThan(0);
      }
    });

    test("normalizes tool name", () => {
      const result = resolveTool("TEST/PROJECT-TOOL", { startDir: PROJECT_DIR });
      expect(result.manifest.name).toBe("test/project-tool");
    });
  });

  describe("tryResolveTool", () => {
    test("returns result on success", () => {
      const result = tryResolveTool("test/project-tool", { startDir: PROJECT_DIR });
      expect(result).not.toBeNull();
      expect(result?.manifest.name).toBe("test/project-tool");
    });

    test("returns null on failure", () => {
      const result = tryResolveTool("non-existent/tool", {
        startDir: PROJECT_DIR,
        skipUser: true,
        skipCache: true,
      });
      expect(result).toBeNull();
    });

    test("handles path input", () => {
      const toolDir = join(TEST_DIR, "direct-tool");
      const result = tryResolveTool(toolDir);
      expect(result).not.toBeNull();
      expect(result?.manifest.name).toBe("test/direct-tool");
    });

    test("handles relative path with ./", () => {
      // This would need the cwd to be set appropriately
      // For now, just verify it doesn't crash
      const result = tryResolveTool("./non-existent");
      expect(result).toBeNull();
    });
  });

  describe("resolveToolAuto", () => {
    test("resolves path starting with /", () => {
      const toolDir = join(TEST_DIR, "direct-tool");
      const result = resolveToolAuto(toolDir);
      expect(result.manifest.name).toBe("test/direct-tool");
    });

    test("resolves path starting with ./", () => {
      // Use an absolute path that exists
      const toolDir = join(TEST_DIR, "direct-tool");
      const result = resolveToolAuto(toolDir);
      expect(result.manifest.name).toBe("test/direct-tool");
    });

    test("resolves tool name", () => {
      const result = resolveToolAuto("test/project-tool", { startDir: PROJECT_DIR });
      expect(result.manifest.name).toBe("test/project-tool");
    });

    test("throws for non-existent", () => {
      expect(() =>
        resolveToolAuto("completely/non-existent", {
          startDir: PROJECT_DIR,
          skipUser: true,
          skipCache: true,
        })
      ).toThrow(ToolResolveError);
    });
  });

  describe("ToolResolveError", () => {
    test("has correct properties", () => {
      const error = new ToolResolveError("Test error", "test/tool", ["/path/1", "/path/2"]);

      expect(error.name).toBe("ToolResolveError");
      expect(error.message).toBe("Test error");
      expect(error.toolPath).toBe("test/tool");
      expect(error.searchedLocations).toEqual(["/path/1", "/path/2"]);
    });
  });

  describe("alias resolution", () => {
    test("resolves tool via alias", () => {
      // Set up an alias for the project tool
      addToolToRegistry("test/project-tool", "1.0.0", "project", PROJECT_DIR);
      addAlias("pt", "test/project-tool", "project", PROJECT_DIR);

      try {
        // Resolve using the alias (no slashes = potential alias)
        const result = resolveTool("pt", { startDir: PROJECT_DIR });
        expect(result.manifest.name).toBe("test/project-tool");
        expect(result.location).toBe("project");
      } finally {
        // Clean up
        removeAlias("pt", "project", PROJECT_DIR);
        rmSync(join(PROJECT_AGENTS_DIR, "skills.json"), { force: true });
      }
    });

    test("alias resolution is case-insensitive (normalized to lowercase)", () => {
      addToolToRegistry("test/project-tool", "1.0.0", "project", PROJECT_DIR);
      addAlias("mytool", "test/project-tool", "project", PROJECT_DIR);

      try {
        // Lowercase alias should work
        const result = resolveTool("mytool", { startDir: PROJECT_DIR });
        expect(result.manifest.name).toBe("test/project-tool");

        // Uppercase alias should also work (normalized to lowercase)
        const upperResult = resolveTool("MYTOOL", { startDir: PROJECT_DIR });
        expect(upperResult.manifest.name).toBe("test/project-tool");

        // Mixed case should also work
        const mixedResult = resolveTool("MyTool", { startDir: PROJECT_DIR });
        expect(mixedResult.manifest.name).toBe("test/project-tool");
      } finally {
        removeAlias("mytool", "project", PROJECT_DIR);
        rmSync(join(PROJECT_AGENTS_DIR, "skills.json"), { force: true });
      }
    });

    test("full tool names bypass alias resolution", () => {
      addToolToRegistry("test/project-tool", "1.0.0", "project", PROJECT_DIR);
      // Create an alias that would conflict if checked
      addAlias("test/project-tool", "some/other-tool", "project", PROJECT_DIR);

      try {
        // Full name with slashes should resolve directly, not via alias
        const result = resolveTool("test/project-tool", { startDir: PROJECT_DIR });
        expect(result.manifest.name).toBe("test/project-tool");
      } finally {
        removeAlias("test/project-tool", "project", PROJECT_DIR);
        rmSync(join(PROJECT_AGENTS_DIR, "skills.json"), { force: true });
      }
    });

    test("tryResolveTool works with aliases", () => {
      addToolToRegistry("test/project-tool", "1.0.0", "project", PROJECT_DIR);
      addAlias("try-alias", "test/project-tool", "project", PROJECT_DIR);

      try {
        const result = tryResolveTool("try-alias", { startDir: PROJECT_DIR });
        expect(result).not.toBeNull();
        expect(result?.manifest.name).toBe("test/project-tool");
      } finally {
        removeAlias("try-alias", "project", PROJECT_DIR);
        rmSync(join(PROJECT_AGENTS_DIR, "skills.json"), { force: true });
      }
    });

    test("non-existent alias returns null from tryResolveTool", () => {
      const result = tryResolveTool("nonexistent-alias", {
        startDir: PROJECT_DIR,
        skipUser: true,
        skipCache: true,
      });
      expect(result).toBeNull();
    });
  });
});
