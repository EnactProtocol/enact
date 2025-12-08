import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ManifestLoadError,
  findManifestFile,
  hasManifest,
  loadManifest,
  loadManifestFromDir,
  tryLoadManifest,
  tryLoadManifestFromDir,
} from "../../src/manifest/loader";

const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures");
const TEST_DIR = join(import.meta.dir, "temp-loader-test");

describe("manifest loader", () => {
  beforeAll(() => {
    // Create temp test directory
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    // Cleanup
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("loadManifest", () => {
    test("loads valid YAML manifest", () => {
      const filePath = join(FIXTURES_DIR, "valid-tool.yaml");
      const result = loadManifest(filePath);

      expect(result.manifest.name).toBe("acme/utils/greeter");
      expect(result.manifest.description).toBe("Greets users by name");
      expect(result.manifest.version).toBe("1.0.0");
      expect(result.format).toBe("yaml");
      expect(result.filePath).toBe(filePath);
      expect(result.body).toBeUndefined();
    });

    test("loads valid Markdown manifest", () => {
      const filePath = join(FIXTURES_DIR, "valid-tool.md");
      const result = loadManifest(filePath);

      expect(result.manifest.name).toBe("acme/docs/analyzer");
      expect(result.manifest.description).toBe("Analyzes documentation for completeness");
      expect(result.format).toBe("md");
      expect(result.body).toBeDefined();
      expect(result.body).toContain("# Documentation Analyzer");
    });

    test("includes validation warnings", () => {
      // Create a minimal manifest that will have warnings
      const minimalPath = join(TEST_DIR, "minimal.yaml");
      writeFileSync(
        minimalPath,
        `
name: test/tool
description: A minimal tool
`,
        "utf-8"
      );

      const result = loadManifest(minimalPath);
      expect(result.manifest.name).toBe("test/tool");
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.length).toBeGreaterThan(0);
    });

    test("throws ManifestLoadError for non-existent file", () => {
      const filePath = join(FIXTURES_DIR, "does-not-exist.yaml");
      expect(() => loadManifest(filePath)).toThrow(ManifestLoadError);
      expect(() => loadManifest(filePath)).toThrow("not found");
    });

    test("throws ManifestLoadError for invalid manifest", () => {
      const filePath = join(FIXTURES_DIR, "invalid-tool.yaml");
      expect(() => loadManifest(filePath)).toThrow(ManifestLoadError);
      expect(() => loadManifest(filePath)).toThrow("validation failed");
    });

    test("throws ManifestLoadError for malformed YAML", () => {
      const malformedPath = join(TEST_DIR, "malformed.yaml");
      writeFileSync(malformedPath, "name: [unclosed", "utf-8");

      expect(() => loadManifest(malformedPath)).toThrow(ManifestLoadError);
      expect(() => loadManifest(malformedPath)).toThrow("parse");
    });

    test("error includes file path", () => {
      const filePath = join(FIXTURES_DIR, "does-not-exist.yaml");
      try {
        loadManifest(filePath);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ManifestLoadError);
        expect((error as ManifestLoadError).filePath).toBe(filePath);
      }
    });
  });

  describe("loadManifestFromDir", () => {
    test("loads manifest from directory with enact.yaml", () => {
      const testDir = join(TEST_DIR, "yaml-dir");
      mkdirSync(testDir, { recursive: true });
      writeFileSync(
        join(testDir, "enact.yaml"),
        `
name: test/yaml
description: Test YAML manifest
`,
        "utf-8"
      );

      const result = loadManifestFromDir(testDir);
      expect(result.manifest.name).toBe("test/yaml");
    });

    test("loads manifest from directory with enact.md", () => {
      const testDir = join(TEST_DIR, "md-dir");
      mkdirSync(testDir, { recursive: true });
      writeFileSync(
        join(testDir, "enact.md"),
        `---
name: test/md
description: Test Markdown manifest
---

# Documentation
`,
        "utf-8"
      );

      const result = loadManifestFromDir(testDir);
      expect(result.manifest.name).toBe("test/md");
      expect(result.format).toBe("md");
    });

    test("prefers enact.md over enact.yaml", () => {
      const testDir = join(TEST_DIR, "both-dir");
      mkdirSync(testDir, { recursive: true });

      // Create both files
      writeFileSync(
        join(testDir, "enact.md"),
        `---
name: test/md-preferred
description: Markdown version
---
`,
        "utf-8"
      );
      writeFileSync(
        join(testDir, "enact.yaml"),
        `
name: test/yaml-version
description: YAML version
`,
        "utf-8"
      );

      const result = loadManifestFromDir(testDir);
      expect(result.manifest.name).toBe("test/md-preferred");
    });

    test("throws for directory without manifest", () => {
      const emptyDir = join(TEST_DIR, "empty-dir");
      mkdirSync(emptyDir, { recursive: true });

      expect(() => loadManifestFromDir(emptyDir)).toThrow(ManifestLoadError);
      expect(() => loadManifestFromDir(emptyDir)).toThrow("No manifest found");
    });
  });

  describe("findManifestFile", () => {
    test("finds enact.yaml", () => {
      const testDir = join(TEST_DIR, "find-yaml");
      mkdirSync(testDir, { recursive: true });
      writeFileSync(join(testDir, "enact.yaml"), "name: test/find", "utf-8");

      const result = findManifestFile(testDir);
      expect(result).toBe(join(testDir, "enact.yaml"));
    });

    test("finds enact.md", () => {
      const testDir = join(TEST_DIR, "find-md");
      mkdirSync(testDir, { recursive: true });
      writeFileSync(join(testDir, "enact.md"), "---\nname: test/find\n---", "utf-8");

      const result = findManifestFile(testDir);
      expect(result).toBe(join(testDir, "enact.md"));
    });

    test("returns null for empty directory", () => {
      const testDir = join(TEST_DIR, "find-empty");
      mkdirSync(testDir, { recursive: true });

      const result = findManifestFile(testDir);
      expect(result).toBeNull();
    });
  });

  describe("hasManifest", () => {
    test("returns true when manifest exists", () => {
      const testDir = join(TEST_DIR, "has-manifest");
      mkdirSync(testDir, { recursive: true });
      writeFileSync(join(testDir, "enact.yaml"), "name: test/has", "utf-8");

      expect(hasManifest(testDir)).toBe(true);
    });

    test("returns false when no manifest", () => {
      const testDir = join(TEST_DIR, "no-manifest");
      mkdirSync(testDir, { recursive: true });

      expect(hasManifest(testDir)).toBe(false);
    });
  });

  describe("tryLoadManifest", () => {
    test("returns manifest on success", () => {
      const filePath = join(FIXTURES_DIR, "valid-tool.yaml");
      const result = tryLoadManifest(filePath);

      expect(result).not.toBeNull();
      expect(result?.manifest.name).toBe("acme/utils/greeter");
    });

    test("returns null on failure", () => {
      const filePath = join(FIXTURES_DIR, "does-not-exist.yaml");
      const result = tryLoadManifest(filePath);

      expect(result).toBeNull();
    });

    test("returns null for invalid manifest", () => {
      const filePath = join(FIXTURES_DIR, "invalid-tool.yaml");
      const result = tryLoadManifest(filePath);

      expect(result).toBeNull();
    });
  });

  describe("tryLoadManifestFromDir", () => {
    test("returns manifest on success", () => {
      const testDir = join(TEST_DIR, "try-success");
      mkdirSync(testDir, { recursive: true });
      writeFileSync(
        join(testDir, "enact.yaml"),
        `
name: test/try
description: Test try loading
`,
        "utf-8"
      );

      const result = tryLoadManifestFromDir(testDir);
      expect(result).not.toBeNull();
      expect(result?.manifest.name).toBe("test/try");
    });

    test("returns null for empty directory", () => {
      const testDir = join(TEST_DIR, "try-empty");
      mkdirSync(testDir, { recursive: true });

      const result = tryLoadManifestFromDir(testDir);
      expect(result).toBeNull();
    });
  });

  describe("ManifestLoadError", () => {
    test("has correct properties", () => {
      const error = new ManifestLoadError("Test error", "/path/to/file.yaml");

      expect(error.name).toBe("ManifestLoadError");
      expect(error.message).toBe("Test error");
      expect(error.filePath).toBe("/path/to/file.yaml");
    });

    test("preserves original error", () => {
      const original = new Error("Original error");
      const error = new ManifestLoadError("Wrapped", "/path", original);

      expect(error.originalError).toBe(original);
    });
  });
});
