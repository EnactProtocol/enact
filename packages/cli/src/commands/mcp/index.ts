/**
 * enact mcp command
 *
 * Manage MCP-exposed tools and toolsets.
 *
 * Subcommands:
 *   - install: Show configuration for MCP clients (Claude Code, etc.)
 *   - list: List tools exposed to MCP
 *   - add: Add a tool to MCP (from global installs)
 *   - remove: Remove a tool from MCP
 *   - toolsets: List available toolsets
 *   - use: Switch active toolset
 *   - toolset: Manage toolsets (create, delete, add, remove)
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  addMcpTool,
  addToolToToolset,
  createToolset,
  deleteToolset,
  getActiveToolset,
  listMcpTools,
  listToolsets,
  loadToolsRegistry,
  removeMcpTool,
  removeToolFromToolset,
  setActiveToolset,
  syncMcpWithGlobalTools,
  tryLoadManifestFromDir,
} from "@enactprotocol/shared";
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
  select,
  success,
  table,
} from "../../utils";

interface McpInstallOptions extends GlobalOptions {
  client?: string;
}

interface McpOptions extends GlobalOptions {
  all?: boolean;
  sync?: boolean;
}

interface ToolInfo {
  name: string;
  version: string;
  description: string;
  [key: string]: string;
}

/**
 * Get the path to enact-mcp binary
 */
function getEnactMcpPath(): string {
  // For now, assume it's installed globally or via npm
  // Could be enhanced to detect actual binary location
  return "enact-mcp";
}

/**
 * Known MCP client definitions
 */
interface McpClient {
  id: string;
  name: string;
  configPath: string | (() => string);
  configFormat: "json" | "jsonc";
  detected: boolean;
  instructions: string;
  configTemplate: (mcpPath: string) => string;
}

/**
 * Detect installed MCP clients
 */
function detectClients(): McpClient[] {
  const home = homedir();
  const platform = process.platform;

  const clients: McpClient[] = [
    {
      id: "claude-code",
      name: "Claude Code",
      configPath: () => {
        // Claude Code settings location varies by platform
        if (platform === "darwin") {
          return join(
            home,
            "Library",
            "Application Support",
            "Claude",
            "claude_desktop_config.json"
          );
        }
        if (platform === "win32") {
          return join(home, "AppData", "Roaming", "Claude", "claude_desktop_config.json");
        }
        return join(home, ".config", "claude", "claude_desktop_config.json");
      },
      configFormat: "json",
      detected: false,
      instructions: "Add to mcpServers in your Claude Desktop config:",
      configTemplate: (mcpPath) => `{
  "mcpServers": {
    "enact": {
      "command": "${mcpPath}",
      "args": []
    }
  }
}`,
    },
    {
      id: "cursor",
      name: "Cursor",
      configPath: () => {
        if (platform === "darwin") {
          return join(
            home,
            "Library",
            "Application Support",
            "Cursor",
            "User",
            "globalStorage",
            "cursor.mcp",
            "config.json"
          );
        }
        if (platform === "win32") {
          return join(
            home,
            "AppData",
            "Roaming",
            "Cursor",
            "User",
            "globalStorage",
            "cursor.mcp",
            "config.json"
          );
        }
        return join(
          home,
          ".config",
          "Cursor",
          "User",
          "globalStorage",
          "cursor.mcp",
          "config.json"
        );
      },
      configFormat: "json",
      detected: false,
      instructions: "Add to your Cursor MCP configuration:",
      configTemplate: (mcpPath) => `{
  "mcpServers": {
    "enact": {
      "command": "${mcpPath}",
      "args": []
    }
  }
}`,
    },
    {
      id: "vscode",
      name: "VS Code (with MCP extension)",
      configPath: () => {
        if (platform === "darwin") {
          return join(home, "Library", "Application Support", "Code", "User", "settings.json");
        }
        if (platform === "win32") {
          return join(home, "AppData", "Roaming", "Code", "User", "settings.json");
        }
        return join(home, ".config", "Code", "User", "settings.json");
      },
      configFormat: "jsonc",
      detected: false,
      instructions: "Add to your VS Code settings.json:",
      configTemplate: (mcpPath) => `{
  "mcp.servers": {
    "enact": {
      "command": "${mcpPath}",
      "args": []
    }
  }
}`,
    },
    {
      id: "generic",
      name: "Other MCP Client",
      configPath: "",
      configFormat: "json",
      detected: true, // Always available
      instructions: "Generic MCP server configuration:",
      configTemplate: (mcpPath) => `{
  "command": "${mcpPath}",
  "args": []
}`,
    },
  ];

  // Detect which clients are installed
  for (const client of clients) {
    if (client.id === "generic") continue;

    const configPath =
      typeof client.configPath === "function" ? client.configPath() : client.configPath;
    // Check if the app directory exists (not just config file)
    const appDir = join(configPath, "..", "..");
    client.detected = existsSync(appDir) || existsSync(configPath);
  }

  return clients;
}

