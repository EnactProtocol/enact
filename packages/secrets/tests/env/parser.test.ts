import { describe, expect, it } from "bun:test";
import {
  createEnvContent,
  parseEnvContent,
  parseEnvFile,
  removeEnvVar,
  serializeEnvFile,
  updateEnvVar,
} from "../../src/env/parser";

describe("env/parser", () => {
  describe("parseEnvContent", () => {
    it("should parse simple key=value pairs", () => {
      const content = `FOO=bar
BAZ=qux`;
      const result = parseEnvContent(content);

      expect(result.FOO).toBe("bar");
      expect(result.BAZ).toBe("qux");
    });

    it("should ignore comments", () => {
      const content = `# This is a comment
FOO=bar
# Another comment
BAZ=qux`;
      const result = parseEnvContent(content);

      expect(Object.keys(result)).toHaveLength(2);
      expect(result.FOO).toBe("bar");
      expect(result.BAZ).toBe("qux");
    });

    it("should ignore empty lines", () => {
      const content = `FOO=bar

BAZ=qux

`;
      const result = parseEnvContent(content);

      expect(Object.keys(result)).toHaveLength(2);
    });

    it("should handle values with = signs", () => {
      const content = "DATABASE_URL=postgres://user:pass@host:5432/db";
      const result = parseEnvContent(content);

      expect(result.DATABASE_URL).toBe("postgres://user:pass@host:5432/db");
    });

    it("should handle double-quoted values", () => {
      const content = `MESSAGE="Hello World"`;
      const result = parseEnvContent(content);

      expect(result.MESSAGE).toBe("Hello World");
    });

    it("should handle single-quoted values", () => {
      const content = `MESSAGE='Hello World'`;
      const result = parseEnvContent(content);

      expect(result.MESSAGE).toBe("Hello World");
    });

    it("should handle inline comments for unquoted values", () => {
      const content = "FOO=bar # this is a comment";
      const result = parseEnvContent(content);

      expect(result.FOO).toBe("bar");
    });

    it("should not treat # in quoted values as comments", () => {
      const content = `MESSAGE="Hello #World"`;
      const result = parseEnvContent(content);

      expect(result.MESSAGE).toBe("Hello #World");
    });

    it("should handle escape sequences in double quotes", () => {
      const content = `MESSAGE="Line1\\nLine2"`;
      const result = parseEnvContent(content);

      expect(result.MESSAGE).toBe("Line1\nLine2");
    });

    it("should handle escaped quotes in double-quoted values", () => {
      const content = `MESSAGE="Say \\"Hello\\""`;
      const result = parseEnvContent(content);

      expect(result.MESSAGE).toBe('Say "Hello"');
    });

    it("should handle empty values", () => {
      const content = `EMPTY=
FOO=bar`;
      const result = parseEnvContent(content);

      expect(result.EMPTY).toBe("");
      expect(result.FOO).toBe("bar");
    });

    it("should handle values with spaces (unquoted)", () => {
      const content = "MESSAGE=Hello World";
      const result = parseEnvContent(content);

      // Unquoted values may include spaces until inline comment
      expect(result.MESSAGE).toBe("Hello World");
    });

    it("should treat lines without = as invalid", () => {
      const content = `VALID=value
INVALID_LINE
ANOTHER=valid`;
      const result = parseEnvContent(content);

      expect(Object.keys(result)).toHaveLength(2);
      expect(result.VALID).toBe("value");
      expect(result.ANOTHER).toBe("valid");
    });
  });

  describe("parseEnvFile", () => {
    it("should preserve original line structure", () => {
      const content = `# Header comment
FOO=bar

# Section
BAZ=qux`;
      const result = parseEnvFile(content);

      expect(result.lines).toHaveLength(5);
      expect(result.lines[0]?.type).toBe("comment");
      expect(result.lines[1]?.type).toBe("variable");
      expect(result.lines[2]?.type).toBe("empty");
      expect(result.lines[3]?.type).toBe("comment");
      expect(result.lines[4]?.type).toBe("variable");
    });

    it("should store raw line content", () => {
      const content = "FOO=bar";
      const result = parseEnvFile(content);

      expect(result.lines[0]?.raw).toBe("FOO=bar");
    });

    it("should return both vars and lines", () => {
      const content = `FOO=bar
BAZ=qux`;
      const result = parseEnvFile(content);

      expect(result.vars.FOO).toBe("bar");
      expect(result.vars.BAZ).toBe("qux");
      expect(result.lines).toHaveLength(2);
    });
  });

  describe("serializeEnvFile", () => {
    it("should serialize a parsed env file back to string", () => {
      const content = `FOO=bar
BAZ=qux`;
      const parsed = parseEnvFile(content);
      const serialized = serializeEnvFile(parsed);

      expect(serialized).toBe(content);
    });

    it("should preserve comments", () => {
      const content = `# Comment
FOO=bar`;
      const parsed = parseEnvFile(content);
      const serialized = serializeEnvFile(parsed);

      expect(serialized).toBe(content);
    });

    it("should preserve empty lines", () => {
      const content = `FOO=bar

BAZ=qux`;
      const parsed = parseEnvFile(content);
      const serialized = serializeEnvFile(parsed);

      expect(serialized).toBe(content);
    });

    it("should quote values with spaces", () => {
      const parsed = parseEnvFile("FOO=bar");
      parsed.vars.FOO = "hello world";

      const serialized = serializeEnvFile(parsed);
      expect(serialized).toBe('FOO="hello world"');
    });

    it("should quote values with = signs", () => {
      const parsed = parseEnvFile("URL=test");
      parsed.vars.URL = "host=localhost";

      const serialized = serializeEnvFile(parsed);
      expect(serialized).toBe('URL="host=localhost"');
    });

    it("should escape quotes in quoted values", () => {
      const parsed = parseEnvFile("MSG=test");
      parsed.vars.MSG = 'Say "Hello"';

      const serialized = serializeEnvFile(parsed);
      expect(serialized).toBe('MSG="Say \\"Hello\\""');
    });
  });

  describe("createEnvContent", () => {
    it("should create env content from object", () => {
      const vars = {
        FOO: "bar",
        BAZ: "qux",
      };
      const result = createEnvContent(vars);

      expect(result).toContain("FOO=bar");
      expect(result).toContain("BAZ=qux");
    });

    it("should quote values with special characters", () => {
      const vars = {
        MESSAGE: "Hello World",
      };
      const result = createEnvContent(vars);

      expect(result).toBe('MESSAGE="Hello World"');
    });

    it("should handle empty object", () => {
      const result = createEnvContent({});
      expect(result).toBe("");
    });
  });

  describe("updateEnvVar", () => {
    it("should update existing variable", () => {
      const content = `FOO=old
BAZ=qux`;
      const parsed = parseEnvFile(content);
      const updated = updateEnvVar(parsed, "FOO", "new");

      expect(updated.vars.FOO).toBe("new");
      expect(updated.lines).toHaveLength(2);
    });

    it("should add new variable if not exists", () => {
      const content = "FOO=bar";
      const parsed = parseEnvFile(content);
      const updated = updateEnvVar(parsed, "NEW_VAR", "new-value");

      expect(updated.vars.NEW_VAR).toBe("new-value");
      expect(updated.lines).toHaveLength(2);
    });

    it("should preserve other lines", () => {
      const content = `# Comment
FOO=bar

BAZ=qux`;
      const parsed = parseEnvFile(content);
      const updated = updateEnvVar(parsed, "FOO", "new");

      expect(updated.lines).toHaveLength(4);
      expect(updated.lines[0]?.type).toBe("comment");
      expect(updated.lines[2]?.type).toBe("empty");
    });

    it("should update line's raw content", () => {
      const content = "FOO=old";
      const parsed = parseEnvFile(content);
      const updated = updateEnvVar(parsed, "FOO", "new");
      const line = updated.lines[0];

      expect(line?.raw).toBe("FOO=new");
    });
  });

  describe("removeEnvVar", () => {
    it("should remove existing variable", () => {
      const content = `FOO=bar
BAZ=qux`;
      const parsed = parseEnvFile(content);
      const updated = removeEnvVar(parsed, "FOO");

      expect(updated.vars.FOO).toBeUndefined();
      expect(updated.vars.BAZ).toBe("qux");
      expect(updated.lines).toHaveLength(1);
    });

    it("should preserve comments and empty lines", () => {
      const content = `# Comment
FOO=bar

BAZ=qux`;
      const parsed = parseEnvFile(content);
      const updated = removeEnvVar(parsed, "FOO");

      expect(updated.lines).toHaveLength(3);
      expect(updated.lines[0]?.type).toBe("comment");
      expect(updated.lines[1]?.type).toBe("empty");
      expect(updated.lines[2]?.type).toBe("variable");
    });

    it("should return same object if key not found", () => {
      const content = "FOO=bar";
      const parsed = parseEnvFile(content);
      const updated = removeEnvVar(parsed, "NONEXISTENT");

      expect(Object.keys(updated.vars)).toHaveLength(1);
      expect(updated.vars.FOO).toBe("bar");
    });
  });

  describe("complex .env files", () => {
    it("should parse complex fixture", () => {
      const content = `# Database configuration
DATABASE_URL="postgres://user:pass@localhost:5432/mydb"
DATABASE_POOL_SIZE=10

# API Keys
STRIPE_API_KEY=sk_test_12345 # development key
STRIPE_WEBHOOK_SECRET="whsec_abc123"

# Feature Flags
ENABLE_NEW_FEATURE=true
DEPRECATED_FEATURE=false

# Multiline-like content
JSON_CONFIG='{"key": "value"}'
MESSAGE="Line 1\\nLine 2"`;

      const result = parseEnvFile(content);

      expect(result.vars.DATABASE_URL).toBe("postgres://user:pass@localhost:5432/mydb");
      expect(result.vars.DATABASE_POOL_SIZE).toBe("10");
      expect(result.vars.STRIPE_API_KEY).toBe("sk_test_12345");
      expect(result.vars.STRIPE_WEBHOOK_SECRET).toBe("whsec_abc123");
      expect(result.vars.ENABLE_NEW_FEATURE).toBe("true");
      expect(result.vars.JSON_CONFIG).toBe('{"key": "value"}');
      expect(result.vars.MESSAGE).toBe("Line 1\nLine 2");

      // Check structure is preserved
      expect(result.lines.filter((l) => l.type === "comment")).toHaveLength(4);
      expect(result.lines.filter((l) => l.type === "empty")).toHaveLength(3);
      expect(result.lines.filter((l) => l.type === "variable")).toHaveLength(8);
    });
  });
});
