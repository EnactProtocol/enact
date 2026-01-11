/**
 * Local tool registry management
 *
 * Manages tools.json files for tracking installed tools:
 * - Global: ~/.enact/tools.json (installed with -g)
 * - Project: .enact/tools.json (project dependencies)
 *
 * Tools are stored in cache and referenced by version in tools.json.
 * This eliminates the need for a separate ~/.enact/tools/ directory.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getCacheDir, getEnactHome, getProjectEnactDir } from "./paths";

/**
 * Structure of tools.json file
 */
export interface ToolsRegistry {
  /** Map of tool name to installed version */
  tools: Record<string, string>;
  /** Map of alias to full tool name */
  aliases?: Record<string, string>;
}

/**
 * Scope for tool registry
 */
export type RegistryScope = "global" | "project";

/**
 * Information about an installed tool
 */
export interface InstalledToolInfo {
  name: string;
  version: string;
  scope: RegistryScope;
  cachePath: string;
}

/**
 * Get the path to tools.json for the specified scope
 */
export function getToolsJsonPath(scope: RegistryScope, startDir?: string): string | null {
  if (scope === "global") {
    return join(getEnactHome(), "tools.json");
  }

  const projectDir = getProjectEnactDir(startDir);
  return projectDir ? join(projectDir, "tools.json") : null;
}

/**
 * Load tools.json from the specified scope
 * Returns empty registry if file doesn't exist
 */
export function loadToolsRegistry(scope: RegistryScope, startDir?: string): ToolsRegistry {
  const registryPath = getToolsJsonPath(scope, startDir);

  if (!registryPath || !existsSync(registryPath)) {
    return { tools: {}, aliases: {} };
  }

  try {
    const content = readFileSync(registryPath, "utf-8");
    const parsed = JSON.parse(content);
    return {
      tools: parsed.tools ?? {},
      aliases: parsed.aliases ?? {},
    };
  } catch {
    // Return empty registry on parse error
    return { tools: {}, aliases: {} };
  }
}

/**
 * Save tools.json to the specified scope
 */
