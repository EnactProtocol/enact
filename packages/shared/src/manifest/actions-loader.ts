/**
 * Manifest loader with scripts support
 *
 * Loads SKILL.md manifests and converts inline scripts to ActionsManifest
 * objects for the execution pipeline.
 */

import type { ActionsManifest } from "../types/actions";
import { type LoadManifestOptions, type LoadedManifest, loadManifestFromDir } from "./loader";
import { manifestScriptsToActionsManifest } from "./scripts";

/**
 * Result of loading a manifest with its scripts
 */
export interface LoadedManifestWithActions extends LoadedManifest {
  /** The scripts manifest (converted from inline scripts) */
  actionsManifest?: ActionsManifest;
}

/**
 * Load a SKILL.md manifest and convert inline scripts to an ActionsManifest
 *
 * This is the primary function for loading a complete skill with scripts.
 * It loads the SKILL.md for documentation and metadata, then converts any
 * inline `scripts` field into an ActionsManifest for the execution pipeline.
 *
 * @param dir - Directory containing SKILL.md
 * @param options - Options for loading and validation
 * @returns LoadedManifestWithActions containing manifest and optional scripts
 * @throws ManifestLoadError if SKILL.md loading fails
 */
export function loadManifestWithActions(
  dir: string,
  options: LoadManifestOptions = {}
): LoadedManifestWithActions {
  // Load the primary manifest (SKILL.md)
  const loaded = loadManifestFromDir(dir, options);

  // Convert inline scripts to ActionsManifest
  const scriptsManifest = manifestScriptsToActionsManifest(loaded.manifest);
  if (scriptsManifest) {
    return {
      ...loaded,
      actionsManifest: scriptsManifest,
    };
  }

  return loaded;
}
