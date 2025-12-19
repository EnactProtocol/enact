/**
 * MCP tools registry management
 *
 * Manages mcp.json for tracking tools exposed to MCP clients:
 * - Global only: ~/.enact/mcp.json
 *
 * Similar to tools.json but adds toolset management for organizing
 * which tools are exposed to MCP clients.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getCacheDir, getEnactHome } from "./paths";

/**
 * Structure of mcp.json file
 */
export interface McpRegistry {
  /** Map of tool name to installed version */
  tools: Record<string, string>;
  /** Named collections of tools */
  toolsets: Record<string, string[]>;
  /** Currently active toolset (null = expose all tools) */
  activeToolset: string | null;
}

/**
 * Information about an MCP-exposed tool
 */
export interface McpToolInfo {
  name: string;
  version: string;
  cachePath: string;
}

/**
 * Get the path to mcp.json
 */
export function getMcpJsonPath(): string {
  return join(getEnactHome(), "mcp.json");
}

/**
 * Load mcp.json
 * Returns empty registry if file doesn't exist
 */
export function loadMcpRegistry(): McpRegistry {
  const registryPath = getMcpJsonPath();

  if (!existsSync(registryPath)) {
    return { tools: {}, toolsets: {}, activeToolset: null };
  }

  try {
    const content = readFileSync(registryPath, "utf-8");
    const parsed = JSON.parse(content);
    return {
      tools: parsed.tools ?? {},
      toolsets: parsed.toolsets ?? {},
      activeToolset: parsed.activeToolset ?? null,
    };
  } catch {
    // Return empty registry on parse error
    return { tools: {}, toolsets: {}, activeToolset: null };
  }
}

/**
 * Save mcp.json
 */
