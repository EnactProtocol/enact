import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getGlobalEnvPath,
  getLocalEnvPath,
  loadLocalEnv,
  localEnvExists,
  readEnvFile,
  readEnvVars,
} from "../../src/env/reader";
import {
  deleteEnvVar,
  deleteLocalEnvVar,
  setEnvVar,
  setLocalEnvVar,
  writeEnvFile,
  writeEnvVars,
} from "../../src/env/writer";

describe("env/reader", () => {
  const testDir = join(tmpdir(), `enact-test-${Date.now()}`);
  const testEnvPath = join(testDir, ".env");

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe("getGlobalEnvPath", () => {
    it("should return path to ~/.enact/.env", () => {
      const path = getGlobalEnvPath();
      expect(path).toContain(".enact");
      expect(path).toContain(".env");
    });
  });

  describe("getLocalEnvPath", () => {
    it("should return path relative to cwd", () => {
      const path = getLocalEnvPath(testDir);
      expect(path).toBe(join(testDir, ".enact", ".env"));
    });
  });

  describe("readEnvFile", () => {
    it("should read and parse an existing .env file", () => {
      writeFileSync(testEnvPath, "FOO=bar\nBAZ=qux");

      const result = readEnvFile(testEnvPath);

      expect(result.vars.FOO).toBe("bar");
      expect(result.vars.BAZ).toBe("qux");
      expect(result.lines).toHaveLength(2);
    });

    it("should return empty object for non-existent file", () => {
      const result = readEnvFile(join(testDir, "nonexistent.env"));

      expect(result.vars).toEqual({});
      expect(result.lines).toEqual([]);
    });
  });

  describe("readEnvVars", () => {
    it("should read .env file as key-value object", () => {
      writeFileSync(testEnvPath, "FOO=bar\nBAZ=qux");

      const result = readEnvVars(testEnvPath);

      expect(result).toEqual({ FOO: "bar", BAZ: "qux" });
    });

    it("should return empty object for non-existent file", () => {
      const result = readEnvVars(join(testDir, "nonexistent.env"));
      expect(result).toEqual({});
    });
  });

  describe("loadLocalEnv", () => {
    it("should load local .env file", () => {
      const localDir = join(testDir, ".enact");
      mkdirSync(localDir, { recursive: true });
      writeFileSync(join(localDir, ".env"), "LOCAL_KEY=local-value");

      const result = loadLocalEnv(testDir);

      expect(result.LOCAL_KEY).toBe("local-value");
    });

    it("should return empty object if local .env doesn't exist", () => {
      const result = loadLocalEnv(testDir);
      expect(result).toEqual({});
    });
  });

  describe("localEnvExists", () => {
    it("should return true if local .env exists", () => {
      const localDir = join(testDir, ".enact");
      mkdirSync(localDir, { recursive: true });
      writeFileSync(join(localDir, ".env"), "KEY=value");

      expect(localEnvExists(testDir)).toBe(true);
    });

    it("should return false if local .env doesn't exist", () => {
      expect(localEnvExists(testDir)).toBe(false);
    });
  });
});

describe("env/writer", () => {
  const testDir = join(tmpdir(), `enact-test-writer-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe("writeEnvFile", () => {
    it("should write parsed env file to disk", () => {
      const envPath = join(testDir, "test.env");
      const parsed = {
        vars: { FOO: "bar", BAZ: "qux" },
        lines: [
          { type: "variable" as const, raw: "FOO=bar", key: "FOO", value: "bar" },
          { type: "variable" as const, raw: "BAZ=qux", key: "BAZ", value: "qux" },
        ],
      };

      writeEnvFile(envPath, parsed);
      const result = readEnvVars(envPath);

      expect(result).toEqual({ FOO: "bar", BAZ: "qux" });
    });

    it("should create parent directories if needed", () => {
      const envPath = join(testDir, "nested", "deep", ".env");

      writeEnvFile(envPath, { vars: { KEY: "value" }, lines: [] });

      expect(existsSync(join(testDir, "nested", "deep"))).toBe(true);
    });
  });

  describe("writeEnvVars", () => {
    it("should write key-value object to .env file", () => {
      const envPath = join(testDir, "test.env");

      writeEnvVars(envPath, { FOO: "bar", BAZ: "qux" });
      const result = readEnvVars(envPath);

      expect(result).toEqual({ FOO: "bar", BAZ: "qux" });
    });
  });

  describe("setEnvVar", () => {
    it("should add a new variable to existing file", () => {
      const envPath = join(testDir, "test.env");
      writeFileSync(envPath, "FOO=bar");

      setEnvVar(envPath, "BAZ", "qux");
      const result = readEnvVars(envPath);

      expect(result).toEqual({ FOO: "bar", BAZ: "qux" });
    });

    it("should update an existing variable", () => {
      const envPath = join(testDir, "test.env");
      writeFileSync(envPath, "FOO=old");

      setEnvVar(envPath, "FOO", "new");
      const result = readEnvVars(envPath);

      expect(result.FOO).toBe("new");
    });

    it("should create file if it doesn't exist", () => {
      const envPath = join(testDir, "newfile.env");

      setEnvVar(envPath, "KEY", "value");
      const result = readEnvVars(envPath);

      expect(result.KEY).toBe("value");
    });

    it("should preserve comments and formatting", () => {
      const envPath = join(testDir, "test.env");
      writeFileSync(envPath, "# Comment\nFOO=bar\n\nBAZ=qux");

      setEnvVar(envPath, "FOO", "updated");
      const parsed = readEnvFile(envPath);

      expect(parsed.lines[0]?.type).toBe("comment");
      expect(parsed.lines[2]?.type).toBe("empty");
      expect(parsed.vars.FOO).toBe("updated");
    });
  });

  describe("deleteEnvVar", () => {
    it("should delete an existing variable", () => {
      const envPath = join(testDir, "test.env");
      writeFileSync(envPath, "FOO=bar\nBAZ=qux");

      const deleted = deleteEnvVar(envPath, "FOO");
      const result = readEnvVars(envPath);

      expect(deleted).toBe(true);
      expect(result.FOO).toBeUndefined();
      expect(result.BAZ).toBe("qux");
    });

    it("should return false for non-existent variable", () => {
      const envPath = join(testDir, "test.env");
      writeFileSync(envPath, "FOO=bar");

      const deleted = deleteEnvVar(envPath, "NONEXISTENT");

      expect(deleted).toBe(false);
    });
  });

  describe("setLocalEnvVar", () => {
    it("should set a variable in local .env", () => {
      setLocalEnvVar("LOCAL_KEY", "local-value", testDir);
      const result = loadLocalEnv(testDir);

      expect(result.LOCAL_KEY).toBe("local-value");
    });

    it("should create .enact directory if needed", () => {
      setLocalEnvVar("KEY", "value", testDir);

      expect(existsSync(join(testDir, ".enact"))).toBe(true);
    });
  });

  describe("deleteLocalEnvVar", () => {
    it("should delete a variable from local .env", () => {
      setLocalEnvVar("KEY", "value", testDir);
      const deleted = deleteLocalEnvVar("KEY", testDir);

      expect(deleted).toBe(true);
      expect(loadLocalEnv(testDir).KEY).toBeUndefined();
    });
  });
});
