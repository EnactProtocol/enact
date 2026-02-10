/**
 * Tests for getEffectiveInputSchema and DEFAULT_INPUT_SCHEMA.
 */

import { describe, expect, test } from "bun:test";
import { DEFAULT_INPUT_SCHEMA, getEffectiveInputSchema } from "../src/types/actions";
import type { Action } from "../src/types/actions";

describe("DEFAULT_INPUT_SCHEMA", () => {
  test("is an object type schema", () => {
    expect(DEFAULT_INPUT_SCHEMA.type).toBe("object");
  });

  test("has empty properties", () => {
    expect(DEFAULT_INPUT_SCHEMA.properties).toEqual({});
  });

  test("has no required fields", () => {
    expect(DEFAULT_INPUT_SCHEMA.required).toBeUndefined();
  });
});

describe("getEffectiveInputSchema", () => {
  test("returns action inputSchema when provided", () => {
    const action: Action = {
      description: "test",
      command: ["echo"],
      inputSchema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    };

    const schema = getEffectiveInputSchema(action);
    expect(schema).toBe(action.inputSchema!);
    expect(schema.required).toEqual(["name"]);
  });

  test("returns DEFAULT_INPUT_SCHEMA when no inputSchema", () => {
    const action: Action = {
      description: "test",
      command: "echo hello",
    };

    const schema = getEffectiveInputSchema(action);
    expect(schema).toBe(DEFAULT_INPUT_SCHEMA);
    expect(schema.type).toBe("object");
    expect(schema.properties).toEqual({});
  });

  test("returns DEFAULT_INPUT_SCHEMA when inputSchema is undefined", () => {
    const action = {
      description: "test",
      command: ["echo", "hello"],
    } as Action;

    const schema = getEffectiveInputSchema(action);
    expect(schema).toBe(DEFAULT_INPUT_SCHEMA);
  });

  test("preserves complex inputSchema with nested properties", () => {
    const action: Action = {
      description: "test",
      command: ["cmd"],
      inputSchema: {
        type: "object",
        properties: {
          config: {
            type: "object",
            properties: {
              depth: { type: "number", default: 3 },
              format: { type: "string", enum: ["json", "csv"] },
            },
          },
        },
        required: ["config"],
      },
    };

    const schema = getEffectiveInputSchema(action);
    expect(schema.required).toEqual(["config"]);
    const props = schema.properties as Record<string, { type: string }>;
    expect(props.config!.type).toBe("object");
  });
});
