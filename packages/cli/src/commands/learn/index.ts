/**
 * enact learn command
 *
 * Display the documentation (enact.md) for a tool.
 * Fetches and displays the raw manifest content for easy reading.
 */

import { createApiClient, getToolInfo, getToolVersion } from "@enactprotocol/api";
import { loadConfig } from "@enactprotocol/shared";
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import { dim, error, formatError, header, json, newline } from "../../utils";

interface LearnOptions extends GlobalOptions {
  ver?: string;
}

/**
 * Learn command handler
 */
async function learnHandler(
  toolName: string,
  options: LearnOptions,
  _ctx: CommandContext
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

  try {
    // Get the version to fetch - either specified or latest
    let version = options.ver;
    if (!version) {
      const toolInfo = await getToolInfo(client, toolName);
      version = toolInfo.latestVersion;
    }

    // Get the version info which includes rawManifest
    const versionInfo = await getToolVersion(client, toolName, version);

    if (options.json) {
      json({
        name: toolName,
        version: versionInfo.version,
        documentation: versionInfo.rawManifest ?? null,
      });
      return;
    }

    if (!versionInfo.rawManifest) {
      error(`No documentation found for ${toolName}@${version}`);
      dim("This tool may not have an enact.md file.");
      process.exit(1);
    }

    // Display the documentation
    header(`${toolName}@${version}`);
    newline();
    console.log(versionInfo.rawManifest);
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
 * Configure the learn command
 */
export function configureLearnCommand(program: Command): void {
  program
    .command("learn <tool>")
    .description("Display documentation (enact.md) for a tool")
    .option("--ver <version>", "Show documentation for a specific version")
    .option("--json", "Output as JSON")
    .action(async (toolName: string, options: LearnOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await learnHandler(toolName, options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });
}
