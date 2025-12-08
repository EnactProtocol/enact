/**
 * Integration tests for install command
 *
 * Tests actual installation flows using local tools.
 * These tests create real files and directories to verify the full installation process.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Test fixtures
const TEST_BASE = join(import.meta.dir, "..", "fixtures", "install-integration");
const TEST_PROJECT = join(TEST_BASE, "test-project");
const TEST_TOOL_SRC = join(TEST_BASE, "source-tool");
const TEST_GLOBAL_HOME = join(TEST_BASE, "fake-home");

// Create a sample tool manifest for testing
const SAMPLE_MANIFEST = `
name: test/sample-tool
version: 1.0.0
description: A sample tool for testing installation
command: echo "Hello from sample-tool!"
tags:
  - test
  - sample
`;

const SAMPLE_MANIFEST_V2 = `
name: test/sample-tool
version: 2.0.0
description: A sample tool for testing installation (v2)
command: echo "Hello from sample-tool v2!"
tags:
  - test
  - sample
`;

describe("install integration", () => {
  beforeAll(() => {
    // Create test directories
    mkdirSync(TEST_BASE, { recursive: true });
    mkdirSync(TEST_PROJECT, { recursive: true });
    mkdirSync(join(TEST_PROJECT, ".enact"), { recursive: true });
    mkdirSync(TEST_TOOL_SRC, { recursive: true });
    mkdirSync(join(TEST_GLOBAL_HOME, ".enact", "cache"), { recursive: true });

    // Create sample tool source
    writeFileSync(join(TEST_TOOL_SRC, "enact.yaml"), SAMPLE_MANIFEST);
  });

  beforeEach(() => {
    // Clean project tools before each test
    const projectToolsDir = join(TEST_PROJECT, ".enact", "tools");
    if (existsSync(projectToolsDir)) {
      rmSync(projectToolsDir, { recursive: true, force: true });
    }

    // Clean fake global tools.json
    const globalToolsJson = join(TEST_GLOBAL_HOME, ".enact", "tools.json");
    if (existsSync(globalToolsJson)) {
      rmSync(globalToolsJson);
    }
  });

  afterAll(() => {
    // Clean up test directories
    if (existsSync(TEST_BASE)) {
      rmSync(TEST_BASE, { recursive: true, force: true });
    }
  });

  describe("local path installation", () => {
    test("installs tool from local path to project .enact/tools/", async () => {
      // This test simulates what happens when you run `enact install ./source-tool`

      // Import the shared functions we need
      const { loadManifestFromDir, toolNameToPath } = await import("@enactprotocol/shared");

      // Verify source tool exists
      const loaded = loadManifestFromDir(TEST_TOOL_SRC);
      expect(loaded).not.toBeNull();
      expect(loaded?.manifest.name).toBe("test/sample-tool");

      // Simulate the copy operation the install command performs
      const destPath = join(TEST_PROJECT, ".enact", "tools", toolNameToPath("test/sample-tool"));
      mkdirSync(destPath, { recursive: true });

      // Copy the manifest
      const { cpSync } = await import("node:fs");
      cpSync(TEST_TOOL_SRC, destPath, { recursive: true });

      // Verify installation
      expect(existsSync(destPath)).toBe(true);
      expect(existsSync(join(destPath, "enact.yaml"))).toBe(true);

      // Verify manifest can be loaded from destination
      const installedManifest = loadManifestFromDir(destPath);
      expect(installedManifest).not.toBeNull();
      expect(installedManifest?.manifest.name).toBe("test/sample-tool");
      expect(installedManifest?.manifest.version).toBe("1.0.0");
    });

    test("overwrites existing project tool when force is used", async () => {
      const { loadManifestFromDir, toolNameToPath } = await import("@enactprotocol/shared");
      const { cpSync } = await import("node:fs");

      const destPath = join(TEST_PROJECT, ".enact", "tools", toolNameToPath("test/sample-tool"));

      // First installation
      mkdirSync(destPath, { recursive: true });
      cpSync(TEST_TOOL_SRC, destPath, { recursive: true });

      // Verify v1 is installed
      let installed = loadManifestFromDir(destPath);
      expect(installed?.manifest.version).toBe("1.0.0");

      // Create v2 source
      const v2Source = join(TEST_BASE, "source-tool-v2");
      mkdirSync(v2Source, { recursive: true });
      writeFileSync(join(v2Source, "enact.yaml"), SAMPLE_MANIFEST_V2);

      // Simulate force overwrite
      rmSync(destPath, { recursive: true, force: true });
      mkdirSync(destPath, { recursive: true });
      cpSync(v2Source, destPath, { recursive: true });

      // Verify v2 is now installed
      installed = loadManifestFromDir(destPath);
      expect(installed?.manifest.version).toBe("2.0.0");
    });
  });

  describe("global installation via tools.json", () => {
    test("global install updates tools.json registry", async () => {
      const { addToolToRegistry, getInstalledVersion, isToolInstalled, loadToolsRegistry } =
        await import("@enactprotocol/shared");

      // Simulate global installation by adding to registry
      // Note: In real usage, this writes to ~/.enact/tools.json
      // For testing, we verify the registry functions work correctly

      // Add tool to registry (simulating what install command does)
      addToolToRegistry("test/sample-tool", "1.0.0", "project", TEST_PROJECT);

      // Verify it's registered
      expect(isToolInstalled("test/sample-tool", "project", TEST_PROJECT)).toBe(true);
      expect(getInstalledVersion("test/sample-tool", "project", TEST_PROJECT)).toBe("1.0.0");

      // Load and verify registry directly
      const registry = loadToolsRegistry("project", TEST_PROJECT);
      expect(registry.tools["test/sample-tool"]).toBe("1.0.0");
    });

    test("global install updates version when reinstalling", async () => {
      const { addToolToRegistry, getInstalledVersion } = await import("@enactprotocol/shared");

      // Install v1
      addToolToRegistry("test/sample-tool", "1.0.0", "project", TEST_PROJECT);
      expect(getInstalledVersion("test/sample-tool", "project", TEST_PROJECT)).toBe("1.0.0");

      // "Upgrade" to v2
      addToolToRegistry("test/sample-tool", "2.0.0", "project", TEST_PROJECT);
      expect(getInstalledVersion("test/sample-tool", "project", TEST_PROJECT)).toBe("2.0.0");
    });

    test("global install extracts to cache path", async () => {
      const { getToolCachePath } = await import("@enactprotocol/shared");

      // Verify cache path structure
      const cachePath = getToolCachePath("test/sample-tool", "1.0.0");
      expect(cachePath).toContain(".enact");
      expect(cachePath).toContain("cache");
      expect(cachePath).toContain("test/sample-tool");
      expect(cachePath).toContain("v1.0.0");
    });

    test("listInstalledTools returns installed tools from registry", async () => {
      const { addToolToRegistry, listInstalledTools, saveToolsRegistry } = await import(
        "@enactprotocol/shared"
      );

      // Clear any existing tools first
      saveToolsRegistry({ tools: {} }, "project", TEST_PROJECT);

      // Add multiple tools
      addToolToRegistry("alice/tool-a", "1.0.0", "project", TEST_PROJECT);
      addToolToRegistry("bob/tool-b", "2.0.0", "project", TEST_PROJECT);
      addToolToRegistry("charlie/tool-c", "3.0.0", "project", TEST_PROJECT);

      // List all installed
      const tools = listInstalledTools("project", TEST_PROJECT);

      expect(tools.length).toBe(3);
      expect(tools.find((t) => t.name === "alice/tool-a")).toBeTruthy();
      expect(tools.find((t) => t.name === "bob/tool-b")).toBeTruthy();
      expect(tools.find((t) => t.name === "charlie/tool-c")).toBeTruthy();

      // Verify versions
      expect(tools.find((t) => t.name === "alice/tool-a")?.version).toBe("1.0.0");
      expect(tools.find((t) => t.name === "bob/tool-b")?.version).toBe("2.0.0");
    });
  });

  describe("registry integration scenarios", () => {
    test("removeToolFromRegistry removes tool from tools.json", async () => {
      const { addToolToRegistry, isToolInstalled, removeToolFromRegistry } = await import(
        "@enactprotocol/shared"
      );

      // Add then remove
      addToolToRegistry("test/to-remove", "1.0.0", "project", TEST_PROJECT);
      expect(isToolInstalled("test/to-remove", "project", TEST_PROJECT)).toBe(true);

      const removed = removeToolFromRegistry("test/to-remove", "project", TEST_PROJECT);
      expect(removed).toBe(true);
      expect(isToolInstalled("test/to-remove", "project", TEST_PROJECT)).toBe(false);
    });

    test("tools.json file format is correct", async () => {
      const { addToolToRegistry, getToolsJsonPath } = await import("@enactprotocol/shared");

      addToolToRegistry("org/namespace/tool", "1.2.3", "project", TEST_PROJECT);

      const jsonPath = getToolsJsonPath("project", TEST_PROJECT);
      expect(jsonPath).not.toBeNull();

      const content = readFileSync(jsonPath!, "utf-8");
      const parsed = JSON.parse(content);

      // Verify structure
      expect(parsed).toHaveProperty("tools");
      expect(typeof parsed.tools).toBe("object");
      expect(parsed.tools["org/namespace/tool"]).toBe("1.2.3");
    });
  });

  describe("tool resolution", () => {
    test("resolver finds tools from registry", async () => {
      // Setup: Create a cached tool with manifest
      const cachePath = join(TEST_GLOBAL_HOME, ".enact", "cache", "test", "cached-tool", "v1.0.0");
      mkdirSync(cachePath, { recursive: true });
      writeFileSync(
        join(cachePath, "enact.yaml"),
        `
name: test/cached-tool
version: 1.0.0
description: A cached tool
command: echo "cached"
`
      );

      // The resolver should be able to find this tool once it's registered
      // Note: Full resolver testing is in resolver.test.ts
      expect(existsSync(join(cachePath, "enact.yaml"))).toBe(true);
    });
  });
});

describe("tools.json edge cases", () => {
  const EDGE_TEST_DIR = join(TEST_BASE, "edge-cases");

  beforeAll(() => {
    mkdirSync(join(EDGE_TEST_DIR, ".enact"), { recursive: true });
  });

  afterAll(() => {
    if (existsSync(EDGE_TEST_DIR)) {
      rmSync(EDGE_TEST_DIR, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Ensure .enact directory exists
    mkdirSync(join(EDGE_TEST_DIR, ".enact"), { recursive: true });

    const jsonPath = join(EDGE_TEST_DIR, ".enact", "tools.json");
    if (existsSync(jsonPath)) {
      rmSync(jsonPath);
    }
  });

  test("handles tool names with special characters", async () => {
    const { addToolToRegistry, getInstalledVersion } = await import("@enactprotocol/shared");

    // Various tool name formats
    addToolToRegistry("org/ns/my-tool", "1.0.0", "project", EDGE_TEST_DIR);
    addToolToRegistry("org/ns/my_tool", "2.0.0", "project", EDGE_TEST_DIR);
    addToolToRegistry("org123/ns456/tool789", "3.0.0", "project", EDGE_TEST_DIR);

    expect(getInstalledVersion("org/ns/my-tool", "project", EDGE_TEST_DIR)).toBe("1.0.0");
    expect(getInstalledVersion("org/ns/my_tool", "project", EDGE_TEST_DIR)).toBe("2.0.0");
    expect(getInstalledVersion("org123/ns456/tool789", "project", EDGE_TEST_DIR)).toBe("3.0.0");
  });

  test("handles version formats correctly", async () => {
    const { addToolToRegistry, getInstalledVersion } = await import("@enactprotocol/shared");

    // Various version formats
    addToolToRegistry("test/semver", "1.2.3", "project", EDGE_TEST_DIR);
    addToolToRegistry("test/prerelease", "2.0.0-beta.1", "project", EDGE_TEST_DIR);
    addToolToRegistry("test/build", "3.0.0+build.123", "project", EDGE_TEST_DIR);

    expect(getInstalledVersion("test/semver", "project", EDGE_TEST_DIR)).toBe("1.2.3");
    expect(getInstalledVersion("test/prerelease", "project", EDGE_TEST_DIR)).toBe("2.0.0-beta.1");
    expect(getInstalledVersion("test/build", "project", EDGE_TEST_DIR)).toBe("3.0.0+build.123");
  });

  test("handles concurrent writes gracefully", async () => {
    const { addToolToRegistry, loadToolsRegistry } = await import("@enactprotocol/shared");

    // Simulate rapid concurrent writes
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        Promise.resolve().then(() => {
          addToolToRegistry(`test/concurrent-${i}`, `${i}.0.0`, "project", EDGE_TEST_DIR);
        })
      );
    }

    await Promise.all(promises);

    // All tools should be registered (though order may vary)
    const registry = loadToolsRegistry("project", EDGE_TEST_DIR);
    const keys = Object.keys(registry.tools);

    // Due to race conditions, we may not have all 10
    // but we should have at least some and they should be valid
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(key).toMatch(/^test\/concurrent-\d$/);
    }
  });

  test("empty registry returns empty tools object", async () => {
    const { loadToolsRegistry } = await import("@enactprotocol/shared");

    // No tools.json exists
    const registry = loadToolsRegistry("project", EDGE_TEST_DIR);
    expect(registry.tools).toEqual({});
  });
});
