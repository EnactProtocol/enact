/**
 * Tool resolver - finds and loads tools from various locations
 *
 * Resolution order:
 * 1. Direct file path (if provided path exists)
 * 2. Project tools (.enact/tools/{name}/)
 * 3. Global tools (via ~/.enact/tools.json → cache)
 * 4. Cache (~/.enact/cache/{name}/{version}/)
 */

import { existsSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { findManifestFile, loadManifest } from "./manifest/loader";
import { getCacheDir, getProjectEnactDir } from "./paths";
import { getInstalledVersion, getToolCachePath } from "./registry";
import type { ToolLocation, ToolResolution } from "./types/manifest";

/**
 * Error thrown when tool resolution fails
 */
export class ToolResolveError extends Error {
  constructor(
    message: string,
    public readonly toolPath: string,
    public readonly searchedLocations?: string[]
  ) {
    super(message);
    this.name = "ToolResolveError";
  }
}

/**
 * Options for tool resolution
 */
export interface ResolveOptions {
  /** Starting directory for project search (defaults to cwd) */
  startDir?: string;
  /** Specific version to look for in cache */
  version?: string;
  /** Skip project-level tools */
  skipProject?: boolean;
  /** Skip user-level tools */
  skipUser?: boolean;
  /** Skip cached tools */
  skipCache?: boolean;
}

/**
 * Convert tool name to directory path
 * e.g., "acme/utils/greeter" -> "acme/utils/greeter"
 */
export function toolNameToPath(name: string): string {
  // Tool names are already path-like, just normalize
  return name.replace(/\\/g, "/");
}

/**
 * Normalize a tool name (lowercase, forward slashes)
 */
export function normalizeToolName(name: string): string {
  return name.toLowerCase().replace(/\\/g, "/").trim();
}

/**
 * Get the tool path within a tools directory
 */
export function getToolPath(toolsDir: string, toolName: string): string {
  return join(toolsDir, toolNameToPath(toolName));
}

/**
 * Try to load a tool from a specific directory
 *
 * @param dir - Directory to check
 * @param location - The location type for metadata
 * @returns ToolResolution or null if not found/invalid
 */
function tryLoadFromDir(dir: string, location: ToolLocation): ToolResolution | null {
  if (!existsSync(dir)) {
    return null;
  }

  const manifestPath = findManifestFile(dir);
  if (!manifestPath) {
    return null;
  }

  try {
    const loaded = loadManifest(manifestPath);
    return {
      manifest: loaded.manifest,
      sourceDir: dir,
      location,
      manifestPath,
      version: loaded.manifest.version,
    };
  } catch {
    // Invalid manifest, skip
    return null;
  }
}

/**
 * Resolve a tool from a file path
 *
 * @param filePath - Path to manifest file or directory containing manifest
 * @returns ToolResolution
 * @throws ToolResolveError if not found
 */
export function resolveToolFromPath(filePath: string): ToolResolution {
  const absolutePath = isAbsolute(filePath) ? filePath : resolve(filePath);

  // Check if it's a manifest file directly
  if (
    absolutePath.endsWith(".yaml") ||
    absolutePath.endsWith(".yml") ||
    absolutePath.endsWith(".md")
  ) {
    if (!existsSync(absolutePath)) {
      throw new ToolResolveError(`Manifest file not found: ${absolutePath}`, filePath);
    }

    const loaded = loadManifest(absolutePath);
    return {
      manifest: loaded.manifest,
      sourceDir: dirname(absolutePath),
      location: "file",
      manifestPath: absolutePath,
      version: loaded.manifest.version,
    };
  }

  // Treat as directory
  const result = tryLoadFromDir(absolutePath, "file");
  if (result) {
    return result;
  }

  throw new ToolResolveError(`No manifest found at: ${absolutePath}`, filePath);
}

/**
 * Resolve a tool by name, searching through standard locations
 *
 * @param toolName - Tool name (e.g., "acme/utils/greeter")
 * @param options - Resolution options
 * @returns ToolResolution
 * @throws ToolResolveError if not found
 */
export function resolveTool(toolName: string, options: ResolveOptions = {}): ToolResolution {
  const normalizedName = normalizeToolName(toolName);
  const searchedLocations: string[] = [];

  // 1. Try project tools (.enact/tools/{name}/)
  if (!options.skipProject) {
    const projectDir = getProjectEnactDir(options.startDir);
    if (projectDir) {
      const projectToolsDir = join(projectDir, "tools");
      const toolDir = getToolPath(projectToolsDir, normalizedName);
      searchedLocations.push(toolDir);

      const result = tryLoadFromDir(toolDir, "project");
      if (result) {
        return result;
      }
    }
  }

  // 2. Try global tools (via ~/.enact/tools.json → cache)
  if (!options.skipUser) {
    const globalVersion = getInstalledVersion(normalizedName, "global");
    if (globalVersion) {
      const cachePath = getToolCachePath(normalizedName, globalVersion);
      searchedLocations.push(cachePath);

      const result = tryLoadFromDir(cachePath, "user");
      if (result) {
        return result;
      }
    }
  }

  // 3. Try cache (with optional version)
  if (!options.skipCache) {
    const cacheDir = getCacheDir();
    const toolCacheBase = getToolPath(cacheDir, normalizedName);

    if (options.version) {
      // Look for specific version
      const versionDir = join(toolCacheBase, `v${options.version.replace(/^v/, "")}`);
      searchedLocations.push(versionDir);

      const result = tryLoadFromDir(versionDir, "cache");
      if (result) {
        return result;
      }
    } else {
      // Look for latest cached version
      if (existsSync(toolCacheBase)) {
        const latestVersion = findLatestCachedVersion(toolCacheBase);
        if (latestVersion) {
          const versionDir = join(toolCacheBase, latestVersion);
          searchedLocations.push(versionDir);

          const result = tryLoadFromDir(versionDir, "cache");
          if (result) {
            return result;
          }
        }
      }
    }
  }

  throw new ToolResolveError(
    `Tool not found: ${toolName}. Searched locations:\n${searchedLocations.map((l) => `  - ${l}`).join("\n")}`,
    toolName,
    searchedLocations
  );
}

/**
 * Find the latest cached version directory
 */
function findLatestCachedVersion(toolCacheBase: string): string | null {
  try {
    const entries = readdirSync(toolCacheBase, { withFileTypes: true });
    const versions = entries
      .filter((e) => e.isDirectory() && e.name.startsWith("v"))
      .map((e) => e.name)
      .sort((a, b) => {
        // Sort by semver (v1.0.0 format)
        const aVer = a.slice(1).split(".").map(Number);
        const bVer = b.slice(1).split(".").map(Number);
        for (let i = 0; i < 3; i++) {
          if ((aVer[i] ?? 0) !== (bVer[i] ?? 0)) {
            return (bVer[i] ?? 0) - (aVer[i] ?? 0);
          }
        }
        return 0;
      });

    return versions[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Try to resolve a tool, returning null instead of throwing
 *
 * @param toolNameOrPath - Tool name or path
 * @param options - Resolution options
 * @returns ToolResolution or null
 */
export function tryResolveTool(
  toolNameOrPath: string,
  options: ResolveOptions = {}
): ToolResolution | null {
  try {
    // Check if it looks like a path
    if (
      toolNameOrPath.startsWith("/") ||
      toolNameOrPath.startsWith("./") ||
      toolNameOrPath.startsWith("../") ||
      toolNameOrPath.includes("\\") ||
      existsSync(toolNameOrPath)
    ) {
      return resolveToolFromPath(toolNameOrPath);
    }

    return resolveTool(toolNameOrPath, options);
  } catch {
    return null;
  }
}

/**
 * Resolve a tool, automatically detecting if input is a path or name
 *
 * @param toolNameOrPath - Tool name or path to manifest/directory
 * @param options - Resolution options
 * @returns ToolResolution
 * @throws ToolResolveError if not found
 */
export function resolveToolAuto(
  toolNameOrPath: string,
  options: ResolveOptions = {}
): ToolResolution {
  // Check if it looks like a path
  if (
    toolNameOrPath.startsWith("/") ||
    toolNameOrPath.startsWith("./") ||
    toolNameOrPath.startsWith("../") ||
    toolNameOrPath.includes("\\")
  ) {
    return resolveToolFromPath(toolNameOrPath);
  }

  // Check if the path exists as-is (could be a relative directory without ./)
  if (existsSync(toolNameOrPath)) {
    const result = tryLoadFromDir(resolve(toolNameOrPath), "file");
    if (result) {
      return result;
    }
  }

  // Treat as tool name
  return resolveTool(toolNameOrPath, options);
}

/**
 * Get all locations where a tool might be installed
 *
 * @param toolName - Tool name
 * @param options - Resolution options
 * @returns Array of potential paths
 */
export function getToolSearchPaths(toolName: string, options: ResolveOptions = {}): string[] {
  const normalizedName = normalizeToolName(toolName);
  const paths: string[] = [];

  // Project tools
  if (!options.skipProject) {
    const projectDir = getProjectEnactDir(options.startDir);
    if (projectDir) {
      paths.push(join(projectDir, "tools", toolNameToPath(normalizedName)));
    }
  }

  // Global tools (via tools.json → cache)
  if (!options.skipUser) {
    const globalVersion = getInstalledVersion(normalizedName, "global");
    if (globalVersion) {
      paths.push(getToolCachePath(normalizedName, globalVersion));
    }
  }

  // Cache
  if (!options.skipCache) {
    const cacheDir = getCacheDir();
    paths.push(join(cacheDir, toolNameToPath(normalizedName)));
  }

  return paths;
}
