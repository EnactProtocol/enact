/**
 * @enactprotocol/shared - Logger utility
 *
 * Provides structured logging with level filtering and
 * configurable output formats (console with colors or JSON).
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown> | undefined;
}

export interface LoggerOptions {
  /** Minimum level to output */
  level?: LogLevel;
  /** Output format: 'console' for colored output, 'json' for structured */
  format?: "console" | "json";
  /** Enable colors in console output */
  colors?: boolean;
  /** Custom output function (defaults to console) */
  output?: (text: string) => void;
  /** Custom error output function (defaults to console.error) */
  errorOutput?: (text: string) => void;
  /** Prefix for log messages */
  prefix?: string;
}

/** Level priorities (higher = more severe) */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

/** ANSI color codes */
const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

/** Level display colors */
const LEVEL_COLORS: Record<Exclude<LogLevel, "silent">, string> = {
  debug: COLORS.gray,
  info: COLORS.blue,
  warn: COLORS.yellow,
  error: COLORS.red,
};

/** Level labels for output */
const LEVEL_LABELS: Record<Exclude<LogLevel, "silent">, string> = {
  debug: "DEBUG",
  info: "INFO",
  warn: "WARN",
  error: "ERROR",
};

/**
 * Logger class with level filtering and structured output
 */
export class Logger {
  private level: LogLevel;
  private format: "console" | "json";
  private colors: boolean;
  private output: (text: string) => void;
  private errorOutput: (text: string) => void;
  private prefix: string;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? "info";
    this.format = options.format ?? "console";
    this.colors = options.colors ?? true;
    this.output = options.output ?? console.log;
    this.errorOutput = options.errorOutput ?? console.error;
    this.prefix = options.prefix ?? "";
  }

  /**
   * Check if a level should be logged
   */
  shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.level];
  }

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get the current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Set the output format
   */
  setFormat(format: "console" | "json"): void {
    this.format = format;
  }

  /**
   * Enable or disable colors
   */
  setColors(enabled: boolean): void {
    this.colors = enabled;
  }

  /**
   * Set the prefix for log messages
   */
  setPrefix(prefix: string): void {
    this.prefix = prefix;
  }

  /**
   * Create a child logger with a prefix
   */
  child(prefix: string): Logger {
    const childPrefix = this.prefix ? `${this.prefix}:${prefix}` : prefix;
    return new Logger({
      level: this.level,
      format: this.format,
      colors: this.colors,
      output: this.output,
      errorOutput: this.errorOutput,
      prefix: childPrefix,
    });
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log("debug", message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log("info", message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log("warn", message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, context?: Record<string, unknown>): void {
    this.log("error", message, context);
  }

  /**
   * Core logging method
   */
  private log(
    level: Exclude<LogLevel, "silent">,
    message: string,
    context?: Record<string, unknown>
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: this.prefix ? `[${this.prefix}] ${message}` : message,
      context,
    };

    const formatted = this.format === "json" ? this.formatJson(entry) : this.formatConsole(entry);

    // Use error output for warn/error levels
    if (level === "warn" || level === "error") {
      this.errorOutput(formatted);
    } else {
      this.output(formatted);
    }
  }

  /**
   * Format entry as JSON
   */
  private formatJson(entry: LogEntry): string {
    const obj: Record<string, unknown> = {
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
    };

    if (entry.context && Object.keys(entry.context).length > 0) {
      obj.context = entry.context;
    }

    return JSON.stringify(obj);
  }

  /**
   * Format entry for console with colors
   */
  private formatConsole(entry: LogEntry): string {
    const parts: string[] = [];

    // Timestamp (dim)
    if (this.colors) {
      parts.push(`${COLORS.dim}${entry.timestamp}${COLORS.reset}`);
    } else {
      parts.push(entry.timestamp);
    }

    // Level label with color (only active levels, not silent)
    const level = entry.level as Exclude<LogLevel, "silent">;
    const label = LEVEL_LABELS[level];
    if (this.colors) {
      const color = LEVEL_COLORS[level];
      parts.push(`${color}${label.padEnd(5)}${COLORS.reset}`);
    } else {
      parts.push(label.padEnd(5));
    }

    // Message
    parts.push(entry.message);

    // Context (if any)
    if (entry.context && Object.keys(entry.context).length > 0) {
      const contextStr = JSON.stringify(entry.context);
      if (this.colors) {
        parts.push(`${COLORS.dim}${contextStr}${COLORS.reset}`);
      } else {
        parts.push(contextStr);
      }
    }

    return parts.join(" ");
  }
}

/**
 * Default logger instance
 */
let defaultLogger = new Logger();

/**
 * Get the default logger instance
 */
export function getLogger(): Logger {
  return defaultLogger;
}

/**
 * Configure the default logger
 */
export function configureLogger(options: LoggerOptions): void {
  defaultLogger = new Logger(options);
}

/**
 * Create a new logger with the given options
 */
export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}

// Convenience exports for quick logging
export const debug = (message: string, context?: Record<string, unknown>) =>
  defaultLogger.debug(message, context);
export const info = (message: string, context?: Record<string, unknown>) =>
  defaultLogger.info(message, context);
export const warn = (message: string, context?: Record<string, unknown>) =>
  defaultLogger.warn(message, context);
export const error = (message: string, context?: Record<string, unknown>) =>
  defaultLogger.error(message, context);
