import { beforeEach, describe, expect, it, mock } from "bun:test";
import { KEYRING_SERVICE } from "../src/types";
import { mockKeyring, resetMockKeyring, seedMockKeyring } from "./mocks/keyring";

// Mock the keyring module before importing resolver
mock.module("../src/keyring", () => ({
  getSecret: async (namespace: string, name: string) => {
    const account = `${namespace}:${name}`;
    return mockKeyring.getPassword(KEYRING_SERVICE, account);
  },
}));

// Import after mocking
const {
  getNamespaceChain,
  resolveSecret,
  traceSecretResolution,
  resolveSecrets,
  checkRequiredSecrets,
} = await import("../src/resolver");

describe("resolver", () => {
  const testService = KEYRING_SERVICE;

  beforeEach(() => {
    resetMockKeyring();
  });

  describe("getNamespaceChain", () => {
    it("should return the full namespace chain for a path", () => {
      const chain = getNamespaceChain("alice/api/slack");
      expect(chain).toEqual(["alice/api/slack", "alice/api", "alice"]);
    });

    it("should return single element for simple namespace", () => {
      const chain = getNamespaceChain("alice");
      expect(chain).toEqual(["alice"]);
    });

    it("should return empty array for empty string", () => {
      const chain = getNamespaceChain("");
      expect(chain).toEqual([]);
    });

    it("should handle deep namespaces", () => {
      const chain = getNamespaceChain("org/team/project/service/component");
      expect(chain).toEqual([
        "org/team/project/service/component",
        "org/team/project/service",
        "org/team/project",
        "org/team",
        "org",
      ]);
    });

    it("should handle leading/trailing slashes", () => {
      const chain = getNamespaceChain("/alice/api/");
      expect(chain).toEqual(["alice/api", "alice"]);
    });

    it("should handle multiple consecutive slashes", () => {
      const chain = getNamespaceChain("alice//api");
      expect(chain).toEqual(["alice/api", "alice"]);
    });
  });

  describe("resolveSecret", () => {
    it("should find secret in exact namespace", async () => {
      seedMockKeyring(testService, [
        { namespace: "alice/api/slack", name: "API_TOKEN", value: "slack-token" },
      ]);

      const result = await resolveSecret("alice/api/slack", "API_TOKEN");

      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.namespace).toBe("alice/api/slack");
        expect(result.value).toBe("slack-token");
      }
    });

    it("should walk up namespace chain to find secret", async () => {
      seedMockKeyring(testService, [
        { namespace: "alice/api", name: "API_TOKEN", value: "api-level-token" },
      ]);

      const result = await resolveSecret("alice/api/slack", "API_TOKEN");

      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.namespace).toBe("alice/api");
        expect(result.value).toBe("api-level-token");
      }
    });

    it("should find secret at root namespace", async () => {
      seedMockKeyring(testService, [
        { namespace: "alice", name: "SHARED_KEY", value: "root-level-key" },
      ]);

      const result = await resolveSecret("alice/api/slack", "SHARED_KEY");

      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.namespace).toBe("alice");
        expect(result.value).toBe("root-level-key");
      }
    });

    it("should prefer more specific namespace", async () => {
      seedMockKeyring(testService, [
        { namespace: "alice", name: "API_TOKEN", value: "root-token" },
        { namespace: "alice/api", name: "API_TOKEN", value: "api-token" },
        { namespace: "alice/api/slack", name: "API_TOKEN", value: "slack-token" },
      ]);

      const result = await resolveSecret("alice/api/slack", "API_TOKEN");

      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.namespace).toBe("alice/api/slack");
        expect(result.value).toBe("slack-token");
      }
    });

    it("should return not found for missing secret", async () => {
      const result = await resolveSecret("alice/api/slack", "NONEXISTENT");

      expect(result.found).toBe(false);
      if (!result.found) {
        expect(result.searchedNamespaces).toEqual(["alice/api/slack", "alice/api", "alice"]);
      }
    });

    it("should include key in result", async () => {
      seedMockKeyring(testService, [{ namespace: "alice", name: "MY_SECRET", value: "value" }]);

      const result = await resolveSecret("alice/api", "MY_SECRET");

      expect(result.key).toBe("MY_SECRET");
    });
  });

  describe("traceSecretResolution", () => {
    it("should trace all checked namespaces", async () => {
      seedMockKeyring(testService, [{ namespace: "alice/api", name: "API_TOKEN", value: "token" }]);

      const trace = await traceSecretResolution("alice/api/slack", "API_TOKEN");

      expect(trace.key).toBe("API_TOKEN");
      expect(trace.toolPath).toBe("alice/api/slack");
      expect(trace.entries).toHaveLength(3);

      // First entry (most specific) - not found
      const entry0 = trace.entries[0];
      const entry1 = trace.entries[1];
      const entry2 = trace.entries[2];
      expect(entry0).toBeDefined();
      expect(entry1).toBeDefined();
      expect(entry2).toBeDefined();

      expect(entry0?.namespace).toBe("alice/api/slack");
      expect(entry0?.found).toBe(false);

      // Second entry - found
      expect(entry1?.namespace).toBe("alice/api");
      expect(entry1?.found).toBe(true);

      // Third entry - not found (but would have been checked)
      expect(entry2?.namespace).toBe("alice");
      expect(entry2?.found).toBe(false);

      // Result should be the first found
      expect(trace.result.found).toBe(true);
      if (trace.result.found) {
        expect(trace.result.namespace).toBe("alice/api");
      }
    });

    it("should trace all namespaces when secret not found", async () => {
      const trace = await traceSecretResolution("alice/api", "MISSING");

      expect(trace.entries).toHaveLength(2);
      expect(trace.entries.every((e) => !e.found)).toBe(true);
      expect(trace.result.found).toBe(false);
    });

    it("should include account format in entries", async () => {
      seedMockKeyring(testService, [{ namespace: "alice", name: "KEY", value: "value" }]);

      const trace = await traceSecretResolution("alice/api", "KEY");
      const entry0 = trace.entries[0];
      const entry1 = trace.entries[1];

      expect(entry0?.account).toBe("alice/api:KEY");
      expect(entry1?.account).toBe("alice:KEY");
    });
  });

  describe("resolveSecrets", () => {
    it("should resolve multiple secrets", async () => {
      seedMockKeyring(testService, [
        { namespace: "alice", name: "KEY1", value: "value1" },
        { namespace: "alice/api", name: "KEY2", value: "value2" },
      ]);

      const results = await resolveSecrets("alice/api", ["KEY1", "KEY2", "KEY3"]);

      expect(results.size).toBe(3);

      const key1 = results.get("KEY1");
      expect(key1?.found).toBe(true);
      if (key1?.found) {
        expect(key1.value).toBe("value1");
      }

      const key2 = results.get("KEY2");
      expect(key2?.found).toBe(true);
      if (key2?.found) {
        expect(key2.value).toBe("value2");
      }

      const key3 = results.get("KEY3");
      expect(key3?.found).toBe(false);
    });

    it("should return empty map for empty secret list", async () => {
      const results = await resolveSecrets("alice/api", []);
      expect(results.size).toBe(0);
    });
  });

  describe("checkRequiredSecrets", () => {
    it("should report all found when all secrets exist", async () => {
      seedMockKeyring(testService, [
        { namespace: "alice", name: "KEY1", value: "value1" },
        { namespace: "alice/api", name: "KEY2", value: "value2" },
      ]);

      const check = await checkRequiredSecrets("alice/api", ["KEY1", "KEY2"]);

      expect(check.allFound).toBe(true);
      expect(check.found).toHaveLength(2);
      expect(check.missing).toEqual([]);
    });

    it("should report missing secrets", async () => {
      seedMockKeyring(testService, [{ namespace: "alice", name: "KEY1", value: "value1" }]);

      const check = await checkRequiredSecrets("alice/api", ["KEY1", "KEY2", "KEY3"]);

      expect(check.allFound).toBe(false);
      expect(check.found).toHaveLength(1);
      expect(check.missing).toEqual(["KEY2", "KEY3"]);
    });

    it("should report all missing when no secrets exist", async () => {
      const check = await checkRequiredSecrets("alice/api", ["KEY1", "KEY2"]);

      expect(check.allFound).toBe(false);
      expect(check.found).toHaveLength(0);
      expect(check.missing).toEqual(["KEY1", "KEY2"]);
    });

    it("should return allFound true for empty required list", async () => {
      const check = await checkRequiredSecrets("alice/api", []);

      expect(check.allFound).toBe(true);
      expect(check.found).toHaveLength(0);
      expect(check.missing).toEqual([]);
    });

    it("should include resolution details in found results", async () => {
      seedMockKeyring(testService, [
        { namespace: "alice", name: "SHARED_KEY", value: "shared-value" },
      ]);

      const check = await checkRequiredSecrets("alice/api/slack", ["SHARED_KEY"]);
      const foundResult = check.found[0];
      expect(foundResult).toBeDefined();

      expect(foundResult?.namespace).toBe("alice");
      expect(foundResult?.value).toBe("shared-value");
      expect(foundResult?.key).toBe("SHARED_KEY");
    });
  });
});
