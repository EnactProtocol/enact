/**
 * Server-side checksum manifest verification
 * 
 * Verifies that a checksum manifest matches the contents of a tar.gz bundle.
 * This enables pre-publish signing by validating that the signed manifest
 * accurately represents the bundle contents.
 */

import { extractTarGz, type TarEntry } from "./tar.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Checksum manifest format (mirrors @enactprotocol/trust)
 */
export interface ChecksumManifest {
  version: "1.0";
  tool: {
    name: string;
    version: string;
  };
  files: Array<{
    path: string;
    sha256: string;
    size: number;
  }>;
  manifestHash: {
    algorithm: "sha256";
    digest: string;
  };
}

/**
 * Result of manifest verification against bundle
 */
export interface ManifestVerificationResult {
  valid: boolean;
  errors?: string[];
  missingFiles?: string[];
  modifiedFiles?: string[];
  extraFiles?: string[];
}

// ============================================================================
// Checksum Computation
// ============================================================================

/**
 * Compute SHA-256 hash of data using Web Crypto API
 */
async function sha256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================================================
// Files to Ignore in Bundle
// ============================================================================

/**
 * Files that should be ignored when verifying manifests
 * These are commonly included in bundles but not in the manifest
 */
const IGNORED_FILES = new Set([
  ".enact-manifest.json",
  ".sigstore-bundle.json",
  ".git",
  ".gitignore",
  ".gitattributes",
  ".DS_Store",
  "Thumbs.db",
  ".npmrc",
  ".yarnrc",
]);

/**
 * Check if a file should be ignored
 */
function shouldIgnoreFile(path: string): boolean {
  // Check exact match
  if (IGNORED_FILES.has(path)) {
    return true;
  }
  
  // Check basename match
  const basename = path.split("/").pop() ?? "";
  if (IGNORED_FILES.has(basename)) {
    return true;
  }
  
  // Check hidden directories/files that are commonly ignored
  const parts = path.split("/");
  for (const part of parts) {
    if (part === ".git" || part === "node_modules") {
      return true;
    }
  }
  
  return false;
}

// ============================================================================
// Verification Functions
// ============================================================================

/**
 * Verify that a checksum manifest matches the contents of a tar.gz bundle
 * 
 * @param manifest - The checksum manifest to verify
 * @param bundleData - The raw tar.gz bundle data
 * @returns Verification result with details about any mismatches
 */
export async function verifyManifestAgainstBundle(
  manifest: ChecksumManifest,
  bundleData: ArrayBuffer | Uint8Array
): Promise<ManifestVerificationResult> {
  const errors: string[] = [];
  const missingFiles: string[] = [];
  const modifiedFiles: string[] = [];
  const extraFiles: string[] = [];

  try {
    // Extract all files from the bundle
    const entries = await extractTarGz(bundleData, { listOnly: false });
    
    // Filter to only files (not directories) and normalize paths
    const bundleFiles = new Map<string, TarEntry>();
    for (const entry of entries) {
      if (entry.type === "file" && entry.name && !shouldIgnoreFile(entry.name)) {
        // Normalize path: strip leading package name folder if present
        // e.g., "tool-name/tool.yaml" -> "tool.yaml"
        const normalizedPath = normalizeEntryPath(entry.name);
        if (normalizedPath) {
          bundleFiles.set(normalizedPath, entry);
        }
      }
    }

    // Create a set of manifest file paths for quick lookup
    const manifestPaths = new Set(manifest.files.map((f) => f.path));

    // Check each file in the manifest exists in the bundle with correct hash
    for (const fileEntry of manifest.files) {
      const bundleEntry = bundleFiles.get(fileEntry.path);
      
      if (!bundleEntry) {
        // File in manifest but not in bundle
        missingFiles.push(fileEntry.path);
        errors.push(`File missing from bundle: ${fileEntry.path}`);
        continue;
      }

      // Verify the content hash
      if (bundleEntry.content) {
        const actualHash = await sha256(bundleEntry.content);
        if (actualHash !== fileEntry.sha256) {
          modifiedFiles.push(fileEntry.path);
          errors.push(
            `Hash mismatch for ${fileEntry.path}: manifest=${fileEntry.sha256.slice(0, 16)}..., actual=${actualHash.slice(0, 16)}...`
          );
        }
      } else {
        // We need content to verify, re-extract with content
        const entriesWithContent = await extractTarGz(bundleData, { filterPath: bundleEntry.name });
        const entryWithContent = entriesWithContent.find(e => e.name === bundleEntry.name);
        
        if (entryWithContent?.content) {
          const actualHash = await sha256(entryWithContent.content);
          if (actualHash !== fileEntry.sha256) {
            modifiedFiles.push(fileEntry.path);
            errors.push(
              `Hash mismatch for ${fileEntry.path}: manifest=${fileEntry.sha256.slice(0, 16)}..., actual=${actualHash.slice(0, 16)}...`
            );
          }
        } else {
          errors.push(`Could not read content for ${fileEntry.path}`);
        }
      }
    }

    // Check for extra files in bundle not in manifest
    for (const [path] of bundleFiles) {
      if (!manifestPaths.has(path)) {
        extraFiles.push(path);
        // Extra files are a warning, not necessarily an error
        console.warn(`[Manifest] Extra file in bundle not in manifest: ${path}`);
      }
    }

    const valid = errors.length === 0 && missingFiles.length === 0 && modifiedFiles.length === 0;

    return {
      valid,
      errors: errors.length > 0 ? errors : undefined,
      missingFiles: missingFiles.length > 0 ? missingFiles : undefined,
      modifiedFiles: modifiedFiles.length > 0 ? modifiedFiles : undefined,
      extraFiles: extraFiles.length > 0 ? extraFiles : undefined,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [`Failed to verify manifest: ${(error as Error).message}`],
    };
  }
}

