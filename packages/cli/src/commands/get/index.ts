/**
 * enact get command
 *
 * Show detailed information about a tool from the registry.
 */

import {
  type ToolInfo,
  type ToolVersionInfo,
  createApiClient,
  getToolInfo,
  getToolVersion,
} from "@enactprotocol/api";
import { loadConfig } from "@enactprotocol/shared";
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import {
  dim,
  error,
  formatError,
  header,
  info,
  json,
  keyValue,
  newline,
  success,
} from "../../utils";

interface GetOptions extends GlobalOptions {
  version?: string;
}

/**
 * Format a date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Display tool info
 */
function displayToolInfo(tool: ToolInfo, options: GetOptions): void {
  header(tool.name);
  newline();

  info(tool.description);
  newline();

  keyValue("Latest Version", tool.latestVersion);
  keyValue("License", tool.license);
  keyValue("Created", formatDate(tool.createdAt));
  keyValue("Updated", formatDate(tool.updatedAt));

  if (tool.tags.length > 0) {
    keyValue("Tags", tool.tags.join(", "));
  }

  if (tool.author) {
    keyValue("Author", tool.author.username);
  }

  newline();
  keyValue("Available Versions", tool.versions.join(", "));

  if (options.verbose) {
    newline();
    dim("Use --version <ver> to see version-specific details");
  }
}

/**
 * Display version-specific info
 */
function displayVersionInfo(version: ToolVersionInfo): void {
  header(`${version.name}@${version.version}`);
  newline();

  info(version.description);
  newline();

  keyValue("Version", version.version);
  keyValue("License", version.license);
  if (version.bundle) {
    keyValue("Bundle Hash", version.bundle.hash);
    keyValue("Bundle Size", `${(version.bundle.size / 1024).toFixed(1)} KB`);
  }

  if (version.yanked) {
    newline();
    dim(`⚠ This version is yanked${version.yankReason ? `: ${version.yankReason}` : ""}`);
    if (version.yankReplacement) {
      dim(`  Recommended: ${version.yankReplacement}`);
    }
  }

  if (version.manifest) {
    newline();
    dim("Manifest:");
    console.log(JSON.stringify(version.manifest, null, 2));
  }
}

/**
 * Get command handler
 */
async function getHandler(
  toolName: string,
  options: GetOptions,
  ctx: CommandContext
): Promise<void> {
  const config = loadConfig();
  const registryUrl =
    process.env.ENACT_REGISTRY_URL ??
    config.registry?.url ??
    "https://siikwkfgsmouioodghho.supabase.co/functions/v1";
  const authToken = config.registry?.authToken;
  const client = createApiClient({
    baseUrl: registryUrl,
    authToken: authToken,
  });

  if (ctx.options.verbose) {
    info(`Fetching info for: ${toolName}`);
  }

  try {
    if (options.version) {
      // Get specific version info
      const versionInfo = await getToolVersion(client, toolName, options.version);

      if (options.json) {
        json(versionInfo);
        return;
      }

      displayVersionInfo(versionInfo);
    } else {
      // Get general tool info
      const toolInfo = await getToolInfo(client, toolName);

      if (options.json) {
        json(toolInfo);
        return;
      }

      displayToolInfo(toolInfo, options);
    }

    newline();
    success(`Install with: enact install ${toolName}`);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes("not_found") || err.message.includes("404")) {
        error(`Tool not found: ${toolName}`);
        dim("Check the tool name or search with: enact search <query>");
        process.exit(1);
      }
      if (err.message.includes("fetch")) {
        error("Unable to connect to registry. Check your internet connection.");
        process.exit(1);
      }
    }
    throw err;
  }
}

/**
 * Configure the get command
 */
export function configureGetCommand(program: Command): void {
  program
    .command("get <tool>")
    .alias("info")
    .description("Show detailed information about a tool")
    .option("-V, --version <version>", "Show info for a specific version")
    .option("-v, --verbose", "Show detailed output")
    .option("--json", "Output as JSON")
    .action(async (toolName: string, options: GetOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await getHandler(toolName, options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });
}
