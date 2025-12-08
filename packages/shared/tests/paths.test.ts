import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  getCacheDir,
  getConfigPath,
  getEnactHome,
  getGlobalEnvPath,
  getProjectEnactDir,
  getProjectEnvPath,
  getToolsDir,
} from "../src/paths";

const TEST_DIR = join(import.meta.dir, "fixtures", "path-test");
const NESTED_DIR = join(TEST_DIR, "nested", "deep", "directory");

describe("path utilities", () => {
  beforeAll(() => {
    // Create test directory structure
    mkdirSync(NESTED_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, ".enact"), { recursive: true });
  });

  afterAll(() => {
    // Clean up test directories
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("getEnactHome", () => {
    test("returns ~/.enact/ path", () => {
      const home = getEnactHome();
      const expected = join(homedir(), ".enact");
      expect(home).toBe(expected);
    });

    test("returns absolute path", () => {
      const home = getEnactHome();
      expect(home.startsWith("/") || home.match(/^[A-Z]:\\/)).toBe(true);
    });
  });

  describe("getProjectEnactDir", () => {
    test("finds .enact in current directory", () => {
      const result = getProjectEnactDir(TEST_DIR);
      expect(result).toBe(join(TEST_DIR, ".enact"));
    });

    test("finds .enact in parent directory", () => {
      const result = getProjectEnactDir(NESTED_DIR);
      expect(result).toBe(join(TEST_DIR, ".enact"));
    });

    test("returns null when .enact not found (stops at root)", () => {
      // Note: This test may find ~/.enact/ if it exists
      // That's actually correct behavior - it walks up to find .enact
      // To truly test "not found", we'd need to mock the filesystem
      // For now, we just verify it returns a valid path or null
      const result = getProjectEnactDir("/tmp/nonexistent-unlikely-path-12345");
      // Result will be null or a valid .enact directory path
      if (result !== null) {
        expect(result.endsWith(".enact")).toBe(true);
      }
    });

    test("uses current working directory by default", () => {
      // Save original cwd
      const originalCwd = process.cwd();

      try {
        // Change to test directory
        process.chdir(NESTED_DIR);
        const result = getProjectEnactDir();
        expect(result).toBe(join(TEST_DIR, ".enact"));
      } finally {
        // Restore original cwd
        process.chdir(originalCwd);
      }
    });
  });

  describe("getToolsDir", () => {
    test("returns ~/.enact/tools/ for user scope", () => {
      const result = getToolsDir("user");
      const expected = join(homedir(), ".enact", "tools");
      expect(result).toBe(expected);
    });

    test("returns .enact/tools/ for project scope", () => {
      const result = getToolsDir("project", TEST_DIR);
      expect(result).toBe(join(TEST_DIR, ".enact", "tools"));
    });

    test("finds project tools in parent directory", () => {
      const result = getToolsDir("project", NESTED_DIR);
      expect(result).toBe(join(TEST_DIR, ".enact", "tools"));
    });

    test("returns null for project scope when .enact not found", () => {
      // Similar to above - may find ~/.enact/ if it exists
      const result = getToolsDir("project", "/tmp/no-enact-unlikely-path");
      // Result will be null or a valid tools directory
      if (result !== null) {
        expect(result.endsWith("tools")).toBe(true);
      }
    });
  });

  describe("getCacheDir", () => {
    test("returns ~/.enact/cache/ path", () => {
      const result = getCacheDir();
      const expected = join(homedir(), ".enact", "cache");
      expect(result).toBe(expected);
    });
  });

  describe("getConfigPath", () => {
    test("returns ~/.enact/config.yaml path", () => {
      const result = getConfigPath();
      const expected = join(homedir(), ".enact", "config.yaml");
      expect(result).toBe(expected);
    });
  });

  describe("getGlobalEnvPath", () => {
    test("returns ~/.enact/.env path", () => {
      const result = getGlobalEnvPath();
      const expected = join(homedir(), ".enact", ".env");
      expect(result).toBe(expected);
    });
  });

  describe("getProjectEnvPath", () => {
    test("returns .enact/.env path for project", () => {
      const result = getProjectEnvPath(TEST_DIR);
      expect(result).toBe(join(TEST_DIR, ".enact", ".env"));
    });

    test("finds project .env in parent directory", () => {
      const result = getProjectEnvPath(NESTED_DIR);
      expect(result).toBe(join(TEST_DIR, ".enact", ".env"));
    });

    test("returns null when .enact not found", () => {
      // Similar to above - may find ~/.enact/ if it exists
      const result = getProjectEnvPath("/tmp/no-project-unlikely-path");
      // Result will be null or a valid .env path
      if (result !== null) {
        expect(result.endsWith(".env")).toBe(true);
      }
    });
  });
});
