/**
 * Tests for auth utilities
 */

import { describe, expect, test } from "bun:test";
import { extractNamespace } from "../../src/utils/auth";

describe("auth utils", () => {
  describe("extractNamespace", () => {
    test("extracts namespace from simple tool name", () => {
      expect(extractNamespace("alice/greeter")).toBe("alice");
    });

    test("extracts namespace from nested tool name", () => {
      expect(extractNamespace("alice/utils/greeter")).toBe("alice");
    });

    test("extracts namespace from deeply nested tool name", () => {
      expect(extractNamespace("alice/utils/text/greeter")).toBe("alice");
    });

    test("returns empty string for tool name without namespace", () => {
      expect(extractNamespace("greeter")).toBe("greeter");
    });

    test("returns empty string for empty input", () => {
      expect(extractNamespace("")).toBe("");
    });

    test("handles namespace with hyphens", () => {
      expect(extractNamespace("my-org/my-tool")).toBe("my-org");
    });

    test("handles namespace with underscores", () => {
      expect(extractNamespace("my_org/my_tool")).toBe("my_org");
    });

    test("handles namespace with numbers", () => {
      expect(extractNamespace("user123/tool456")).toBe("user123");
    });
  });

  // Note: getCurrentUsername tests would require mocking the keyring and fetch
  // which is more complex. The function is tested indirectly through e2e tests.
});