export function saveToolsRegistry(
  registry: ToolsRegistry,
  scope: RegistryScope,
  startDir?: string
): void {
  let registryPath = getToolsJsonPath(scope, startDir);

  // For project scope, create .enact/ directory if it doesn't exist
  if (!registryPath && scope === "project") {
    const projectRoot = startDir ?? process.cwd();
    const enactDir = join(projectRoot, ".enact");
    mkdirSync(enactDir, { recursive: true });
    registryPath = join(enactDir, "tools.json");
  }

  if (!registryPath) {
    throw new Error("Cannot save project registry: unable to determine registry path");
  }

  // Ensure directory exists
  const dir = dirname(registryPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const content = JSON.stringify(registry, null, 2);
  writeFileSync(registryPath, content, "utf-8");
}

/**
 * Add a tool to the registry
 */
export function addToolToRegistry(
  toolName: string,
  version: string,
  scope: RegistryScope,
  startDir?: string
): void {
  const registry = loadToolsRegistry(scope, startDir);
  registry.tools[toolName] = version;
  saveToolsRegistry(registry, scope, startDir);
}

/**
 * Remove a tool from the registry
 */
export function removeToolFromRegistry(
  toolName: string,
  scope: RegistryScope,
  startDir?: string
): boolean {
  const registry = loadToolsRegistry(scope, startDir);

  if (!(toolName in registry.tools)) {
    return false;
  }

  delete registry.tools[toolName];
  saveToolsRegistry(registry, scope, startDir);
  return true;
}

/**
 * Check if a tool is installed in the registry
 */
export function isToolInstalled(
  toolName: string,
  scope: RegistryScope,
  startDir?: string
): boolean {
  const registry = loadToolsRegistry(scope, startDir);
  return toolName in registry.tools;
}

/**
 * Get the installed version of a tool
 * Returns null if not installed
 */
export function getInstalledVersion(
  toolName: string,
  scope: RegistryScope,
  startDir?: string
): string | null {
  const registry = loadToolsRegistry(scope, startDir);
  return registry.tools[toolName] ?? null;
}

/**
 * Get the cache path for an installed tool
 */
export function getToolCachePath(toolName: string, version: string): string {
  const cacheDir = getCacheDir();
  const normalizedVersion = version.startsWith("v") ? version.slice(1) : version;
  return join(cacheDir, toolName, `v${normalizedVersion}`);
}

/**
 * List all installed tools in a registry
 */
export function listInstalledTools(scope: RegistryScope, startDir?: string): InstalledToolInfo[] {
  const registry = loadToolsRegistry(scope, startDir);
  const tools: InstalledToolInfo[] = [];

  for (const [name, version] of Object.entries(registry.tools)) {
    tools.push({
      name,
      version,
      scope,
      cachePath: getToolCachePath(name, version),
    });
  }

  return tools;
}

/**
 * Get tool info if installed (checks cache path exists)
 */
export function getInstalledToolInfo(
  toolName: string,
  scope: RegistryScope,
  startDir?: string
): InstalledToolInfo | null {
  const version = getInstalledVersion(toolName, scope, startDir);

  if (!version) {
    return null;
  }

  const cachePath = getToolCachePath(toolName, version);

  // Verify cache exists
  if (!existsSync(cachePath)) {
    return null;
  }

  return {
    name: toolName,
    version,
    scope,
    cachePath,
  };
}

/**
 * Add an alias for a tool
 * @param alias - Short name for the tool (e.g., "firebase")
 * @param toolName - Full tool name (e.g., "user/api/firebase")
 * @param scope - Registry scope (global or project)
 * @param startDir - Starting directory for project scope
 * @throws Error if alias already exists for a different tool
 */
export function addAlias(
  alias: string,
  toolName: string,
  scope: RegistryScope,
  startDir?: string
): void {
  const registry = loadToolsRegistry(scope, startDir);

  // Initialize aliases if not present
  if (!registry.aliases) {
    registry.aliases = {};
  }

  // Check if alias already exists for a different tool
  const existingTarget = registry.aliases[alias];
  if (existingTarget && existingTarget !== toolName) {
    throw new Error(
      `Alias "${alias}" already exists for tool "${existingTarget}". Remove it first with 'enact alias --remove ${alias}'.`
    );
  }

  registry.aliases[alias] = toolName;
  saveToolsRegistry(registry, scope, startDir);
}

/**
 * Remove an alias
 * @param alias - Alias to remove
 * @param scope - Registry scope
 * @param startDir - Starting directory for project scope
 * @returns true if alias was removed, false if it didn't exist
 */
export function removeAlias(alias: string, scope: RegistryScope, startDir?: string): boolean {
  const registry = loadToolsRegistry(scope, startDir);

  if (!registry.aliases || !(alias in registry.aliases)) {
    return false;
  }

  delete registry.aliases[alias];
  saveToolsRegistry(registry, scope, startDir);
  return true;
}

/**
 * Resolve an alias to its full tool name
 * @param alias - Alias to resolve
 * @param scope - Registry scope
 * @param startDir - Starting directory for project scope
 * @returns Full tool name or null if alias doesn't exist
 */
export function resolveAlias(
  alias: string,
  scope: RegistryScope,
  startDir?: string
): string | null {
  const registry = loadToolsRegistry(scope, startDir);
  return registry.aliases?.[alias] ?? null;
}

/**
 * Get all aliases for a specific tool
 * @param toolName - Full tool name
 * @param scope - Registry scope
 * @param startDir - Starting directory for project scope
 * @returns Array of aliases for the tool
 */
export function getAliasesForTool(
  toolName: string,
  scope: RegistryScope,
  startDir?: string
): string[] {
  const registry = loadToolsRegistry(scope, startDir);
  const aliases: string[] = [];

  if (registry.aliases) {
    for (const [alias, target] of Object.entries(registry.aliases)) {
      if (target === toolName) {
        aliases.push(alias);
      }
    }
  }

  return aliases;
}

/**
 * Remove all aliases for a specific tool
 * Useful when uninstalling a tool
 * @param toolName - Full tool name
 * @param scope - Registry scope
 * @param startDir - Starting directory for project scope
 * @returns Number of aliases removed
 */
export function removeAliasesForTool(
  toolName: string,
  scope: RegistryScope,
  startDir?: string
): number {
  const registry = loadToolsRegistry(scope, startDir);
  let removed = 0;

  if (registry.aliases) {
    for (const [alias, target] of Object.entries(registry.aliases)) {
      if (target === toolName) {
        delete registry.aliases[alias];
        removed++;
      }
    }

    if (removed > 0) {
      saveToolsRegistry(registry, scope, startDir);
    }
  }

  return removed;
}