export function saveMcpRegistry(registry: McpRegistry): void {
  const registryPath = getMcpJsonPath();

  // Ensure directory exists
  const dir = dirname(registryPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const content = JSON.stringify(registry, null, 2);
  writeFileSync(registryPath, content, "utf-8");
}

/**
 * Add a tool to the MCP registry
 */
export function addMcpTool(toolName: string, version: string): void {
  const registry = loadMcpRegistry();
  registry.tools[toolName] = version;
  saveMcpRegistry(registry);
}

/**
 * Remove a tool from the MCP registry
 */
export function removeMcpTool(toolName: string): boolean {
  const registry = loadMcpRegistry();

  if (!(toolName in registry.tools)) {
    return false;
  }

  delete registry.tools[toolName];

  // Also remove from all toolsets
  for (const toolsetName of Object.keys(registry.toolsets)) {
    const toolset = registry.toolsets[toolsetName];
    if (toolset) {
      registry.toolsets[toolsetName] = toolset.filter((t) => t !== toolName);
    }
  }

  saveMcpRegistry(registry);
  return true;
}

/**
 * Check if a tool is in the MCP registry
 */
export function isMcpToolInstalled(toolName: string): boolean {
  const registry = loadMcpRegistry();
  return toolName in registry.tools;
}

/**
 * Get the installed version of an MCP tool
 * Returns null if not installed
 */
export function getMcpToolVersion(toolName: string): string | null {
  const registry = loadMcpRegistry();
  return registry.tools[toolName] ?? null;
}

/**
 * Get the cache path for an MCP tool
 */
function getMcpToolCachePath(toolName: string, version: string): string {
  const cacheDir = getCacheDir();
  const normalizedVersion = version.startsWith("v") ? version.slice(1) : version;
  return join(cacheDir, toolName, `v${normalizedVersion}`);
}

/**
 * List all tools that should be exposed to MCP clients
 * If activeToolset is set, only returns tools in that toolset
 * Otherwise returns all tools
 */
export function listMcpTools(): McpToolInfo[] {
  const registry = loadMcpRegistry();
  const tools: McpToolInfo[] = [];

  // Determine which tools to expose
  let toolsToExpose: string[];

  const activeToolsetTools = registry.activeToolset
    ? registry.toolsets[registry.activeToolset]
    : undefined;

  if (activeToolsetTools) {
    // Filter to only tools in the active toolset that are also installed
    toolsToExpose = activeToolsetTools.filter((name) => name in registry.tools);
  } else {
    // Expose all installed tools
    toolsToExpose = Object.keys(registry.tools);
  }

  for (const name of toolsToExpose) {
    const version = registry.tools[name];
    if (version) {
      tools.push({
        name,
        version,
        cachePath: getMcpToolCachePath(name, version),
      });
    }
  }

  return tools;
}

/**
 * Get info for a specific MCP tool if it's exposed
 */
export function getMcpToolInfo(toolName: string): McpToolInfo | null {
  const registry = loadMcpRegistry();
  const version = registry.tools[toolName];

  if (!version) {
    return null;
  }

  // Check if tool is in active toolset (if one is set)
  if (registry.activeToolset) {
    const activeToolsetTools = registry.toolsets[registry.activeToolset];
    if (activeToolsetTools && !activeToolsetTools.includes(toolName)) {
      return null; // Tool is installed but not in active toolset
    }
  }

  const cachePath = getMcpToolCachePath(toolName, version);

  // Verify cache exists
  if (!existsSync(cachePath)) {
    return null;
  }

  return { name: toolName, version, cachePath };
}

// Toolset management

/**
 * Create a new toolset
 */
export function createToolset(name: string, tools: string[] = []): void {
  const registry = loadMcpRegistry();
  registry.toolsets[name] = tools;
  saveMcpRegistry(registry);
}

/**
 * Delete a toolset
 */
export function deleteToolset(name: string): boolean {
  const registry = loadMcpRegistry();

  if (!(name in registry.toolsets)) {
    return false;
  }

  delete registry.toolsets[name];

  // Clear active toolset if it was the deleted one
  if (registry.activeToolset === name) {
    registry.activeToolset = null;
  }

  saveMcpRegistry(registry);
  return true;
}

/**
 * Add a tool to a toolset
 */
export function addToolToToolset(toolsetName: string, toolName: string): boolean {
  const registry = loadMcpRegistry();

  const toolset = registry.toolsets[toolsetName];
  if (!toolset) {
    return false;
  }

  if (!toolset.includes(toolName)) {
    toolset.push(toolName);
    saveMcpRegistry(registry);
  }

  return true;
}

/**
 * Remove a tool from a toolset
 */
export function removeToolFromToolset(toolsetName: string, toolName: string): boolean {
  const registry = loadMcpRegistry();

  const toolset = registry.toolsets[toolsetName];
  if (!toolset) {
    return false;
  }

  const index = toolset.indexOf(toolName);
  if (index === -1) {
    return false;
  }

  toolset.splice(index, 1);
  saveMcpRegistry(registry);
  return true;
}

/**
 * Set the active toolset
 */
export function setActiveToolset(name: string | null): boolean {
  const registry = loadMcpRegistry();

  if (name !== null && !(name in registry.toolsets)) {
    return false;
  }

  registry.activeToolset = name;
  saveMcpRegistry(registry);
  return true;
}

/**
 * Get the active toolset name
 */
export function getActiveToolset(): string | null {
  const registry = loadMcpRegistry();
  return registry.activeToolset;
}

/**
 * List all toolsets
 */
export function listToolsets(): Array<{ name: string; tools: string[]; isActive: boolean }> {
  const registry = loadMcpRegistry();

  return Object.entries(registry.toolsets).map(([name, tools]) => ({
    name,
    tools,
    isActive: registry.activeToolset === name,
  }));
}

/**
 * Sync MCP registry with global tools.json
 * Adds any tools from tools.json that aren't in mcp.json
 * Does NOT remove tools (allows mcp.json to have subset of tools.json)
 */
export function syncMcpWithGlobalTools(globalTools: Record<string, string>): void {
  const registry = loadMcpRegistry();
  let changed = false;

  for (const [name, version] of Object.entries(globalTools)) {
    if (!(name in registry.tools)) {
      registry.tools[name] = version;
      changed = true;
    }
  }

  if (changed) {
    saveMcpRegistry(registry);
  }
}
