/**
 * Input validation using JSON Schema
 *
 * Validates tool inputs against the manifest's inputSchema.
 */

import type { JSONSchema7 } from "json-schema";
import type { InputValidationError, InputValidationResult } from "./types";

/**
 * Validate inputs against a JSON Schema
 *
 * @param inputs - The inputs to validate
 * @param schema - The JSON Schema to validate against
 * @returns Validation result with errors and coerced values
 */
export function validateInputs(
  inputs: Record<string, unknown>,
  schema: JSONSchema7 | undefined
): InputValidationResult {
  // If no schema, everything is valid
  if (!schema) {
    return { valid: true, errors: [], coercedValues: inputs };
  }

  const errors: InputValidationError[] = [];
  const coercedValues: Record<string, unknown> = { ...inputs };

  // Check schema type (should be object)
  if (schema.type !== "object") {
    return { valid: true, errors: [], coercedValues: inputs };
  }

  const properties = schema.properties || {};
  const required = schema.required || [];

  // Check required properties
  for (const propName of required) {
    if (inputs[propName] === undefined) {
      const propSchema = properties[propName] as JSONSchema7 | undefined;
      const typeHint = propSchema?.type ? ` (${propSchema.type})` : "";
      errors.push({
        path: `params.${propName}`,
        message: `Missing required parameter: ${propName}${typeHint}`,
        expected: "value",
      });
    }
  }

  // Validate each property
  for (const [propName, propValue] of Object.entries(inputs)) {
    const propSchema = properties[propName] as JSONSchema7 | undefined;

    if (propSchema) {
      const propErrors = validateProperty(propName, propValue, propSchema);
      errors.push(...propErrors);

      // Attempt type coercion
      const coerced = coerceValue(propValue, propSchema);
      if (coerced !== undefined) {
        coercedValues[propName] = coerced;
      }
    }
  }

  // Check for additional properties if not allowed
  if (schema.additionalProperties === false) {
    for (const propName of Object.keys(inputs)) {
      if (!properties[propName]) {
        errors.push({
          path: `params.${propName}`,
          message: `Unknown parameter: ${propName}`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    coercedValues,
  };
}

/**
 * Validate a single property against its schema
 */
function validateProperty(
  name: string,
  value: unknown,
  schema: JSONSchema7
): InputValidationError[] {
  const errors: InputValidationError[] = [];
  const path = `params.${name}`;

  // Type validation
  if (schema.type) {
    const typeValid = validateType(value, schema.type);
    if (!typeValid) {
      errors.push({
        path,
        message: `Invalid type for ${name}: expected ${schema.type}, got ${typeof value}`,
        expected: String(schema.type),
        actual: value,
      });
      return errors; // Skip further validation if type is wrong
    }
  }

  // String validations
  if (typeof value === "string") {
    // minLength
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        path,
        message: `${name} must be at least ${schema.minLength} characters`,
        expected: `minLength: ${schema.minLength}`,
        actual: value,
      });
    }

    // maxLength
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        path,
        message: `${name} must be at most ${schema.maxLength} characters`,
        expected: `maxLength: ${schema.maxLength}`,
        actual: value,
      });
    }

    // pattern
    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push({
          path,
          message: `${name} must match pattern: ${schema.pattern}`,
          expected: `pattern: ${schema.pattern}`,
          actual: value,
        });
      }
    }

    // format (basic support)
    if (schema.format) {
      const formatError = validateFormat(value, schema.format);
      if (formatError) {
        errors.push({
          path,
          message: `${name}: ${formatError}`,
          expected: `format: ${schema.format}`,
          actual: value,
        });
      }
    }
  }

  // Number validations
  if (typeof value === "number") {
    // minimum
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({
        path,
        message: `${name} must be >= ${schema.minimum}`,
        expected: `minimum: ${schema.minimum}`,
        actual: value,
      });
    }

    // maximum
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({
        path,
        message: `${name} must be <= ${schema.maximum}`,
        expected: `maximum: ${schema.maximum}`,
        actual: value,
      });
    }

    // exclusiveMinimum
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      errors.push({
        path,
        message: `${name} must be > ${schema.exclusiveMinimum}`,
        expected: `exclusiveMinimum: ${schema.exclusiveMinimum}`,
        actual: value,
      });
    }

    // exclusiveMaximum
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
      errors.push({
        path,
        message: `${name} must be < ${schema.exclusiveMaximum}`,
        expected: `exclusiveMaximum: ${schema.exclusiveMaximum}`,
        actual: value,
      });
    }

    // multipleOf
    if (schema.multipleOf !== undefined && value % schema.multipleOf !== 0) {
      errors.push({
        path,
        message: `${name} must be a multiple of ${schema.multipleOf}`,
        expected: `multipleOf: ${schema.multipleOf}`,
        actual: value,
      });
    }
  }

  // Enum validation
  if (schema.enum && !schema.enum.includes(value as string | number | boolean | null)) {
    errors.push({
      path,
      message: `${name} must be one of: ${schema.enum.join(", ")}`,
      expected: `enum: [${schema.enum.join(", ")}]`,
      actual: value,
    });
  }

  // Const validation
  if (schema.const !== undefined && value !== schema.const) {
    errors.push({
      path,
      message: `${name} must be: ${schema.const}`,
      expected: `const: ${schema.const}`,
      actual: value,
    });
  }

  // Array validations
  if (Array.isArray(value)) {
    // minItems
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({
        path,
        message: `${name} must have at least ${schema.minItems} items`,
        expected: `minItems: ${schema.minItems}`,
        actual: value,
      });
    }

    // maxItems
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({
        path,
        message: `${name} must have at most ${schema.maxItems} items`,
        expected: `maxItems: ${schema.maxItems}`,
        actual: value,
      });
    }

    // uniqueItems
    if (schema.uniqueItems) {
      const seen = new Set();
      const hasDuplicates = value.some((item) => {
        const key = JSON.stringify(item);
        if (seen.has(key)) return true;
        seen.add(key);
        return false;
      });
      if (hasDuplicates) {
        errors.push({
          path,
          message: `${name} must contain unique items`,
          expected: "uniqueItems: true",
          actual: value,
        });
      }
    }
  }

  return errors;
}

