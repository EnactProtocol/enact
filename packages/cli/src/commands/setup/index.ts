/**
 * enact setup command
 *
 * Set up Enact configuration interactively
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import * as clack from "@clack/prompts";
import { type EnactConfig, getConfigPath, loadConfig } from "@enactprotocol/shared";
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import { dim, error, formatError, info } from "../../utils";

interface SetupOptions extends GlobalOptions {
  force?: boolean;
  global?: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Partial<EnactConfig> = {
  version: "1.0.0",
  trust: {
    minimum_attestations: 1,
  },
  cache: {
    maxSizeMb: 1024,
    ttlSeconds: 604800, // 7 days
  },
  execution: {
    defaultTimeout: "30s",
    verbose: false,
  },
  registry: {
    url: "https://siikwkfgsmouioodghho.supabase.co/functions/v1",
  },
};

/**
 * Setup command handler
 */
async function setupHandler(options: SetupOptions, _ctx: CommandContext): Promise<void> {
  const actualScope = options.global ? "global" : "project";
  const configPath = getConfigPath();

  // Check if config already exists
  if (existsSync(configPath) && !options.force) {
    clack.log.warn(`Configuration already exists at: ${configPath}`);
    const overwrite = await clack.confirm({
      message: "Overwrite existing configuration?",
    });

    if (clack.isCancel(overwrite) || !overwrite) {
      clack.cancel("Setup cancelled");
      process.exit(0);
    }
  }

  clack.intro(`Setting up Enact ${actualScope} configuration`);

  // Load existing config if available
  let existingConfig: EnactConfig = {};
  try {
    if (existsSync(configPath)) {
      existingConfig = loadConfig();
    }
  } catch {
    // Ignore errors loading existing config
  }

  // Prompt for configuration
  const registryUrl = await clack.text({
    message: "Registry URL (recommended: https://siikwkfgsmouioodghho.supabase.co/functions/v1)",
    placeholder: "https://siikwkfgsmouioodghho.supabase.co/functions/v1",
    defaultValue: "https://siikwkfgsmouioodghho.supabase.co/functions/v1",
    validate: (value) => {
      // Allow empty to use default
      if (!value || value.trim() === "") return undefined;
      try {
        new URL(value);
        return undefined;
      } catch {
        return "Invalid URL format";
      }
    },
  });

  if (clack.isCancel(registryUrl)) {
    clack.cancel("Setup cancelled");
    process.exit(0);
  }

  // Use default if empty
  const finalRegistryUrl =
    (registryUrl as string).trim() || "https://siikwkfgsmouioodghho.supabase.co/functions/v1";

  const isLocalDev =
    finalRegistryUrl.includes("localhost") || finalRegistryUrl.includes("127.0.0.1");
  const isOfficialRegistry = finalRegistryUrl.includes("siikwkfgsmouioodghho.supabase.co");

  let authToken: string | undefined;
  if (isLocalDev) {
    const useAnonKey = await clack.confirm({
      message: "Use local development anon key?",
      initialValue: true,
    });

    if (clack.isCancel(useAnonKey)) {
      clack.cancel("Setup cancelled");
      process.exit(0);
    }

    if (useAnonKey) {
      authToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
    }
  } else if (isOfficialRegistry) {
    // Use official registry anon key
    authToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpaWt3a2Znc21vdWlvb2RnaGhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MTkzMzksImV4cCI6MjA4MDE5NTMzOX0.kxnx6-IPFhmGx6rzNx36vbyhFMFZKP_jFqaDbKnJ_E0";
  }

  const minimumAttestations = await clack.text({
    message: "Minimum attestations required for trust",
    placeholder: "1",
    defaultValue: String(
      existingConfig.trust?.minimum_attestations || DEFAULT_CONFIG.trust?.minimum_attestations
    ),
    validate: (value) => {
      if (!value || value.trim() === "") return undefined; // Allow empty for default
      const num = Number(value);
      if (Number.isNaN(num) || num < 0) return "Must be a positive number";
      return undefined;
    },
  });

  if (clack.isCancel(minimumAttestations)) {
    clack.cancel("Setup cancelled");
    process.exit(0);
  }

  const finalMinAttestations = (minimumAttestations as string).trim()
    ? Number(minimumAttestations)
    : existingConfig.trust?.minimum_attestations || DEFAULT_CONFIG.trust?.minimum_attestations || 1;

  const cacheMaxSize = await clack.text({
    message: "Maximum cache size (MB)",
    placeholder: "1024",
    defaultValue: String(existingConfig.cache?.maxSizeMb || DEFAULT_CONFIG.cache?.maxSizeMb),
    validate: (value) => {
      if (!value || value.trim() === "") return undefined; // Allow empty for default
      const num = Number(value);
      if (Number.isNaN(num) || num <= 0) return "Must be a positive number";
      return undefined;
    },
  });

  if (clack.isCancel(cacheMaxSize)) {
    clack.cancel("Setup cancelled");
    process.exit(0);
  }

  const finalCacheMaxSize = (cacheMaxSize as string).trim()
    ? Number(cacheMaxSize)
    : existingConfig.cache?.maxSizeMb || DEFAULT_CONFIG.cache?.maxSizeMb || 1024;

  const defaultTimeout = await clack.text({
    message: "Default execution timeout",
    placeholder: "30s",
    defaultValue:
      existingConfig.execution?.defaultTimeout || DEFAULT_CONFIG.execution?.defaultTimeout || "30s",
    validate: (value) => {
      if (!value || value.trim() === "") return undefined; // Allow empty for default
      if (!/^\d+[smh]$/.test(value)) {
        return "Must be in format: 30s, 5m, or 1h";
      }
      return undefined;
    },
  });

  if (clack.isCancel(defaultTimeout)) {
    clack.cancel("Setup cancelled");
    process.exit(0);
  }

  const finalDefaultTimeout =
    (defaultTimeout as string).trim() ||
    existingConfig.execution?.defaultTimeout ||
    DEFAULT_CONFIG.execution?.defaultTimeout ||
    "30s";

  // Build configuration
  const config: EnactConfig = {
    version: "1.0.0",
    trust: {
      minimum_attestations: finalMinAttestations,
    },
    cache: {
      maxSizeMb: finalCacheMaxSize,
      ttlSeconds: existingConfig.cache?.ttlSeconds || DEFAULT_CONFIG.cache?.ttlSeconds || 604800,
    },
    execution: {
      defaultTimeout: finalDefaultTimeout,
      verbose: existingConfig.execution?.verbose || DEFAULT_CONFIG.execution?.verbose || false,
    },
    registry: {
      url: finalRegistryUrl,
      ...(authToken && { authToken }),
    },
  };

  // Save configuration
  const configDir = dirname(configPath);
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Convert to YAML format
  const yaml = [
    `version: ${config.version}`,
    "trust:",
    `  minimum_attestations: ${config.trust?.minimum_attestations}`,
    "cache:",
    `  maxSizeMb: ${config.cache?.maxSizeMb}`,
    `  ttlSeconds: ${config.cache?.ttlSeconds}`,
    "execution:",
    `  defaultTimeout: ${config.execution?.defaultTimeout}`,
    `  verbose: ${config.execution?.verbose}`,
    "registry:",
    `  url: ${config.registry?.url}`,
    ...(config.registry?.authToken ? [`  authToken: ${config.registry.authToken}`] : []),
  ].join("\n");

  writeFileSync(configPath, `${yaml}\n`, "utf-8");

  clack.outro(`Configuration saved to ${configPath}`);

  if (options.verbose) {
    info("\nConfiguration:");
    dim(yaml);
  }
}

/**
 * Configure the setup command
 */
export function configureSetupCommand(program: Command): void {
  program
    .command("setup")
    .description("Set up Enact configuration")
    .option("-g, --global", "Initialize global configuration (~/.enact/config.yaml)")
    .option("-f, --force", "Overwrite existing configuration without prompting")
    .option("-v, --verbose", "Show detailed output")
    .action(async (options: SetupOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await setupHandler(options, ctx);
      } catch (err) {
        error(formatError(err));
        if (options.verbose && err instanceof Error && err.stack) {
          dim(err.stack);
        }
        process.exit(1);
      }
    });
}
