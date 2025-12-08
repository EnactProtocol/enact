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
    return { tools: {} };
  }

  try {
    const content = readFileSync(registryPath, "utf-8");
    const parsed = JSON.parse(content);
    return {
      tools: parsed.tools ?? {},
    };
  } catch {
    // Return empty registry on parse error
    return { tools: {} };
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
