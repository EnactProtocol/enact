/**
 * Checksum manifest creation and verification
 *
 * Creates deterministic manifests of file checksums for signing.
 * This enables pre-publish signing by avoiding tar.gz non-determinism.
 *
 * Based on recommendation from Bob Callaway (Google Sigstore team):
 * "Most folks would just create and sign a manifest of checksums."
 */

import { readdirSync, statSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";
import { hashContent, hashFile } from "./hash";
import type { HashResult } from "./types";

// ============================================================================
// Types
// ============================================================================

/**
 * Checksum manifest version
 */
export const MANIFEST_VERSION = "1.0" as const;

/**
 * Individual file checksum entry
 */
export interface FileChecksum {
  /** Relative path from tool root (always uses forward slashes) */
  path: string;
  /** SHA-256 hash of file contents */
  sha256: string;
  /** File size in bytes */
  size: number;
}

/**
 * Complete checksum manifest for a tool
 */
export interface ChecksumManifest {
  /** Manifest format version */
  version: typeof MANIFEST_VERSION;
  /** Tool metadata */
  tool: {
    /** Tool name (e.g., "author/tool-name") */
    name: string;
    /** Tool version (e.g., "1.0.0") */
    version: string;
  };
  /** Array of file checksums, sorted by path */
  files: FileChecksum[];
  /** Hash of the manifest itself (for signing) */
  manifestHash: {
    algorithm: "sha256";
    digest: string;
  };
}

/**
 * Options for creating a checksum manifest
 */
export interface CreateManifestOptions {
  /** Patterns to ignore (glob-style, relative to tool root) */
  ignorePatterns?: string[] | undefined;
  /** Progress callback for each file processed */
  onProgress?: ((file: string) => void) | undefined;
}

/**
 * Result of manifest verification
 */
export interface ManifestVerificationResult {
  /** Whether all files match the manifest */
  valid: boolean;
  /** Error messages if verification failed */
  errors?: string[] | undefined;
  /** Files in manifest but missing from directory */
  missingFiles?: string[] | undefined;
  /** Files that exist but have different hashes */
  modifiedFiles?: string[] | undefined;
  /** Files in directory but not in manifest */
  extraFiles?: string[] | undefined;
}

// ============================================================================
// Default Ignore Patterns
// ============================================================================

/**
 * Files that should always be ignored when creating manifests
 */
const ALWAYS_IGNORE = [
  // Manifest artifacts (we're creating these)
  ".enact-manifest.json",
  ".sigstore-bundle.json",
  // Version control
  ".git",
  ".gitignore",
  ".gitattributes",
  // OS artifacts
  ".DS_Store",
  "Thumbs.db",
  // IDE/Editor
  ".vscode",
  ".idea",
  "*.swp",
  "*.swo",
  // Dependencies (should be installed, not bundled)
  "node_modules",
  "__pycache__",
  ".pytest_cache",
  "*.pyc",
  "*.pyo",
  // Build artifacts
  "dist",
  "build",
  ".next",
  // Logs
  "*.log",
  "npm-debug.log*",
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a path should be ignored
 */
function shouldIgnore(
  relativePath: string,
  fileName: string,
  customPatterns: string[] = []
): boolean {
  const allPatterns = [...ALWAYS_IGNORE, ...customPatterns];

  for (const pattern of allPatterns) {
    // Exact match
    if (pattern === fileName || pattern === relativePath) {
      return true;
    }

    // Glob pattern matching (simplified)
    if (pattern.startsWith("*")) {
      const suffix = pattern.slice(1);
      if (fileName.endsWith(suffix) || relativePath.endsWith(suffix)) {
        return true;
      }
    }

    // Directory pattern (pattern without extension matches directories)
    if (!pattern.includes(".") && !pattern.includes("*")) {
      if (relativePath.startsWith(`${pattern}/`) || relativePath === pattern) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Normalize path to use forward slashes (for cross-platform consistency)
 */
function normalizePath(filePath: string): string {
  return filePath.split(sep).join(posix.sep);
}

/**
 * Recursively collect all files in a directory
 */
function collectFiles(
  dir: string,
  baseDir: string,
  ignorePatterns: string[],
  files: string[] = []
): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = normalizePath(relative(baseDir, fullPath));

    // Check if should be ignored
    if (shouldIgnore(relativePath, entry.name, ignorePatterns)) {
      continue;
    }

    if (entry.isDirectory()) {
      collectFiles(fullPath, baseDir, ignorePatterns, files);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
    // Skip symlinks and other special files
  }

  return files;
}

/**
 * Create canonical JSON string for hashing
 *
 * - Sorts object keys recursively
 * - No whitespace (minified)
 * - Consistent output across platforms
 */
function canonicalJSON(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalJSON).join(",")}]`;
  }

  // Sort keys and recursively process
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalJSON((obj as Record<string, unknown>)[key])}`
  );

  return `{${pairs.join(",")}}`;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Create a checksum manifest for a tool directory
 *
 * Scans all files in the directory, computes SHA-256 hashes,
 * and creates a manifest suitable for signing.
 *
 * @param toolDir - Path to the tool directory
 * @param toolName - Tool name (e.g., "author/tool-name")
 * @param toolVersion - Tool version (e.g., "1.0.0")
 * @param options - Optional settings for ignore patterns and progress
 * @returns Complete checksum manifest ready for signing
 *
 * @example
 * ```ts
 * const manifest = await createChecksumManifest(
 *   "./my-tool",
 *   "alice/my-tool",
 *   "1.0.0",
 *   { onProgress: (file) => console.log(`Hashing: ${file}`) }
 * );
 * ```
 */
export async function createChecksumManifest(
  toolDir: string,
  toolName: string,
  toolVersion: string,
  options: CreateManifestOptions = {}
): Promise<ChecksumManifest> {
  const { ignorePatterns = [], onProgress } = options;

  // Collect all files
  const filePaths = collectFiles(toolDir, toolDir, ignorePatterns);

  // Hash each file
  const fileChecksums: FileChecksum[] = [];

  for (const filePath of filePaths) {
    const relativePath = normalizePath(relative(toolDir, filePath));

    if (onProgress) {
      onProgress(relativePath);
    }

    const stats = statSync(filePath);
    const hashResult = await hashFile(filePath);

    fileChecksums.push({
      path: relativePath,
      sha256: hashResult.digest,
      size: stats.size,
    });
  }

  // Sort by path for deterministic ordering (using simple string comparison)
  fileChecksums.sort((a, b) => {
    if (a.path < b.path) return -1;
    if (a.path > b.path) return 1;
    return 0;
  });

  // Create manifest without the hash first
  const manifestWithoutHash = {
    version: MANIFEST_VERSION,
    tool: {
      name: toolName,
      version: toolVersion,
    },
    files: fileChecksums,
  };

  // Compute manifest hash from canonical JSON
  const manifestHash = computeManifestHash(manifestWithoutHash);

  // Return complete manifest
  return {
    ...manifestWithoutHash,
    manifestHash: {
      algorithm: "sha256",
      digest: manifestHash.digest,
    },
  };
}

/**
 * Compute the canonical hash of a manifest (for signing)
 *
 * Creates a deterministic hash by:
 * 1. Excluding the manifestHash field itself
 * 2. Using canonical JSON (sorted keys, no whitespace)
 * 3. Computing SHA-256
 *
 * @param manifest - The manifest to hash (manifestHash field is ignored)
 * @returns Hash result with algorithm and digest
 */
export function computeManifestHash(
  manifest: Omit<ChecksumManifest, "manifestHash"> | ChecksumManifest
): HashResult {
  // Create a copy without manifestHash
  const { manifestHash: _, ...manifestWithoutHash } = manifest as ChecksumManifest;

  // Compute canonical JSON and hash
  const canonical = canonicalJSON(manifestWithoutHash);
  return hashContent(canonical, "sha256");
}

/**
 * Verify that files in a directory match a checksum manifest
 *
 * @param toolDir - Path to the tool directory
 * @param manifest - The manifest to verify against
 * @param options - Optional settings for ignore patterns
 * @returns Verification result with details on any mismatches
 *
 * @example
 * ```ts
 * const result = await verifyChecksumManifest("./my-tool", manifest);
 * if (!result.valid) {
 *   console.error("Verification failed:", result.errors);
 * }
 * ```
 */
export async function verifyChecksumManifest(
  toolDir: string,
  manifest: ChecksumManifest,
  options: { ignorePatterns?: string[] } = {}
): Promise<ManifestVerificationResult> {
  const { ignorePatterns = [] } = options;
  const errors: string[] = [];
  const missingFiles: string[] = [];
  const modifiedFiles: string[] = [];
  const extraFiles: string[] = [];

  // First, verify the manifest hash itself
  const computedHash = computeManifestHash(manifest);
  if (computedHash.digest !== manifest.manifestHash.digest) {
    errors.push(
      `Manifest hash mismatch: expected ${manifest.manifestHash.digest}, got ${computedHash.digest}`
    );
  }

  // Collect current files in directory
  const currentFilePaths = collectFiles(toolDir, toolDir, ignorePatterns);
  const currentFiles = new Set(currentFilePaths.map((fp) => normalizePath(relative(toolDir, fp))));

  // Check each file in manifest
  const manifestFiles = new Set<string>();

  for (const fileEntry of manifest.files) {
    manifestFiles.add(fileEntry.path);
    const fullPath = join(toolDir, fileEntry.path);

    // Check if file exists
    if (!currentFiles.has(fileEntry.path)) {
      missingFiles.push(fileEntry.path);
      errors.push(`Missing file: ${fileEntry.path}`);
      continue;
    }

    // Check hash
    try {
      const hashResult = await hashFile(fullPath);
      if (hashResult.digest !== fileEntry.sha256) {
        modifiedFiles.push(fileEntry.path);
        errors.push(
          `Modified file: ${fileEntry.path} (expected ${fileEntry.sha256.slice(0, 12)}..., got ${hashResult.digest.slice(0, 12)}...)`
        );
      }
    } catch (err) {
      errors.push(`Failed to hash file ${fileEntry.path}: ${err}`);
    }
  }

  // Check for extra files not in manifest
  for (const currentFile of currentFiles) {
    if (!manifestFiles.has(currentFile)) {
      extraFiles.push(currentFile);
      errors.push(`Extra file not in manifest: ${currentFile}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    missingFiles: missingFiles.length > 0 ? missingFiles : undefined,
    modifiedFiles: modifiedFiles.length > 0 ? modifiedFiles : undefined,
    extraFiles: extraFiles.length > 0 ? extraFiles : undefined,
  };
}

/**
 * Parse a checksum manifest from JSON string
 *
 * @param json - JSON string containing the manifest
 * @returns Parsed manifest
 * @throws Error if JSON is invalid or manifest structure is wrong
 */
export function parseChecksumManifest(json: string): ChecksumManifest {
  const parsed = JSON.parse(json);

  // Validate structure
  if (!parsed.version || parsed.version !== MANIFEST_VERSION) {
    throw new Error(
      `Invalid manifest version: expected ${MANIFEST_VERSION}, got ${parsed.version}`
    );
  }

  if (!parsed.tool?.name || !parsed.tool?.version) {
    throw new Error("Invalid manifest: missing tool name or version");
  }

  if (!Array.isArray(parsed.files)) {
    throw new Error("Invalid manifest: files must be an array");
  }

  if (!parsed.manifestHash?.algorithm || !parsed.manifestHash?.digest) {
    throw new Error("Invalid manifest: missing manifestHash");
  }

  return parsed as ChecksumManifest;
}

/**
 * Serialize a checksum manifest to JSON string (pretty-printed for storage)
 *
 * @param manifest - The manifest to serialize
 * @returns Pretty-printed JSON string
 */
export function serializeChecksumManifest(manifest: ChecksumManifest): string {
  return JSON.stringify(manifest, null, 2);
}

// ============================================================================
// Attestation Verification
// ============================================================================

/**
 * Result of verifying a manifest attestation
 */
export interface ManifestAttestationVerificationResult {
  /** Whether the attestation is valid */
  valid: boolean;
  /** The auditor identity (email) from the certificate */
  auditor?: string | undefined;
  /** The OIDC provider used for signing */
  provider?: string | undefined;
  /** Error message if verification failed */
  error?: string | undefined;
  /** Detailed verification results */
  details?:
    | {
        /** Whether the Sigstore bundle was verified */
        bundleVerified: boolean;
        /** Whether the manifest hash matches what was signed */
        manifestHashMatches: boolean;
        /** Whether the manifest matches the current files */
        manifestMatchesFiles?: boolean | undefined;
      }
    | undefined;
}

/**
 * Verify a manifest-based attestation
 *
 * This verifies that:
 * 1. The Sigstore bundle is valid
 * 2. The bundle was signed over the manifest hash
 * 3. Optionally, the manifest matches the current files on disk
 *
 * @param manifest - The checksum manifest that was signed
 * @param sigstoreBundle - The Sigstore bundle containing the signature
 * @param options - Verification options
 * @returns Verification result
 */
export async function verifyManifestAttestation(
  manifest: ChecksumManifest,
  sigstoreBundle: unknown,
  options: {
    /** If provided, also verify manifest matches files in this directory */
    toolDir?: string | undefined;
    /** Additional patterns to ignore when verifying against directory */
    ignorePatterns?: string[] | undefined;
  } = {}
): Promise<ManifestAttestationVerificationResult> {
  // Dynamic import to avoid circular dependencies
  const { verifyBundle, extractIdentityFromBundle } = await import("./sigstore");
  type SigstoreBundleType = import("./sigstore/types").SigstoreBundle;

  try {
    // Get the manifest hash that should have been signed
    const expectedHash = manifest.manifestHash.digest;

    // Convert hash to Buffer for verification
    const hashBuffer = Buffer.from(
      expectedHash.match(/.{1,2}/g)!.map((byte) => Number.parseInt(byte, 16))
    );

    // Cast the bundle to the expected type
    const bundle = sigstoreBundle as SigstoreBundleType;

    // Verify the Sigstore bundle
    const bundleResult = await verifyBundle(bundle, hashBuffer);

    if (!bundleResult.verified) {
      return {
        valid: false,
        error: bundleResult.error ?? "Sigstore bundle verification failed",
        details: {
          bundleVerified: false,
          manifestHashMatches: false,
        },
      };
    }

    // Extract identity from the bundle
    const identity = extractIdentityFromBundle(bundle);

    // If toolDir is provided, also verify manifest matches files
    let manifestMatchesFiles: boolean | undefined;
    if (options.toolDir) {
      const ignoreOpts = options.ignorePatterns ? { ignorePatterns: options.ignorePatterns } : {};
      const fileVerification = await verifyChecksumManifest(options.toolDir, manifest, ignoreOpts);
      manifestMatchesFiles = fileVerification.valid;

      if (!fileVerification.valid) {
        return {
          valid: false,
          auditor: identity?.email ?? identity?.subject,
          provider: identity?.issuer,
          error: `Manifest does not match files: ${fileVerification.errors?.join(", ")}`,
          details: {
            bundleVerified: true,
            manifestHashMatches: true,
            manifestMatchesFiles: false,
          },
        };
      }
    }

    return {
      valid: true,
      auditor: identity?.email ?? identity?.subject,
      provider: identity?.issuer,
      details: {
        bundleVerified: true,
        manifestHashMatches: true,
        manifestMatchesFiles,
      },
    };
  } catch (error) {
    return {
      valid: false,
      error: `Verification failed: ${(error as Error).message}`,
      details: {
        bundleVerified: false,
        manifestHashMatches: false,
      },
    };
  }
}
