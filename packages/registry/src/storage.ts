/**
 * Local file storage for registry bundles.
 * Stores bundles at {dataDir}/bundles/{name}/{version}/bundle.tar.gz
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

let bundlesDir: string;

export function initStorage(dataDir: string): void {
  bundlesDir = join(dataDir, "bundles");
  if (!existsSync(bundlesDir)) {
    mkdirSync(bundlesDir, { recursive: true });
  }
}

/**
 * Get the relative path for a bundle (stored in the DB)
 */
export function getBundlePath(name: string, version: string): string {
  // name is like "alice/greeter" → "alice/greeter/1.0.0/bundle.tar.gz"
  return join(name, version, "bundle.tar.gz");
}

/**
 * Store a bundle file
 */
export function storeBundle(name: string, version: string, data: Buffer): string {
  const relativePath = getBundlePath(name, version);
  const fullPath = join(bundlesDir, relativePath);
  const dir = dirname(fullPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(fullPath, data);
  return relativePath;
}

/**
 * Load a bundle file
 */
export function loadBundle(relativePath: string): Buffer | null {
  const fullPath = join(bundlesDir, relativePath);
  if (!existsSync(fullPath)) return null;
  return readFileSync(fullPath);
}

/**
 * Delete a bundle file
 */
export function deleteBundle(relativePath: string): void {
  const fullPath = join(bundlesDir, relativePath);
  if (existsSync(fullPath)) {
    unlinkSync(fullPath);
  }
}
