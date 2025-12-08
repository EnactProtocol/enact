/**
 * File ignore utilities for bundling
 *
 * Provides gitignore-style pattern matching and default ignore lists
 * to prevent sensitive files from being included in tool bundles.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Files/patterns that should never be included in bundles */
export const ALWAYS_IGNORE = [
  // Environment and secrets
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.*.local",
  "*.pem",
  "*.key",
  "*.p12",
  "*.pfx",

  // Version control
  ".git",
  ".gitignore",
  ".gitattributes",

  // IDE/Editor
  ".vscode",
  ".idea",
  "*.swp",
  "*.swo",
  "*~",

  // OS files
  ".DS_Store",
  "Thumbs.db",
  "desktop.ini",

  // Dependencies
  "node_modules",
  "vendor",
  "__pycache__",
  "*.pyc",
  ".venv",
  "venv",

  // Build artifacts
  "dist",
  "build",
  "out",
  "target",
  "*.log",
];

/**
 * Load and parse a .gitignore file from a directory
 */
export function loadGitignore(toolDir: string): string[] {
  const gitignorePath = join(toolDir, ".gitignore");
  if (!existsSync(gitignorePath)) {
    return [];
  }

  const content = readFileSync(gitignorePath, "utf-8");
  return parseGitignoreContent(content);
}

/**
 * Parse gitignore content string into patterns
 */
export function parseGitignoreContent(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

/**
 * Check if a path matches a gitignore-style pattern
 */
export function matchesPattern(relativePath: string, pattern: string): boolean {
  // Handle negation patterns (we don't support re-including for now)
  if (pattern.startsWith("!")) {
    return false;
  }

  // Normalize pattern
  let normalizedPattern = pattern;

  // Handle directory-specific patterns (ending with /)
  const isDirPattern = pattern.endsWith("/");
  if (isDirPattern) {
    normalizedPattern = pattern.slice(0, -1);
  }

  // Handle patterns starting with /
  const isRooted = pattern.startsWith("/");
  if (isRooted) {
    normalizedPattern = normalizedPattern.slice(1);
  }

  // Simple glob matching
  const regexPattern = normalizedPattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "<<<GLOBSTAR>>>")
    .replace(/\*/g, "[^/]*")
    .replace(/<<<GLOBSTAR>>>/g, ".*")
    .replace(/\?/g, ".");

  const regex = isRooted
    ? new RegExp(`^${regexPattern}($|/)`)
    : new RegExp(`(^|/)${regexPattern}($|/)`);

  return regex.test(relativePath);
}

/**
 * Check if a file should be ignored based on patterns
 */
export function shouldIgnore(
  relativePath: string,
  fileName: string,
  ignorePatterns: string[] = []
): boolean {
  // Always skip hidden files (starting with .)
  if (fileName.startsWith(".")) {
    return true;
  }

  // Check against always-ignore list
  for (const pattern of ALWAYS_IGNORE) {
    if (matchesPattern(relativePath, pattern) || matchesPattern(fileName, pattern)) {
      return true;
    }
  }

  // Check against gitignore patterns
  for (const pattern of ignorePatterns) {
    if (matchesPattern(relativePath, pattern)) {
      return true;
    }
  }

  return false;
}
