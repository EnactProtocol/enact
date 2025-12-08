/**
 * Unified environment variable manager
 *
 * Provides high-level functions for managing environment variables
 * with priority resolution: local → global → default
 */

import type { EnvResolution, EnvironmentVariable } from "../types";
import {
  getGlobalEnvPath,
  getLocalEnvPath,
  globalEnvExists,
  loadGlobalEnv,
  loadLocalEnv,
  localEnvExists,
} from "./reader";
import { deleteGlobalEnvVar, deleteLocalEnvVar, setGlobalEnvVar, setLocalEnvVar } from "./writer";

/**
 * Set an environment variable
 *
 * @param key - Variable key
 * @param value - Variable value
 * @param scope - Where to set: 'local' or 'global' (default: 'global')
 * @param cwd - Current working directory for local scope
 */
export function setEnv(
  key: string,
  value: string,
  scope: "local" | "global" = "global",
  cwd?: string
): void {
  if (scope === "local") {
    setLocalEnvVar(key, value, cwd);
  } else {
    setGlobalEnvVar(key, value);
  }
}

/**
 * Get an environment variable with priority resolution
 *
 * Priority: local → global → default
 *
 * @param key - Variable key
 * @param defaultValue - Default value if not found
 * @param cwd - Current working directory for local scope
 * @returns Resolution result with value and source
 */
export function getEnv(key: string, defaultValue?: string, cwd?: string): EnvResolution | null {
  // Check local first
  const localVars = loadLocalEnv(cwd);
  const localValue = localVars[key];
  if (localValue !== undefined) {
    return {
      key,
      value: localValue,
      source: "local",
      filePath: getLocalEnvPath(cwd),
    };
  }

  // Check global
  const globalVars = loadGlobalEnv();
  const globalValue = globalVars[key];
  if (globalValue !== undefined) {
    return {
      key,
      value: globalValue,
      source: "global",
      filePath: getGlobalEnvPath(),
    };
  }

  // Use default
  if (defaultValue !== undefined) {
    return {
      key,
      value: defaultValue,
      source: "default",
    };
  }

  return null;
}

/**
 * Get just the value of an environment variable
 *
 * @param key - Variable key
 * @param defaultValue - Default value if not found
 * @param cwd - Current working directory for local scope
 * @returns The value, or default/undefined if not found
 */
export function getEnvValue(key: string, defaultValue?: string, cwd?: string): string | undefined {
  const result = getEnv(key, defaultValue, cwd);
  return result?.value;
}

/**
 * Delete an environment variable
 *
 * @param key - Variable key
 * @param scope - Where to delete from: 'local' or 'global' (default: 'global')
 * @param cwd - Current working directory for local scope
 * @returns true if variable existed and was deleted
 */
export function deleteEnv(
  key: string,
  scope: "local" | "global" = "global",
  cwd?: string
): boolean {
  if (scope === "local") {
    return deleteLocalEnvVar(key, cwd);
  }
  return deleteGlobalEnvVar(key);
}

/**
 * List all environment variables from a scope
 *
 * @param scope - Which scope to list: 'local', 'global', or 'all'
 * @param cwd - Current working directory for local scope
 * @returns Array of environment variables with sources
 */
export function listEnv(
  scope: "local" | "global" | "all" = "all",
  cwd?: string
): EnvironmentVariable[] {
  const results: EnvironmentVariable[] = [];

  if (scope === "global" || scope === "all") {
    const globalVars = loadGlobalEnv();
    for (const [key, value] of Object.entries(globalVars)) {
      results.push({ key, value, source: "global" });
    }
  }

  if (scope === "local" || scope === "all") {
    const localVars = loadLocalEnv(cwd);
    for (const [key, value] of Object.entries(localVars)) {
      // If 'all' scope, we might already have the key from global
      // In that case, replace with local (higher priority)
      if (scope === "all") {
        const existingIndex = results.findIndex((v) => v.key === key);
        if (existingIndex !== -1) {
          results[existingIndex] = { key, value, source: "local" };
        } else {
          results.push({ key, value, source: "local" });
        }
      } else {
        results.push({ key, value, source: "local" });
      }
    }
  }

  return results;
}

/**
 * Get all environment variables with priority resolution
 * Returns the effective value for each key (local overrides global)
 *
 * @param defaults - Default values for keys
 * @param cwd - Current working directory for local scope
 * @returns Map of key to resolution result
 */
export function resolveAllEnv(
  defaults: Record<string, string> = {},
  cwd?: string
): Map<string, EnvResolution> {
  const results = new Map<string, EnvResolution>();

  // Start with defaults
  for (const [key, value] of Object.entries(defaults)) {
    results.set(key, { key, value, source: "default" });
  }

  // Add global (overrides defaults)
  const globalVars = loadGlobalEnv();
  for (const [key, value] of Object.entries(globalVars)) {
    results.set(key, {
      key,
      value,
      source: "global",
      filePath: getGlobalEnvPath(),
    });
  }

  // Add local (overrides global and defaults)
  const localVars = loadLocalEnv(cwd);
  for (const [key, value] of Object.entries(localVars)) {
    results.set(key, {
      key,
      value,
      source: "local",
      filePath: getLocalEnvPath(cwd),
    });
  }

  return results;
}

/**
 * Resolve environment variables for a tool manifest
 * Checks that all required vars are present
 *
 * @param envDeclarations - Env declarations from manifest
 * @param cwd - Current working directory
 * @returns Object with resolved vars and any missing required vars
 */
export function resolveToolEnv(
  envDeclarations: Record<string, { description?: string; default?: string; secret?: boolean }>,
  cwd?: string
): {
  resolved: Map<string, EnvResolution>;
  missing: string[];
} {
  const resolved = new Map<string, EnvResolution>();
  const missing: string[] = [];

  for (const [key, declaration] of Object.entries(envDeclarations)) {
    // Skip secrets - they're handled by the keyring
    if (declaration.secret) {
      continue;
    }

    const result = getEnv(key, declaration.default, cwd);
    if (result) {
      resolved.set(key, result);
    } else {
      missing.push(key);
    }
  }

  return { resolved, missing };
}

/**
 * Check if local .env exists
 */
export function hasLocalEnv(cwd?: string): boolean {
  return localEnvExists(cwd);
}

/**
 * Check if global .env exists
 */
export function hasGlobalEnv(): boolean {
  return globalEnvExists();
}
