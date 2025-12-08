/**
 * Path resolution utilities for Enact directories and tool locations
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Scope for tool directories
 */
export type ToolScope = "user" | "project";

/**
 * Get the Enact home directory (~/.enact/)
 * @returns Absolute path to ~/.enact/
 */
export function getEnactHome(): string {
  return join(homedir(), ".enact");
}

/**
 * Get the project-level .enact directory
 * Searches up from current working directory to find .enact/
 * NOTE: Does NOT return ~/.enact/ - that's the global home, not a project dir
 * @param startDir - Directory to start searching from (defaults to cwd)
 * @returns Absolute path to .enact/ or null if not found
 */
export function getProjectEnactDir(startDir?: string): string | null {
  let currentDir = resolve(startDir ?? process.cwd());
  const root = resolve("/");
  const enactHome = getEnactHome();

  // Walk up directory tree looking for .enact/
  while (currentDir !== root) {
    const enactDir = join(currentDir, ".enact");
    // Skip ~/.enact/ - that's the global home, not a project directory
    if (existsSync(enactDir) && enactDir !== enactHome) {
      return enactDir;
    }
    const parentDir = resolve(currentDir, "..");
    if (parentDir === currentDir) {
      break; // Reached root
    }
    currentDir = parentDir;
  }

  return null;
}

/**
 * Get the tools directory for specified scope
 *
 * NOTE: For global scope ("user"), this is DEPRECATED.
 * Global tools are now tracked in ~/.enact/tools.json and stored in cache.
 * Use getToolsJsonPath("global") and getToolCachePath() from ./registry instead.
 *
 * For project scope, this returns .enact/tools/ where project tools are copied.
 *
 * @param scope - 'user' for ~/.enact/tools/ (deprecated) or 'project' for .enact/tools/
 * @param startDir - For project scope, directory to start searching from
 * @returns Absolute path to tools directory or null if project scope and not found
 * @deprecated Use registry.ts functions for global tools
 */
export function getToolsDir(scope: ToolScope, startDir?: string): string | null {
  if (scope === "user") {
    // DEPRECATED: Global tools now use tools.json + cache
    // This path is kept for backward compatibility during migration
    return join(getEnactHome(), "tools");
  }

  const projectDir = getProjectEnactDir(startDir);
  return projectDir ? join(projectDir, "tools") : null;
}

/**
 * Get the cache directory (~/.enact/cache/)
 * @returns Absolute path to ~/.enact/cache/
 */
export function getCacheDir(): string {
  return join(getEnactHome(), "cache");
}

/**
 * Get the configuration file path (~/.enact/config.yaml)
 * @returns Absolute path to ~/.enact/config.yaml
 */
export function getConfigPath(): string {
  return join(getEnactHome(), "config.yaml");
}

/**
 * Get the global .env file path (~/.enact/.env)
 * @returns Absolute path to ~/.enact/.env
 */
export function getGlobalEnvPath(): string {
  return join(getEnactHome(), ".env");
}

/**
 * Get the project .env file path (.enact/.env)
 * @param startDir - Directory to start searching from
 * @returns Absolute path to .enact/.env or null if not found
 */
export function getProjectEnvPath(startDir?: string): string | null {
  const projectDir = getProjectEnactDir(startDir);
  return projectDir ? join(projectDir, ".env") : null;
}
