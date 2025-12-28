/**
 * Tests for input validation module
 */

import { describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import {
  applyDefaults,
  getParamInfo,
  getRequiredParams,
  validateInputs,
} from "../../src/execution/validation";

describe("Input Validation", () => {
  describe("validateInputs", () => {
    const simpleSchema: JSONSchema7 = {
      type: "object",
      properties: {
        name: { type: "string" },
        count: { type: "number" },
      },
      required: ["name"],
    };

    test("validates correct inputs", () => {
      const result = validateInputs({ name: "test", count: 5 }, simpleSchema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("reports missing required fields", () => {
      const result = validateInputs({ count: 5 }, simpleSchema);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]?.path).toContain("name");
    });

    test("includes type hint in error message for missing required params", () => {
      const result = validateInputs({ count: 5 }, simpleSchema);

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.message).toContain("name");
      expect(result.errors[0]?.message).toContain("string");
    });

    test("allows optional params to be omitted", () => {
      // Only "name" is required, "count" is optional
      const result = validateInputs({ name: "test" }, simpleSchema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("reports type errors", () => {
      const result = validateInputs({ name: "test", count: "not a number" }, simpleSchema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes("count"))).toBe(true);
    });

    test("validates nested objects", () => {
      const nestedSchema: JSONSchema7 = {
        type: "object",
        properties: {
          config: {
            type: "object",
            properties: {
              timeout: { type: "number" },
            },
            required: ["timeout"],
          },
        },
        required: ["config"],
      };

      const result = validateInputs({ config: { timeout: 30 } }, nestedSchema);

      expect(result.valid).toBe(true);
    });

    test("validates arrays", () => {
      const arraySchema: JSONSchema7 = {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { type: "string" },
          },
        },
      };

      const result = validateInputs({ items: ["a", "b", "c"] }, arraySchema);

      expect(result.valid).toBe(true);
    });

    test("handles empty inputs", () => {
      const result = validateInputs({}, simpleSchema);

      // Missing required "name"
      expect(result.valid).toBe(false);
    });

    test("validates string patterns", () => {
      const patternSchema: JSONSchema7 = {
        type: "object",
        properties: {
          email: {
            type: "string",
            pattern: "^[a-z]+@[a-z]+\\.[a-z]+$",
          },
        },
      };

      const validResult = validateInputs({ email: "test@example.com" }, patternSchema);
      expect(validResult.valid).toBe(true);

      const invalidResult = validateInputs({ email: "not-an-email" }, patternSchema);
      expect(invalidResult.valid).toBe(false);
    });

    test("validates enums", () => {
      const enumSchema: JSONSchema7 = {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["active", "inactive", "pending"],
          },
        },
      };

      const validResult = validateInputs({ status: "active" }, enumSchema);
      expect(validResult.valid).toBe(true);

      const invalidResult = validateInputs({ status: "unknown" }, enumSchema);
      expect(invalidResult.valid).toBe(false);
    });

    test("validates minimum and maximum", () => {
      const rangeSchema: JSONSchema7 = {
        type: "object",
        properties: {
          count: { type: "number", minimum: 0, maximum: 100 },
        },
      };

      expect(validateInputs({ count: 50 }, rangeSchema).valid).toBe(true);
      expect(validateInputs({ count: -1 }, rangeSchema).valid).toBe(false);
      expect(validateInputs({ count: 101 }, rangeSchema).valid).toBe(false);
    });

    test("validates string lengths", () => {
      const lengthSchema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string", minLength: 2, maxLength: 10 },
        },
      };

      expect(validateInputs({ name: "test" }, lengthSchema).valid).toBe(true);
      expect(validateInputs({ name: "x" }, lengthSchema).valid).toBe(false);
      expect(validateInputs({ name: "this is too long" }, lengthSchema).valid).toBe(false);
    });
  });

  describe("applyDefaults", () => {
    test("applies default values", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string", default: "default_name" },
          count: { type: "number", default: 10 },
        },
      };

      const result = applyDefaults({}, schema);

      expect(result.name).toBe("default_name");
      expect(result.count).toBe(10);
    });

    test("preserves provided values", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string", default: "default_name" },
        },
      };

      const result = applyDefaults({ name: "custom_name" }, schema);

      expect(result.name).toBe("custom_name");
    });

    test("applies nested defaults", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          config: {
            type: "object",
            default: { timeout: 30, retries: 3 },
          },
        },
      };

      const result = applyDefaults({}, schema);

      expect(result.config).toEqual({ timeout: 30, retries: 3 });
    });

    test("handles array defaults", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          tags: {
            type: "array",
            default: ["default", "tag"],
          },
        },
      };

      const result = applyDefaults({}, schema);

      expect(result.tags).toEqual(["default", "tag"]);
    });

    test("handles boolean defaults", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          enabled: { type: "boolean", default: true },
        },
      };

      const result = applyDefaults({}, schema);

      expect(result.enabled).toBe(true);
    });

    test("does not apply defaults for explicit null", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          value: { type: "string", default: "default" },
        },
      };

      // Explicitly passing null should not trigger default
      const result = applyDefaults({ value: null }, schema);

      expect(result.value).toBeNull();
    });

    test("applies defaults only for undefined", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          value: { type: "string", default: "default" },
          count: { type: "number", default: 0 },
        },
      };

      const result = applyDefaults({ value: undefined }, schema);

      expect(result.value).toBe("default");
      expect(result.count).toBe(0);
    });
  });

  describe("getRequiredParams", () => {
    test("returns required parameter names", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          age: { type: "number" },
        },
        required: ["name", "email"],
      };

      const result = getRequiredParams(schema);

      expect(result).toContain("name");
      expect(result).toContain("email");
      expect(result).not.toContain("age");
    });

    test("returns empty array when no required params", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      };

      const result = getRequiredParams(schema);

      expect(result).toEqual([]);
    });

    test("handles schema without properties", () => {
      const schema: JSONSchema7 = {
        type: "object",
      };

      const result = getRequiredParams(schema);

      expect(result).toEqual([]);
    });
  });

  describe("getParamInfo", () => {
    test("extracts parameter information", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "User name",
            default: "anonymous",
          },
          count: {
            type: "number",
            description: "Item count",
            minimum: 0,
          },
        },
        required: ["name"],
      };

      const result = getParamInfo(schema);

      expect(result.size).toBe(2);

      const nameParam = result.get("name");
      expect(nameParam).toBeDefined();
      expect(nameParam?.type).toBe("string");
      expect(nameParam?.description).toBe("User name");
      expect(nameParam?.required).toBe(true);
      expect(nameParam?.default).toBe("anonymous");

      const countParam = result.get("count");
      expect(countParam).toBeDefined();
      expect(countParam?.type).toBe("number");
      expect(countParam?.required).toBe(false);
    });

    test("handles array types", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Tags for categorization",
          },
        },
      };

      const result = getParamInfo(schema);
      const tagsParam = result.get("tags");

      expect(tagsParam?.type).toBe("array");
    });

    test("handles enum types", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["active", "inactive"],
            description: "Account status",
          },
        },
      };

      const result = getParamInfo(schema);
      const statusParam = result.get("status");

      // Note: getParamInfo doesn't extract enum values, just type
      expect(statusParam).toBeDefined();
      expect(statusParam?.type).toBe("string");
    });

    test("returns empty Map for schema without properties", () => {
      const schema: JSONSchema7 = {
        type: "object",
      };

      const result = getParamInfo(schema);

      expect(result.size).toBe(0);
    });
  });
});
