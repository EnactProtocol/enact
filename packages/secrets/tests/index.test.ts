import { describe, expect, it, mock } from "bun:test";

// Mock the keyring module before importing anything that uses it
mock.module("@zowe/secrets-for-zowe-sdk", () => ({
  keyring: {
    setPassword: async () => {},
    getPassword: async () => null,
    deletePassword: async () => false,
    findCredentials: async () => [],
    findPassword: async () => null,
  },
}));

// Now we can safely import from index
import { version } from "../src/index";

describe("@enactprotocol/secrets", () => {
  it("should export version", () => {
    expect(version).toBe("0.1.0");
  });

  it("should be a valid semver version", () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
