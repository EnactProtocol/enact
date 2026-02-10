/**
 * Tests for the action command interpolation module.
 *
 * Covers {{param}} template parsing, interpolation, omission of optionals,
 * and the prepareActionCommand entry point.
 */

import { describe, expect, test } from "bun:test";
import {
  getActionCommandParams,
  getMissingRequiredParams,
  hasActionTemplates,
  interpolateActionCommand,
  parseActionArgument,
  parseActionCommand,
  prepareActionCommand,
} from "../src/execution/action-command";

describe("hasActionTemplates", () => {
  test("returns true for string with {{param}}", () => {
    expect(hasActionTemplates("hello {{name}}")).toBe(true);
  });

  test("returns false for plain string", () => {
    expect(hasActionTemplates("echo hello")).toBe(false);
  });

  test("returns false for ${param} syntax", () => {
    expect(hasActionTemplates("echo ${name}")).toBe(false);
  });

  test("returns true for standalone {{param}}", () => {
    expect(hasActionTemplates("{{url}}")).toBe(true);
  });
});

describe("parseActionArgument", () => {
  test("parses a literal argument", () => {
    const result = parseActionArgument("echo");
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0]?.type).toBe("literal");
    expect(result.tokens[0]?.type === "literal" && result.tokens[0].value).toBe("echo");
    expect(result.parameters).toHaveLength(0);
  });

  test("parses a standalone parameter", () => {
    const result = parseActionArgument("{{url}}");
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0]?.type).toBe("parameter");
    expect(result.tokens[0]?.type === "parameter" && result.tokens[0].name).toBe("url");
    expect(result.parameters).toEqual(["url"]);
  });

  test("parses mixed literal and parameter", () => {
    const result = parseActionArgument("--name={{name}}");
    expect(result.tokens).toHaveLength(2);
    expect(result.tokens[0]?.type).toBe("literal");
    expect(result.tokens[1]?.type).toBe("parameter");
    expect(result.parameters).toEqual(["name"]);
  });

  test("parses multiple parameters in one argument", () => {
    const result = parseActionArgument("{{host}}:{{port}}");
    expect(result.tokens).toHaveLength(3);
    expect(result.parameters).toEqual(["host", "port"]);
  });

  test("trims whitespace in parameter names", () => {
    const result = parseActionArgument("{{ name }}");
    expect(result.parameters).toEqual(["name"]);
  });
});

describe("parseActionCommand", () => {
  test("parses command with no templates", () => {
    const result = parseActionCommand(["echo", "hello", "world"]);
    expect(result.allParameters).toHaveLength(0);
    expect(result.arguments).toHaveLength(3);
  });

  test("parses command with templates", () => {
    const result = parseActionCommand(["python", "main.py", "{{url}}"]);
    expect(result.allParameters).toEqual(["url"]);
  });

  test("deduplicates parameter names", () => {
    const result = parseActionCommand(["echo", "{{name}}", "{{name}}"]);
    expect(result.allParameters).toEqual(["name"]);
  });

  test("collects all unique parameters", () => {
    const result = parseActionCommand(["cmd", "{{a}}", "{{b}}", "{{c}}"]);
    expect(result.allParameters).toEqual(["a", "b", "c"]);
  });
});