/**
 * Show MCP configuration for a specific client
 */
function showClientConfig(client: McpClient, mcpPath: string): void {
  header(`Enact MCP Server - ${client.name}`);
  newline();

  info(client.instructions);
  newline();
  console.log(client.configTemplate(mcpPath));

  if (client.id !== "generic") {
    const configPath =
      typeof client.configPath === "function" ? client.configPath() : client.configPath;
    newline();
    dim(`Config file: ${configPath}`);
  }

  if (client.id === "claude-code") {
    newline();
    dim('For HTTP mode (remote access), use args: ["--http", "--port", "3000"]');
  }

  newline();
  dim("The MCP server exposes all tools in ~/.enact/mcp.json");
  dim("Use 'enact mcp sync' to add globally installed tools");
  dim("Use 'enact mcp list' to see available tools");
}

/**
 * Show MCP configuration for various clients
 */
async function installHandler(options: McpInstallOptions, isInteractive: boolean): Promise<void> {
  const mcpPath = getEnactMcpPath();
  const clients = detectClients();

  // If --json, output config
  if (options.json) {
    const config = {
      enact: {
        command: mcpPath,
        args: [] as string[],
      },
    };
    json(config);
    return;
  }

  // If client specified via flag, show that client's config
  if (options.client) {
    const client = clients.find(
      (c) => c.id === options.client || c.name.toLowerCase().includes(options.client!.toLowerCase())
    );
    if (!client) {
      error(`Unknown client: ${options.client}`);
      newline();
      dim(`Available clients: ${clients.map((c) => c.id).join(", ")}`);
      process.exit(1);
    }
    showClientConfig(client, mcpPath);
    return;
  }

  // Interactive mode: show detected clients and let user choose
  if (isInteractive) {
    const detectedClients = clients.filter((c) => c.detected);
    const genericClient = detectedClients.find((c) => c.id === "generic");

    if (detectedClients.length === 1 && genericClient) {
      // No clients detected, show generic
      showClientConfig(genericClient, mcpPath);
      return;
    }

    header("Enact MCP Server Setup");
    newline();

    // Show which clients were detected
    const installedClients = detectedClients.filter((c) => c.id !== "generic");
    if (installedClients.length > 0) {
      info(`Detected MCP clients: ${installedClients.map((c) => c.name).join(", ")}`);
      newline();
    }

    // Let user select
    const selectedId = await select(
      "Select your MCP client:",
      detectedClients.map((c) => {
        const option: { value: string; label: string; hint?: string } = {
          value: c.id,
          label: c.name,
        };
        if (c.id !== "generic" && c.detected) {
          option.hint = "detected";
        }
        return option;
      })
    );

    if (!selectedId) {
      info("Cancelled");
      return;
    }

    const selectedClient = clients.find((c) => c.id === selectedId);
    if (selectedClient) {
      newline();
      showClientConfig(selectedClient, mcpPath);
    }
  } else {
    // Non-interactive: show all detected clients
    const detectedClients = clients.filter((c) => c.detected && c.id !== "generic");
    const genericClient = clients.find((c) => c.id === "generic");

    if (detectedClients.length === 0 && genericClient) {
      showClientConfig(genericClient, mcpPath);
    } else if (detectedClients.length === 1 && detectedClients[0]) {
      showClientConfig(detectedClients[0], mcpPath);
    } else {
      // Multiple clients detected, show them all
      info("Multiple MCP clients detected. Use --client to specify one:");
      newline();
      for (const client of detectedClients) {
        dim(`  --client ${client.id}  (${client.name})`);
      }
      newline();
      dim("Or run interactively to select from a list.");
    }
  }
}

/**
 * List MCP-exposed tools
 */
