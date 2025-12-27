/**
 * Error handling utilities for CLI
 *
 * Provides consistent error handling with helpful suggestions
 */

import {
  EXIT_AUTH_ERROR,
  EXIT_CONFIG,
  EXIT_CONTAINER_ERROR,
  EXIT_EXECUTION_ERROR,
  EXIT_FAILURE,
  EXIT_MANIFEST_ERROR,
  EXIT_NETWORK_ERROR,
  EXIT_NOINPUT,
  EXIT_NOPERM,
  EXIT_REGISTRY_ERROR,
  EXIT_TIMEOUT,
  EXIT_TOOL_NOT_FOUND,
  EXIT_TRUST_ERROR,
  EXIT_USAGE,
  EXIT_VALIDATION_ERROR,
} from "./exit-codes";
import { colors, dim, newline, error as printError, suggest } from "./output";

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base CLI error with exit code
 */
export class CliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number = EXIT_FAILURE,
    public readonly suggestion?: string
  ) {
    super(message);
    this.name = "CliError";
  }
}

/**
 * Tool not found error
 */
export class ToolNotFoundError extends CliError {
  constructor(
    toolName: string,
    options?: {
      /** Additional context about why the tool wasn't found */
      reason?: string;
      /** Locations that were searched */
      searchedLocations?: string[];
      /** Whether --local flag was set */
      localOnly?: boolean;
    }
  ) {
    let message = `Tool not found: ${toolName}`;
    if (options?.reason) {
      message += `\n${options.reason}`;
    }
    if (options?.searchedLocations && options.searchedLocations.length > 0) {
      message += `\nSearched locations:\n${options.searchedLocations.map((l) => `  - ${l}`).join("\n")}`;
    }

    let suggestion =
      "Check the tool name or provide a path to a local tool.\nFor registry tools, use the format: owner/namespace/tool[@version]";
    if (options?.localOnly) {
      suggestion = "Remove --local flag to search the registry, or check the tool path.";
    }

    super(message, EXIT_TOOL_NOT_FOUND, suggestion);
    this.name = "ToolNotFoundError";
  }
}

/**
 * Manifest error
 */
export class ManifestError extends CliError {
  constructor(message: string, path?: string) {
    const fullMessage = path ? `${message} in ${path}` : message;
    super(
      fullMessage,
      EXIT_MANIFEST_ERROR,
      "Ensure the directory contains a valid enact.yaml or enact.md file."
    );
    this.name = "ManifestError";
  }
}

/**
 * Validation error
 */
export class ValidationError extends CliError {
  constructor(message: string, field?: string) {
    const fullMessage = field ? `Invalid ${field}: ${message}` : message;
    super(fullMessage, EXIT_VALIDATION_ERROR);
    this.name = "ValidationError";
  }
}

/**
 * Authentication error
 */
export class AuthError extends CliError {
  constructor(message: string) {
    super(message, EXIT_AUTH_ERROR, "Run 'enact auth login' to authenticate.");
    this.name = "AuthError";
  }
}

/**
 * Network error
 */
export class NetworkError extends CliError {
  constructor(message: string) {
    super(message, EXIT_NETWORK_ERROR, "Check your network connection and try again.");
    this.name = "NetworkError";
  }
}

/**
 * Registry error
 */
export class RegistryError extends CliError {
  constructor(message: string) {
    super(
      message,
      EXIT_REGISTRY_ERROR,
      "The registry may be temporarily unavailable. Try again later."
    );
    this.name = "RegistryError";
  }
}

/**
 * Trust verification error
 */