/**
 * Validate a value matches the expected type
 */
function validateType(value: unknown, type: JSONSchema7["type"]): boolean {
  if (type === undefined) return true;

  // Handle array of types
  if (Array.isArray(type)) {
    return type.some((t) => validateType(value, t));
  }

  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && !Number.isNaN(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "null":
      return value === null;
    default:
      return true;
  }
}

/**
 * Validate string format
 */
function validateFormat(value: string, format: string): string | null {
  switch (format) {
    case "email": {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return "Invalid email format";
      }
      break;
    }

    case "uri":
    case "url": {
      try {
        new URL(value);
      } catch {
        return "Invalid URL format";
      }
      break;
    }

    case "date": {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(value) || Number.isNaN(Date.parse(value))) {
        return "Invalid date format (expected YYYY-MM-DD)";
      }
      break;
    }

    case "date-time": {
      if (Number.isNaN(Date.parse(value))) {
        return "Invalid date-time format";
      }
      break;
    }

    case "time": {
      const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;
      if (!timeRegex.test(value)) {
        return "Invalid time format (expected HH:MM or HH:MM:SS)";
      }
      break;
    }

    case "uuid": {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(value)) {
        return "Invalid UUID format";
      }
      break;
    }

    case "hostname": {
      const hostnameRegex =
        /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!hostnameRegex.test(value)) {
        return "Invalid hostname format";
      }
      break;
    }

    case "ipv4": {
      const ipv4Regex =
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipv4Regex.test(value)) {
        return "Invalid IPv4 format";
      }
      break;
    }

    // Note: Add more formats as needed
  }

  return null;
}

/**
 * Attempt to coerce a value to match the schema type
 */
function coerceValue(value: unknown, schema: JSONSchema7): unknown {
  if (value === undefined || value === null) {
    return schema.default;
  }

  const type = schema.type;
  if (!type || Array.isArray(type)) {
    return value;
  }

  // String coercion
  if (type === "string" && typeof value !== "string") {
    return String(value);
  }

  // Number coercion
  if ((type === "number" || type === "integer") && typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      if (type === "integer") {
        return Math.floor(parsed);
      }
      return parsed;
    }
  }

  // Boolean coercion
  if (type === "boolean" && typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }

  return value;
}

/**
 * Apply default values from schema to inputs
 *
 * @param inputs - Current inputs
 * @param schema - Input schema with defaults
 * @returns Inputs with defaults applied
 */
export function applyDefaults(
  inputs: Record<string, unknown>,
  schema: JSONSchema7 | undefined
): Record<string, unknown> {
  if (!schema || schema.type !== "object" || !schema.properties) {
    return inputs;
  }

  const result = { ...inputs };

  for (const [propName, propSchema] of Object.entries(schema.properties)) {
    if (result[propName] === undefined) {
      const prop = propSchema as JSONSchema7;
      if (prop.default !== undefined) {
        result[propName] = prop.default;
      }
    }
  }

  return result;
}

/**
 * Get the list of required parameters from a schema
 *
 * @param schema - Input schema
 * @returns Array of required parameter names
 */
export function getRequiredParams(schema: JSONSchema7 | undefined): string[] {
  if (!schema || !schema.required) {
    return [];
  }
  return [...schema.required];
}

/**
 * Get parameter info from schema for help/documentation
 *
 * @param schema - Input schema
 * @returns Map of parameter name to info
 */
export function getParamInfo(
  schema: JSONSchema7 | undefined
): Map<
  string,
  { type: string; description?: string | undefined; required: boolean; default?: unknown }
> {
  const info = new Map<
    string,
    { type: string; description?: string | undefined; required: boolean; default?: unknown }
  >();

  if (!schema || schema.type !== "object" || !schema.properties) {
    return info;
  }

  const required = new Set(schema.required || []);

  for (const [propName, propSchema] of Object.entries(schema.properties)) {
    const prop = propSchema as JSONSchema7;
    const entry: {
      type: string;
      description?: string | undefined;
      required: boolean;
      default?: unknown;
    } = {
      type: Array.isArray(prop.type) ? prop.type.join(" | ") : prop.type || "any",
      required: required.has(propName),
    };
    if (prop.description !== undefined) {
      entry.description = prop.description;
    }
    if (prop.default !== undefined) {
      entry.default = prop.default;
    }
    info.set(propName, entry);
  }

  return info;
}
