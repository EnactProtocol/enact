import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashBuffer, hashContent, hashFile } from "../src/hash";

const TEST_DIR = join(import.meta.dir, "fixtures");
const TEST_FILE = join(TEST_DIR, "test.txt");
const LARGE_FILE = join(TEST_DIR, "large.txt");
const BINARY_FILE = join(TEST_DIR, "binary.dat");

describe("hash utilities", () => {
  beforeAll(() => {
    // Create test directory and files
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, "hello world");

    // Create a larger file for streaming tests
    writeFileSync(LARGE_FILE, "x".repeat(1024 * 1024)); // 1MB file

    // Create a binary file
    const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
    writeFileSync(BINARY_FILE, binaryData);
  });

  afterAll(() => {
    // Clean up test files
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("hashContent", () => {
    test("hashes string content with sha256", () => {
      const result = hashContent("hello world");

      expect(result.algorithm).toBe("sha256");
      expect(result.digest).toBe(
        "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
      );
    });

    test("hashes string content with sha512", () => {
      const result = hashContent("hello world", "sha512");

      expect(result.algorithm).toBe("sha512");
      expect(result.digest).toBe(
        "309ecc489c12d6eb4cc40f50c902f2b4d0ed77ee511a7c7a9bcd3ca86d4cd86f989dd35bc5ff499670da34255b45b0cfd830e81f605dcf7dc5542e93ae9cd76f"
      );
    });

    test("hashes buffer content", () => {
      const buffer = Buffer.from("hello world");
      const result = hashContent(buffer);

      expect(result.digest).toBe(
        "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
      );
    });

    test("produces consistent hashes for same content", () => {
      const result1 = hashContent("test content");
      const result2 = hashContent("test content");

      expect(result1.digest).toBe(result2.digest);
    });

    test("produces different hashes for different content", () => {
      const result1 = hashContent("content 1");
      const result2 = hashContent("content 2");

      expect(result1.digest).not.toBe(result2.digest);
    });

    test("handles empty string", () => {
      const result = hashContent("");

      expect(result.digest).toBe(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      );
    });

    test("handles unicode content", () => {
      const result = hashContent("Hello 世界 🌍");

      expect(result.algorithm).toBe("sha256");
      expect(result.digest).toHaveLength(64); // sha256 produces 64 hex chars
    });
  });

  describe("hashBuffer", () => {
    test("hashes buffer data", () => {
      const buffer = Buffer.from("hello world");
      const result = hashBuffer(buffer);

      expect(result.digest).toBe(
        "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
      );
    });

    test("hashes binary data", () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0xff]);
      const result = hashBuffer(buffer);

      expect(result.algorithm).toBe("sha256");
      expect(result.digest).toHaveLength(64);
    });

    test("supports sha512 algorithm", () => {
      const buffer = Buffer.from("test");
      const result = hashBuffer(buffer, "sha512");

      expect(result.algorithm).toBe("sha512");
      expect(result.digest).toHaveLength(128); // sha512 produces 128 hex chars
    });
  });

  describe("hashFile", () => {
    test("hashes file content", async () => {
      const result = await hashFile(TEST_FILE);

      expect(result.algorithm).toBe("sha256");
      expect(result.digest).toBe(
        "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
      );
    });

    test("hashes file with sha512", async () => {
      const result = await hashFile(TEST_FILE, { algorithm: "sha512" });

      expect(result.algorithm).toBe("sha512");
      expect(result.digest).toHaveLength(128);
    });

    test("hashes large file with streaming", async () => {
      const result = await hashFile(LARGE_FILE);

      expect(result.algorithm).toBe("sha256");
      expect(result.digest).toHaveLength(64);
    });

    test("hashes binary file", async () => {
      const result = await hashFile(BINARY_FILE);

      expect(result.algorithm).toBe("sha256");
      expect(result.digest).toHaveLength(64);
    });

    test("calls progress callback during hashing", async () => {
      const progressCalls: Array<{ read: number; total: number }> = [];

      await hashFile(LARGE_FILE, {
        onProgress: (bytesRead, totalBytes) => {
          progressCalls.push({ read: bytesRead, total: totalBytes });
        },
      });

      expect(progressCalls.length).toBeGreaterThan(0);

      // Last call should have read all bytes
      const lastCall = progressCalls[progressCalls.length - 1];
      if (lastCall) {
        expect(lastCall.read).toBe(lastCall.total);
      }
    });

    test("throws error for non-existent file", async () => {
      await expect(hashFile("/nonexistent/file.txt")).rejects.toThrow("Failed to access file");
    });

    test("throws error for directory path", async () => {
      await expect(hashFile(TEST_DIR)).rejects.toThrow("Path is not a file");
    });

    test("produces same hash as hashContent for same data", async () => {
      const content = "hello world";
      const contentResult = hashContent(content);
      const fileResult = await hashFile(TEST_FILE);

      expect(fileResult.digest).toBe(contentResult.digest);
    });
  });
});