export class TrustError extends CliError {
  constructor(message: string) {
    super(
      message,
      EXIT_TRUST_ERROR,
      "Verify the tool's attestations with 'enact trust check <tool>'"
    );
    this.name = "TrustError";
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends CliError {
  constructor(operation: string, timeoutMs: number) {
    const timeoutSec = Math.round(timeoutMs / 1000);
    super(
      `${operation} timed out after ${timeoutSec}s`,
      EXIT_TIMEOUT,
      "Try increasing the timeout with --timeout option."
    );
    this.name = "TimeoutError";
  }
}

/**
 * Execution error
 */
export class ExecutionError extends CliError {
  constructor(
    message: string,
    public readonly stderr?: string
  ) {
    super(message, EXIT_EXECUTION_ERROR);
    this.name = "ExecutionError";
  }
}

/**
 * Container error
 */
export class ContainerError extends CliError {
  constructor(message: string) {
    super(message, EXIT_CONTAINER_ERROR, "Ensure Docker or another container runtime is running.");
    this.name = "ContainerError";
  }
}

/**
 * File not found error
 */
export class FileNotFoundError extends CliError {
  constructor(path: string) {
    super(`File not found: ${path}`, EXIT_NOINPUT);
    this.name = "FileNotFoundError";
  }
}

/**
 * Permission error
 */
export class PermissionError extends CliError {
  constructor(path: string) {
    super(`Permission denied: ${path}`, EXIT_NOPERM);
    this.name = "PermissionError";
  }
}

/**
 * Configuration error
 */
export class ConfigError extends CliError {
  constructor(message: string) {
    super(message, EXIT_CONFIG, "Check your configuration with 'enact config list'.");
    this.name = "ConfigError";
  }
}

/**
 * Usage error (invalid arguments)
 */
export class UsageError extends CliError {
  constructor(message: string) {
    super(message, EXIT_USAGE);
    this.name = "UsageError";
  }
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Handle an error and exit with appropriate code
 */
export function handleError(err: unknown, options?: { verbose: boolean }): never {
  if (err instanceof CliError) {
    printError(err.message);
    if (err.suggestion) {
      suggest(err.suggestion);
    }
    if (options?.verbose && err.stack) {
      newline();
      dim(err.stack);
    }
    process.exit(err.exitCode);
  }

  // Handle standard errors
  if (err instanceof Error) {
    printError(err.message);
    if (options?.verbose && err.stack) {
      newline();
      dim(err.stack);
    }
    process.exit(EXIT_FAILURE);
  }

  // Handle unknown errors
  printError(String(err));
  process.exit(EXIT_FAILURE);
}

/**
 * Wrap an async function with error handling
 */
export function withErrorHandling<T extends unknown[]>(
  fn: (...args: T) => Promise<void>,
  options?: { verbose: boolean }
): (...args: T) => Promise<void> {
  return async (...args: T) => {
    try {
      await fn(...args);
    } catch (err) {
      handleError(err, options);
    }
  };
}

/**
 * Categorize an error and return appropriate CliError
 */
export function categorizeError(err: unknown): CliError {
  if (err instanceof CliError) {
    return err;
  }

  if (err instanceof Error) {
    const message = err.message.toLowerCase();

    // Network errors
    if (
      message.includes("network") ||
      message.includes("econnrefused") ||
      message.includes("enotfound") ||
      message.includes("etimedout") ||
      message.includes("fetch failed")
    ) {
      return new NetworkError(err.message);
    }

    // Permission errors
    if (
      message.includes("eacces") ||
      message.includes("permission denied") ||
      message.includes("eperm")
    ) {
      return new PermissionError(err.message);
    }

    // File not found
    if (message.includes("enoent") || message.includes("no such file")) {
      return new FileNotFoundError(err.message);
    }

    // Timeout
    if (message.includes("timeout") || message.includes("timed out")) {
      return new TimeoutError("Operation", 30000);
    }

    // Authentication
    if (
      message.includes("unauthorized") ||
      message.includes("401") ||
      message.includes("authentication")
    ) {
      return new AuthError(err.message);
    }

    // Return generic CliError
    return new CliError(err.message);
  }

  return new CliError(String(err));
}

// ============================================================================
// Error Messages with Actions
// ============================================================================

/**
 * Common error messages with actionable suggestions
 */
export const ErrorMessages = {
  toolNotFound: (name: string) => ({
    message: `Tool "${name}" not found`,
    suggestions: [
      "Check the tool name spelling",
      `Search for tools: ${colors.command("enact search <query>")}`,
      `Install from path: ${colors.command("enact install ./path/to/tool")}`,
    ],
  }),

  notAuthenticated: () => ({
    message: "You are not authenticated",
    suggestions: [
      `Log in: ${colors.command("enact auth login")}`,
      `Check status: ${colors.command("enact auth status")}`,
    ],
  }),

  manifestNotFound: (dir: string) => ({
    message: `No manifest found in ${dir}`,
    suggestions: [
      `Create a manifest: ${colors.command("enact init")}`,
      "Ensure the directory contains enact.yaml or enact.md",
    ],
  }),

  invalidManifest: (errors: string[]) => ({
    message: "Invalid manifest",
    suggestions: [
      "Fix the following errors:",
      ...errors.map((e) => `  ${colors.error("•")} ${e}`),
      `Validate manifest: ${colors.command("enact validate")}`,
    ],
  }),

  registryUnavailable: () => ({
    message: "Registry is unavailable",
    suggestions: [
      "Check your internet connection",
      `Verify registry URL: ${colors.command("enact config get registry.url")}`,
      "Try again later",
    ],
  }),

  containerRuntimeNotFound: () => ({
    message: "No container runtime found",
    suggestions: [
      "Install Docker: https://docs.docker.com/get-docker/",
      "Or install Podman: https://podman.io/getting-started/installation",
      "Ensure the runtime is running",
    ],
  }),

  trustVerificationFailed: (tool: string) => ({
    message: `Trust verification failed for "${tool}"`,
    suggestions: [
      "The tool has no valid attestations",
      `Add a trusted publisher: ${colors.command("enact trust add <identity>")}`,
      `Check attestations: ${colors.command(`enact trust check ${tool}`)}`,
    ],
  }),

  executionFailed: (tool: string, exitCode: number) => ({
    message: `Tool "${tool}" failed with exit code ${exitCode}`,
    suggestions: [
      "Check tool logs for details",
      "Verify input parameters",
      `Run with verbose output: ${colors.command("enact run --verbose")}`,
    ],
  }),
};

/**
 * Print an error with actionable suggestions
 */
export function printErrorWithSuggestions(errorInfo: {
  message: string;
  suggestions: string[];
}): void {
  printError(errorInfo.message);
  newline();
  for (const suggestion of errorInfo.suggestions) {
    console.log(`  ${colors.dim("•")} ${suggestion}`);
  }
}
