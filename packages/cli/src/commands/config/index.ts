/**
 * enact config command
 *
 * Manage CLI configuration.
 */

import { getConfigPath, getConfigValue, loadConfig, setConfigValue } from "@enactprotocol/shared";
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import { dim, error, formatError, info, json, keyValue, newline, success } from "../../utils";

interface ConfigOptions extends GlobalOptions {}

/**
 * Get a config value
 */
async function configGetHandler(
  key: string,
  options: ConfigOptions,
  _ctx: CommandContext
): Promise<void> {
  const value = getConfigValue(key, undefined);

  if (options.json) {
    json({ key, value });
    return;
  }

  if (value === undefined) {
    info(`Configuration key '${key}' is not set`);
  } else {
    keyValue(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }
}

/**
 * Set a config value
 */
async function configSetHandler(
  key: string,
  value: string,
  options: ConfigOptions,
  _ctx: CommandContext
): Promise<void> {
  // Try to parse value as JSON for complex values
  let parsedValue: unknown = value;
  try {
    parsedValue = JSON.parse(value);
  } catch {
    // Keep as string if not valid JSON
  }

  setConfigValue(key, parsedValue);

  if (options.json) {
    json({ key, value: parsedValue, set: true });
    return;
  }

  success(`Set ${key} = ${value}`);
}

/**
 * List all config values
 */
async function configListHandler(options: ConfigOptions, _ctx: CommandContext): Promise<void> {
  const config = loadConfig();

  if (options.json) {
    json(config);
    return;
  }

  dim(`Configuration file: ${getConfigPath()}`);
  newline();

  // Flatten config for display
  function displayObject(obj: Record<string, unknown>, prefix = ""): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        displayObject(value as Record<string, unknown>, fullKey);
      } else {
        const displayValue = Array.isArray(value) ? JSON.stringify(value) : String(value);
        keyValue(fullKey, displayValue);
      }
    }
  }

  displayObject(config as unknown as Record<string, unknown>);
}

/**
 * Configure the config command
 */
export function configureConfigCommand(program: Command): void {
  const config = program.command("config").description("Manage CLI configuration");

  // config get
  config
    .command("get")
    .description("Get a configuration value")
    .argument("<key>", "Configuration key (dot notation, e.g., trust.policy)")
    .option("--json", "Output as JSON")
    .action(async (key: string, options: ConfigOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await configGetHandler(key, options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });

  // config set
  config
    .command("set")
    .description("Set a configuration value")
    .argument("<key>", "Configuration key (dot notation, e.g., trust.policy)")
    .argument("<value>", "Value to set (JSON for complex values)")
    .option("--json", "Output as JSON")
    .action(async (key: string, value: string, options: ConfigOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await configSetHandler(key, value, options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });

  // config list
  config
    .command("list")
    .description("List all configuration values")
    .option("--json", "Output as JSON")
    .action(async (options: ConfigOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await configListHandler(options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });
}