describe("interpolateActionCommand", () => {
  test("replaces parameter with value", () => {
    const result = interpolateActionCommand(["echo", "{{name}}"], { name: "Alice" });
    expect(result).toEqual(["echo", "Alice"]);
  });

  test("preserves literal arguments", () => {
    const result = interpolateActionCommand(["python", "main.py", "--verbose"], {});
    expect(result).toEqual(["python", "main.py", "--verbose"]);
  });

  test("handles mixed literal and parameter", () => {
    const result = interpolateActionCommand(["--output={{format}}"], { format: "json" });
    expect(result).toEqual(["--output=json"]);
  });

  test("converts number to string", () => {
    const result = interpolateActionCommand(["echo", "{{count}}"], { count: 42 });
    expect(result).toEqual(["echo", "42"]);
  });

  test("converts boolean to string", () => {
    const result = interpolateActionCommand(["echo", "{{flag}}"], { flag: true });
    expect(result).toEqual(["echo", "true"]);
  });

  test("converts object to JSON string", () => {
    const result = interpolateActionCommand(["echo", "{{data}}"], { data: { key: "value" } });
    expect(result).toEqual(["echo", '{"key":"value"}']);
  });

  test("omits argument for optional param with no value", () => {
    const schema = {
      type: "object" as const,
      properties: {
        name: { type: "string" as const },
        verbose: { type: "boolean" as const },
      },
      required: ["name"],
    };

    const result = interpolateActionCommand(
      ["echo", "{{name}}", "{{verbose}}"],
      { name: "Alice" },
      { inputSchema: schema }
    );
    // "verbose" is optional with no value → omitted
    expect(result).toEqual(["echo", "Alice"]);
  });

  test("uses default value for optional param", () => {
    const schema = {
      type: "object" as const,
      properties: {
        format: { type: "string" as const, default: "text" },
      },
    };

    const result = interpolateActionCommand(["echo", "{{format}}"], {}, { inputSchema: schema });
    expect(result).toEqual(["echo", "text"]);
  });

  test("does not split values with spaces into multiple args", () => {
    const result = interpolateActionCommand(["echo", "{{msg}}"], {
      msg: "hello world with spaces",
    });
    // Must remain a single argument — security property
    expect(result).toEqual(["echo", "hello world with spaces"]);
  });
});

describe("getMissingRequiredParams", () => {
  test("returns empty when all required params provided", () => {
    const schema = {
      type: "object" as const,
      required: ["name"],
      properties: { name: { type: "string" as const } },
    };
    const missing = getMissingRequiredParams(["echo", "{{name}}"], { name: "hi" }, schema);
    expect(missing).toHaveLength(0);
  });

  test("returns missing required param names", () => {
    const schema = {
      type: "object" as const,
      required: ["name", "age"],
      properties: {
        name: { type: "string" as const },
        age: { type: "number" as const },
      },
    };
    const missing = getMissingRequiredParams(
      ["echo", "{{name}}", "{{age}}"],
      { name: "Alice" },
      schema
    );
    expect(missing).toEqual(["age"]);
  });

  test("does not report optional params as missing", () => {
    const schema = {
      type: "object" as const,
      required: [],
      properties: { verbose: { type: "boolean" as const } },
    };
    const missing = getMissingRequiredParams(["echo", "{{verbose}}"], {}, schema);
    expect(missing).toHaveLength(0);
  });
});

describe("getActionCommandParams", () => {
  test("returns all parameter names from command", () => {
    expect(getActionCommandParams(["cmd", "{{a}}", "{{b}}"])).toEqual(["a", "b"]);
  });

  test("returns empty for command without templates", () => {
    expect(getActionCommandParams(["echo", "hello"])).toEqual([]);
  });
});

describe("prepareActionCommand", () => {
  test("interpolates and returns command array", () => {
    const schema = {
      type: "object" as const,
      required: ["url"],
      properties: { url: { type: "string" as const } },
    };
    const result = prepareActionCommand(
      ["python", "main.py", "{{url}}"],
      { url: "https://example.com" },
      schema
    );
    expect(result).toEqual(["python", "main.py", "https://example.com"]);
  });

  test("throws when required parameters are missing", () => {
    const schema = {
      type: "object" as const,
      required: ["url"],
      properties: { url: { type: "string" as const } },
    };
    expect(() => prepareActionCommand(["python", "main.py", "{{url}}"], {}, schema)).toThrow(
      "Missing required parameters: url"
    );
  });

  test("works without schema (all params treated conservatively)", () => {
    // Without schema, all params are treated as required
    expect(() => prepareActionCommand(["echo", "{{name}}"], {})).toThrow(
      "Missing required parameters: name"
    );
  });
});
