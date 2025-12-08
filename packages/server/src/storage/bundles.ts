/**
 * Bundle storage utilities
 */

import type { StorageClient } from "./client.js";

/**
 * Generate storage key for a tool bundle
 * Format: bundles/{owner}/{path}/{version}.tar.gz
 * Example: bundles/alice/utils/greeter/1.2.0.tar.gz
 */
export function getBundleKey(toolName: string, version: string): string {
  return `bundles/${toolName}/${version}.tar.gz`;
}

/**
 * Upload a tool bundle
 */
export async function uploadBundle(
  storage: StorageClient,
  toolName: string,
  version: string,
  data: ArrayBuffer | Uint8Array
): Promise<{ path: string; hash: string; size: number }> {
  const key = getBundleKey(toolName, version);

  // Upload to storage
  await storage.upload(key, data, {
    contentType: "application/gzip",
    metadata: {
      tool: toolName,
      version,
    },
  });

  // Compute hash
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = `sha256:${hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")}`;

  const size = data.byteLength;

  return {
    path: key,
    hash,
    size,
  };
}

/**
 * Download a tool bundle
 */
export async function downloadBundle(
  storage: StorageClient,
  toolName: string,
  version: string
): Promise<ArrayBuffer> {
  const key = getBundleKey(toolName, version);
  return await storage.download(key);
}

/**
 * Delete a tool bundle
 */
export async function deleteBundle(
  storage: StorageClient,
  toolName: string,
  version: string
): Promise<void> {
  const key = getBundleKey(toolName, version);
  await storage.delete(key);
}

/**
 * Check if bundle exists
 */
export async function bundleExists(
  storage: StorageClient,
  toolName: string,
  version: string
): Promise<boolean> {
  const key = getBundleKey(toolName, version);
  return await storage.exists(key);
}
