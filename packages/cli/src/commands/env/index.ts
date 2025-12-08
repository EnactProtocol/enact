/**
 * enact env command
 *
 * Manage environment variables and secrets.
 */

import {
  deleteEnv,
  deleteSecret,
  getEnv,
  listEnv,
  listSecrets,
  secretExists,
  setEnv,
  setSecret,
} from "@enactprotocol/secrets";
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import {
  type TableColumn,
  dim,
  error,
  formatError,
  header,
  info,
  json,
  keyValue,
  newline,
  password,
  success,
  table,
} from "../../utils";

interface EnvSetOptions extends GlobalOptions {
  secret?: boolean;
  namespace?: string;
  local?: boolean;
}

interface EnvGetOptions extends GlobalOptions {
  secret?: boolean;
  namespace?: string;
}

interface EnvListOptions extends GlobalOptions {
  secret?: boolean;
  namespace?: string;
  local?: boolean;
  global?: boolean;
}

interface EnvDeleteOptions extends GlobalOptions {
  secret?: boolean;
  namespace?: string;
  local?: boolean;
}

/**
 * Set environment variable or secret
 */
async function envSetHandler(
  key: string,
  value: string | undefined,
  options: EnvSetOptions,
  ctx: CommandContext
): Promise<void> {
  if (options.secret) {
    // Setting a secret in the keyring
    if (!options.namespace) {
      error("--namespace is required when setting a secret");
      dim("Example: enact env set API_KEY --secret --namespace alice/api");
      process.exit(1);
    }

    // If no value provided, prompt for it
    let secretValue = value;
    if (!secretValue) {
      if (!ctx.isInteractive) {
        error("Value is required in non-interactive mode");
        process.exit(1);
      }
      const prompted = await password(`Enter value for ${key}:`);
      if (!prompted) {
        error("No value provided");
        process.exit(1);
      }
      secretValue = prompted;
    }

    await setSecret(options.namespace, key, secretValue);

    if (options.json) {
      json({ set: true, key, namespace: options.namespace, type: "secret" });
      return;
    }

    success(`Secret ${key} set for namespace ${options.namespace}`);
  } else {
    // Setting an environment variable in .env file
    if (!value) {
      error("Value is required for environment variables");
      dim("Example: enact env set API_URL https://api.example.com");
      process.exit(1);
    }

    const scope = options.local ? "local" : "global";
    setEnv(key, value, scope, ctx.cwd);

    if (options.json) {
      json({ set: true, key, value, scope, type: "env" });
      return;
    }

    success(`Environment variable ${key} set (${scope})`);
  }
}

/**
 * Get environment variable or check secret existence
 */
async function envGetHandler(
  key: string,
  options: EnvGetOptions,
  ctx: CommandContext
): Promise<void> {
  if (options.secret) {
    // Check if secret exists (never show value)
    if (!options.namespace) {
      error("--namespace is required when getting a secret");
      process.exit(1);
    }

    const exists = await secretExists(options.namespace, key);

    if (options.json) {
      json({ key, namespace: options.namespace, exists, type: "secret" });
      return;
    }

    if (exists) {
      success(`Secret ${key} exists for namespace ${options.namespace}`);
    } else {
      info(`Secret ${key} not found for namespace ${options.namespace}`);
    }
  } else {
    // Get environment variable
    const result = getEnv(key, undefined, ctx.cwd);

    if (options.json) {
      json(result ? { ...result, type: "env" } : { key, found: false, type: "env" });
      return;
    }

    if (result) {
      keyValue("Key", key);
      keyValue("Value", result.value);
      keyValue("Source", result.source);
      if (result.filePath) {
        keyValue("File", result.filePath);
      }
    } else {
      info(`Environment variable ${key} not found`);
    }
  }
}

/**
 * List environment variables or secrets
 */
