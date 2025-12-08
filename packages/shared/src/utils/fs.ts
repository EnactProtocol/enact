/**
 * @enactprotocol/shared - File system helpers
 *
 * Provides utilities for common filesystem operations.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Ensure the parent directory of a file exists
 */
export function ensureParentDir(filePath: string): void {
  const parentDir = dirname(filePath);
  ensureDir(parentDir);
}

/**
 * Check if a path exists
 */
export function pathExists(path: string): boolean {
  return existsSync(path);
}

/**
 * Check if a path is a directory
 */
export function isDirectory(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if a path is a file
 */
export function isFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * Read and parse a JSON file
 * @throws Error if file doesn't exist or isn't valid JSON
 */
export function readJsonFile<T = unknown>(filePath: string): T {
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content) as T;
}

/**
 * Try to read and parse a JSON file
 * @returns The parsed JSON or null if file doesn't exist or is invalid
 */
export function tryReadJsonFile<T = unknown>(filePath: string): T | null {
  try {
    return readJsonFile<T>(filePath);
  } catch {
    return null;
  }
}

/**
 * Write data to a JSON file with formatting
 */
export function writeJsonFile(
  filePath: string,
  data: unknown,
  options?: { indent?: number | undefined }
): void {
  const indent = options?.indent ?? 2;
  ensureParentDir(filePath);
  writeFileSync(filePath, `${JSON.stringify(data, null, indent)}\n`, "utf-8");
}

/**
 * Read a text file
 */
export function readTextFile(filePath: string): string {
  return readFileSync(filePath, "utf-8");
}

/**
 * Try to read a text file
 * @returns The file content or null if file doesn't exist
 */
export function tryReadTextFile(filePath: string): string | null {
  try {
    return readTextFile(filePath);
  } catch {
    return null;
  }
}

/**
 * Write content to a text file
 */
export function writeTextFile(filePath: string, content: string): void {
  ensureParentDir(filePath);
  writeFileSync(filePath, content, "utf-8");
}

/**
 * Copy a file
 */
export function copyFile(src: string, dest: string): void {
  ensureParentDir(dest);
  copyFileSync(src, dest);
}

/**
 * Copy a directory recursively
 */
export function copyDir(src: string, dest: string): void {
  ensureDir(dest);

  const entries = readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

/**
 * Remove a file or directory
 */
export function remove(path: string): void {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true });
  }
}

/**
 * List directory contents
 */
export function listDir(dirPath: string): string[] {
  if (!existsSync(dirPath)) {
    return [];
  }
  return readdirSync(dirPath);
}

/**
 * List directory entries with types
 */
export function listDirEntries(dirPath: string): Array<{
  name: string;
  type: "file" | "directory" | "unknown";
  path: string;
}> {
  if (!existsSync(dirPath)) {
    return [];
  }

  const entries = readdirSync(dirPath, { withFileTypes: true });
  return entries.map((entry) => ({
    name: entry.name,
    type: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "unknown",
    path: join(dirPath, entry.name),
  }));
}

/**
 * Find files matching a pattern in a directory (non-recursive)
 */
export function findFiles(dirPath: string, pattern: RegExp | string): string[] {
  const entries = listDir(dirPath);
  const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;

  return entries
    .filter((name) => regex.test(name) && isFile(join(dirPath, name)))
    .map((name) => join(dirPath, name));
}

/**
 * Find files recursively
 */
export function findFilesRecursive(dirPath: string, pattern?: RegExp | string): string[] {
  const results: string[] = [];

  if (!existsSync(dirPath)) {
    return results;
  }

  const regex =
    pattern !== undefined ? (typeof pattern === "string" ? new RegExp(pattern) : pattern) : null;

  function walk(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        if (!regex || regex.test(entry.name)) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(dirPath);
  return results;
}

/**
 * Get file stats
 */
export function getStats(path: string): {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  created: Date;
  modified: Date;
} | null {
  try {
    const stats = statSync(path);
    return {
      size: stats.size,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      created: stats.birthtime,
      modified: stats.mtime,
    };
  } catch {
    return null;
  }
}

/**
 * Get file size in bytes
 */
export function getFileSize(filePath: string): number | null {
  const stats = getStats(filePath);
  return stats?.isFile ? stats.size : null;
}

/**
 * Touch a file (create if not exists, update mtime if exists)
 */
export function touchFile(filePath: string): void {
  ensureParentDir(filePath);
  if (existsSync(filePath)) {
    // Update access and modification time by rewriting the file
    writeFileSync(filePath, readFileSync(filePath));
  } else {
    writeFileSync(filePath, "", "utf-8");
  }
}
