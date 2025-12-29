/**
 * Update checker for Enact CLI
 *
 * Checks npm registry for new versions and notifies users.
 * Caches results to avoid excessive network requests.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getEnactHome } from "./paths";
import { compareVersions } from "./utils/version";

/**
 * Information about an available update
 */
export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateCommand: string;
}

/**
 * Cache structure for update checks
 */
interface UpdateCache {
  lastCheck: number;
  latestVersion: string;
}

/** Check interval: 24 hours */
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000;

/** npm registry URL for the enact package */
const NPM_REGISTRY_URL = "https://registry.npmjs.org/@enactprotocol/enact/latest";

/**
 * Get the path to the update cache file
 */
function getUpdateCachePath(): string {
  return join(getEnactHome(), "update-check.json");
}

/**
 * Load the update cache from disk
 */
function loadUpdateCache(): UpdateCache | null {
  const cachePath = getUpdateCachePath();
  if (!existsSync(cachePath)) return null;
  try {
    return JSON.parse(readFileSync(cachePath, "utf-8")) as UpdateCache;
  } catch {
    return null;
  }
}

/**
 * Save the update cache to disk
 */
function saveUpdateCache(latestVersion: string): void {
  const cachePath = getUpdateCachePath();
  const cache: UpdateCache = { lastCheck: Date.now(), latestVersion };
  try {
    writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf-8");
  } catch {
    // Silent fail - cache is optional
  }
}

/**
 * Check for updates to the Enact CLI
 *
 * @param currentVersion - The current installed version
 * @returns UpdateInfo if a newer version is available, null otherwise
 */
export async function checkForUpdates(currentVersion: string): Promise<UpdateInfo | null> {
  // Check cache first - avoid network request if recently checked
  const cache = loadUpdateCache();
  if (cache && Date.now() - cache.lastCheck < UPDATE_CHECK_INTERVAL) {
    // Use cached version for comparison
    if (compareVersions(cache.latestVersion, currentVersion) > 0) {
      return {
        currentVersion,
        latestVersion: cache.latestVersion,
        updateCommand: "npm install -g @enactprotocol/enact@latest",
      };
    }
    return null;
  }

  // Fetch from npm registry
  try {
    const response = await fetch(NPM_REGISTRY_URL);
    if (!response.ok) return null;

    const data = (await response.json()) as { version: string };
    const latestVersion = data.version;

    // Save to cache
    saveUpdateCache(latestVersion);

    // Compare versions
    if (compareVersions(latestVersion, currentVersion) > 0) {
      return {
        currentVersion,
        latestVersion,
        updateCommand: "npm install -g @enactprotocol/enact@latest",
      };
    }
  } catch {
    // Silent fail - don't block on network errors
  }

  return null;
}
