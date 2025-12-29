#!/usr/bin/env bun

/**
 * @enactprotocol/cli
 *
 * Command-line interface for Enact.
 * User-facing commands for tool execution, discovery, and management.
 */

import { ensureGlobalSetup } from "@enactprotocol/shared";
import { Command } from "commander";
import {
  configureAuthCommand,
  configureCacheCommand,
  configureConfigCommand,
  configureEnvCommand,
  configureExecCommand,
  configureInfoCommand,
  configureInitCommand,
  configureInspectCommand,
  configureInstallCommand,
  configureLearnCommand,
  configureListCommand,
  configureMcpCommand,
  configurePublishCommand,
  configureReportCommand,
  configureRunCommand,
  configureSearchCommand,
  configureSetupCommand,
  configureSignCommand,
  configureTrustCommand,
  configureUnyankCommand,
  configureValidateCommand,
  configureVisibilityCommand,
  configureYankCommand,
} from "./commands";
import { error, formatError } from "./utils";

export const version = "2.1.30";

// Export types for external use
export type { GlobalOptions, CommandContext } from "./types";

// Main CLI entry point
async function main() {
  // Ensure global setup is complete on first run
  ensureGlobalSetup();

  const program = new Command();

  program
    .name("enact")
    .description("Enact - Verified, portable protocol for AI-executable tools")
    .version(version, "-v, --version", "output the version number");

  // Configure all commands
  configureSetupCommand(program);
  configureInitCommand(program);
  configureRunCommand(program);
  configureExecCommand(program);
  configureInstallCommand(program);
  configureListCommand(program);
  configureEnvCommand(program);
  configureTrustCommand(program);
  configureConfigCommand(program);

  // Registry commands (Phase 8)
  configureSearchCommand(program);
  configureInfoCommand(program);
  configureLearnCommand(program);
  configurePublishCommand(program);
  configureAuthCommand(program);
  configureCacheCommand(program);

  // CLI solidification commands (Phase 9)
  configureSignCommand(program);
  configureReportCommand(program);
  configureInspectCommand(program);

  // API v2 migration commands
  configureYankCommand(program);
  configureUnyankCommand(program);

  // Private tools - visibility management
  configureVisibilityCommand(program);
  // MCP integration commands
  configureMcpCommand(program);

  // Validation command
  configureValidateCommand(program);

  // Global error handler - handle Commander's help/version exits gracefully
  program.exitOverride((err) => {
    // Commander throws errors for help, version, and other "exit" scenarios
    // We want these to exit cleanly without printing error messages
    if (
      err.code === "commander.help" ||
      err.code === "commander.helpDisplayed" ||
      err.code === "commander.version" ||
      err.code === "commander.executeSubCommandAsync" ||
      err.message?.includes("outputHelp")
    ) {
      process.exit(0);
    }
    throw err;
  });

  try {
    await program.parseAsync(process.argv);
  } catch (err: unknown) {
    // Don't print error for help/version (Commander may still throw)
    const errObj = err as { code?: string; message?: string };
    if (errObj?.code?.startsWith("commander.") || errObj?.message?.includes("outputHelp")) {
      process.exit(0);
    }
    error(formatError(err));
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    error(formatError(err));
    process.exit(1);
  });
}
