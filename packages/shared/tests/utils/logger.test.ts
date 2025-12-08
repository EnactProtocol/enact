import { describe, expect, test } from "bun:test";
import { Logger, configureLogger, createLogger, getLogger } from "../../src/utils/logger";

/** Helper to parse JSON from output array */
function parseOutput(output: string[], index: number): Record<string, unknown> {
  const item = output[index];
  if (item === undefined) {
    throw new Error(`No output at index ${index}`);
  }
  return JSON.parse(item) as Record<string, unknown>;
}

/** Helper to get output at index */
function getOutput(output: string[], index: number): string {
  const item = output[index];
  if (item === undefined) {
    throw new Error(`No output at index ${index}`);
  }
  return item;
}

describe("Logger", () => {
  describe("constructor and options", () => {
    test("creates logger with default options", () => {
      const logger = new Logger();
      expect(logger.getLevel()).toBe("info");
    });

    test("creates logger with custom level", () => {
      const logger = new Logger({ level: "debug" });
      expect(logger.getLevel()).toBe("debug");
    });

    test("creates logger with custom format", () => {
      const output: string[] = [];
      const logger = new Logger({
        format: "json",
        output: (text) => output.push(text),
      });
      logger.info("test");
      expect(output.length).toBe(1);
      const parsed = parseOutput(output, 0);
      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("test");
    });

    test("creates logger with prefix", () => {
      const output: string[] = [];
      const logger = new Logger({
        prefix: "MyModule",
        format: "json",
        output: (text) => output.push(text),
      });
      logger.info("test");
      const parsed = parseOutput(output, 0);
      expect(parsed.message).toBe("[MyModule] test");
    });
  });

  describe("level filtering", () => {
    test("logs messages at or above current level", () => {
      const output: string[] = [];
      const logger = new Logger({
        level: "warn",
        format: "json",
        output: (text) => output.push(text),
        errorOutput: (text) => output.push(text),
      });

      logger.debug("debug msg");
      logger.info("info msg");
      logger.warn("warn msg");
      logger.error("error msg");

      expect(output.length).toBe(2); // only warn and error
      expect(getOutput(output, 0)).toContain("warn msg");
      expect(getOutput(output, 1)).toContain("error msg");
    });

    test("silent level suppresses all output", () => {
      const output: string[] = [];
      const logger = new Logger({
        level: "silent",
        output: (text) => output.push(text),
        errorOutput: (text) => output.push(text),
      });

      logger.debug("debug");
      logger.info("info");
      logger.warn("warn");
      logger.error("error");

      expect(output.length).toBe(0);
    });

    test("debug level logs everything", () => {
      const output: string[] = [];
      const logger = new Logger({
        level: "debug",
        format: "json",
        output: (text) => output.push(text),
        errorOutput: (text) => output.push(text),
      });

      logger.debug("debug");
      logger.info("info");
      logger.warn("warn");
      logger.error("error");

      expect(output.length).toBe(4);
    });

    test("setLevel changes filtering", () => {
      const output: string[] = [];
      const logger = new Logger({
        level: "info",
        format: "json",
        output: (text) => output.push(text),
        errorOutput: (text) => output.push(text),
      });

      logger.debug("should not appear");
      expect(output.length).toBe(0);

      logger.setLevel("debug");
      logger.debug("should appear");
      expect(output.length).toBe(1);
    });

    test("shouldLog returns correct boolean", () => {
      const logger = new Logger({ level: "warn" });
      expect(logger.shouldLog("debug")).toBe(false);
      expect(logger.shouldLog("info")).toBe(false);
      expect(logger.shouldLog("warn")).toBe(true);
      expect(logger.shouldLog("error")).toBe(true);
    });
  });

  describe("output formats", () => {
    test("JSON format outputs valid JSON", () => {
      const output: string[] = [];
      const logger = new Logger({
        format: "json",
        output: (text) => output.push(text),
      });

      logger.info("test message");

      const parsed = parseOutput(output, 0);
      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("test message");
      expect(parsed.timestamp).toBeDefined();
    });

    test("JSON format includes context", () => {
      const output: string[] = [];
      const logger = new Logger({
        format: "json",
        output: (text) => output.push(text),
      });

      logger.info("test", { userId: 123, action: "login" });

      const parsed = parseOutput(output, 0);
      expect(parsed.context).toEqual({ userId: 123, action: "login" });
    });

    test("JSON format omits empty context", () => {
      const output: string[] = [];
      const logger = new Logger({
        format: "json",
        output: (text) => output.push(text),
      });

      logger.info("test");

      const parsed = parseOutput(output, 0);
      expect(parsed.context).toBeUndefined();
    });

    test("console format includes timestamp and level", () => {
      const output: string[] = [];
      const logger = new Logger({
        format: "console",
        colors: false,
        output: (text) => output.push(text),
      });

      logger.info("test message");

      const out = getOutput(output, 0);
      expect(out).toContain("INFO");
      expect(out).toContain("test message");
      // Should have ISO timestamp
      expect(out).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test("console format with colors includes ANSI codes", () => {
      const output: string[] = [];
      const logger = new Logger({
        format: "console",
        colors: true,
        output: (text) => output.push(text),
      });

      logger.info("test");

      // Should contain ANSI escape codes
      expect(getOutput(output, 0)).toContain("\x1b[");
    });

    test("console format without colors has no ANSI codes", () => {
      const output: string[] = [];
      const logger = new Logger({
        format: "console",
        colors: false,
        output: (text) => output.push(text),
      });

      logger.info("test");

      expect(getOutput(output, 0)).not.toContain("\x1b[");
    });

    test("setFormat changes output format", () => {
      const output: string[] = [];
      const logger = new Logger({
        format: "console",
        colors: false,
        output: (text) => output.push(text),
      });

      logger.info("console");
      logger.setFormat("json");
      logger.info("json");

      // First message is console format (not valid JSON)
      expect(() => JSON.parse(getOutput(output, 0))).toThrow();
      // Second message is JSON
      expect(parseOutput(output, 1).message).toBe("json");
    });

    test("setColors enables/disables colors", () => {
      const output: string[] = [];
      const logger = new Logger({
        format: "console",
        colors: true,
        output: (text) => output.push(text),
      });

      logger.info("with colors");
      logger.setColors(false);
      logger.info("no colors");

      expect(getOutput(output, 0)).toContain("\x1b[");
      expect(getOutput(output, 1)).not.toContain("\x1b[");
    });
  });

  describe("error output routing", () => {
    test("warn and error use errorOutput", () => {
      const stdout: string[] = [];
      const stderr: string[] = [];
      const logger = new Logger({
        level: "debug",
        format: "json",
        output: (text) => stdout.push(text),
        errorOutput: (text) => stderr.push(text),
      });

      logger.debug("debug");
      logger.info("info");
      logger.warn("warn");
      logger.error("error");

      expect(stdout.length).toBe(2); // debug, info
      expect(stderr.length).toBe(2); // warn, error
    });
  });

  describe("child loggers", () => {
    test("child logger inherits settings", () => {
      const output: string[] = [];
      const parent = new Logger({
        level: "debug",
        format: "json",
        output: (text) => output.push(text),
      });

      const child = parent.child("SubModule");
      child.info("test");

      const parsed = parseOutput(output, 0);
      expect(parsed.message).toBe("[SubModule] test");
    });

    test("child logger chains prefixes", () => {
      const output: string[] = [];
      const parent = new Logger({
        level: "debug",
        format: "json",
        prefix: "Parent",
        output: (text) => output.push(text),
      });

      const child = parent.child("Child");
      child.info("test");

      const parsed = parseOutput(output, 0);
      expect(parsed.message).toBe("[Parent:Child] test");
    });

    test("setPrefix changes prefix", () => {
      const output: string[] = [];
      const logger = new Logger({
        format: "json",
        output: (text) => output.push(text),
      });

      logger.info("no prefix");
      logger.setPrefix("NewPrefix");
      logger.info("with prefix");

      const msg1 = parseOutput(output, 0).message;
      const msg2 = parseOutput(output, 1).message;
      expect(msg1).toBe("no prefix");
      expect(msg2).toBe("[NewPrefix] with prefix");
    });
  });

  describe("structured context", () => {
    test("context is included in JSON output", () => {
      const output: string[] = [];
      const logger = new Logger({
        format: "json",
        output: (text) => output.push(text),
      });

      logger.info("user action", {
        userId: "u123",
        action: "login",
        success: true,
        duration: 150,
      });

      const parsed = parseOutput(output, 0);
      expect(parsed.context).toEqual({
        userId: "u123",
        action: "login",
        success: true,
        duration: 150,
      });
    });

    test("context is included in console output", () => {
      const output: string[] = [];
      const logger = new Logger({
        format: "console",
        colors: false,
        output: (text) => output.push(text),
      });

      logger.info("test", { key: "value" });

      expect(getOutput(output, 0)).toContain('{"key":"value"}');
    });

    test("nested context is supported", () => {
      const output: string[] = [];
      const logger = new Logger({
        format: "json",
        output: (text) => output.push(text),
      });

      logger.info("nested", {
        user: { id: 1, name: "test" },
        tags: ["a", "b"],
      });

      const parsed = parseOutput(output, 0);
      const context = parsed.context as Record<string, unknown>;
      expect(context.user).toEqual({ id: 1, name: "test" });
      expect(context.tags).toEqual(["a", "b"]);
    });
  });

  describe("convenience functions", () => {
    test("createLogger creates new instance", () => {
      const logger = createLogger({ level: "debug" });
      expect(logger).toBeInstanceOf(Logger);
      expect(logger.getLevel()).toBe("debug");
    });

    test("getLogger returns singleton", () => {
      const logger1 = getLogger();
      const logger2 = getLogger();
      expect(logger1).toBe(logger2);
    });

    test("configureLogger updates singleton", () => {
      configureLogger({ level: "error" });
      const newLogger = getLogger();
      expect(newLogger.getLevel()).toBe("error");
      // Restore to info for other tests
      configureLogger({ level: "info" });
    });
  });

  describe("level-specific methods", () => {
    test("debug method logs at debug level", () => {
      const output: string[] = [];
      const logger = new Logger({
        level: "debug",
        format: "json",
        output: (text) => output.push(text),
      });

      logger.debug("debug message");
      const parsed = parseOutput(output, 0);
      expect(parsed.level).toBe("debug");
    });

    test("info method logs at info level", () => {
      const output: string[] = [];
      const logger = new Logger({
        level: "debug",
        format: "json",
        output: (text) => output.push(text),
      });

      logger.info("info message");
      const parsed = parseOutput(output, 0);
      expect(parsed.level).toBe("info");
    });

    test("warn method logs at warn level", () => {
      const output: string[] = [];
      const logger = new Logger({
        level: "debug",
        format: "json",
        errorOutput: (text) => output.push(text),
      });

      logger.warn("warn message");
      const parsed = parseOutput(output, 0);
      expect(parsed.level).toBe("warn");
    });

    test("error method logs at error level", () => {
      const output: string[] = [];
      const logger = new Logger({
        level: "debug",
        format: "json",
        errorOutput: (text) => output.push(text),
      });

      logger.error("error message");
      const parsed = parseOutput(output, 0);
      expect(parsed.level).toBe("error");
    });
  });

  describe("timestamp format", () => {
    test("timestamp is ISO 8601 format", () => {
      const output: string[] = [];
      const logger = new Logger({
        format: "json",
        output: (text) => output.push(text),
      });

      logger.info("test");
      const parsed = parseOutput(output, 0);

      // Should be valid ISO 8601
      const timestamp = parsed.timestamp as string;
      const date = new Date(timestamp);
      expect(date.toISOString()).toBe(timestamp);
    });
  });
});
