import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type ChecksumManifest,
  MANIFEST_VERSION,
  computeManifestHash,
  createChecksumManifest,
  parseChecksumManifest,
  serializeChecksumManifest,
  verifyChecksumManifest,
} from "../src/manifest";

const TEST_DIR = join(import.meta.dir, "fixtures", "manifest-test");
const TOOL_DIR = join(TEST_DIR, "sample-tool");

describe("checksum manifest", () => {
  beforeAll(() => {
    // Create test directory structure
    mkdirSync(TOOL_DIR, { recursive: true });
    mkdirSync(join(TOOL_DIR, "src"), { recursive: true });

    // Create sample tool files
    writeFileSync(
      join(TOOL_DIR, "SKILL.md"),
      `---
name: test/sample-tool
version: 1.0.0
description: A sample tool for testing
---

# Sample Tool

This is a test tool.
`
    );

    writeFileSync(
      join(TOOL_DIR, "src", "main.py"),
      `#!/usr/bin/env python3
def main():
    print("Hello, World!")

if __name__ == "__main__":
    main()
`
    );

    writeFileSync(join(TOOL_DIR, "requirements.txt"), "requests>=2.28.0\n");

    // Create files that should be ignored
    writeFileSync(join(TOOL_DIR, ".gitignore"), "*.pyc\n__pycache__/\n");
    writeFileSync(join(TOOL_DIR, ".DS_Store"), "");
  });

  afterAll(() => {
    // Clean up test files
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("createChecksumManifest", () => {
    test("creates manifest with correct structure", async () => {
      const manifest = await createChecksumManifest(TOOL_DIR, "test/sample-tool", "1.0.0");

      expect(manifest.version).toBe(MANIFEST_VERSION);
      expect(manifest.tool.name).toBe("test/sample-tool");
      expect(manifest.tool.version).toBe("1.0.0");
      expect(manifest.files).toBeArray();
      expect(manifest.manifestHash).toBeDefined();
      expect(manifest.manifestHash.algorithm).toBe("sha256");
      expect(manifest.manifestHash.digest).toHaveLength(64); // SHA-256 hex
    });

    test("includes expected files", async () => {
      const manifest = await createChecksumManifest(TOOL_DIR, "test/sample-tool", "1.0.0");

      const filePaths = manifest.files.map((f) => f.path);

      expect(filePaths).toContain("SKILL.md");
      expect(filePaths).toContain("src/main.py");
      expect(filePaths).toContain("requirements.txt");
    });

    test("excludes ignored files", async () => {
      const manifest = await createChecksumManifest(TOOL_DIR, "test/sample-tool", "1.0.0");

      const filePaths = manifest.files.map((f) => f.path);

      // Should not include .gitignore or .DS_Store
      expect(filePaths).not.toContain(".gitignore");
      expect(filePaths).not.toContain(".DS_Store");
    });

    test("files are sorted by path", async () => {
      const manifest = await createChecksumManifest(TOOL_DIR, "test/sample-tool", "1.0.0");

      const paths = manifest.files.map((f) => f.path);
      const sortedPaths = [...paths].sort();

      expect(paths).toEqual(sortedPaths);
    });

    test("each file has correct hash format", async () => {
      const manifest = await createChecksumManifest(TOOL_DIR, "test/sample-tool", "1.0.0");

      for (const file of manifest.files) {
        expect(file.path).toBeString();
        expect(file.sha256).toHaveLength(64); // SHA-256 hex
        expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(file.size).toBeNumber();
        expect(file.size).toBeGreaterThan(0);
      }
    });

    test("calls progress callback for each file", async () => {
      const processedFiles: string[] = [];

      await createChecksumManifest(TOOL_DIR, "test/sample-tool", "1.0.0", {
        onProgress: (file) => processedFiles.push(file),
      });

      expect(processedFiles.length).toBeGreaterThan(0);
      expect(processedFiles).toContain("SKILL.md");
    });

    test("respects custom ignore patterns", async () => {
      const manifest = await createChecksumManifest(TOOL_DIR, "test/sample-tool", "1.0.0", {
        ignorePatterns: ["requirements.txt"],
      });

      const filePaths = manifest.files.map((f) => f.path);

      expect(filePaths).not.toContain("requirements.txt");
      expect(filePaths).toContain("SKILL.md"); // Should still include other files
    });

    test("produces deterministic output", async () => {
      const manifest1 = await createChecksumManifest(TOOL_DIR, "test/sample-tool", "1.0.0");

      const manifest2 = await createChecksumManifest(TOOL_DIR, "test/sample-tool", "1.0.0");

      expect(manifest1.manifestHash.digest).toBe(manifest2.manifestHash.digest);
      expect(manifest1.files).toEqual(manifest2.files);
    });
  });

  describe("computeManifestHash", () => {
    test("computes hash excluding manifestHash field", async () => {
      const manifest = await createChecksumManifest(TOOL_DIR, "test/sample-tool", "1.0.0");

      const hash = computeManifestHash(manifest);

      expect(hash.algorithm).toBe("sha256");
      expect(hash.digest).toHaveLength(64);
      expect(hash.digest).toBe(manifest.manifestHash.digest);
    });

    test("produces different hashes for different content", async () => {
      const manifest1 = await createChecksumManifest(TOOL_DIR, "test/sample-tool", "1.0.0");

      const manifest2 = await createChecksumManifest(
        TOOL_DIR,
        "test/sample-tool",
        "2.0.0" // Different version
      );

      expect(manifest1.manifestHash.digest).not.toBe(manifest2.manifestHash.digest);
    });

    test("is deterministic", async () => {
      const manifest = await createChecksumManifest(TOOL_DIR, "test/sample-tool", "1.0.0");

      const hash1 = computeManifestHash(manifest);
      const hash2 = computeManifestHash(manifest);

      expect(hash1.digest).toBe(hash2.digest);
    });
  });

  describe("verifyChecksumManifest", () => {
    test("returns valid for matching directory", async () => {
      const manifest = await createChecksumManifest(TOOL_DIR, "test/sample-tool", "1.0.0");

      const result = await verifyChecksumManifest(TOOL_DIR, manifest);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.missingFiles).toBeUndefined();
      expect(result.modifiedFiles).toBeUndefined();
      expect(result.extraFiles).toBeUndefined();
    });

    test("detects modified files", async () => {
      const manifest = await createChecksumManifest(TOOL_DIR, "test/sample-tool", "1.0.0");

      // Modify a file
      const originalContent = "requests>=2.28.0\n";
      writeFileSync(join(TOOL_DIR, "requirements.txt"), "modified content\n");

      try {
        const result = await verifyChecksumManifest(TOOL_DIR, manifest);

        expect(result.valid).toBe(false);
        expect(result.modifiedFiles).toContain("requirements.txt");
        expect(result.errors).toBeDefined();
        expect(result.errors?.some((e) => e.includes("Modified file"))).toBe(true);
      } finally {
        // Restore original content
        writeFileSync(join(TOOL_DIR, "requirements.txt"), originalContent);
      }
    });

    test("detects missing files", async () => {
      const manifest = await createChecksumManifest(TOOL_DIR, "test/sample-tool", "1.0.0");

      // Remove a file
      const filePath = join(TOOL_DIR, "requirements.txt");
      const originalContent = "requests>=2.28.0\n";
      rmSync(filePath);

      try {
        const result = await verifyChecksumManifest(TOOL_DIR, manifest);

        expect(result.valid).toBe(false);
        expect(result.missingFiles).toContain("requirements.txt");
        expect(result.errors).toBeDefined();
      } finally {
        // Restore file
        writeFileSync(filePath, originalContent);
      }
    });

    test("detects extra files", async () => {
      const manifest = await createChecksumManifest(TOOL_DIR, "test/sample-tool", "1.0.0");

      // Add a new file
      const newFilePath = join(TOOL_DIR, "extra-file.txt");
      writeFileSync(newFilePath, "extra content");

      try {
        const result = await verifyChecksumManifest(TOOL_DIR, manifest);

        expect(result.valid).toBe(false);
        expect(result.extraFiles).toContain("extra-file.txt");
        expect(result.errors).toBeDefined();
      } finally {
        // Remove extra file
        rmSync(newFilePath);
      }
    });

    test("detects corrupted manifest hash", async () => {
      const manifest = await createChecksumManifest(TOOL_DIR, "test/sample-tool", "1.0.0");

      // Corrupt the manifest hash
      const corruptedManifest: ChecksumManifest = {
        ...manifest,
        manifestHash: {
          algorithm: "sha256",
          digest: "0".repeat(64), // Invalid hash
        },
      };

      const result = await verifyChecksumManifest(TOOL_DIR, corruptedManifest);

      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.includes("Manifest hash mismatch"))).toBe(true);
    });
  });

  describe("parseChecksumManifest", () => {
    test("parses valid manifest JSON", async () => {
      const original = await createChecksumManifest(TOOL_DIR, "test/sample-tool", "1.0.0");

      const json = serializeChecksumManifest(original);
      const parsed = parseChecksumManifest(json);

      expect(parsed.version).toBe(original.version);
      expect(parsed.tool).toEqual(original.tool);
      expect(parsed.files).toEqual(original.files);
      expect(parsed.manifestHash).toEqual(original.manifestHash);
    });

    test("throws on invalid version", () => {
      const invalidJson = JSON.stringify({
        version: "99.0",
        tool: { name: "test", version: "1.0.0" },
        files: [],
        manifestHash: { algorithm: "sha256", digest: "abc" },
      });

      expect(() => parseChecksumManifest(invalidJson)).toThrow("Invalid manifest version");
    });

    test("throws on missing tool info", () => {
      const invalidJson = JSON.stringify({
        version: "1.0",
        files: [],
        manifestHash: { algorithm: "sha256", digest: "abc" },
      });

      expect(() => parseChecksumManifest(invalidJson)).toThrow("missing tool name");
    });

    test("throws on invalid files array", () => {
      const invalidJson = JSON.stringify({
        version: "1.0",
        tool: { name: "test", version: "1.0.0" },
        files: "not an array",
        manifestHash: { algorithm: "sha256", digest: "abc" },
      });

      expect(() => parseChecksumManifest(invalidJson)).toThrow("files must be an array");
    });

    test("throws on missing manifestHash", () => {
      const invalidJson = JSON.stringify({
        version: "1.0",
        tool: { name: "test", version: "1.0.0" },
        files: [],
      });

      expect(() => parseChecksumManifest(invalidJson)).toThrow("missing manifestHash");
    });
  });

  describe("serializeChecksumManifest", () => {
    test("produces valid JSON", async () => {
      const manifest = await createChecksumManifest(TOOL_DIR, "test/sample-tool", "1.0.0");

      const json = serializeChecksumManifest(manifest);

      expect(() => JSON.parse(json)).not.toThrow();
    });

    test("produces pretty-printed output", async () => {
      const manifest = await createChecksumManifest(TOOL_DIR, "test/sample-tool", "1.0.0");

      const json = serializeChecksumManifest(manifest);

      // Should contain newlines (pretty-printed)
      expect(json).toContain("\n");
      expect(json).toContain("  "); // 2-space indent
    });

    test("round-trips correctly", async () => {
      const original = await createChecksumManifest(TOOL_DIR, "test/sample-tool", "1.0.0");

      const json = serializeChecksumManifest(original);
      const parsed = parseChecksumManifest(json);

      expect(parsed).toEqual(original);
    });
  });

  describe("cross-platform path handling", () => {
    test("uses forward slashes in file paths", async () => {
      const manifest = await createChecksumManifest(TOOL_DIR, "test/sample-tool", "1.0.0");

      for (const file of manifest.files) {
        expect(file.path).not.toContain("\\");
        // Should use forward slashes even on Windows
        if (file.path.includes("/")) {
          expect(file.path).toMatch(/^[^\\]+$/);
        }
      }
    });
  });
});
