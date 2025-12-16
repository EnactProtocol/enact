import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  deletePassword,
  findCredentials,
  findPassword,
  forceFallback,
  getPassword,
  isUsingFallback,
  setPassword,
} from "./keyring";

const TEST_SERVICE = "enact-keyring-test";

describe("keyring", () => {
  describe("OS keyring (when available)", () => {
    const testAccount = `test-account-${Date.now()}`;
    const testPassword = "test-password-123!@#";

    afterAll(async () => {
      // Cleanup
      await deletePassword(TEST_SERVICE, testAccount);
    });

    test("setPassword stores a password", async () => {
      await setPassword(TEST_SERVICE, testAccount, testPassword);
      // No error means success
    });

    test("getPassword retrieves stored password", async () => {
      const retrieved = await getPassword(TEST_SERVICE, testAccount);
      expect(retrieved).toBe(testPassword);
    });

    test("getPassword returns null for non-existent password", async () => {
      const retrieved = await getPassword(TEST_SERVICE, "non-existent-account");
      expect(retrieved).toBeNull();
    });

    test("setPassword updates existing password", async () => {
      const newPassword = "updated-password-456";
      await setPassword(TEST_SERVICE, testAccount, newPassword);
      const retrieved = await getPassword(TEST_SERVICE, testAccount);
      expect(retrieved).toBe(newPassword);
    });

    test("findCredentials lists credentials for service", async () => {
      const credentials = await findCredentials(TEST_SERVICE);
      expect(Array.isArray(credentials)).toBe(true);
      const found = credentials.find((c) => c.account === testAccount);
      expect(found).toBeDefined();
    });

    test("findPassword returns first password for service", async () => {
      const password = await findPassword(TEST_SERVICE);
      expect(password).not.toBeNull();
    });

    test("deletePassword removes password", async () => {
      const deleted = await deletePassword(TEST_SERVICE, testAccount);
      expect(deleted).toBe(true);

      const retrieved = await getPassword(TEST_SERVICE, testAccount);
      expect(retrieved).toBeNull();
    });

    test("deletePassword returns false for non-existent", async () => {
      const deleted = await deletePassword(TEST_SERVICE, "non-existent-account");
      expect(deleted).toBe(false);
    });
  });

  describe("fallback storage", () => {
    const testAccount = `fallback-test-${Date.now()}`;
    const testPassword = "fallback-password-789";

    beforeAll(() => {
      // Force fallback mode
      forceFallback(true);
    });

    afterAll(async () => {
      // Cleanup
      await deletePassword(TEST_SERVICE, testAccount);
      // Reset fallback mode
      forceFallback(false);
    });

    test("isUsingFallback returns true when forced", () => {
      expect(isUsingFallback()).toBe(true);
    });

    test("setPassword works in fallback mode", async () => {
      await setPassword(TEST_SERVICE, testAccount, testPassword);
      // No error means success
    });

    test("getPassword retrieves password in fallback mode", async () => {
      const retrieved = await getPassword(TEST_SERVICE, testAccount);
      expect(retrieved).toBe(testPassword);
    });

    test("getPassword returns null for non-existent in fallback", async () => {
      const retrieved = await getPassword(TEST_SERVICE, "non-existent-fallback");
      expect(retrieved).toBeNull();
    });

    test("setPassword updates existing in fallback mode", async () => {
      const newPassword = "updated-fallback-password";
      await setPassword(TEST_SERVICE, testAccount, newPassword);
      const retrieved = await getPassword(TEST_SERVICE, testAccount);
      expect(retrieved).toBe(newPassword);
    });

    test("findCredentials works in fallback mode", async () => {
      const credentials = await findCredentials(TEST_SERVICE);
      expect(Array.isArray(credentials)).toBe(true);
      const found = credentials.find((c) => c.account === testAccount);
      expect(found).toBeDefined();
    });

    test("findPassword works in fallback mode", async () => {
      const password = await findPassword(TEST_SERVICE);
      expect(password).not.toBeNull();
    });

    test("deletePassword works in fallback mode", async () => {
      const deleted = await deletePassword(TEST_SERVICE, testAccount);
      expect(deleted).toBe(true);

      const retrieved = await getPassword(TEST_SERVICE, testAccount);
      expect(retrieved).toBeNull();
    });

    test("deletePassword returns false for non-existent in fallback", async () => {
      const deleted = await deletePassword(TEST_SERVICE, "non-existent-fallback");
      expect(deleted).toBe(false);
    });
  });

  describe("special characters", () => {
    const testAccount = `special-chars-${Date.now()}`;

    afterAll(async () => {
      await deletePassword(TEST_SERVICE, testAccount);
    });

    test("handles passwords with special characters", async () => {
      const specialPassword = `p@ss'w"ord\`with$pecial!chars&more<>`;
      await setPassword(TEST_SERVICE, testAccount, specialPassword);
      const retrieved = await getPassword(TEST_SERVICE, testAccount);
      expect(retrieved).toBe(specialPassword);
    });

    test("handles passwords with unicode", async () => {
      const unicodePassword = "密码🔐пароль";
      await setPassword(TEST_SERVICE, testAccount, unicodePassword);
      const retrieved = await getPassword(TEST_SERVICE, testAccount);
      expect(retrieved).toBe(unicodePassword);
    });

    test("handles passwords with newlines", async () => {
      const multilinePassword = "line1\nline2\nline3";
      await setPassword(TEST_SERVICE, testAccount, multilinePassword);
      const retrieved = await getPassword(TEST_SERVICE, testAccount);
      expect(retrieved).toBe(multilinePassword);
    });

    test("handles empty password", async () => {
      const emptyPassword = "";
      await setPassword(TEST_SERVICE, testAccount, emptyPassword);
      const retrieved = await getPassword(TEST_SERVICE, testAccount);
      // Some systems may return null or empty string for empty passwords
      expect(retrieved === "" || retrieved === null).toBe(true);
    });
  });

  describe("edge cases", () => {
    test("handles very long account names", async () => {
      const longAccount = `${"a".repeat(200)}-${Date.now()}`;
      const password = "test-password";

      await setPassword(TEST_SERVICE, longAccount, password);
      const retrieved = await getPassword(TEST_SERVICE, longAccount);
      expect(retrieved).toBe(password);

      await deletePassword(TEST_SERVICE, longAccount);
    });

    test("handles very long passwords", async () => {
      const testAccount = `long-password-${Date.now()}`;
      const longPassword = "x".repeat(10000);

      await setPassword(TEST_SERVICE, testAccount, longPassword);
      const retrieved = await getPassword(TEST_SERVICE, testAccount);
      expect(retrieved).toBe(longPassword);

      await deletePassword(TEST_SERVICE, testAccount);
    });

    test("handles concurrent operations", async () => {
      const accounts = Array.from({ length: 5 }, (_, i) => `concurrent-${Date.now()}-${i}`);
      const password = "concurrent-password";

      // Set all passwords concurrently
      await Promise.all(accounts.map((acc) => setPassword(TEST_SERVICE, acc, password)));

      // Get all passwords concurrently
      const results = await Promise.all(accounts.map((acc) => getPassword(TEST_SERVICE, acc)));
      expect(results.every((r) => r === password)).toBe(true);

      // Delete all concurrently
      await Promise.all(accounts.map((acc) => deletePassword(TEST_SERVICE, acc)));
    });
  });
});
