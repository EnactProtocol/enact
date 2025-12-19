/**
 * enact info command
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

interface InfoOptions extends GlobalOptions {
  ver?: string;
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
function displayToolInfo(
  tool: ToolInfo,
  options: InfoOptions,
  rawManifest?: string | undefined
): void {
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
  keyValue("Available Versions", tool.versions.map((v) => v.version).join(", "));

  // Show raw manifest when --verbose is used
  if (options.verbose && rawManifest) {
    newline();
    header("Documentation (enact.md)");
    newline();
    console.log(rawManifest);
  }
}

/**
 * Display version-specific info
 */
function displayVersionInfo(version: ToolVersionInfo, options: InfoOptions): void {
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

  // Show raw manifest (enact.md content) when --verbose is used
  if (options.verbose && version.rawManifest) {
    newline();
    header("Documentation (enact.md)");
    newline();
    console.log(version.rawManifest);
  } else if (version.manifest) {
    newline();
    dim("Manifest:");
    console.log(JSON.stringify(version.manifest, null, 2));
  }
}

/**
 * Info command handler
 */
async function infoHandler(
  toolName: string,
  options: InfoOptions,
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
    if (options.ver) {
      // Get specific version info
      const versionInfo = await getToolVersion(client, toolName, options.ver);

      if (options.json) {
        json(versionInfo);
        return;
      }

      displayVersionInfo(versionInfo, options);
    } else {
      // Get general tool info
      const toolInfo = await getToolInfo(client, toolName);

      if (options.json) {
        json(toolInfo);
        return;
      }

      // If verbose, fetch the latest version to get the raw manifest
      let rawManifest: string | undefined;
      if (options.verbose && toolInfo.latestVersion) {
        const versionInfo = await getToolVersion(client, toolName, toolInfo.latestVersion);
        rawManifest = versionInfo.rawManifest;
      }

      displayToolInfo(toolInfo, options, rawManifest);
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
 * Configure the info command
 */
export function configureInfoCommand(program: Command): void {
  program
    .command("info <tool>")
    .alias("get")
    .description("Show detailed information about a tool")
    .option("--ver <version>", "Show info for a specific version")
    .option("-v, --verbose", "Show detailed output")
    .option("--json", "Output as JSON")
    .action(async (toolName: string, options: InfoOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await infoHandler(toolName, options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });
}
