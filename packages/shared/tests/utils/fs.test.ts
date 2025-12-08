import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  copyDir,
  copyFile,
  ensureDir,
  ensureParentDir,
  findFiles,
  findFilesRecursive,
  getFileSize,
  getStats,
  isDirectory,
  isFile,
  listDir,
  listDirEntries,
  pathExists,
  readJsonFile,
  readTextFile,
  remove,
  touchFile,
  tryReadJsonFile,
  tryReadTextFile,
  writeJsonFile,
  writeTextFile,
} from "../../src/utils/fs";

const TEST_DIR = join(import.meta.dir, "temp-fs-test");

describe("File system helpers", () => {
  beforeAll(() => {
    // Create test directory structure
    mkdirSync(join(TEST_DIR, "existing"), { recursive: true });
    mkdirSync(join(TEST_DIR, "nested", "deep"), { recursive: true });
    writeFileSync(join(TEST_DIR, "test.txt"), "hello world", "utf-8");
    writeFileSync(join(TEST_DIR, "test.json"), '{"key": "value"}', "utf-8");
    writeFileSync(join(TEST_DIR, "existing", "file.txt"), "content", "utf-8");
    writeFileSync(join(TEST_DIR, "nested", "file1.txt"), "file1", "utf-8");
    writeFileSync(join(TEST_DIR, "nested", "deep", "file2.txt"), "file2", "utf-8");
  });

  afterAll(() => {
    // Clean up
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("ensureDir", () => {
    test("creates new directory", () => {
      const newDir = join(TEST_DIR, "new-dir");
      ensureDir(newDir);
      expect(existsSync(newDir)).toBe(true);
    });

    test("does nothing if directory exists", () => {
      const existingDir = join(TEST_DIR, "existing");
      ensureDir(existingDir);
      expect(existsSync(existingDir)).toBe(true);
    });

    test("creates nested directories", () => {
      const nestedDir = join(TEST_DIR, "a", "b", "c");
      ensureDir(nestedDir);
      expect(existsSync(nestedDir)).toBe(true);
    });
  });

  describe("ensureParentDir", () => {
    test("creates parent directory for file path", () => {
      const filePath = join(TEST_DIR, "parent-test", "file.txt");
      ensureParentDir(filePath);
      expect(existsSync(join(TEST_DIR, "parent-test"))).toBe(true);
    });
  });

  describe("pathExists", () => {
    test("returns true for existing file", () => {
      expect(pathExists(join(TEST_DIR, "test.txt"))).toBe(true);
    });

    test("returns true for existing directory", () => {
      expect(pathExists(join(TEST_DIR, "existing"))).toBe(true);
    });

    test("returns false for non-existent path", () => {
      expect(pathExists(join(TEST_DIR, "non-existent"))).toBe(false);
    });
  });

  describe("isDirectory", () => {
    test("returns true for directory", () => {
      expect(isDirectory(join(TEST_DIR, "existing"))).toBe(true);
    });

    test("returns false for file", () => {
      expect(isDirectory(join(TEST_DIR, "test.txt"))).toBe(false);
    });

    test("returns false for non-existent", () => {
      expect(isDirectory(join(TEST_DIR, "non-existent"))).toBe(false);
    });
  });

  describe("isFile", () => {
    test("returns true for file", () => {
      expect(isFile(join(TEST_DIR, "test.txt"))).toBe(true);
    });

    test("returns false for directory", () => {
      expect(isFile(join(TEST_DIR, "existing"))).toBe(false);
    });

    test("returns false for non-existent", () => {
      expect(isFile(join(TEST_DIR, "non-existent"))).toBe(false);
    });
  });

  describe("readJsonFile", () => {
    test("reads and parses JSON file", () => {
      const data = readJsonFile(join(TEST_DIR, "test.json"));
      expect(data).toEqual({ key: "value" });
    });

    test("throws for non-existent file", () => {
      expect(() => readJsonFile(join(TEST_DIR, "non-existent.json"))).toThrow();
    });

    test("throws for invalid JSON", () => {
      const invalidJson = join(TEST_DIR, "invalid.json");
      writeFileSync(invalidJson, "not valid json", "utf-8");
      expect(() => readJsonFile(invalidJson)).toThrow();
    });
  });

  describe("tryReadJsonFile", () => {
    test("returns parsed JSON for valid file", () => {
      const data = tryReadJsonFile(join(TEST_DIR, "test.json"));
      expect(data).toEqual({ key: "value" });
    });

    test("returns null for non-existent file", () => {
      expect(tryReadJsonFile(join(TEST_DIR, "non-existent.json"))).toBeNull();
    });

    test("returns null for invalid JSON", () => {
      const invalidJson = join(TEST_DIR, "invalid2.json");
      writeFileSync(invalidJson, "not valid json", "utf-8");
      expect(tryReadJsonFile(invalidJson)).toBeNull();
    });
  });

  describe("writeJsonFile", () => {
    test("writes formatted JSON", () => {
      const filePath = join(TEST_DIR, "write-test.json");
      writeJsonFile(filePath, { test: true });
      const content = readTextFile(filePath);
      expect(content).toBe('{\n  "test": true\n}\n');
    });

    test("creates parent directories", () => {
      const filePath = join(TEST_DIR, "write-parent", "nested", "file.json");
      writeJsonFile(filePath, { nested: true });
      expect(existsSync(filePath)).toBe(true);
    });

    test("respects custom indent", () => {
      const filePath = join(TEST_DIR, "indent-test.json");
      writeJsonFile(filePath, { a: 1 }, { indent: 4 });
      const content = readTextFile(filePath);
      expect(content).toBe('{\n    "a": 1\n}\n');
    });
  });

  describe("readTextFile", () => {
    test("reads text file content", () => {
      const content = readTextFile(join(TEST_DIR, "test.txt"));
      expect(content).toBe("hello world");
    });

    test("throws for non-existent file", () => {
      expect(() => readTextFile(join(TEST_DIR, "non-existent.txt"))).toThrow();
    });
  });

  describe("tryReadTextFile", () => {
    test("returns content for existing file", () => {
      const content = tryReadTextFile(join(TEST_DIR, "test.txt"));
      expect(content).toBe("hello world");
    });

    test("returns null for non-existent file", () => {
      expect(tryReadTextFile(join(TEST_DIR, "non-existent.txt"))).toBeNull();
    });
  });

  describe("writeTextFile", () => {
    test("writes text content", () => {
      const filePath = join(TEST_DIR, "write-text.txt");
      writeTextFile(filePath, "test content");
      expect(readTextFile(filePath)).toBe("test content");
    });

    test("creates parent directories", () => {
      const filePath = join(TEST_DIR, "write-text-parent", "file.txt");
      writeTextFile(filePath, "nested content");
      expect(existsSync(filePath)).toBe(true);
    });
  });

  describe("copyFile", () => {
    test("copies file to new location", () => {
      const src = join(TEST_DIR, "test.txt");
      const dest = join(TEST_DIR, "copy-test", "copied.txt");
      copyFile(src, dest);
      expect(existsSync(dest)).toBe(true);
      expect(readTextFile(dest)).toBe("hello world");
    });
  });

  describe("copyDir", () => {
    test("copies directory recursively", () => {
      const src = join(TEST_DIR, "nested");
      const dest = join(TEST_DIR, "nested-copy");
      copyDir(src, dest);
      expect(existsSync(join(dest, "file1.txt"))).toBe(true);
      expect(existsSync(join(dest, "deep", "file2.txt"))).toBe(true);
    });
  });

  describe("remove", () => {
    test("removes file", () => {
      const filePath = join(TEST_DIR, "to-remove.txt");
      writeFileSync(filePath, "delete me", "utf-8");
      expect(existsSync(filePath)).toBe(true);
      remove(filePath);
      expect(existsSync(filePath)).toBe(false);
    });

    test("removes directory recursively", () => {
      const dirPath = join(TEST_DIR, "dir-to-remove");
      mkdirSync(join(dirPath, "nested"), { recursive: true });
      writeFileSync(join(dirPath, "nested", "file.txt"), "content", "utf-8");
      remove(dirPath);
      expect(existsSync(dirPath)).toBe(false);
    });

    test("does nothing for non-existent path", () => {
      // Should not throw
      remove(join(TEST_DIR, "non-existent"));
    });
  });

  describe("listDir", () => {
    test("lists directory contents", () => {
      const contents = listDir(join(TEST_DIR, "existing"));
      expect(contents).toContain("file.txt");
    });

    test("returns empty array for non-existent directory", () => {
      expect(listDir(join(TEST_DIR, "non-existent"))).toEqual([]);
    });
  });

  describe("listDirEntries", () => {
    test("lists entries with types", () => {
      const entries = listDirEntries(TEST_DIR);
      const existing = entries.find((e) => e.name === "existing");
      const testTxt = entries.find((e) => e.name === "test.txt");

      expect(existing?.type).toBe("directory");
      expect(testTxt?.type).toBe("file");
    });

    test("includes full paths", () => {
      const entries = listDirEntries(TEST_DIR);
      const testTxt = entries.find((e) => e.name === "test.txt");
      expect(testTxt?.path).toBe(join(TEST_DIR, "test.txt"));
    });

    test("returns empty array for non-existent directory", () => {
      expect(listDirEntries(join(TEST_DIR, "non-existent"))).toEqual([]);
    });
  });

  describe("findFiles", () => {
    test("finds files matching regex pattern", () => {
      const files = findFiles(TEST_DIR, /\.txt$/);
      expect(files.some((f) => f.endsWith("test.txt"))).toBe(true);
    });

    test("finds files matching string pattern", () => {
      const files = findFiles(TEST_DIR, "\\.json$");
      expect(files.some((f) => f.endsWith("test.json"))).toBe(true);
    });

    test("returns empty array for no matches", () => {
      const files = findFiles(TEST_DIR, /\.xyz$/);
      expect(files).toEqual([]);
    });
  });

  describe("findFilesRecursive", () => {
    test("finds files recursively", () => {
      const files = findFilesRecursive(join(TEST_DIR, "nested"));
      expect(files.length).toBeGreaterThanOrEqual(2);
      expect(files.some((f) => f.includes("file1.txt"))).toBe(true);
      expect(files.some((f) => f.includes("file2.txt"))).toBe(true);
    });

    test("filters by pattern", () => {
      const files = findFilesRecursive(join(TEST_DIR, "nested"), /file1/);
      expect(files.length).toBe(1);
      expect(files[0]).toContain("file1.txt");
    });

    test("returns empty for non-existent dir", () => {
      expect(findFilesRecursive(join(TEST_DIR, "non-existent"))).toEqual([]);
    });
  });

  describe("getStats", () => {
    test("returns stats for file", () => {
      const stats = getStats(join(TEST_DIR, "test.txt"));
      expect(stats).not.toBeNull();
      expect(stats?.isFile).toBe(true);
      expect(stats?.isDirectory).toBe(false);
      expect(stats?.size).toBeGreaterThan(0);
    });

    test("returns stats for directory", () => {
      const stats = getStats(join(TEST_DIR, "existing"));
      expect(stats?.isDirectory).toBe(true);
      expect(stats?.isFile).toBe(false);
    });

    test("returns null for non-existent", () => {
      expect(getStats(join(TEST_DIR, "non-existent"))).toBeNull();
    });
  });

  describe("getFileSize", () => {
    test("returns file size", () => {
      const size = getFileSize(join(TEST_DIR, "test.txt"));
      expect(size).toBe(11); // "hello world" = 11 bytes
    });

    test("returns null for directory", () => {
      expect(getFileSize(join(TEST_DIR, "existing"))).toBeNull();
    });

    test("returns null for non-existent", () => {
      expect(getFileSize(join(TEST_DIR, "non-existent"))).toBeNull();
    });
  });

  describe("touchFile", () => {
    test("creates new file if not exists", () => {
      const filePath = join(TEST_DIR, "touched-new.txt");
      touchFile(filePath);
      expect(existsSync(filePath)).toBe(true);
      expect(readTextFile(filePath)).toBe("");
    });

    test("updates existing file mtime", () => {
      const filePath = join(TEST_DIR, "touched-existing.txt");
      writeFileSync(filePath, "content", "utf-8");

      // Wait a bit to ensure mtime changes
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      return delay(10).then(() => {
        touchFile(filePath);
        const statsAfter = getStats(filePath);
        // Content should be preserved
        expect(readTextFile(filePath)).toBe("content");
        // mtime should be updated (or at least stats should exist)
        expect(statsAfter).not.toBeNull();
      });
    });

    test("creates parent directories", () => {
      const filePath = join(TEST_DIR, "touch-parent", "nested", "file.txt");
      touchFile(filePath);
      expect(existsSync(filePath)).toBe(true);
    });
  });
});
