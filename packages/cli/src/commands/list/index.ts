/**
 * enact list command
 *
 * List installed tools from tools.json registries.
 * - Default: project tools (via .enact/tools.json)
 * - --global/-g: global tools (via ~/.enact/tools.json)
 *
 * All tools are stored in ~/.enact/cache/{tool}/{version}/
 */

import { listInstalledTools, tryLoadManifestFromDir } from "@enactprotocol/shared";
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
  newline,
  table,
} from "../../utils";

interface ListOptions extends GlobalOptions {
  global?: boolean;
}

interface ToolInfo {
  name: string;
  description: string;
  version: string;
  location: string;
  scope: string;
  [key: string]: string; // Index signature for table compatibility
}

/**
 * List tools from tools.json registry
 */
function listToolsFromRegistry(scope: "global" | "project", cwd?: string): ToolInfo[] {
  const tools: ToolInfo[] = [];
  const installedTools = listInstalledTools(scope, cwd);

  for (const tool of installedTools) {
    // Load manifest from cache to get description
    const loaded = tryLoadManifestFromDir(tool.cachePath);
    tools.push({
      name: tool.name,
      description: loaded?.manifest.description ?? "-",
      version: tool.version,
      location: tool.cachePath,
      scope,
    });
  }

  return tools;
}

/**
 * List command handler
 */
async function listHandler(options: ListOptions, ctx: CommandContext): Promise<void> {
  const allTools: ToolInfo[] = [];

  if (options.global) {
    // Global tools (via ~/.enact/tools.json)
    const globalTools = listToolsFromRegistry("global");
    allTools.push(...globalTools);
  } else {
    // Project tools (via .enact/tools.json)
    const projectTools = listToolsFromRegistry("project", ctx.cwd);
    allTools.push(...projectTools);
  }

  // Output
  if (options.json) {
    json(allTools);
    return;
  }

  if (allTools.length === 0) {
    if (options.global) {
      info("No global tools installed.");
      dim("Install globally with 'enact install <tool> -g'");
    } else {
      info("No project tools installed.");
      dim("Install with 'enact install <tool>' or use '-g' for global");
    }
    return;
  }

  header(options.global ? "Global Tools" : "Project Tools");
  newline();

  const columns: TableColumn[] = [
    { key: "name", header: "Name", width: 28 },
    { key: "description", header: "Description", width: 50 },
  ];

  if (options.verbose) {
    columns.push({ key: "version", header: "Version", width: 10 });
    columns.push({ key: "location", header: "Location", width: 40 });
  }

  table(allTools, columns);
  newline();
  dim(`Total: ${allTools.length} tool(s)`);
}

/**
 * Configure the list command
 */
export function configureListCommand(program: Command): void {
  program
    .command("list")
    .alias("ls")
    .description("List installed tools")
    .option("-g, --global", "List global tools (via ~/.enact/tools.json)")
    .option("-v, --verbose", "Show detailed output including paths")
    .option("--json", "Output as JSON")
    .action(async (options: ListOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await listHandler(options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });
}
