/**
 * enact exec command
 *
 * Execute an arbitrary command in a tool's container environment.
 * Unlike `run`, this allows running any command, not just the manifest-defined one.
 */

import { DaggerExecutionProvider, type ExecutionResult } from "@enactprotocol/execution";
import { resolveSecrets, resolveToolEnv } from "@enactprotocol/secrets";
import { resolveToolAuto } from "@enactprotocol/shared";
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import { dim, error, formatError, json, newline, suggest, symbols, withSpinner } from "../../utils";

interface ExecOptions extends GlobalOptions {
  timeout?: string;
}

/**
 * Display execution result
 */
function displayResult(result: ExecutionResult, options: ExecOptions): void {
  if (options.json) {
    json(result);
    return;
  }

  if (result.success) {
    if (result.output?.stdout) {
      process.stdout.write(result.output.stdout);
      if (!result.output.stdout.endsWith("\n")) {
        newline();
      }
    }

    if (options.verbose && result.output?.stderr) {
      dim(`stderr: ${result.output.stderr}`);
    }

    if (options.verbose && result.metadata) {
      newline();
      dim(`Duration: ${result.metadata.durationMs}ms`);
      dim(`Exit code: ${result.output?.exitCode ?? 0}`);
    }
  } else {
    error(`Execution failed: ${result.error?.message ?? "Unknown error"}`);

    if (result.output?.stderr) {
      newline();
      dim("stderr:");
      dim(result.output.stderr);
    }
  }
}

/**
 * Parse timeout string (e.g., "30s", "5m", "1h")
 */
function parseTimeout(timeout: string): number {
  const match = timeout.match(/^(\d+)(s|m|h)?$/);
  if (!match) {
    throw new Error(`Invalid timeout format: ${timeout}. Use format like "30s", "5m", or "1h".`);
  }

  const value = Number.parseInt(match[1] ?? "0", 10);
  const unit = match[2] || "s";

  switch (unit) {
    case "h":
      return value * 60 * 60 * 1000;
    case "m":
      return value * 60 * 1000;
    default:
      return value * 1000;
  }
}

/**
 * Exec command handler
 */
async function execHandler(
  tool: string,
  command: string,
  options: ExecOptions,
  ctx: CommandContext
): Promise<void> {
  // Resolve the tool
  const resolution = await withSpinner(
    `Resolving tool: ${tool}`,
    async () => resolveToolAuto(tool, { startDir: ctx.cwd }),
    `${symbols.success} Resolved: ${tool}`
  );

  if (!resolution) {
    error(`Tool not found: ${tool}`);
    suggest(`Try 'enact install ${tool}' first, or check the tool name.`);
    process.exit(1);
  }

  const manifest = resolution.manifest;

  // Resolve environment variables (non-secrets)
  const { resolved: envResolved } = resolveToolEnv(manifest.env ?? {}, ctx.cwd);
  const envVars: Record<string, string> = {};
  for (const [key, envRes] of envResolved) {
    envVars[key] = envRes.value;
  }

  // Resolve secrets
  const secretDeclarations = Object.entries(manifest.env ?? {})
    .filter(([_, v]) => v.secret)
    .map(([k]) => k);

  if (secretDeclarations.length > 0) {
    const namespace = manifest.name.split("/").slice(0, -1).join("/") || manifest.name;
    const secretResults = await resolveSecrets(namespace, secretDeclarations);

    for (const [key, result] of secretResults) {
      if (result.found && result.value) {
        envVars[key] = result.value;
      }
    }
  }

  // Execute the custom command
  const providerConfig: { defaultTimeout?: number; verbose?: boolean } = {};
  if (options.timeout) {
    providerConfig.defaultTimeout = parseTimeout(options.timeout);
  }
  if (options.verbose) {
    providerConfig.verbose = true;
  }

  const provider = new DaggerExecutionProvider(providerConfig);

  try {
    await provider.initialize();

    // Create a modified manifest with the custom command
    const execManifest = {
      ...manifest,
      command,
    };

    const result = await withSpinner(
      `Executing in ${manifest.name}...`,
      async () =>
        provider.execute(execManifest, {
          params: {},
          envOverrides: envVars,
        }),
      options.verbose ? `${symbols.success} Execution complete` : undefined
    );

    displayResult(result, options);

    if (!result.success) {
      process.exit(1);
    }
  } finally {
    // Provider cleanup handled by Dagger
  }
}

/**
 * Configure the exec command
 */
export function configureExecCommand(program: Command): void {
  program
    .command("exec")
    .description("Execute an arbitrary command in a tool's container environment")
    .argument("<tool>", "Tool to run in (name, path, or '.' for current directory)")
    .argument("<command>", "Command to execute (quote complex commands)")
    .option("-t, --timeout <duration>", "Execution timeout (e.g., 30s, 5m)")
    .option("-v, --verbose", "Show detailed output")
    .option("--json", "Output result as JSON")
    .action(async (tool: string, command: string, options: ExecOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await execHandler(tool, command, options, ctx);
      } catch (err) {
        error(formatError(err));
        if (options.verbose && err instanceof Error && err.stack) {
          dim(err.stack);
        }
        process.exit(1);
      }
    });
}