/**
 * Normalize a tar entry path by stripping the leading package folder
 * 
 * tar.gz bundles often have a leading folder like "package/" or "tool-name/"
 * We need to strip this to match the manifest paths
 */
function normalizeEntryPath(entryPath: string): string {
  // Remove leading "./" if present
  let path = entryPath.replace(/^\.\//, "");
  
  // If the path starts with a folder, check if it's the package wrapper
  const parts = path.split("/");
  if (parts.length > 1) {
    // Check if first part looks like a package wrapper (common patterns)
    const firstPart = parts[0];
    if (
      firstPart === "package" ||
      firstPart === "dist" ||
      // Check if it could be the tool name (contains dash/underscore, lowercase)
      /^[a-z0-9_-]+$/.test(firstPart)
    ) {
      // Strip the first folder - but only if there's actually content after it
      const remaining = parts.slice(1).join("/");
      if (remaining) {
        return remaining;
      }
    }
  }
  
  return path;
}

/**
 * Recompute the manifest hash to verify integrity
 * 
 * The manifest hash is computed from the sorted, deterministic JSON representation
 * of the manifest (excluding the manifestHash field itself)
 */
export async function computeManifestHash(manifest: ChecksumManifest): Promise<string> {
  // Create a copy without manifestHash
  const manifestForHashing = {
    version: manifest.version,
    tool: manifest.tool,
    files: manifest.files,
  };
  
  // Serialize deterministically (keys sorted, no extra whitespace)
  const serialized = JSON.stringify(manifestForHashing, Object.keys(manifestForHashing).sort());
  
  // Compute hash
  const encoder = new TextEncoder();
  return sha256(encoder.encode(serialized));
}

/**
 * Validate manifest structure and metadata
 */
export function validateManifest(
  manifest: unknown,
  expectedToolName: string,
  expectedVersion: string
): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (!manifest || typeof manifest !== "object") {
    return { valid: false, errors: ["Invalid manifest: not an object"] };
  }

  const m = manifest as Record<string, unknown>;

  // Check version
  if (m.version !== "1.0") {
    errors.push(`Invalid manifest version: ${m.version}`);
  }

  // Check tool metadata
  const tool = m.tool as Record<string, unknown> | undefined;
  if (!tool || typeof tool !== "object") {
    errors.push("Missing or invalid tool metadata");
  } else {
    if (tool.name !== expectedToolName) {
      errors.push(`Tool name mismatch: manifest=${tool.name}, expected=${expectedToolName}`);
    }
    if (tool.version !== expectedVersion) {
      errors.push(`Tool version mismatch: manifest=${tool.version}, expected=${expectedVersion}`);
    }
  }

  // Check files array
  if (!Array.isArray(m.files)) {
    errors.push("Missing or invalid files array");
  }

  // Check manifestHash
  const manifestHash = m.manifestHash as Record<string, unknown> | undefined;
  if (!manifestHash || typeof manifestHash !== "object") {
    errors.push("Missing manifestHash");
  } else if (manifestHash.algorithm !== "sha256" || typeof manifestHash.digest !== "string") {
    errors.push("Invalid manifestHash structure");
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