async function listMcpHandler(options: McpOptions): Promise<void> {
  const mcpTools = listMcpTools();
  const activeToolset = getActiveToolset();

  if (options.json) {
    json({
      tools: mcpTools,
      activeToolset,
    });
    return;
  }

  if (mcpTools.length === 0) {
    info("No tools exposed to MCP.");
    newline();
    dim("Add tools with 'enact mcp add <tool>'");
    dim("Or sync with global installs: 'enact mcp sync'");
    return;
  }

  header("MCP Tools");
  if (activeToolset) {
    keyValue("Active toolset", activeToolset);
  }
  newline();

  const toolInfos: ToolInfo[] = mcpTools.map((tool) => {
    const loaded = tryLoadManifestFromDir(tool.cachePath);
    return {
      name: tool.name,
      version: tool.version,
      description: loaded?.manifest.description ?? "-",
    };
  });

  const columns: TableColumn[] = [
    { key: "name", header: "Name", width: 30 },
    { key: "version", header: "Version", width: 12 },
    { key: "description", header: "Description", width: 45 },
  ];

  table(toolInfos, columns);
  newline();
  dim(`Total: ${mcpTools.length} tool(s)`);
}

/**
 * Add a tool to MCP from global installs
 */
async function addMcpHandler(
  toolName: string,
  options: McpOptions,
  _ctx: CommandContext
): Promise<void> {
  // Get global tools to find the version
  const globalRegistry = loadToolsRegistry("global");
  const version = globalRegistry.tools[toolName];

  if (!version) {
    error(`Tool "${toolName}" is not installed globally.`);
    newline();
    dim(`Install it first with: enact install ${toolName} -g`);
    process.exit(1);
  }

  addMcpTool(toolName, version);

  if (options.json) {
    json({ success: true, tool: toolName, version });
    return;
  }

  success(`Added ${toolName}@${version} to MCP`);
}

/**
 * Remove a tool from MCP
 */
async function removeMcpHandler(toolName: string, options: McpOptions): Promise<void> {
  const removed = removeMcpTool(toolName);

  if (!removed) {
    error(`Tool "${toolName}" is not in MCP registry.`);
    process.exit(1);
  }

  if (options.json) {
    json({ success: true, tool: toolName });
    return;
  }

  success(`Removed ${toolName} from MCP`);
}

/**
 * Sync MCP registry with global tools
 */
async function syncMcpHandler(options: McpOptions): Promise<void> {
  const globalRegistry = loadToolsRegistry("global");
  const beforeCount = listMcpTools().length;

  syncMcpWithGlobalTools(globalRegistry.tools);

  const afterCount = listMcpTools().length;
  const added = afterCount - beforeCount;

  if (options.json) {
    json({ success: true, added, total: afterCount });
    return;
  }

  if (added > 0) {
    success(`Synced ${added} new tool(s) from global installs`);
  } else {
    info("MCP registry is already in sync with global tools");
  }
  dim(`Total MCP tools: ${afterCount}`);
}

/**
 * List toolsets
 */
async function toolsetsHandler(options: McpOptions): Promise<void> {
  const toolsets = listToolsets();

  if (options.json) {
    json(toolsets);
    return;
  }

  if (toolsets.length === 0) {
    info("No toolsets configured.");
    newline();
    dim("Create one with: enact mcp toolset create <name>");
    return;
  }

  header("Toolsets");
  newline();

  for (const ts of toolsets) {
    const prefix = ts.isActive ? "→ " : "  ";
    const suffix = ts.isActive ? " (active)" : "";
    console.log(`${prefix}${ts.name}${suffix}`);
    if (ts.tools.length > 0) {
      dim(`    ${ts.tools.join(", ")}`);
    } else {
      dim("    (empty)");
    }
  }
  newline();
}

/**
 * Switch active toolset
 */
async function useHandler(toolsetName: string | undefined, options: McpOptions): Promise<void> {
  if (options.all) {
    // Use all tools (disable toolset filtering)
    setActiveToolset(null);

    if (options.json) {
      json({ success: true, activeToolset: null });
      return;
    }

    success("Using all MCP tools (no toolset filter)");
    return;
  }

  if (!toolsetName) {
    error("Please specify a toolset name or use --all");
    process.exit(1);
  }

  const result = setActiveToolset(toolsetName);

  if (!result) {
    error(`Toolset "${toolsetName}" not found.`);
    dim("List available toolsets with: enact mcp toolsets");
    process.exit(1);
  }

  if (options.json) {
    json({ success: true, activeToolset: toolsetName });
    return;
  }

  success(`Now using toolset: ${toolsetName}`);
}

/**
 * Toolset management subcommands
 */
