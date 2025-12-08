/**
 * enact yank command
 *
 * Yank a published tool version from the registry.
 * Yanked versions remain downloadable but are excluded from version listings
 * and show warnings to users.
 */

import { createApiClient, yankVersion } from "@enactprotocol/api";
import { getSecret } from "@enactprotocol/secrets";
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import {
  dim,
  error,
  formatError,
  info,
  json,
  keyValue,
  newline,
  success,
  warning,
} from "../../utils";

/** Auth namespace for token storage */
const AUTH_NAMESPACE = "enact:auth";
const ACCESS_TOKEN_KEY = "access_token";

interface YankOptions extends GlobalOptions {
  reason?: string;
  replacement?: string;
}

/**
 * Parse tool@version syntax
 */
function parseToolSpec(spec: string): { name: string; version: string } {
  const atIndex = spec.lastIndexOf("@");
  if (atIndex === -1 || atIndex === 0) {
    throw new Error(
      `Invalid tool specification: ${spec}\nExpected format: tool-name@version (e.g., alice/utils/greeter@1.0.0)`
    );
  }

  return {
    name: spec.slice(0, atIndex),
    version: spec.slice(atIndex + 1),
  };
}

/**
 * Yank command handler
 */
async function yankHandler(
  toolSpec: string,
  options: YankOptions,
  _ctx: CommandContext
): Promise<void> {
  // Parse tool@version
  const { name, version } = parseToolSpec(toolSpec);

  // Check for auth token
  const authToken = await getSecret(AUTH_NAMESPACE, ACCESS_TOKEN_KEY);
  if (!authToken) {
    error("Not authenticated. Please run: enact auth login");
    process.exit(1);
  }

  const client = createApiClient();
  client.setAuthToken(authToken);

  info(`Yanking ${name}@${version}...`);

  if (options.reason) {
    dim(`Reason: ${options.reason}`);
  }
  if (options.replacement) {
    dim(`Replacement: ${options.replacement}`);
  }
  newline();

  try {
    const result = await yankVersion(client, name, version, {
      reason: options.reason,
      replacementVersion: options.replacement,
    });

    if (options.json) {
      json({
        yanked: result.yanked,
        name,
        version: result.version,
        reason: result.reason,
        replacementVersion: result.replacementVersion,
        yankedAt: result.yankedAt.toISOString(),
      });
      return;
    }

    success(`Yanked ${name}@${version}`);
    keyValue("Yanked At", result.yankedAt.toISOString());
    if (result.reason) {
      keyValue("Reason", result.reason);
    }
    if (result.replacementVersion) {
      keyValue("Replacement", result.replacementVersion);
    }
    newline();
    warning("Note: Yanked versions can still be downloaded but show warnings.");
    dim("Use 'enact unyank' to restore the version.");
  } catch (err) {
    error(`Failed to yank version: ${formatError(err)}`);
    process.exit(1);
  }
}

/**
 * Configure the yank command
 */
export function configureYankCommand(program: Command): void {
  program
    .command("yank <tool@version>")
    .description("Yank a published tool version from the registry")
    .option("-r, --reason <reason>", "Reason for yanking (e.g., security issue)")
    .option("--replacement <version>", "Recommend a replacement version (e.g., 1.2.1)")
    .option("-v, --verbose", "Show detailed output")
    .option("--json", "Output as JSON")
    .action(async (toolSpec: string, options: YankOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await yankHandler(toolSpec, options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });
}
