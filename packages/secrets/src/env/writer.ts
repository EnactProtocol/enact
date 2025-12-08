/**
 * .env file writer
 *
 * Writes .env files while preserving comments and formatting
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ParsedEnvFile } from "../types";
import { createEnvContent, removeEnvVar, serializeEnvFile, updateEnvVar } from "./parser";
import { getGlobalEnvPath, getLocalEnvPath, readEnvFile } from "./reader";

/**
 * Ensure directory exists for a file path
 */
function ensureDirectory(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Write a parsed env file to disk
 *
 * @param path - Path to write to
 * @param parsed - Parsed env file to write
 */
export function writeEnvFile(path: string, parsed: ParsedEnvFile): void {
  ensureDirectory(path);
  const content = serializeEnvFile(parsed);
  writeFileSync(path, content, "utf-8");
}

/**
 * Write a vars object to an .env file
 *
 * @param path - Path to write to
 * @param vars - Key-value pairs to write
 */
export function writeEnvVars(path: string, vars: Record<string, string>): void {
  ensureDirectory(path);
  const content = createEnvContent(vars);
  writeFileSync(path, content, "utf-8");
}

/**
 * Set an environment variable in a file
 * Creates file if it doesn't exist, preserves existing content
 *
 * @param path - Path to the .env file
 * @param key - Variable key
 * @param value - Variable value
 */
export function setEnvVar(path: string, key: string, value: string): void {
  const parsed = readEnvFile(path);
  const updated = updateEnvVar(parsed, key, value);
  writeEnvFile(path, updated);
}

/**
 * Delete an environment variable from a file
 *
 * @param path - Path to the .env file
 * @param key - Variable key to delete
 * @returns true if variable existed and was deleted
 */
export function deleteEnvVar(path: string, key: string): boolean {
  const parsed = readEnvFile(path);
  if (!(key in parsed.vars)) {
    return false;
  }
  const updated = removeEnvVar(parsed, key);
  writeEnvFile(path, updated);
  return true;
}

/**
 * Set a global environment variable (~/.enact/.env)
 *
 * @param key - Variable key
 * @param value - Variable value
 */
export function setGlobalEnvVar(key: string, value: string): void {
  setEnvVar(getGlobalEnvPath(), key, value);
}

/**
 * Set a local environment variable (.enact/.env)
 *
 * @param key - Variable key
 * @param value - Variable value
 * @param cwd - Current working directory (defaults to process.cwd())
 */
export function setLocalEnvVar(key: string, value: string, cwd?: string): void {
  setEnvVar(getLocalEnvPath(cwd), key, value);
}

/**
 * Delete a global environment variable
 *
 * @param key - Variable key to delete
 * @returns true if variable existed and was deleted
 */
export function deleteGlobalEnvVar(key: string): boolean {
  return deleteEnvVar(getGlobalEnvPath(), key);
}

/**
 * Delete a local environment variable
 *
 * @param key - Variable key to delete
 * @param cwd - Current working directory (defaults to process.cwd())
 * @returns true if variable existed and was deleted
 */
export function deleteLocalEnvVar(key: string, cwd?: string): boolean {
  return deleteEnvVar(getLocalEnvPath(cwd), key);
}
