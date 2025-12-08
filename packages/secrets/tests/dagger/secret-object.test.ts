import { beforeEach, describe, expect, it, mock } from "bun:test";
import { KEYRING_SERVICE } from "../../src/types";
import { mockKeyring, resetMockKeyring, seedMockKeyring } from "../mocks/keyring";

// Mock the keyring module before importing
mock.module("../../src/keyring", () => ({
  getSecret: async (namespace: string, name: string) => {
    const account = `${namespace}:${name}`;
    return mockKeyring.getPassword(KEYRING_SERVICE, account);
  },
}));

// Import after mocking
const { getSecretObject, getSecretObjects, parseSecretOverride, parseSecretOverrides } =
  await import("../../src/dagger/secret-object");

describe("dagger/secret-object", () => {
  const testService = KEYRING_SERVICE;

  beforeEach(() => {
    resetMockKeyring();
  });

  describe("getSecretObject", () => {
    it("should get secret from keyring", async () => {
      seedMockKeyring(testService, [
        { namespace: "alice/api", name: "API_TOKEN", value: "keyring-token" },
      ]);

      const result = await getSecretObject("alice/api", "API_TOKEN");

      expect(result.name).toBe("API_TOKEN");
      expect(result.value).toBe("keyring-token");
      expect(result.source).toBe("keyring");
      expect(result.namespace).toBe("alice/api");
    });

    it("should use override URI when provided", async () => {
      process.env.TEST_OVERRIDE_VAR = "override-value";

      const result = await getSecretObject("alice/api", "API_TOKEN", {
        overrideUri: "env://TEST_OVERRIDE_VAR",
      });

      expect(result.name).toBe("API_TOKEN");
      expect(result.value).toBe("override-value");
      expect(result.source).toBe("override");
      expect(result.overrideUri).toBe("env://TEST_OVERRIDE_VAR");

      process.env.TEST_OVERRIDE_VAR = undefined;
    });

    it("should prefer override URI over keyring", async () => {
      process.env.TEST_PRIORITY_VAR = "override-wins";
      seedMockKeyring(testService, [
        { namespace: "alice/api", name: "API_TOKEN", value: "keyring-value" },
      ]);

      const result = await getSecretObject("alice/api", "API_TOKEN", {
        overrideUri: "env://TEST_PRIORITY_VAR",
      });

      expect(result.value).toBe("override-wins");
      expect(result.source).toBe("override");

      process.env.TEST_PRIORITY_VAR = undefined;
    });

    it("should throw for missing secret without override", async () => {
      await expect(getSecretObject("alice/api", "NONEXISTENT_SECRET")).rejects.toThrow(
        /Secret.*not found/
      );
    });

    it("should use namespace inheritance to find secrets", async () => {
      seedMockKeyring(testService, [
        { namespace: "alice", name: "SHARED_KEY", value: "root-level" },
      ]);

      const result = await getSecretObject("alice/api/slack", "SHARED_KEY");

      expect(result.value).toBe("root-level");
      expect(result.namespace).toBe("alice");
    });
  });

  describe("getSecretObjects", () => {
    it("should get multiple secrets from keyring", async () => {
      seedMockKeyring(testService, [
        { namespace: "alice/api", name: "KEY1", value: "value1" },
        { namespace: "alice/api", name: "KEY2", value: "value2" },
      ]);

      const results = await getSecretObjects("alice/api", {
        KEY1: undefined,
        KEY2: undefined,
      });

      expect(results.size).toBe(2);
      expect(results.get("KEY1")?.value).toBe("value1");
      expect(results.get("KEY2")?.value).toBe("value2");
    });

    it("should support mixed keyring and override", async () => {
      process.env.TEST_MIXED_VAR = "from-env";
      seedMockKeyring(testService, [
        { namespace: "alice/api", name: "KEY1", value: "from-keyring" },
      ]);

      const results = await getSecretObjects("alice/api", {
        KEY1: undefined,
        KEY2: "env://TEST_MIXED_VAR",
      });

      expect(results.get("KEY1")?.value).toBe("from-keyring");
      expect(results.get("KEY1")?.source).toBe("keyring");
      expect(results.get("KEY2")?.value).toBe("from-env");
      expect(results.get("KEY2")?.source).toBe("override");

      process.env.TEST_MIXED_VAR = undefined;
    });

    it("should return empty map for empty input", async () => {
      const results = await getSecretObjects("alice/api", {});

      expect(results.size).toBe(0);
    });
  });

  describe("parseSecretOverride", () => {
    it("should parse valid override", () => {
      const result = parseSecretOverride("API_TOKEN=env://MY_TOKEN");

      expect(result).not.toBeNull();
      expect(result?.name).toBe("API_TOKEN");
      expect(result?.uri).toBe("env://MY_TOKEN");
    });

    it("should parse override with file:// URI", () => {
      const result = parseSecretOverride("SECRET_FILE=file:///etc/secret");

      expect(result?.name).toBe("SECRET_FILE");
      expect(result?.uri).toBe("file:///etc/secret");
    });

    it("should parse override with cmd:// URI", () => {
      const result = parseSecretOverride("DYNAMIC=cmd://echo hello");

      expect(result?.name).toBe("DYNAMIC");
      expect(result?.uri).toBe("cmd://echo hello");
    });

    it("should return null for missing =", () => {
      const result = parseSecretOverride("API_TOKEN");

      expect(result).toBeNull();
    });

    it("should return null for invalid URI", () => {
      const result = parseSecretOverride("API_TOKEN=not-a-uri");

      expect(result).toBeNull();
    });

    it("should return null for empty name", () => {
      const result = parseSecretOverride("=env://TOKEN");

      expect(result).toBeNull();
    });

    it("should handle whitespace", () => {
      const result = parseSecretOverride("  API_TOKEN  =  env://TOKEN  ");

      expect(result?.name).toBe("API_TOKEN");
      expect(result?.uri).toBe("env://TOKEN");
    });
  });

  describe("parseSecretOverrides", () => {
    it("should parse multiple overrides", () => {
      const result = parseSecretOverrides([
        "KEY1=env://VAR1",
        "KEY2=file:///etc/secret",
        "KEY3=cmd://echo test",
      ]);

      expect(result.KEY1).toBe("env://VAR1");
      expect(result.KEY2).toBe("file:///etc/secret");
      expect(result.KEY3).toBe("cmd://echo test");
    });

    it("should skip invalid overrides", () => {
      const result = parseSecretOverrides([
        "KEY1=env://VAR1",
        "INVALID",
        "KEY2=not-a-uri",
        "KEY3=file:///valid",
      ]);

      expect(Object.keys(result)).toHaveLength(2);
      expect(result.KEY1).toBe("env://VAR1");
      expect(result.KEY3).toBe("file:///valid");
    });

    it("should return empty object for empty input", () => {
      const result = parseSecretOverrides([]);

      expect(result).toEqual({});
    });

    it("should handle duplicates (last wins)", () => {
      const result = parseSecretOverrides(["KEY=env://VAR1", "KEY=env://VAR2"]);

      expect(result.KEY).toBe("env://VAR2");
    });
  });
});
