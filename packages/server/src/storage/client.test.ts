/**
 * Storage client tests
 */

import { describe, expect, it } from "bun:test";
import { StorageClient, StorageError } from "./client.js";

describe("StorageClient", () => {
  describe("constructor", () => {
    it("should create client with full config", () => {
      const client = new StorageClient({
        accountId: "test-account",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        bucket: "test-bucket",
        endpoint: "https://test.r2.cloudflarestorage.com",
        region: "auto",
      });

      expect(client).toBeDefined();
    });

    it("should create client with minimal config", () => {
      const client = new StorageClient({
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        bucket: "test-bucket",
      });

      expect(client).toBeDefined();
    });
  });

  describe("StorageError", () => {
    it("should create error with code", () => {
      const error = new StorageError("Test error", "TEST_CODE");
      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_CODE");
      expect(error.name).toBe("StorageError");
    });

    it("should create error with status code", () => {
      const error = new StorageError("Not found", "NOT_FOUND", 404);
      expect(error.statusCode).toBe(404);
    });
  });
});

describe("createStorageClient", () => {
  it("should throw error if credentials are missing", async () => {
    // Save original env
    const originalEnv = { ...process.env };

    try {
      // Clear credentials
      process.env.R2_ACCESS_KEY_ID = undefined;
      process.env.R2_SECRET_ACCESS_KEY = undefined;

      // Import after clearing env
      const { createStorageClient } = await import("./client.js");

      expect(() => createStorageClient()).toThrow(StorageError);
      expect(() => createStorageClient()).toThrow("Missing required storage credentials");
    } finally {
      // Restore env
      process.env = originalEnv;
    }
  });
});
