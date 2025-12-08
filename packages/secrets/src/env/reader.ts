/**
 * .env file reader
 *
 * Reads .env files from global (~/.enact/.env) and local (.enact/.env) locations
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ParsedEnvFile } from "../types";
import { parseEnvContent, parseEnvFile } from "./parser";

/**
 * Get the path to the global .env file
 */
export function getGlobalEnvPath(): string {
  return join(homedir(), ".enact", ".env");
}

/**
 * Get the path to the local (project) .env file
 *
 * @param cwd - Current working directory (defaults to process.cwd())
 */
export function getLocalEnvPath(cwd?: string): string {
  return join(cwd ?? process.cwd(), ".enact", ".env");
}

/**
 * Read and parse an .env file
 *
 * @param path - Path to the .env file
 * @returns Parsed env file, or empty if file doesn't exist
 */
export function readEnvFile(path: string): ParsedEnvFile {
  if (!existsSync(path)) {
    return { vars: {}, lines: [] };
  }

  const content = readFileSync(path, "utf-8");
  return parseEnvFile(content);
}

/**
 * Read .env file to simple key-value object
 *
 * @param path - Path to the .env file
 * @returns Object with key-value pairs, empty object if file doesn't exist
 */
export function readEnvVars(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {};
  }

  const content = readFileSync(path, "utf-8");
  return parseEnvContent(content);
}

/**
 * Load global environment variables from ~/.enact/.env
 */
export function loadGlobalEnv(): Record<string, string> {
  return readEnvVars(getGlobalEnvPath());
}

/**
 * Load local (project) environment variables from .enact/.env
 *
 * @param cwd - Current working directory (defaults to process.cwd())
 */
export function loadLocalEnv(cwd?: string): Record<string, string> {
  return readEnvVars(getLocalEnvPath(cwd));
}

/**
 * Load global environment as parsed file (for updates)
 */
export function loadGlobalEnvFile(): ParsedEnvFile {
  return readEnvFile(getGlobalEnvPath());
}

/**
 * Load local environment as parsed file (for updates)
 *
 * @param cwd - Current working directory (defaults to process.cwd())
 */
export function loadLocalEnvFile(cwd?: string): ParsedEnvFile {
  return readEnvFile(getLocalEnvPath(cwd));
}

/**
 * Check if global .env file exists
 */
export function globalEnvExists(): boolean {
  return existsSync(getGlobalEnvPath());
}

/**
 * Check if local .env file exists
 *
 * @param cwd - Current working directory (defaults to process.cwd())
 */
export function localEnvExists(cwd?: string): boolean {
  return existsSync(getLocalEnvPath(cwd));
}
