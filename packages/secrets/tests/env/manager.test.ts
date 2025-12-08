import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  deleteEnv,
  getEnv,
  getEnvValue,
  hasLocalEnv,
  listEnv,
  resolveAllEnv,
  resolveToolEnv,
  setEnv,
} from "../../src/env/manager";
import { setLocalEnvVar } from "../../src/env/writer";

describe("env/manager", () => {
  const testDir = join(tmpdir(), `enact-manager-test-${Date.now()}`);
  const localEnvDir = join(testDir, ".enact");
  const localEnvPath = join(localEnvDir, ".env");

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe("setEnv", () => {
    it("should set local env var when scope is local", () => {
      setEnv("LOCAL_VAR", "local-value", "local", testDir);

      expect(existsSync(localEnvPath)).toBe(true);
      const result = getEnv("LOCAL_VAR", undefined, testDir);
      expect(result?.value).toBe("local-value");
      expect(result?.source).toBe("local");
    });

    // Note: Testing global env would require mocking homedir() or using temp home
  });

  describe("getEnv", () => {
    it("should return local value with local source", () => {
      setLocalEnvVar("KEY", "local-value", testDir);

      const result = getEnv("KEY", undefined, testDir);

      expect(result).not.toBeNull();
      expect(result?.value).toBe("local-value");
      expect(result?.source).toBe("local");
      expect(result?.filePath).toContain(".enact");
    });

    it("should return default value when not found", () => {
      const result = getEnv("NONEXISTENT", "default-value", testDir);

      expect(result?.value).toBe("default-value");
      expect(result?.source).toBe("default");
    });

    it("should return null when not found and no default", () => {
      const result = getEnv("NONEXISTENT", undefined, testDir);

      expect(result).toBeNull();
    });

    it("should include key in result", () => {
      setLocalEnvVar("MY_KEY", "value", testDir);

      const result = getEnv("MY_KEY", undefined, testDir);

      expect(result?.key).toBe("MY_KEY");
    });
  });

  describe("getEnvValue", () => {
    it("should return just the value", () => {
      setLocalEnvVar("KEY", "the-value", testDir);

      const value = getEnvValue("KEY", undefined, testDir);

      expect(value).toBe("the-value");
    });

    it("should return default if not found", () => {
      const value = getEnvValue("NONEXISTENT", "default", testDir);

      expect(value).toBe("default");
    });

    it("should return undefined if not found and no default", () => {
      const value = getEnvValue("NONEXISTENT", undefined, testDir);

      expect(value).toBeUndefined();
    });
  });

  describe("deleteEnv", () => {
    it("should delete local env var", () => {
      setLocalEnvVar("TO_DELETE", "value", testDir);
      expect(getEnvValue("TO_DELETE", undefined, testDir)).toBe("value");

      const deleted = deleteEnv("TO_DELETE", "local", testDir);

      expect(deleted).toBe(true);
      expect(getEnvValue("TO_DELETE", undefined, testDir)).toBeUndefined();
    });

    it("should return false if var doesn't exist", () => {
      // Create the file first with some other var
      setLocalEnvVar("OTHER", "value", testDir);

      const deleted = deleteEnv("NONEXISTENT", "local", testDir);

      expect(deleted).toBe(false);
    });
  });

  describe("listEnv", () => {
    it("should list local env vars", () => {
      setLocalEnvVar("KEY1", "value1", testDir);
      setLocalEnvVar("KEY2", "value2", testDir);

      const vars = listEnv("local", testDir);

      expect(vars).toHaveLength(2);
      expect(vars.find((v) => v.key === "KEY1")?.value).toBe("value1");
      expect(vars.find((v) => v.key === "KEY2")?.value).toBe("value2");
      expect(vars.every((v) => v.source === "local")).toBe(true);
    });

    it("should return empty array if no vars", () => {
      const vars = listEnv("local", testDir);

      expect(vars).toEqual([]);
    });
  });

  describe("resolveAllEnv", () => {
    it("should merge defaults with local vars", () => {
      const defaults = { KEY1: "default1", KEY2: "default2" };
      setLocalEnvVar("KEY2", "local2", testDir);

      const resolved = resolveAllEnv(defaults, testDir);

      expect(resolved.get("KEY1")?.value).toBe("default1");
      expect(resolved.get("KEY1")?.source).toBe("default");
      expect(resolved.get("KEY2")?.value).toBe("local2");
      expect(resolved.get("KEY2")?.source).toBe("local");
    });

    it("should work with empty defaults", () => {
      setLocalEnvVar("KEY", "value", testDir);

      const resolved = resolveAllEnv({}, testDir);

      expect(resolved.get("KEY")?.value).toBe("value");
    });
  });

  describe("resolveToolEnv", () => {
    it("should resolve env vars from tool declarations", () => {
      setLocalEnvVar("API_URL", "https://api.example.com", testDir);

      const declarations = {
        API_URL: { description: "API endpoint" },
        TIMEOUT: { description: "Timeout in ms", default: "5000" },
      };

      const { resolved, missing } = resolveToolEnv(declarations, testDir);

      expect(missing).toEqual([]);
      expect(resolved.get("API_URL")?.value).toBe("https://api.example.com");
      expect(resolved.get("TIMEOUT")?.value).toBe("5000");
      expect(resolved.get("TIMEOUT")?.source).toBe("default");
    });

    it("should report missing required vars", () => {
      const declarations = {
        REQUIRED_VAR: { description: "This is required" },
        OPTIONAL_VAR: { description: "This has default", default: "default" },
      };

      const { resolved, missing } = resolveToolEnv(declarations, testDir);

      expect(missing).toEqual(["REQUIRED_VAR"]);
      expect(resolved.get("OPTIONAL_VAR")?.value).toBe("default");
    });

    it("should skip secret declarations", () => {
      setLocalEnvVar("SECRET_KEY", "should-not-be-used", testDir);

      const declarations = {
        SECRET_KEY: { description: "API secret", secret: true },
        NORMAL_KEY: { description: "Normal key", default: "default" },
      };

      const { resolved, missing } = resolveToolEnv(declarations, testDir);

      expect(resolved.has("SECRET_KEY")).toBe(false);
      expect(resolved.get("NORMAL_KEY")?.value).toBe("default");
      expect(missing).toEqual([]);
    });
  });

  describe("hasLocalEnv", () => {
    it("should return true if local .env exists", () => {
      setLocalEnvVar("KEY", "value", testDir);

      expect(hasLocalEnv(testDir)).toBe(true);
    });

    it("should return false if local .env doesn't exist", () => {
      expect(hasLocalEnv(testDir)).toBe(false);
    });
  });
});
