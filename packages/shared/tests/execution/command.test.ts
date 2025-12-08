/**
 * Tests for command interpolation module
 */

import { describe, expect, test } from "bun:test";
import {
  getMissingParams,
  interpolateCommand,
  parseCommand,
  parseCommandArgs,
  prepareCommand,
  shellEscape,
} from "../../src/execution/command";

describe("Command Interpolation", () => {
  describe("parseCommand", () => {
    test("parses command with no parameters", () => {
      const result = parseCommand("echo hello");

      expect(result.original).toBe("echo hello");
      expect(result.tokens).toHaveLength(1);
      expect(result.tokens[0]).toEqual({ type: "literal", value: "echo hello" });
      expect(result.parameters).toHaveLength(0);
    });

    test("parses command with single parameter", () => {
      const result = parseCommand("echo ${message}");

      expect(result.original).toBe("echo ${message}");
      expect(result.tokens).toHaveLength(2);
      expect(result.tokens[0]).toEqual({ type: "literal", value: "echo " });
      expect(result.tokens[1]).toEqual({ type: "parameter", name: "message" });
      expect(result.parameters).toEqual(["message"]);
    });

    test("parses command with multiple parameters", () => {
      const result = parseCommand("curl -X ${method} ${url} -d '${data}'");

      expect(result.parameters).toContain("method");
      expect(result.parameters).toContain("url");
      expect(result.parameters).toContain("data");
      expect(result.parameters).toHaveLength(3);
    });

    test("parses command with parameter at start", () => {
      const result = parseCommand("${cmd} arg1 arg2");

      expect(result.tokens[0]).toEqual({ type: "parameter", name: "cmd" });
      expect(result.tokens[1]).toEqual({ type: "literal", value: " arg1 arg2" });
    });

    test("parses command with adjacent parameters", () => {
      const result = parseCommand("${prefix}${suffix}");

      expect(result.tokens).toHaveLength(2);
      expect(result.tokens[0]).toEqual({ type: "parameter", name: "prefix" });
      expect(result.tokens[1]).toEqual({ type: "parameter", name: "suffix" });
    });

    test("handles nested braces", () => {
      const result = parseCommand("echo '${json}' | jq '.${field}'");

      expect(result.parameters).toContain("json");
      expect(result.parameters).toContain("field");
    });

    test("removes duplicate parameters", () => {
      const result = parseCommand("echo ${name} ${name} ${name}");

      expect(result.parameters).toEqual(["name"]);
    });
  });

  describe("interpolateCommand", () => {
    test("interpolates single parameter", () => {
      // By default, escape=true, so values get shell-escaped
      const result = interpolateCommand("echo ${message}", {
        message: "hello world",
      });

      // "hello world" contains space, gets single-quoted
      expect(result).toBe("echo 'hello world'");
    });

    test("interpolates multiple parameters", () => {
      const result = interpolateCommand("curl -X ${method} ${url}", {
        method: "POST",
        url: "https://api.example.com",
      });

      // URL contains special chars, gets quoted
      expect(result).toBe("curl -X POST 'https://api.example.com'");
    });

    test("handles missing parameters with keep option", () => {
      const result = interpolateCommand("echo ${message}", {}, { onMissing: "keep" });

      // Missing params are left as-is when onMissing is "keep"
      expect(result).toBe("echo ${message}");
    });

    test("throws on missing parameters by default", () => {
      expect(() => interpolateCommand("echo ${message}", {})).toThrow(
        "Missing required parameter: message"
      );
    });

    test("converts numbers to strings", () => {
      const result = interpolateCommand("seq ${start} ${end}", {
        start: 1,
        end: 10,
      });

      expect(result).toBe("seq 1 10");
    });

    test("handles boolean values", () => {
      const result = interpolateCommand("echo ${flag}", {
        flag: true,
      });

      expect(result).toBe("echo true");
    });

    test("handles null values as empty string", () => {
      const result = interpolateCommand("echo ${a}", {
        a: null,
      });

      // null becomes empty string
      expect(result).toBe("echo ''");
    });

    test("stringifies objects as JSON", () => {
      const result = interpolateCommand(
        "echo ${data}",
        {
          data: { key: "value" },
        },
        { escape: false }
      );

      expect(result).toBe('echo {"key":"value"}');
    });

    test("handles arrays", () => {
      const result = interpolateCommand(
        "echo ${items}",
        {
          items: [1, 2, 3],
        },
        { escape: false }
      );

      expect(result).toBe("echo [1,2,3]");
    });
  });

  describe("shellEscape", () => {
    test("escapes single quotes", () => {
      // The implementation uses: 'it'"'"'s' pattern
      expect(shellEscape("it's")).toBe("'it'\"'\"'s'");
    });

    test("wraps strings with spaces", () => {
      expect(shellEscape("hello world")).toBe("'hello world'");
    });

    test("escapes special characters", () => {
      expect(shellEscape("test$var")).toBe("'test$var'");
      expect(shellEscape("test`cmd`")).toBe("'test`cmd`'");
    });

    test("returns safe strings as-is", () => {
      expect(shellEscape("simple")).toBe("simple");
      expect(shellEscape("path/to/file")).toBe("path/to/file");
      expect(shellEscape("file.txt")).toBe("file.txt");
    });

    test("handles empty string", () => {
      expect(shellEscape("")).toBe("''");
    });

    test("handles strings with newlines", () => {
      expect(shellEscape("line1\nline2")).toBe("'line1\nline2'");
    });

    test("handles strings with backslashes", () => {
      expect(shellEscape("path\\to\\file")).toBe("'path\\to\\file'");
    });
  });

  describe("parseCommandArgs", () => {
    test("parses simple arguments", () => {
      const result = parseCommandArgs("arg1 arg2 arg3");

      expect(result).toEqual(["arg1", "arg2", "arg3"]);
    });

    test("handles quoted strings", () => {
      const result = parseCommandArgs('echo "hello world"');

      expect(result).toEqual(["echo", "hello world"]);
    });

    test("handles single-quoted strings", () => {
      const result = parseCommandArgs("echo 'hello world'");

      expect(result).toEqual(["echo", "hello world"]);
    });

    test("handles mixed quotes", () => {
      const result = parseCommandArgs("echo 'single' \"double\"");

      expect(result).toEqual(["echo", "single", "double"]);
    });

    test("handles empty input", () => {
      expect(parseCommandArgs("")).toEqual([]);
    });

    test("handles extra whitespace", () => {
      const result = parseCommandArgs("  arg1   arg2   ");

      expect(result).toEqual(["arg1", "arg2"]);
    });

    test("handles escaped quotes within strings", () => {
      const result = parseCommandArgs('echo "say \\"hello\\""');

      expect(result).toEqual(["echo", 'say "hello"']);
    });
  });

  describe("prepareCommand", () => {
    test("prepares simple command without shell wrap", () => {
      const result = prepareCommand("echo hello", {});

      expect(result).toEqual(["echo", "hello"]);
    });

    test("wraps command with pipes", () => {
      const result = prepareCommand("echo hello | cat", {});

      // Contains | which triggers shell wrap
      expect(result).toEqual(["sh", "-c", "echo hello | cat"]);
    });

    test("interpolates parameters without shell wrap when no special chars", () => {
      // After interpolation, "echo world" has no special chars
      const result = prepareCommand("echo ${name}", { name: "world" });

      expect(result).toEqual(["echo", "world"]);
    });

    test("handles commands with pipes", () => {
      const result = prepareCommand("cat file | grep pattern", {});

      expect(result).toEqual(["sh", "-c", "cat file | grep pattern"]);
    });

    test("parses simple args without shell features", () => {
      // No special chars, so should parse as args
      const result = prepareCommand("simple command here", {});

      expect(result).toEqual(["simple", "command", "here"]);
    });

    test("shell wraps when escaped value contains quotes", () => {
      // When value has spaces, it gets single-quoted, but parseCommandArgs
      // handles quotes properly, so it still gets parsed as args
      const result = prepareCommand("echo ${msg}", { msg: "hello world" });

      // parseCommandArgs strips the quotes, so we get the unquoted value
      expect(result).toEqual(["echo", "hello world"]);
    });
  });

  describe("getMissingParams", () => {
    test("returns empty array when all params present", () => {
      const result = getMissingParams("echo ${a} ${b}", { a: "1", b: "2" });

      expect(result).toEqual([]);
    });

    test("returns missing param names", () => {
      const result = getMissingParams("echo ${a} ${b} ${c}", { a: "1" });

      expect(result).toContain("b");
      expect(result).toContain("c");
      expect(result).not.toContain("a");
    });

    test("handles no parameters", () => {
      const result = getMissingParams("echo hello", {});

      expect(result).toEqual([]);
    });

    test("handles all parameters missing", () => {
      const result = getMissingParams("echo ${x} ${y}", {});

      expect(result).toEqual(["x", "y"]);
    });

    test("treats null as present but undefined as missing", () => {
      // null is a value (present), undefined means not provided
      const result = getMissingParams("echo ${a} ${b}", {
        a: null,
        b: undefined,
      });

      // Only b is missing since undefined is treated as not provided
      expect(result).toEqual(["b"]);
    });
  });
});
