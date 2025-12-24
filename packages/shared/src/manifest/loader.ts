/**
 * Manifest loader - combines parsing and validation
 *
 * Provides high-level functions to load tool manifests from files
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { ParsedManifest, ToolManifest, ValidationResult } from "../types/manifest";
import { MANIFEST_FILES } from "../types/manifest";
import { ManifestParseError, parseManifestAuto } from "./parser";
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
 * @param filePath - Path to the manifest file (SKILL.md, enact.md, enact.yaml, or enact.yml)
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
 * Find and load a manifest from a directory
 *
 * Searches for SKILL.md, enact.md, enact.yaml, or enact.yml in the given directory
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
  // Try each manifest filename in order of preference
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
