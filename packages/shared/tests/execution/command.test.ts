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
import type { CommandWarning } from "../../src/execution/types";

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

    test("parses :raw modifier", () => {
      const result = parseCommand("echo ${data:raw}");

      expect(result.parameters).toEqual(["data"]);
      expect(result.tokens).toHaveLength(2);
      expect(result.tokens[1]).toEqual({ type: "parameter", name: "data", raw: true });
    });

    test("detects single-quoted parameter", () => {
      const result = parseCommand("echo '${message}'");

      expect(result.tokens).toHaveLength(2);
      expect(result.tokens[0]).toEqual({ type: "literal", value: "echo " });
      expect(result.tokens[1]).toEqual({
        type: "parameter",
        name: "message",
        surroundingQuotes: "single",
      });
    });

    test("detects double-quoted parameter", () => {
      const result = parseCommand('echo "${message}"');

      expect(result.tokens).toHaveLength(2);
      expect(result.tokens[1]).toEqual({
        type: "parameter",
        name: "message",
        surroundingQuotes: "double",
      });
    });

    test("handles mix of quoted and unquoted parameters", () => {
      const result = parseCommand("cmd '${a}' ${b} \"${c}\"");

      expect(result.parameters).toEqual(["a", "b", "c"]);
      expect(result.tokens[1]).toMatchObject({ name: "a", surroundingQuotes: "single" });
      expect(result.tokens[3]).toMatchObject({ name: "b" });
      expect(
        (result.tokens[3] as { surroundingQuotes?: string }).surroundingQuotes
      ).toBeUndefined();
      expect(result.tokens[5]).toMatchObject({ name: "c", surroundingQuotes: "double" });
    });

    test("does not detect quotes that don't surround the parameter", () => {
      // Single quote before but not after
      const result1 = parseCommand("echo '${a} foo");
      expect(
        (result1.tokens[1] as { surroundingQuotes?: string }).surroundingQuotes
      ).toBeUndefined();

      // Mismatched quotes
      const result2 = parseCommand("echo '${a}\"");
      expect(
        (result2.tokens[1] as { surroundingQuotes?: string }).surroundingQuotes
      ).toBeUndefined();
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

    test("handles :raw modifier - no escaping", () => {
      const result = interpolateCommand("echo ${data:raw}", {
        data: "hello world",
      });

      // Without :raw, "hello world" would become 'hello world' (quoted)
      // With :raw, it stays as-is
      expect(result).toBe("echo hello world");
    });

    test("handles :raw modifier with JSON", () => {
      const result = interpolateCommand("echo ${json:raw}", {
        json: { key: "value" },
      });

      // JSON is stringified but not quoted
      expect(result).toBe('echo {"key":"value"}');
    });

    test("strips surrounding single quotes and applies proper escaping", () => {
      // This is the key fix for the double-quoting issue
      const result = interpolateCommand("node script.js '${input}'", {
        input: '[{"name":"Alice"}]',
      });

      // The surrounding quotes are stripped, and the value is properly escaped
      // JSON with special chars gets single-quoted by shellEscape
      expect(result).toBe('node script.js \'[{"name":"Alice"}]\'');
    });

    test("strips surrounding double quotes and applies proper escaping", () => {
      const result = interpolateCommand('node script.js "${input}"', {
        input: "hello world",
      });

      // The surrounding quotes are stripped, value gets quoted by shellEscape
      expect(result).toBe("node script.js 'hello world'");
    });

    test("emits warning when stripping surrounding quotes", () => {
      const warnings: CommandWarning[] = [];

      interpolateCommand(
        "echo '${message}'",
        { message: "test" },
        {
          onWarning: (w) => warnings.push(w),
        }
      );

      expect(warnings).toHaveLength(1);
      expect(warnings[0]?.code).toBe("DOUBLE_QUOTING");
      expect(warnings[0]?.parameter).toBe("message");
      expect(warnings[0]?.suggestion).toContain("${message}");
    });

    test("no warning for unquoted parameters", () => {
      const warnings: CommandWarning[] = [];

      interpolateCommand(
        "echo ${message}",
        { message: "test" },
        {
          onWarning: (w) => warnings.push(w),
        }
      );

      expect(warnings).toHaveLength(0);
    });

    test("handles complex JSON input without double-quoting", () => {
      // This is the exact case from the user's feedback
      const result = interpolateCommand(
        "node dist/index.js ${input} ${input_format} ${output_format}",
        {
          input: '[{"name":"Alice"}]',
          input_format: "json",
          output_format: "csv",
        }
      );

      // JSON gets quoted, simple strings don't
      expect(result).toBe('node dist/index.js \'[{"name":"Alice"}]\' json csv');
    });

    test("handles quoted parameter template that would have caused double-quoting", () => {
      // Without the fix, this would produce: node dist/index.js ''[{"name":"Alice"}]''
      // With the fix, surrounding quotes are stripped first
      const result = interpolateCommand("node dist/index.js '${input}'", {
        input: '[{"name":"Alice"}]',
      });

      // Should NOT have double quotes
      expect(result).not.toContain("''");
      expect(result).toBe('node dist/index.js \'[{"name":"Alice"}]\'');
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

  describe("knownParameters filtering", () => {
    describe("parseCommand with knownParameters", () => {
      test("only treats known parameters as parameters", () => {
        const result = parseCommand("echo ${name} and ${unknown}", {
          knownParameters: new Set(["name"]),
        });

        expect(result.parameters).toEqual(["name"]);
        expect(result.tokens).toHaveLength(3);
        expect(result.tokens[0]).toEqual({ type: "literal", value: "echo " });
        expect(result.tokens[1]).toEqual({ type: "parameter", name: "name" });
        expect(result.tokens[2]).toEqual({ type: "literal", value: " and ${unknown}" });
      });

      test("preserves bash array syntax ${#array[@]}", () => {
        const result = parseCommand("echo ${#compliments[@]}", {
          knownParameters: new Set(["name"]),
        });

        // The entire string should be a literal since #compliments[@] is not a known param
        expect(result.parameters).toEqual([]);
        expect(result.tokens).toHaveLength(1);
        expect(result.tokens[0]).toEqual({
          type: "literal",
          value: "echo ${#compliments[@]}",
        });
      });

      test("preserves bash array indexing ${array[$i]}", () => {
        const result = parseCommand('echo "${compliments[$random_index]}"', {
          knownParameters: new Set(["name"]),
        });

        expect(result.parameters).toEqual([]);
        expect(result.tokens).toHaveLength(1);
        expect(result.tokens[0]).toEqual({
          type: "literal",
          value: 'echo "${compliments[$random_index]}"',
        });
      });

      test("handles mix of known params and bash syntax", () => {
        const cmd = 'echo "${name}" and ${#arr[@]} and ${arr[$i]} and ${OTHER_VAR}';
        const result = parseCommand(cmd, {
          knownParameters: new Set(["name"]),
        });

        expect(result.parameters).toEqual(["name"]);
        // Should have: literal, param, literal (containing all the bash stuff)
        expect(result.tokens).toHaveLength(3);
        expect(result.tokens[0]).toEqual({ type: "literal", value: "echo " });
        expect(result.tokens[1]).toMatchObject({ type: "parameter", name: "name" });
        expect(result.tokens[2]).toEqual({
          type: "literal",
          value: " and ${#arr[@]} and ${arr[$i]} and ${OTHER_VAR}",
        });
      });

      test("legacy behavior when knownParameters not provided", () => {
        const result = parseCommand("echo ${name} ${unknown}");

        // Without knownParameters, all ${...} are treated as params
        expect(result.parameters).toEqual(["name", "unknown"]);
      });

      test("empty knownParameters set treats nothing as parameter", () => {
        const result = parseCommand("echo ${name} ${other}", {
          knownParameters: new Set(),
        });

        expect(result.parameters).toEqual([]);
        expect(result.tokens).toHaveLength(1);
        expect(result.tokens[0]).toEqual({
          type: "literal",
          value: "echo ${name} ${other}",
        });
      });
    });

    describe("interpolateCommand with knownParameters", () => {
      test("only substitutes known parameters", () => {
        const result = interpolateCommand(
          "echo ${name} and ${MY_VAR}",
          { name: "Keith" },
          { knownParameters: new Set(["name"]) }
        );

        expect(result).toBe("echo Keith and ${MY_VAR}");
      });

      test("preserves bash array operations", () => {
        const cmd = 'arr=("a" "b"); echo ${#arr[@]} items: ${arr[0]}';
        const result = interpolateCommand(
          cmd,
          {},
          {
            knownParameters: new Set(["name"]),
          }
        );

        // Nothing should be substituted
        expect(result).toBe(cmd);
      });

      test("substitutes only schema-defined params in complex command", () => {
        const cmd = `
          NAME="\${name}"
          compliments=("Hello, $NAME!")
          echo "\${compliments[0]}"
        `;
        const result = interpolateCommand(
          cmd,
          { name: "Alice" },
          { knownParameters: new Set(["name"]) }
        );

        expect(result).toContain("Alice");
        expect(result).toContain("${compliments[0]}");
      });
    });

    describe("prepareCommand with knownParameters", () => {
      test("passes through bash syntax while substituting known params", () => {
        const result = prepareCommand(
          "echo ${name} ${RANDOM}",
          { name: "test" },
          { knownParameters: new Set(["name"]) }
        );

        // Contains ${RANDOM} which has $, so needs shell wrap
        expect(result).toEqual(["sh", "-c", "echo test ${RANDOM}"]);
      });

      test("handles full bash script with arrays", () => {
        const cmd = `
arr=("\${name}" "b" "c")
echo \${#arr[@]}
echo \${arr[0]}
`;
        const result = prepareCommand(
          cmd,
          { name: "Keith" },
          {
            knownParameters: new Set(["name"]),
          }
        );

        // Should be shell wrapped due to special chars
        expect(result[0]).toBe("sh");
        expect(result[1]).toBe("-c");
        // The name should be substituted but array syntax preserved
        expect(result[2]).toContain("Keith");
        expect(result[2]).toContain("${#arr[@]}");
        expect(result[2]).toContain("${arr[0]}");
      });
    });

    describe("getMissingParams with knownParameters", () => {
      test("only checks known parameters", () => {
        const result = getMissingParams(
          "echo ${name} ${unknown}",
          {},
          { knownParameters: new Set(["name"]) }
        );

        // Only "name" is a known param, and it's missing
        expect(result).toEqual(["name"]);
      });

      test("ignores unknown ${...} patterns", () => {
        const result = getMissingParams(
          "echo ${name} ${#arr[@]} ${arr[$i]}",
          { name: "Keith" },
          { knownParameters: new Set(["name"]) }
        );

        // name is provided, others are not params
        expect(result).toEqual([]);
      });
    });

    describe("real-world bash examples", () => {
      test("compliment generator with bash arrays", () => {
        const cmd = `
compliments=(
  "You're great, \${name}!"
  "Keep it up, \${name}!"
)
random_index=$((RANDOM % \${#compliments[@]}))
echo "\${compliments[$random_index]}"
`;
        const result = interpolateCommand(
          cmd,
          { name: "Keith" },
          { knownParameters: new Set(["name"]) }
        );

        // ${name} should be substituted
        expect(result).toContain("You're great, Keith!");
        expect(result).toContain("Keep it up, Keith!");
        // Bash syntax should be preserved
        expect(result).toContain("${#compliments[@]}");
        expect(result).toContain("${compliments[$random_index]}");
      });

      test("script with environment variables", () => {
        const cmd = 'echo "Hello ${name}, your home is ${HOME}"';
        const result = interpolateCommand(
          cmd,
          { name: "Alice" },
          { knownParameters: new Set(["name"]) }
        );

        expect(result).toBe('echo "Hello Alice, your home is ${HOME}"');
      });

      test("for loop with index variable", () => {
        const cmd = 'for i in 1 2 3; do echo "${prefix}$i"; done';
        const result = interpolateCommand(
          cmd,
          { prefix: "item-" },
          { knownParameters: new Set(["prefix"]) }
        );

        // prefix substituted, $i preserved (though not in ${} form)
        expect(result).toContain("item-");
        expect(result).toContain("$i");
      });
    });
  });

  describe("onMissing: empty option", () => {
    test("replaces missing params with empty string when onMissing is empty", () => {
      const result = interpolateCommand(
        "echo ${required} ${optional}",
        { required: "hello" },
        { onMissing: "empty" }
      );

      // Empty string is inserted (not quoted) - the shell will treat it as nothing
      expect(result).toBe("echo hello ");
    });

    test("handles multiple missing optional params", () => {
      const result = interpolateCommand(
        "cmd ${a} ${b} ${c}",
        { a: "value" },
        { onMissing: "empty" }
      );

      // Multiple missing params become empty strings
      expect(result).toBe("cmd value  ");
    });

    test("prepareCommand uses empty for missing params by default", () => {
      // prepareCommand sets onMissing: "empty" by default
      const result = prepareCommand("echo ${name} ${optional}", { name: "test" });

      // When parsed, the empty string is just omitted from the args array
      expect(result).toEqual(["echo", "test"]);
    });

    test("handles optional params in complex commands", () => {
      const result = interpolateCommand(
        "curl ${url} -H '${header}' -d '${data}'",
        { url: "https://example.com" },
        { onMissing: "empty" }
      );

      // Empty strings are inserted, quotes around params are stripped
      expect(result).toBe("curl 'https://example.com' -H  -d ");
    });

    test("preserves provided values while emptying missing ones", () => {
      const result = interpolateCommand(
        "tool ${required} ${optional1} ${optional2}",
        { required: "value", optional2: "present" },
        { onMissing: "empty" }
      );

      // optional1 becomes empty, optional2 keeps its value
      expect(result).toBe("tool value  present");
    });

    test("does not throw for missing params when onMissing is empty", () => {
      // This is the key behavior - validation catches truly missing required params,
      // but interpolation should not throw for optional params
      expect(() => {
        interpolateCommand("echo ${missing}", {}, { onMissing: "empty" });
      }).not.toThrow();
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
