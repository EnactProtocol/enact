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
  configureGetCommand,
  configureInitCommand,
  configureInspectCommand,
  configureInstallCommand,
  configureListCommand,
  configurePublishCommand,
  configureReportCommand,
  configureRunCommand,
  configureSearchCommand,
  configureSetupCommand,
  configureSignCommand,
  configureTrustCommand,
  configureUnyankCommand,
  configureYankCommand,
} from "./commands";
import { error, formatError } from "./utils";

export const version = "2.0.6";

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
    .version(version);

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
  configureGetCommand(program);
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

  // Global error handler
  program.exitOverride((err) => {
    if (err.code === "commander.help" || err.code === "commander.version") {
      process.exit(0);
    }
    throw err;
  });

  try {
    await program.parseAsync(process.argv);
  } catch (err) {
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