async function envListHandler(options: EnvListOptions, ctx: CommandContext): Promise<void> {
  if (options.secret) {
    // List secrets for a namespace
    if (!options.namespace) {
      error("--namespace is required when listing secrets");
      process.exit(1);
    }

    const secrets = await listSecrets(options.namespace);

    if (options.json) {
      json({ namespace: options.namespace, secrets, type: "secrets" });
      return;
    }

    if (secrets.length === 0) {
      info(`No secrets found for namespace ${options.namespace}`);
      return;
    }

    header(`Secrets for ${options.namespace}`);
    newline();
    for (const name of secrets) {
      dim(`  • ${name}`);
    }
    newline();
    dim(`Total: ${secrets.length} secret(s)`);
  } else {
    // List environment variables
    let scope: "local" | "global" | "all" = "all";
    if (options.local && !options.global) {
      scope = "local";
    } else if (options.global && !options.local) {
      scope = "global";
    }

    const envVars = listEnv(scope, ctx.cwd);

    if (options.json) {
      json({ scope, variables: envVars, type: "env" });
      return;
    }

    if (envVars.length === 0) {
      info("No environment variables found");
      dim("Set variables with 'enact env set KEY VALUE'");
      return;
    }

    header("Environment Variables");
    newline();

    const columns: TableColumn[] = [
      { key: "key", header: "Key", width: 25 },
      { key: "value", header: "Value", width: 40 },
      { key: "source", header: "Source", width: 10 },
    ];

    // Transform to table-compatible format
    const tableData = envVars.map((v) => ({
      key: v.key,
      value: v.value.length > 40 ? `${v.value.slice(0, 37)}...` : v.value,
      source: v.source,
    }));

    table(tableData, columns);
    newline();
    dim(`Total: ${envVars.length} variable(s)`);
  }
}

/**
 * Delete environment variable or secret
 */
async function envDeleteHandler(
  key: string,
  options: EnvDeleteOptions,
  ctx: CommandContext
): Promise<void> {
  if (options.secret) {
    // Delete secret from keyring
    if (!options.namespace) {
      error("--namespace is required when deleting a secret");
      process.exit(1);
    }

    const deleted = await deleteSecret(options.namespace, key);

    if (options.json) {
      json({ deleted, key, namespace: options.namespace, type: "secret" });
      return;
    }

    if (deleted) {
      success(`Secret ${key} deleted from namespace ${options.namespace}`);
    } else {
      info(`Secret ${key} not found for namespace ${options.namespace}`);
    }
  } else {
    // Delete environment variable
    const scope = options.local ? "local" : "global";
    const deleted = deleteEnv(key, scope, ctx.cwd);

    if (options.json) {
      json({ deleted, key, scope, type: "env" });
      return;
    }

    if (deleted) {
      success(`Environment variable ${key} deleted (${scope})`);
    } else {
      info(`Environment variable ${key} not found (${scope})`);
    }
  }
}

/**
 * Configure the env command
 */
export function configureEnvCommand(program: Command): void {
  const env = program.command("env").description("Manage environment variables and secrets");

  // env set
  env
    .command("set")
    .description("Set an environment variable or secret")
    .argument("<key>", "Variable name")
    .argument("[value]", "Variable value (prompted if secret and not provided)")
    .option("-s, --secret", "Store as secret in OS keyring")
    .option("-n, --namespace <namespace>", "Namespace for secret (required with --secret)")
    .option("-l, --local", "Set in project .enact/.env instead of global")
    .option("--json", "Output as JSON")
    .action(async (key: string, value: string | undefined, options: EnvSetOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await envSetHandler(key, value, options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });

  // env get
  env
    .command("get")
    .description("Get an environment variable or check if a secret exists")
    .argument("<key>", "Variable name")
    .option("-s, --secret", "Check secret in OS keyring (never shows value)")
    .option("-n, --namespace <namespace>", "Namespace for secret (required with --secret)")
    .option("--json", "Output as JSON")
    .action(async (key: string, options: EnvGetOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await envGetHandler(key, options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });

  // env list
  env
    .command("list")
    .description("List environment variables or secrets")
    .option("-s, --secret", "List secrets from OS keyring")
    .option("-n, --namespace <namespace>", "Namespace for secrets (required with --secret)")
    .option("-l, --local", "Show only project .enact/.env variables")
    .option("-g, --global", "Show only global ~/.enact/.env variables")
    .option("--json", "Output as JSON")
    .action(async (options: EnvListOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await envListHandler(options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });

  // env delete
  env
    .command("delete")
    .alias("rm")
    .description("Delete an environment variable or secret")
    .argument("<key>", "Variable name")
    .option("-s, --secret", "Delete secret from OS keyring")
    .option("-n, --namespace <namespace>", "Namespace for secret (required with --secret)")
    .option("-l, --local", "Delete from project .enact/.env instead of global")
    .option("--json", "Output as JSON")
    .action(async (key: string, options: EnvDeleteOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await envDeleteHandler(key, options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });
}
