/**
 * enact visibility command
 *
 * Change the visibility of a published tool.
 */

import { getSecret } from "@enactprotocol/secrets";
import { loadConfig } from "@enactprotocol/shared";
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import {
  dim,
  error,
  extractNamespace,
  formatError,
  getCurrentUsername,
  header,
  info,
  json,
  newline,
  success,
} from "../../utils";

/** Auth namespace for token storage */
const AUTH_NAMESPACE = "enact:auth";
const ACCESS_TOKEN_KEY = "access_token";

/** Valid visibility levels */
const VALID_VISIBILITIES = ["public", "private", "unlisted"] as const;
type Visibility = (typeof VALID_VISIBILITIES)[number];

interface VisibilityOptions extends GlobalOptions {
  json?: boolean;
}

/**
 * Visibility command handler
 */
async function visibilityHandler(
  tool: string,
  visibility: string,
  options: VisibilityOptions,
  _ctx: CommandContext
): Promise<void> {
  // Validate visibility value
  if (!VALID_VISIBILITIES.includes(visibility as Visibility)) {
    error(`Invalid visibility: ${visibility}`);
    newline();
    dim(`Valid values: ${VALID_VISIBILITIES.join(", ")}`);
    process.exit(1);
  }

  header(`Changing visibility for ${tool}`);
  newline();

  // Pre-flight namespace check
  const currentUsername = await getCurrentUsername();
  if (currentUsername) {
    const toolNamespace = extractNamespace(tool);
    if (toolNamespace !== currentUsername) {
      error(
        `Namespace mismatch: Tool namespace "${toolNamespace}" does not match your username "${currentUsername}".`
      );
      newline();
      dim("You can only change visibility for your own tools.");
      process.exit(1);
    }
  }

  // Get registry URL from config or environment
  const config = loadConfig();
  const registryUrl =
    process.env.ENACT_REGISTRY_URL ??
    config.registry?.url ??
    "https://siikwkfgsmouioodghho.supabase.co/functions/v1";

  // Get auth token
  let authToken = await getSecret(AUTH_NAMESPACE, ACCESS_TOKEN_KEY);
  if (!authToken) {
    authToken = config.registry?.authToken ?? process.env.ENACT_AUTH_TOKEN ?? null;
  }
  if (!authToken) {
    error("Not authenticated. Please run: enact auth login");
    process.exit(1);
  }

  // Make the API request to change visibility
  const response = await fetch(`${registryUrl}/tools/${tool}/visibility`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ visibility }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorJson = JSON.parse(errorText);
      error(`Failed to change visibility: ${errorJson.error?.message ?? errorText}`);
    } catch {
      error(`Failed to change visibility: ${errorText}`);
    }
    process.exit(1);
  }

  // Parse response (we don't use it but need to consume the body)
  await response.json();

  // JSON output
  if (options.json) {
    json({ tool, visibility, success: true });
    return;
  }

  // Success output
  success(`${tool} is now ${visibility}`);
  newline();

  if (visibility === "private") {
    info("This tool is now private - only you can access it.");
  } else if (visibility === "unlisted") {
    info("This tool is now unlisted - accessible via direct link, but not searchable.");
  } else {
    info("This tool is now public - anyone can find and install it.");
  }
}

/**
 * Configure the visibility command
 */
export function configureVisibilityCommand(program: Command): void {
  program
    .command("visibility <tool> <visibility>")
    .description("Change tool visibility (public, private, or unlisted)")
    .option("--json", "Output as JSON")
    .option("-v, --verbose", "Show detailed output")
    .action(async (tool: string, visibility: string, options: VisibilityOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await visibilityHandler(tool, visibility, options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });
}
