/**
 * enact unyank command
 *
 * Restore a previously yanked tool version.
 */

import { createApiClient, unyankVersion } from "@enactprotocol/api";
import { getSecret } from "@enactprotocol/secrets";
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import { dim, error, formatError, info, json, keyValue, newline, success } from "../../utils";

/** Auth namespace for token storage */
const AUTH_NAMESPACE = "enact:auth";
const ACCESS_TOKEN_KEY = "access_token";

interface UnyankOptions extends GlobalOptions {}

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
 * Unyank command handler
 */
async function unyankHandler(
  toolSpec: string,
  options: UnyankOptions,
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

  info(`Restoring ${name}@${version}...`);
  newline();

  try {
    const result = await unyankVersion(client, name, version);

    if (options.json) {
      json({
        yanked: result.yanked,
        name,
        version: result.version,
        unyankedAt: result.unyankedAt.toISOString(),
      });
      return;
    }

    success(`Restored ${name}@${version}`);
    keyValue("Unyanked At", result.unyankedAt.toISOString());
    newline();
    dim("The version is now visible in version listings again.");
  } catch (err) {
    error(`Failed to restore version: ${formatError(err)}`);
    process.exit(1);
  }
}

/**
 * Configure the unyank command
 */
export function configureUnyankCommand(program: Command): void {
  program
    .command("unyank <tool@version>")
    .description("Restore a previously yanked tool version")
    .option("-v, --verbose", "Show detailed output")
    .option("--json", "Output as JSON")
    .action(async (toolSpec: string, options: UnyankOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await unyankHandler(toolSpec, options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });
}
