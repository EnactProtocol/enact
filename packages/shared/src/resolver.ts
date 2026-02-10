/**
 * Tool resolver - finds and loads tools from various locations
 *
 * Resolution order:
 * 1. Direct file path (if provided path exists)
 * 2. Project tools (.enact/tools/{name}/)
 * 3. Global tools (via ~/.enact/tools.json → ~/.agent/skills/)
 * 4. Skills directory (~/.agent/skills/{name}/)
 */

import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import {
  type LoadManifestOptions,
  ManifestLoadError,
  findManifestFile,
  loadManifest,
  loadManifestFromDir,
} from "./manifest/loader";
import { manifestScriptsToActionsManifest } from "./manifest/scripts";
import { getProjectEnactDir, getSkillsDir } from "./paths";
import { getInstalledVersion, getToolCachePath, resolveAlias } from "./registry";
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
 * Result of trying to resolve a tool with error details
 */
export interface TryResolveResult {
  /** The resolved tool, or null if not found/invalid */
  resolution: ToolResolution | null;
  /** Error that occurred during resolution, if any */
  error?: Error;
  /** Locations that were searched */
  searchedLocations: string[];
  /** Whether a manifest was found but had errors */
  manifestFound: boolean;
  /** Path where manifest was found (if any) */
  manifestPath?: string;
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
 * Result of parsing an action specifier
 */
export interface ParsedActionSpecifier {
  /** The skill name (e.g., "owner/skill" from "owner/skill:action") */
  skillName: string;
  /** The action name (e.g., "action" from "owner/skill:action"), or undefined if not specified */
  actionName?: string;
}

/**
 * Parse an action specifier into skill name and action name
 *
 * Specifier formats (uses colon separator):
 * - "owner/skill" - skill only, no action
 * - "owner/skill:action" - skill with action
 * - "./path" or "/path" - file path (no action parsing)
 * - "./path:action" - file path with action
 *
 * Examples:
 * - "mendable/firecrawl" → skill="mendable/firecrawl", action=undefined
 * - "mendable/firecrawl:scrape" → skill="mendable/firecrawl", action="scrape"
 * - "acme/tools/greeter:hello" → skill="acme/tools/greeter", action="hello"
 * - "/tmp/skill" → skill="/tmp/skill", action=undefined (file path)
 * - "./skill:hello" → skill="./skill", action="hello" (file path with action)
 *
 * @param specifier - The tool/action specifier string
 * @returns Parsed skill name and optional action name
 */
export function parseActionSpecifier(specifier: string): ParsedActionSpecifier {
  const normalized = specifier.replace(/\\/g, "/").trim();

  // Check for colon separator (action specifier)
  const colonIndex = normalized.lastIndexOf(":");

  // No colon - just a skill name or file path
  if (colonIndex === -1) {
    return { skillName: normalized };
  }

  // Windows drive letter check (e.g., "C:/path")
  // If colon is at index 1 and followed by /, it's a Windows path
  if (colonIndex === 1 && normalized.length > 2 && normalized[2] === "/") {
    return { skillName: normalized };
  }

  // Split on colon
  const skillName = normalized.slice(0, colonIndex);
  const actionName = normalized.slice(colonIndex + 1);

  // Validate action name is non-empty
  if (!actionName || actionName.length === 0) {
    return { skillName: normalized };
  }

  return { skillName, actionName };
}

/**
 * Convert tool name to directory path
 * Strips the @ prefix for disk paths: "@org/my-skill" -> "org/my-skill"
 */
export function toolNameToPath(name: string): string {
  return name.replace(/^@/, "").replace(/\\/g, "/");
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
 * Supports two-file model (skill.yaml + SKILL.md) via loadManifestFromDir().
 *
 * @param dir - Directory to check
 * @param location - The location type for metadata
 * @param options - Options for loading the manifest
 * @returns ToolResolution or null if not found/invalid
 */
function tryLoadFromDir(
  dir: string,
  location: ToolLocation,
  options: LoadManifestOptions = {}
): ToolResolution | null {
  if (!existsSync(dir)) {
    return null;
  }

  try {
    const loaded = loadManifestFromDir(dir, options);

    const resolution: ToolResolution = {
      manifest: loaded.manifest,
      sourceDir: dir,
      location,
      manifestPath: loaded.filePath,
      version: loaded.manifest.version,
    };

    // Convert inline scripts to actionsManifest
    const scriptsManifest = manifestScriptsToActionsManifest(loaded.manifest);
    if (scriptsManifest) {
      resolution.actionsManifest = scriptsManifest;
    }

    return resolution;
  } catch {
    // No manifest or invalid manifest, skip
    return null;
  }
}

/**
 * Resolve a tool from a file path
 *
 * Local/file tools are allowed to have simple names (without hierarchy)
 * since they don't need to be published.
 *
 * @param filePath - Path to manifest file or directory containing manifest
 * @returns ToolResolution
 * @throws ToolResolveError if not found
 */
export function resolveToolFromPath(filePath: string): ToolResolution {
  const absolutePath = isAbsolute(filePath) ? filePath : resolve(filePath);

  // Local tools can have simple names (no hierarchy required)
  const localOptions: LoadManifestOptions = { allowSimpleNames: true };

  // Check if it's a manifest file directly
  if (
    absolutePath.endsWith(".yaml") ||
    absolutePath.endsWith(".yml") ||
    absolutePath.endsWith(".md")
  ) {
    if (!existsSync(absolutePath)) {
      throw new ToolResolveError(`Manifest file not found: ${absolutePath}`, filePath);
    }

    const loaded = loadManifest(absolutePath, localOptions);
    const sourceDir = dirname(absolutePath);

    const resolution: ToolResolution = {
      manifest: loaded.manifest,
      sourceDir,
      location: "file",
      manifestPath: absolutePath,
      version: loaded.manifest.version,
    };

    // Convert inline scripts to actionsManifest
    const scriptsManifest = manifestScriptsToActionsManifest(loaded.manifest);
    if (scriptsManifest) {
      resolution.actionsManifest = scriptsManifest;
    }

    return resolution;
  }

  // Treat as directory
  const result = tryLoadFromDir(absolutePath, "file", localOptions);
  if (result) {
    return result;
  }

  throw new ToolResolveError(`No manifest found at: ${absolutePath}`, filePath);
}

/**
 * Resolve a specific action from a tool/skill
 *
 * @param resolution - Already resolved tool
 * @param actionName - Name of the action to resolve
 * @returns ToolResolution with action field populated
 * @throws ToolResolveError if action not found
 */
export function resolveAction(resolution: ToolResolution, actionName: string): ToolResolution {
  // Check if the skill has actions (from scripts or ACTIONS.yaml)
  if (!resolution.actionsManifest) {
    throw new ToolResolveError(
      `Skill "${resolution.manifest.name}" does not define any scripts or actions. ` +
        `Cannot resolve "${actionName}".`,
      `${resolution.manifest.name}:${actionName}`
    );
  }

  // Find the script/action (map lookup)
  const action = resolution.actionsManifest.actions[actionName];
  if (!action) {
    const availableActions = Object.keys(resolution.actionsManifest.actions);
    throw new ToolResolveError(
      `Action "${actionName}" not found in skill "${resolution.manifest.name}". ` +
        `Available actions: ${availableActions.join(", ")}`,
      `${resolution.manifest.name}:${actionName}`
    );
  }

  return {
    ...resolution,
    action,
    actionName,
  };
}

/**
 * Resolve a tool with optional action specifier
 *
 * Supports formats:
 * - "owner/skill" - resolves skill only
 * - "owner/skill:action" - resolves skill and specific action
 *
 * @param specifier - Tool/action specifier (e.g., "mendable/firecrawl:scrape")
 * @param options - Resolution options
 * @returns ToolResolution with action populated if specified
 * @throws ToolResolveError if not found
 */
export function resolveToolWithAction(
  specifier: string,
  options: ResolveOptions = {}
): ToolResolution {
  const { skillName, actionName } = parseActionSpecifier(specifier);

  // Resolve the skill first
  const resolution = resolveTool(skillName, options);

  // If no action specified, return as-is
  if (!actionName) {
    return resolution;
  }

  // Resolve the action
  return resolveAction(resolution, actionName);
}

/**
 * Resolve a tool by name, searching through standard locations
 *
 * @param toolName - Tool name (e.g., "acme/greeter" or "@acme/greeter") or alias (e.g., "firebase")
 * @param options - Resolution options
 * @returns ToolResolution
 * @throws ToolResolveError if not found
 */
export function resolveTool(toolName: string, options: ResolveOptions = {}): ToolResolution {
  let normalizedName = normalizeToolName(toolName);
  const searchedLocations: string[] = [];

  // Check if this might be an alias (no slashes = not a full tool name)
  if (!normalizedName.includes("/")) {
    // Try project-level alias first, then global
    const aliasedName =
      resolveAlias(normalizedName, "project", options.startDir) ??
      resolveAlias(normalizedName, "global");
    if (aliasedName) {
      normalizedName = normalizeToolName(aliasedName);
    }
  }

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

  // 2. Try global tools (via ~/.enact/tools.json → ~/.agent/skills/)
  if (!options.skipUser) {
    const globalVersion = getInstalledVersion(normalizedName, "global");
    if (globalVersion) {
      const skillPath = getToolCachePath(normalizedName, globalVersion);
      searchedLocations.push(skillPath);

      const result = tryLoadFromDir(skillPath, "user");
      if (result) {
        return result;
      }
    }
  }

  // 3. Try skills directory (~/.agent/skills/{name}/)
  if (!options.skipCache) {
    const skillsDir = getSkillsDir();
    const skillDir = getToolPath(skillsDir, normalizedName);
    searchedLocations.push(skillDir);

    const result = tryLoadFromDir(skillDir, "cache");
    if (result) {
      return result;
    }
  }

  throw new ToolResolveError(
    `Tool not found: ${toolName}. Searched locations:\n${searchedLocations.map((l) => `  - ${l}`).join("\n")}`,
    toolName,
    searchedLocations
  );
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
  const result = tryResolveToolDetailed(toolNameOrPath, options);
  return result.resolution;
}

/**
 * Try to resolve a tool with detailed error information
 *
 * Unlike tryResolveTool, this function returns information about why
 * resolution failed, allowing callers to provide better error messages.
 *
 * @param toolNameOrPath - Tool name or path
 * @param options - Resolution options
 * @returns TryResolveResult with resolution or error details
 */
export function tryResolveToolDetailed(
  toolNameOrPath: string,
  options: ResolveOptions = {}
): TryResolveResult {
  const searchedLocations: string[] = [];

  // Check if it looks like a path
  const isPath =
    toolNameOrPath.startsWith("/") ||
    toolNameOrPath.startsWith("./") ||
    toolNameOrPath.startsWith("../") ||
    toolNameOrPath.includes("\\") ||
    existsSync(toolNameOrPath);

  if (isPath) {
    // Resolve from path
    const absolutePath = isAbsolute(toolNameOrPath) ? toolNameOrPath : resolve(toolNameOrPath);
    searchedLocations.push(absolutePath);

    // Check if path exists
    if (!existsSync(absolutePath)) {
      return {
        resolution: null,
        searchedLocations,
        manifestFound: false,
      };
    }

    // Find manifest file
    const manifestPath =
      absolutePath.endsWith(".yaml") ||
      absolutePath.endsWith(".yml") ||
      absolutePath.endsWith(".md")
        ? absolutePath
        : findManifestFile(absolutePath);

    if (!manifestPath) {
      return {
        resolution: null,
        searchedLocations,
        manifestFound: false,
      };
    }

    // Try to load the manifest
    try {
      const resolution = resolveToolFromPath(toolNameOrPath);
      return {
        resolution,
        searchedLocations,
        manifestFound: true,
        manifestPath,
      };
    } catch (error) {
      // Manifest found but invalid
      return {
        resolution: null,
        error: error instanceof Error ? error : new Error(String(error)),
        searchedLocations,
        manifestFound: true,
        manifestPath,
      };
    }
  }

  // Resolve by name
  try {
    const resolution = resolveTool(toolNameOrPath, options);
    return {
      resolution,
      searchedLocations: getToolSearchPaths(toolNameOrPath, options),
      manifestFound: true,
      manifestPath: resolution.manifestPath,
    };
  } catch (error) {
    // Check if error is due to manifest validation vs not found
    if (error instanceof ToolResolveError) {
      return {
        resolution: null,
        error,
        searchedLocations: error.searchedLocations ?? [],
        manifestFound: false,
      };
    }

    // ManifestLoadError means manifest was found but invalid
    if (error instanceof ManifestLoadError) {
      return {
        resolution: null,
        error,
        searchedLocations: getToolSearchPaths(toolNameOrPath, options),
        manifestFound: true,
        manifestPath: error.filePath,
      };
    }

    // Other error
    return {
      resolution: null,
      error: error instanceof Error ? error : new Error(String(error)),
      searchedLocations: getToolSearchPaths(toolNameOrPath, options),
      manifestFound: false,
    };
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
    // Local tools can have simple names (no hierarchy required)
    const result = tryLoadFromDir(resolve(toolNameOrPath), "file", { allowSimpleNames: true });
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
    const cacheDir = getSkillsDir();
    paths.push(join(cacheDir, toolNameToPath(normalizedName)));
  }

  return paths;
}
