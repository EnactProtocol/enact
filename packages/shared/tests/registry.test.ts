/**
 * Tests for the local tool registry (tools.json management)
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  addToolToRegistry,
  getInstalledVersion,
  getToolCachePath,
  getToolsJsonPath,
  isToolInstalled,
  listInstalledTools,
  loadToolsRegistry,
  removeToolFromRegistry,
  saveToolsRegistry,
} from "../src/registry";

const TEST_DIR = join(import.meta.dir, "temp-registry-test");
const PROJECT_DIR = join(TEST_DIR, "project");
const PROJECT_ENACT_DIR = join(PROJECT_DIR, ".enact");

describe("registry", () => {
  beforeAll(() => {
    // Create test directory structure
    mkdirSync(PROJECT_ENACT_DIR, { recursive: true });
  });

  afterAll(() => {
    // Clean up test directories
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("getToolsJsonPath", () => {
    test("returns path for global scope", () => {
      const path = getToolsJsonPath("global");
      expect(path).not.toBeNull();
      expect(path).toContain(".enact");
      expect(path).toEndWith("tools.json");
    });

    test("returns path for project scope when .enact exists", () => {
      const path = getToolsJsonPath("project", PROJECT_DIR);
      expect(path).not.toBeNull();
      expect(path).toContain(PROJECT_ENACT_DIR);
      expect(path).toEndWith("tools.json");
    });

    test("returns null for project scope when no .enact", () => {
      const path = getToolsJsonPath("project", "/tmp/nonexistent-test-path");
      expect(path).toBeNull();
    });
  });

  describe("loadToolsRegistry", () => {
    test("returns empty registry when file does not exist", () => {
      // Ensure tools.json doesn't exist from previous tests
      const toolsJsonPath = join(PROJECT_ENACT_DIR, "tools.json");
      if (existsSync(toolsJsonPath)) {
        rmSync(toolsJsonPath);
      }
      const registry = loadToolsRegistry("project", PROJECT_DIR);
      expect(registry.tools).toEqual({});
    });

    test("loads existing registry", () => {
      // Create a test registry file
      const registryPath = join(PROJECT_ENACT_DIR, "tools.json");
      writeFileSync(
        registryPath,
        JSON.stringify({
          tools: {
            "test/tool": "1.0.0",
            "other/tool": "2.0.0",
          },
        })
      );

      const registry = loadToolsRegistry("project", PROJECT_DIR);
      expect(registry.tools["test/tool"]).toBe("1.0.0");
      expect(registry.tools["other/tool"]).toBe("2.0.0");

      // Clean up
      rmSync(registryPath);
    });

    test("returns empty registry on parse error", () => {
      const registryPath = join(PROJECT_ENACT_DIR, "tools.json");
      writeFileSync(registryPath, "invalid json");

      const registry = loadToolsRegistry("project", PROJECT_DIR);
      expect(registry.tools).toEqual({});

      // Clean up
      rmSync(registryPath);
    });
  });

  describe("saveToolsRegistry", () => {
    test("saves registry to file", () => {
      const registry = {
        tools: {
          "test/save": "1.0.0",
        },
      };

      saveToolsRegistry(registry, "project", PROJECT_DIR);

      const registryPath = join(PROJECT_ENACT_DIR, "tools.json");
      expect(existsSync(registryPath)).toBe(true);

      const loaded = loadToolsRegistry("project", PROJECT_DIR);
      expect(loaded.tools["test/save"]).toBe("1.0.0");

      // Clean up
      rmSync(registryPath);
    });
  });

  describe("addToolToRegistry", () => {
    test("adds tool to registry", () => {
      addToolToRegistry("test/add", "1.0.0", "project", PROJECT_DIR);

      const registry = loadToolsRegistry("project", PROJECT_DIR);
      expect(registry.tools["test/add"]).toBe("1.0.0");

      // Clean up
      rmSync(join(PROJECT_ENACT_DIR, "tools.json"));
    });

    test("updates existing tool version", () => {
      addToolToRegistry("test/update", "1.0.0", "project", PROJECT_DIR);
      addToolToRegistry("test/update", "2.0.0", "project", PROJECT_DIR);

      const registry = loadToolsRegistry("project", PROJECT_DIR);
      expect(registry.tools["test/update"]).toBe("2.0.0");

      // Clean up
      rmSync(join(PROJECT_ENACT_DIR, "tools.json"));
    });
  });

  describe("removeToolFromRegistry", () => {
    test("removes tool from registry", () => {
      addToolToRegistry("test/remove", "1.0.0", "project", PROJECT_DIR);
      const removed = removeToolFromRegistry("test/remove", "project", PROJECT_DIR);

      expect(removed).toBe(true);

      const registry = loadToolsRegistry("project", PROJECT_DIR);
      expect(registry.tools["test/remove"]).toBeUndefined();

      // Clean up
      rmSync(join(PROJECT_ENACT_DIR, "tools.json"));
    });

    test("returns false for non-existent tool", () => {
      const removed = removeToolFromRegistry("nonexistent/tool", "project", PROJECT_DIR);
      expect(removed).toBe(false);
    });
  });

  describe("isToolInstalled", () => {
    test("returns true for installed tool", () => {
      addToolToRegistry("test/installed", "1.0.0", "project", PROJECT_DIR);
      expect(isToolInstalled("test/installed", "project", PROJECT_DIR)).toBe(true);

      // Clean up
      rmSync(join(PROJECT_ENACT_DIR, "tools.json"));
    });

    test("returns false for non-installed tool", () => {
      expect(isToolInstalled("not/installed", "project", PROJECT_DIR)).toBe(false);
    });
  });

  describe("getInstalledVersion", () => {
    test("returns version for installed tool", () => {
      addToolToRegistry("test/version", "3.0.0", "project", PROJECT_DIR);
      const version = getInstalledVersion("test/version", "project", PROJECT_DIR);
      expect(version).toBe("3.0.0");

      // Clean up
      rmSync(join(PROJECT_ENACT_DIR, "tools.json"));
    });

    test("returns null for non-installed tool", () => {
      const version = getInstalledVersion("not/installed", "project", PROJECT_DIR);
      expect(version).toBeNull();
    });
  });

  describe("getToolCachePath", () => {
    test("returns cache path with version", () => {
      const path = getToolCachePath("org/tool", "1.0.0");
      expect(path).toContain(".enact");
      expect(path).toContain("cache");
      expect(path).toContain("org/tool");
      expect(path).toContain("v1.0.0");
    });

    test("normalizes version prefix", () => {
      const pathWithV = getToolCachePath("org/tool", "v1.0.0");
      const pathWithoutV = getToolCachePath("org/tool", "1.0.0");
      expect(pathWithV).toBe(pathWithoutV);
    });
  });

  describe("listInstalledTools", () => {
    test("returns list of installed tools", () => {
      addToolToRegistry("test/list1", "1.0.0", "project", PROJECT_DIR);
      addToolToRegistry("test/list2", "2.0.0", "project", PROJECT_DIR);

      const tools = listInstalledTools("project", PROJECT_DIR);
      expect(tools.length).toBe(2);
      expect(tools.find((t) => t.name === "test/list1")).toBeTruthy();
      expect(tools.find((t) => t.name === "test/list2")).toBeTruthy();

      // Clean up
      rmSync(join(PROJECT_ENACT_DIR, "tools.json"));
    });

    test("returns empty list when no tools installed", () => {
      const tools = listInstalledTools("project", PROJECT_DIR);
      expect(tools.length).toBe(0);
    });
  });
});
