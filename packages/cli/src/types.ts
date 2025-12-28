/**
 * CLI Types
 */

import type { Command } from "commander";

/**
 * Global CLI options available to all commands
 */
export interface GlobalOptions {
  /** Enable verbose output */
  verbose?: boolean;
  /** Output as JSON */
  json?: boolean;
  /** Suppress all output except errors */
  quiet?: boolean;
  /** Run without making changes (preview mode) */
  dryRun?: boolean;
  /** Enable debug mode - show detailed parameter and environment information */
  debug?: boolean;
}

/**
 * Context passed to command handlers
 */
export interface CommandContext {
  /** Current working directory */
  cwd: string;
  /** Global options */
  options: GlobalOptions;
  /** Whether running in CI environment */
  isCI: boolean;
  /** Whether running interactively (TTY) */
  isInteractive: boolean;
}

/**
 * Command handler function signature
 */
export type CommandHandler<T = Record<string, unknown>> = (
  args: T,
  context: CommandContext
) => Promise<void>;

/**
 * Command definition for registration
 */
export interface CommandDefinition {
  /** Command name */
  name: string;
  /** Command description */
  description: string;
  /** Command aliases */
  aliases?: string[];
  /** Configure the command (add options, arguments, subcommands) */
  configure: (cmd: Command) => void;
}

/**
 * Result from a command execution
 */
export interface CommandResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Exit codes
 */
export const ExitCode = {
  Success: 0,
  Error: 1,
  InvalidArgs: 2,
  NotFound: 3,
  PermissionDenied: 4,
  Cancelled: 130, // Standard for Ctrl+C
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

// Legacy placeholder
export type CLIConfig = Record<string, unknown>;
