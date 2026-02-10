/**
 * Manifest loader - combines parsing and validation
 *
 * Provides high-level functions to load tool manifests from files
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import yaml from "js-yaml";
import type { ParsedManifest, ToolManifest, ValidationResult } from "../types/manifest";
import { MANIFEST_FILES } from "../types/manifest";
import { ManifestParseError, extractFrontmatter, parseManifestAuto } from "./parser";
import { type ValidateManifestOptions, validateManifest } from "./validator";

/**
 * Error thrown when loading a manifest fails
 */
export class ManifestLoadError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = "ManifestLoadError";
  }
}

/**
 * Result of loading a manifest
 */
export interface LoadedManifest {
  /** The validated manifest */
  manifest: ToolManifest;
  /** The markdown body (if from .md file) */
  body?: string;
  /** The format the manifest was loaded from */
  format: "yaml" | "md";
  /** The file path the manifest was loaded from */
  filePath: string;
  /** Validation warnings (if any) */
  warnings?: ValidationResult["warnings"];
}

/**
 * Options for loading a manifest
 */
export interface LoadManifestOptions extends ValidateManifestOptions {
  // Inherits allowSimpleNames from ValidateManifestOptions
}

/**
 * Load a manifest from a file path
 *
 * @param filePath - Path to the manifest file (SKILL.md, skill.yaml, skill.yml, enact.md, enact.yaml, or enact.yml)
 * @param options - Options for loading and validation
 * @returns LoadedManifest with validated manifest and metadata
 * @throws ManifestLoadError if file doesn't exist, parse fails, or validation fails
 */
export function loadManifest(filePath: string, options: LoadManifestOptions = {}): LoadedManifest {
  // Check file exists
  if (!existsSync(filePath)) {
    throw new ManifestLoadError(`Manifest file not found: ${filePath}`, filePath);
  }

  // Read file content
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch (error) {
    throw new ManifestLoadError(
      `Failed to read manifest file: ${(error as Error).message}`,
      filePath,
      error as Error
    );
  }

  // Parse the manifest
  let parsed: ParsedManifest;
  try {
    parsed = parseManifestAuto(content, basename(filePath));
  } catch (error) {
    if (error instanceof ManifestParseError) {
      throw new ManifestLoadError(`Failed to parse manifest: ${error.message}`, filePath, error);
    }
    throw new ManifestLoadError(
      `Failed to parse manifest: ${(error as Error).message}`,
      filePath,
      error as Error
    );
  }

  // Validate the manifest
  const validation = validateManifest(parsed.manifest, options);

  if (!validation.valid) {
    const errorMessages =
      validation.errors?.map((e) => `  - ${e.path}: ${e.message}`).join("\n") ?? "";
    throw new ManifestLoadError(`Manifest validation failed:\n${errorMessages}`, filePath);
  }

  // Build result
  const result: LoadedManifest = {
    manifest: parsed.manifest,
    format: parsed.format,
    filePath,
  };

  if (parsed.body) {
    result.body = parsed.body;
  }

  if (validation.warnings && validation.warnings.length > 0) {
    result.warnings = validation.warnings;
  }

  return result;
}

/**
 * Load SKILL.md for its body content and frontmatter fields.
 * Does NOT validate as a full ToolManifest — used only to extract
 * agent-facing documentation in two-file mode (skill.yaml + SKILL.md).
 */
function loadSkillDoc(
  filePath: string
): { body: string; frontmatter: Record<string, unknown> } | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    const extracted = extractFrontmatter(content);
    if (!extracted) return null;
    const frontmatter = extracted.frontmatter
      ? ((yaml.load(extracted.frontmatter) as Record<string, unknown>) ?? {})
      : {};
    return { body: extracted.body, frontmatter };
  } catch {
    return null;
  }
}

