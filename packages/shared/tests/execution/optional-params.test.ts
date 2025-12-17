/**
 * Tests for optional parameter handling
 *
 * These tests verify the behavior of tools with optional parameters,
 * including parameters with defaults and parameters without defaults.
 */

import { describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { getMissingParams, interpolateCommand, prepareCommand } from "../../src/execution/command";
import {
  applyDefaults,
  getParamInfo,
  getRequiredParams,
  validateInputs,
} from "../../src/execution/validation";

describe("Optional Parameters", () => {
  describe("Schema with optional params (no defaults)", () => {
    const schemaWithOptional: JSONSchema7 = {
      type: "object",
      properties: {
        name: { type: "string", description: "Required name" },
        greeting: { type: "string", description: "Optional greeting prefix" },
        suffix: { type: "string", description: "Optional suffix" },
      },
      required: ["name"], // Only name is required
    };

    test("identifies required vs optional params", () => {
      const required = getRequiredParams(schemaWithOptional);
      expect(required).toEqual(["name"]);
      expect(required).not.toContain("greeting");
      expect(required).not.toContain("suffix");
    });

    test("getParamInfo shows which params are required", () => {
      const info = getParamInfo(schemaWithOptional);

      expect(info.get("name")?.required).toBe(true);
      expect(info.get("greeting")?.required).toBe(false);
      expect(info.get("suffix")?.required).toBe(false);
    });

    test("validates successfully with only required params", () => {
      const result = validateInputs({ name: "Alice" }, schemaWithOptional);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("validates successfully with all params", () => {
      const result = validateInputs(
        { name: "Alice", greeting: "Hello", suffix: "!" },
        schemaWithOptional
      );
      expect(result.valid).toBe(true);
    });

    test("fails validation without required param", () => {
      const result = validateInputs({ greeting: "Hello" }, schemaWithOptional);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes("name"))).toBe(true);
    });

    test("applyDefaults does not add optional params without defaults", () => {
      const result = applyDefaults({ name: "Alice" }, schemaWithOptional);

      expect(result.name).toBe("Alice");
      expect(result.greeting).toBeUndefined();
      expect(result.suffix).toBeUndefined();
    });
  });

  describe("Schema with optional params (with defaults)", () => {
    const schemaWithDefaults: JSONSchema7 = {
      type: "object",
      properties: {
        name: { type: "string" },
        greeting: { type: "string", default: "Hello" },
        count: { type: "number", default: 1 },
        enabled: { type: "boolean", default: true },
      },
      required: ["name"],
    };

    test("applyDefaults fills in optional params with defaults", () => {
      const result = applyDefaults({ name: "Alice" }, schemaWithDefaults);

      expect(result.name).toBe("Alice");
      expect(result.greeting).toBe("Hello");
      expect(result.count).toBe(1);
      expect(result.enabled).toBe(true);
    });

    test("applyDefaults does not override provided values", () => {
      const result = applyDefaults({ name: "Alice", greeting: "Hi", count: 5 }, schemaWithDefaults);

      expect(result.greeting).toBe("Hi");
      expect(result.count).toBe(5);
    });

    test("validates with defaults applied", () => {
      const withDefaults = applyDefaults({ name: "Alice" }, schemaWithDefaults);
      const result = validateInputs(withDefaults, schemaWithDefaults);

      expect(result.valid).toBe(true);
    });
  });

  describe("Command interpolation with optional params", () => {
    test("getMissingParams identifies missing params in command", () => {
      const command = "echo ${greeting} ${name} ${suffix}";
      const params = { name: "Alice" };

      const missing = getMissingParams(command, params);

      expect(missing).toContain("greeting");
      expect(missing).toContain("suffix");
      expect(missing).not.toContain("name");
    });

    test("interpolateCommand throws by default for missing params", () => {
      const command = "echo ${greeting} ${name}";
      const params = { name: "Alice" };

      expect(() => interpolateCommand(command, params)).toThrow(
        "Missing required parameter: greeting"
      );
    });

    test("interpolateCommand with onMissing=empty replaces missing with empty string", () => {
      const command = "echo ${greeting} ${name}";
      const params = { name: "Alice" };

      const result = interpolateCommand(command, params, { onMissing: "empty" });

      expect(result).toBe("echo  Alice");
    });

    test("interpolateCommand with onMissing=keep preserves placeholder", () => {
      const command = "echo ${greeting} ${name}";
      const params = { name: "Alice" };

      const result = interpolateCommand(command, params, { onMissing: "keep" });

      expect(result).toBe("echo ${greeting} Alice");
    });
  });

  describe("Full flow: optional params without defaults", () => {
    // This tests the scenario that causes the bug:
    // - Optional param in schema (not in required[])
    // - No default value
    // - User doesn't provide it
    // - Command template references it

    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        name: { type: "string" },
        prefix: { type: "string" }, // Optional, no default
      },
      required: ["name"],
    };

    const command = "echo ${prefix}${name}";

    test("validation passes with only required param", () => {
      const inputs = { name: "Alice" };
      const withDefaults = applyDefaults(inputs, schema);
      const validation = validateInputs(withDefaults, schema);

      expect(validation.valid).toBe(true);
    });

    test("prepareCommand handles missing optional params with empty string", () => {
      const inputs = { name: "Alice" };
      const withDefaults = applyDefaults(inputs, schema);

      // prepareCommand now defaults to onMissing="empty" so optional params work
      const result = prepareCommand(command, withDefaults);

      // Should produce: ["echo", "Alice"] (prefix becomes empty string)
      expect(result).toContain("Alice");
    });

    test("interpolateCommand with explicit onMissing=empty still works", () => {
      const inputs = { name: "Alice" };
      const withDefaults = applyDefaults(inputs, schema);

      const result = interpolateCommand(command, withDefaults, { onMissing: "empty" });

      expect(result).toBe("echo Alice");
    });
  });

  describe("Recommended pattern: JSON input with explicit values", () => {
    // When using JSON, users can explicitly set empty strings for optional params

    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        name: { type: "string" },
        prefix: { type: "string" },
      },
      required: ["name"],
    };

    const command = "echo ${prefix}${name}";

    test("JSON with explicit empty string works", () => {
      // User provides: --args '{"name": "Alice", "prefix": ""}'
      const inputs = { name: "Alice", prefix: "" };
      const withDefaults = applyDefaults(inputs, schema);

      const result = prepareCommand(command, withDefaults);

      expect(result.join(" ")).toContain("Alice");
    });

    test("JSON with all values works", () => {
      // User provides: --args '{"name": "Alice", "prefix": "Hello, "}'
      const inputs = { name: "Alice", prefix: "Hello, " };
      const withDefaults = applyDefaults(inputs, schema);

      const result = prepareCommand(command, withDefaults);
      const resultStr = result.join(" ");

      expect(resultStr).toContain("Hello,");
      expect(resultStr).toContain("Alice");
    });
  });

  describe("Edge cases", () => {
    test("optional param with null value", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          value: { type: "string", default: "default" },
        },
        required: ["name"],
      };

      // Explicit null should not be replaced with default
      const result = applyDefaults({ name: "test", value: null }, schema);
      expect(result.value).toBeNull();
    });

    test("optional param with false boolean", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          enabled: { type: "boolean", default: true },
        },
      };

      // Explicit false should not be replaced with default
      const result = applyDefaults({ enabled: false }, schema);
      expect(result.enabled).toBe(false);
    });

    test("optional param with zero number", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          count: { type: "number", default: 10 },
        },
      };

      // Explicit 0 should not be replaced with default
      const result = applyDefaults({ count: 0 }, schema);
      expect(result.count).toBe(0);
    });

    test("optional param with empty string", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string", default: "default" },
        },
      };

      // Explicit empty string should not be replaced with default
      const result = applyDefaults({ name: "" }, schema);
      expect(result.name).toBe("");
    });
  });
});
