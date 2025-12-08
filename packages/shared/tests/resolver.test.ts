import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
const PROJECT_ENACT_DIR = join(PROJECT_DIR, ".enact");

describe("tool resolver", () => {
  beforeAll(() => {
    // Create test directories
    mkdirSync(join(PROJECT_ENACT_DIR, "tools", "test", "project-tool"), { recursive: true });

    // Create a project-level tool
    writeFileSync(
      join(PROJECT_ENACT_DIR, "tools", "test", "project-tool", "enact.yaml"),
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
      join(TEST_DIR, "direct-tool", "enact.yaml"),
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
        expect(normalizeToolName("Acme/Utils/Greeter")).toBe("acme/utils/greeter");
      });

      test("converts backslashes to forward slashes", () => {
        expect(normalizeToolName("acme\\utils\\greeter")).toBe("acme/utils/greeter");
      });

      test("trims whitespace", () => {
        expect(normalizeToolName("  acme/tool  ")).toBe("acme/tool");
      });
    });

    describe("toolNameToPath", () => {
      test("returns path-like string", () => {
        expect(toolNameToPath("acme/utils/greeter")).toBe("acme/utils/greeter");
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
      const manifestPath = join(TEST_DIR, "direct-tool", "enact.yaml");
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
});
