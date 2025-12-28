/**
 * CLI Commands Index
 *
 * Exports all command configuration functions.
 */

export { configureSetupCommand } from "./setup";
export { configureInitCommand } from "./init";
export { configureRunCommand } from "./run";
export { configureExecCommand } from "./exec";
export { configureInstallCommand } from "./install";
export { configureListCommand } from "./list";
export { configureEnvCommand } from "./env";
export { configureTrustCommand } from "./trust";
export { configureConfigCommand } from "./config";

// Registry commands (Phase 8)
export { configureSearchCommand } from "./search";
export { configureInfoCommand } from "./info";
export { configureLearnCommand } from "./learn";
export { configurePublishCommand } from "./publish";
export { configureAuthCommand } from "./auth";
export { configureCacheCommand } from "./cache";

// CLI solidification commands (Phase 9)
export { configureSignCommand } from "./sign";
export { configureReportCommand } from "./report";
export { configureInspectCommand } from "./inspect";

// API v2 migration commands
export { configureYankCommand } from "./yank";
export { configureUnyankCommand } from "./unyank";

// Private tools (Phase - visibility management)
export { configureVisibilityCommand } from "./visibility";
// MCP integration commands
export { configureMcpCommand } from "./mcp";

// Validation command
export { configureValidateCommand } from "./validate";