/**
 * Find and load a manifest from a directory
 *
 * Supports two modes:
 * 1. **Two-file model**: If both `skill.yaml` and `SKILL.md` exist, `skill.yaml` is
 *    the package manifest and `SKILL.md` provides agent-facing documentation (body → `doc`).
 *    Also supports legacy `enact.yaml` in place of `skill.yaml`.
 * 2. **Single-file fallback**: Searches for SKILL.md, skill.yaml, skill.yml, enact.md, enact.yaml, or enact.yml
 *    and uses the first match as the complete manifest.
 *
 * @param dir - Directory to search for manifest
 * @param options - Options for loading and validation
 * @returns LoadedManifest if found
 * @throws ManifestLoadError if no manifest found or loading fails
 */
export function loadManifestFromDir(
  dir: string,
  options: LoadManifestOptions = {}
): LoadedManifest {
  const skillMdPath = join(dir, "SKILL.md");
  const hasSkillMd = existsSync(skillMdPath);

  // Find config file (skill.yaml, skill.yml, or legacy enact.yaml/enact.yml)
  let enactConfigPath: string | null = null;
  for (const f of ["skill.yaml", "skill.yml", "enact.yaml", "enact.yml"]) {
    const p = join(dir, f);
    if (existsSync(p)) {
      enactConfigPath = p;
      break;
    }
  }

  // Two-file model: skill.yaml + SKILL.md
  if (enactConfigPath && hasSkillMd) {
    const loaded = loadManifest(enactConfigPath, options);
    const skillDoc = loadSkillDoc(skillMdPath);

    if (skillDoc) {
      // Merge SKILL.md body into manifest.doc and LoadedManifest.body
      loaded.manifest = { ...loaded.manifest };
      if (skillDoc.body) {
        if (!loaded.manifest.doc) {
          loaded.manifest.doc = skillDoc.body;
        }
        loaded.body = skillDoc.body;
      }
      // Use SKILL.md frontmatter as fallbacks for shared fields
      const fm = skillDoc.frontmatter;
      if (!loaded.manifest.description && typeof fm.description === "string") {
        loaded.manifest.description = fm.description;
      }
      if (!loaded.manifest.license && typeof fm.license === "string") {
        loaded.manifest.license = fm.license;
      }
      if (!loaded.manifest.compatibility && typeof fm.compatibility === "string") {
        loaded.manifest.compatibility = fm.compatibility;
      }
      if (!loaded.manifest.metadata && fm.metadata && typeof fm.metadata === "object") {
        loaded.manifest.metadata = fm.metadata as Record<string, string>;
      }
    }

    return loaded;
  }

  // Single-file fallback (existing behavior)
  for (const filename of MANIFEST_FILES) {
    const filePath = join(dir, filename);
    if (existsSync(filePath)) {
      return loadManifest(filePath, options);
    }
  }

  throw new ManifestLoadError(
    `No manifest found in directory: ${dir}. Expected one of: ${MANIFEST_FILES.join(", ")}`,
    dir
  );
}

/**
 * Find a manifest file in a directory without loading it
 *
 * @param dir - Directory to search
 * @returns Path to manifest file or null if not found
 */
export function findManifestFile(dir: string): string | null {
  for (const filename of MANIFEST_FILES) {
    const filePath = join(dir, filename);
    if (existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
}

/**
 * Check if a directory contains a manifest file
 *
 * @param dir - Directory to check
 * @returns true if a manifest file exists
 */
export function hasManifest(dir: string): boolean {
  return findManifestFile(dir) !== null;
}

/**
 * Try to load a manifest, returning null instead of throwing
 *
 * @param filePath - Path to the manifest file
 * @param options - Options for loading and validation
 * @returns LoadedManifest or null if loading fails
 */
export function tryLoadManifest(
  filePath: string,
  options: LoadManifestOptions = {}
): LoadedManifest | null {
  try {
    return loadManifest(filePath, options);
  } catch {
    return null;
  }
}

/**
 * Try to load a manifest from a directory, returning null instead of throwing
 *
 * @param dir - Directory to search
 * @param options - Options for loading and validation
 * @returns LoadedManifest or null if no manifest found or loading fails
 */
export function tryLoadManifestFromDir(
  dir: string,
  options: LoadManifestOptions = {}
): LoadedManifest | null {
  try {
    return loadManifestFromDir(dir, options);
  } catch {
    return null;
  }
}