async function toolsetHandler(action: string, args: string[], options: McpOptions): Promise<void> {
  switch (action) {
    case "create": {
      const name = args[0];
      if (!name) {
        error("Please specify a toolset name");
        process.exit(1);
      }
      createToolset(name, []);
      if (options.json) {
        json({ success: true, action: "create", toolset: name });
        return;
      }
      success(`Created toolset: ${name}`);
      break;
    }

    case "delete": {
      const name = args[0];
      if (!name) {
        error("Please specify a toolset name");
        process.exit(1);
      }
      const deleted = deleteToolset(name);
      if (!deleted) {
        error(`Toolset "${name}" not found.`);
        process.exit(1);
      }
      if (options.json) {
        json({ success: true, action: "delete", toolset: name });
        return;
      }
      success(`Deleted toolset: ${name}`);
      break;
    }

    case "add": {
      const [toolsetName, toolName] = args;
      if (!toolsetName || !toolName) {
        error("Usage: enact mcp toolset add <toolset> <tool>");
        process.exit(1);
      }
      const added = addToolToToolset(toolsetName, toolName);
      if (!added) {
        error(`Toolset "${toolsetName}" not found.`);
        process.exit(1);
      }
      if (options.json) {
        json({ success: true, action: "add", toolset: toolsetName, tool: toolName });
        return;
      }
      success(`Added ${toolName} to toolset ${toolsetName}`);
      break;
    }

    case "remove": {
      const [toolsetName, toolName] = args;
      if (!toolsetName || !toolName) {
        error("Usage: enact mcp toolset remove <toolset> <tool>");
        process.exit(1);
      }
      const removed = removeToolFromToolset(toolsetName, toolName);
      if (!removed) {
        error(`Tool "${toolName}" not found in toolset "${toolsetName}".`);
        process.exit(1);
      }
      if (options.json) {
        json({ success: true, action: "remove", toolset: toolsetName, tool: toolName });
        return;
      }
      success(`Removed ${toolName} from toolset ${toolsetName}`);
      break;
    }

    default:
      error(`Unknown toolset action: ${action}`);
      newline();
      dim("Available actions: create, delete, add, remove");
      process.exit(1);
  }
}

/**
 * Configure the mcp command
 */
export function configureMcpCommand(program: Command): void {
  const mcp = program.command("mcp").description("Manage MCP-exposed tools and toolsets");

  // enact mcp install
  mcp
    .command("install")
    .description("Show configuration to add Enact MCP server to your AI client")
    .option("--client <client>", "Target client (claude-code, cursor, vscode, generic)")
    .option("--json", "Output as JSON")
    .action(async (options: McpInstallOptions) => {
      const isInteractive = process.stdout.isTTY ?? false;
      try {
        await installHandler(options, isInteractive);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });

  // enact mcp list
  mcp
    .command("list")
    .alias("ls")
    .description("List tools exposed to MCP clients")
    .option("--json", "Output as JSON")
    .action(async (options: McpOptions) => {
      try {
        await listMcpHandler(options);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });

  // enact mcp add <tool>
  mcp
    .command("add <tool>")
    .description("Add a globally installed tool to MCP")
    .option("--json", "Output as JSON")
    .action(async (tool: string, options: McpOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };
      try {
        await addMcpHandler(tool, options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });

  // enact mcp remove <tool>
  mcp
    .command("remove <tool>")
    .alias("rm")
    .description("Remove a tool from MCP")
    .option("--json", "Output as JSON")
    .action(async (tool: string, options: McpOptions) => {
      try {
        await removeMcpHandler(tool, options);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });

  // enact mcp sync
  mcp
    .command("sync")
    .description("Sync MCP registry with globally installed tools")
    .option("--json", "Output as JSON")
    .action(async (options: McpOptions) => {
      try {
        await syncMcpHandler(options);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });

  // enact mcp toolsets
  mcp
    .command("toolsets")
    .description("List available toolsets")
    .option("--json", "Output as JSON")
    .action(async (options: McpOptions) => {
      try {
        await toolsetsHandler(options);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });

  // enact mcp use [toolset]
  mcp
    .command("use [toolset]")
    .description("Switch active toolset (or --all to use all tools)")
    .option("--all", "Use all MCP tools (disable toolset filtering)")
    .option("--json", "Output as JSON")
    .action(async (toolset: string | undefined, options: McpOptions) => {
      try {
        await useHandler(toolset, options);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });

  // enact mcp toolset <action> [args...]
  mcp
    .command("toolset <action> [args...]")
    .description("Manage toolsets (create, delete, add, remove)")
    .option("--json", "Output as JSON")
    .action(async (action: string, args: string[], options: McpOptions) => {
      try {
        await toolsetHandler(action, args, options);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });
}
