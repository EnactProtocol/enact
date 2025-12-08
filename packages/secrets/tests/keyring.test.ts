import { beforeEach, describe, expect, it } from "bun:test";
import { KEYRING_SERVICE } from "../src/types";
import {
  createMockKeyringFunctions,
  mockKeyring,
  resetMockKeyring,
  seedMockKeyring,
} from "./mocks/keyring";

describe("keyring", () => {
  const testService = "test-enact-cli";
  const { setSecret, getSecret, listSecrets, deleteSecret, secretExists, listAllSecrets } =
    createMockKeyringFunctions(testService);

  beforeEach(() => {
    resetMockKeyring();
  });

  describe("KEYRING_SERVICE", () => {
    it("should be defined as enact-cli", () => {
      expect(KEYRING_SERVICE).toBe("enact-cli");
    });
  });

  describe("setSecret", () => {
    it("should store a secret in the keyring", async () => {
      await setSecret("alice/api", "API_KEY", "secret123");
      const stored = await mockKeyring.getPassword(testService, "alice/api:API_KEY");
      expect(stored).toBe("secret123");
    });

    it("should store multiple secrets for different namespaces", async () => {
      await setSecret("alice/api", "KEY1", "value1");
      await setSecret("bob/api", "KEY2", "value2");

      expect(await mockKeyring.getPassword(testService, "alice/api:KEY1")).toBe("value1");
      expect(await mockKeyring.getPassword(testService, "bob/api:KEY2")).toBe("value2");
    });

    it("should overwrite existing secret", async () => {
      await setSecret("alice/api", "API_KEY", "old-value");
      await setSecret("alice/api", "API_KEY", "new-value");

      expect(await mockKeyring.getPassword(testService, "alice/api:API_KEY")).toBe("new-value");
    });

    it("should handle empty namespace", async () => {
      await setSecret("", "GLOBAL_KEY", "global-value");
      expect(await mockKeyring.getPassword(testService, ":GLOBAL_KEY")).toBe("global-value");
    });

    it("should handle special characters in key names", async () => {
      await setSecret("namespace", "MY_API_KEY_123", "special-value");
      expect(await mockKeyring.getPassword(testService, "namespace:MY_API_KEY_123")).toBe(
        "special-value"
      );
    });
  });

  describe("getSecret", () => {
    it("should retrieve a stored secret", async () => {
      await setSecret("alice/api", "API_KEY", "secret123");
      const result = await getSecret("alice/api", "API_KEY");
      expect(result).toBe("secret123");
    });

    it("should return null for non-existent secret", async () => {
      const result = await getSecret("alice/api", "NONEXISTENT");
      expect(result).toBeNull();
    });

    it("should return null for non-existent namespace", async () => {
      const result = await getSecret("nonexistent/namespace", "KEY");
      expect(result).toBeNull();
    });

    it("should differentiate between namespaces", async () => {
      await setSecret("alice/api", "API_KEY", "alice-secret");
      await setSecret("bob/api", "API_KEY", "bob-secret");

      const aliceResult = await getSecret("alice/api", "API_KEY");
      const bobResult = await getSecret("bob/api", "API_KEY");

      expect(aliceResult).toBe("alice-secret");
      expect(bobResult).toBe("bob-secret");
    });
  });

  describe("listSecrets", () => {
    it("should return empty array for namespace with no secrets", async () => {
      const result = await listSecrets("empty/namespace");
      expect(result).toEqual([]);
    });

    it("should list all secrets in a namespace", async () => {
      await setSecret("alice/api", "KEY1", "value1");
      await setSecret("alice/api", "KEY2", "value2");
      await setSecret("alice/api", "KEY3", "value3");

      const result = await listSecrets("alice/api");
      expect(result).toHaveLength(3);
      expect(result).toContain("KEY1");
      expect(result).toContain("KEY2");
      expect(result).toContain("KEY3");
    });

    it("should only list secrets for specified namespace", async () => {
      await setSecret("alice/api", "ALICE_KEY", "alice-value");
      await setSecret("bob/api", "BOB_KEY", "bob-value");

      const aliceSecrets = await listSecrets("alice/api");
      const bobSecrets = await listSecrets("bob/api");

      expect(aliceSecrets).toEqual(["ALICE_KEY"]);
      expect(bobSecrets).toEqual(["BOB_KEY"]);
    });

    it("should handle nested namespaces correctly", async () => {
      await setSecret("alice", "ROOT_KEY", "root-value");
      await setSecret("alice/api", "API_KEY", "api-value");
      await setSecret("alice/api/slack", "SLACK_KEY", "slack-value");

      const rootSecrets = await listSecrets("alice");
      const apiSecrets = await listSecrets("alice/api");
      const slackSecrets = await listSecrets("alice/api/slack");

      expect(rootSecrets).toEqual(["ROOT_KEY"]);
      expect(apiSecrets).toEqual(["API_KEY"]);
      expect(slackSecrets).toEqual(["SLACK_KEY"]);
    });
  });

  describe("deleteSecret", () => {
    it("should delete an existing secret", async () => {
      await setSecret("alice/api", "API_KEY", "secret123");
      const deleted = await deleteSecret("alice/api", "API_KEY");

      expect(deleted).toBe(true);
      expect(await getSecret("alice/api", "API_KEY")).toBeNull();
    });

    it("should return false for non-existent secret", async () => {
      const deleted = await deleteSecret("alice/api", "NONEXISTENT");
      expect(deleted).toBe(false);
    });

    it("should only delete specified secret", async () => {
      await setSecret("alice/api", "KEY1", "value1");
      await setSecret("alice/api", "KEY2", "value2");

      await deleteSecret("alice/api", "KEY1");

      expect(await getSecret("alice/api", "KEY1")).toBeNull();
      expect(await getSecret("alice/api", "KEY2")).toBe("value2");
    });

    it("should not affect other namespaces", async () => {
      await setSecret("alice/api", "KEY", "alice-value");
      await setSecret("bob/api", "KEY", "bob-value");

      await deleteSecret("alice/api", "KEY");

      expect(await getSecret("alice/api", "KEY")).toBeNull();
      expect(await getSecret("bob/api", "KEY")).toBe("bob-value");
    });
  });

  describe("secretExists", () => {
    it("should return true for existing secret", async () => {
      await setSecret("namespace", "KEY", "value");
      const exists = await secretExists("namespace", "KEY");
      expect(exists).toBe(true);
    });

    it("should return false for non-existent secret", async () => {
      const exists = await secretExists("namespace", "NONEXISTENT");
      expect(exists).toBe(false);
    });
  });

  describe("listAllSecrets", () => {
    it("should return empty array when no secrets exist", async () => {
      const result = await listAllSecrets();
      expect(result).toEqual([]);
    });

    it("should list all secrets across all namespaces", async () => {
      await setSecret("alice/api", "KEY1", "value1");
      await setSecret("bob/api", "KEY2", "value2");
      await setSecret("charlie", "KEY3", "value3");

      const result = await listAllSecrets();
      expect(result).toHaveLength(3);
      expect(result).toContainEqual({ namespace: "alice/api", key: "KEY1" });
      expect(result).toContainEqual({ namespace: "bob/api", key: "KEY2" });
      expect(result).toContainEqual({ namespace: "charlie", key: "KEY3" });
    });
  });

  describe("seedMockKeyring", () => {
    it("should seed the mock keyring with test data", async () => {
      seedMockKeyring(testService, [
        { namespace: "alice/api", name: "KEY1", value: "value1" },
        { namespace: "bob/api", name: "KEY2", value: "value2" },
      ]);

      const result1 = await getSecret("alice/api", "KEY1");
      const result2 = await getSecret("bob/api", "KEY2");

      expect(result1).toBe("value1");
      expect(result2).toBe("value2");
    });
  });

  describe("edge cases", () => {
    it("should handle secrets with empty values", async () => {
      await setSecret("namespace", "EMPTY_KEY", "");
      const result = await getSecret("namespace", "EMPTY_KEY");
      expect(result).toBe("");
    });

    it("should handle secrets with special characters in values", async () => {
      const specialValue = "pass=word!@#$%^&*()[]{}|;':\",./<>?`~";
      await setSecret("namespace", "SPECIAL_KEY", specialValue);
      const result = await getSecret("namespace", "SPECIAL_KEY");
      expect(result).toBe(specialValue);
    });

    it("should handle secrets with newlines", async () => {
      const multilineValue = "line1\nline2\nline3";
      await setSecret("namespace", "MULTILINE_KEY", multilineValue);
      const result = await getSecret("namespace", "MULTILINE_KEY");
      expect(result).toBe(multilineValue);
    });

    it("should handle unicode in values", async () => {
      const unicodeValue = "emoji: 🔐 日本語 中文";
      await setSecret("namespace", "UNICODE_KEY", unicodeValue);
      const result = await getSecret("namespace", "UNICODE_KEY");
      expect(result).toBe(unicodeValue);
    });

    it("should handle very long namespace paths", async () => {
      const longNamespace = "org/team/project/service/component/instance";
      await setSecret(longNamespace, "KEY", "deep-value");
      const result = await getSecret(longNamespace, "KEY");
      expect(result).toBe("deep-value");
    });
  });
});
