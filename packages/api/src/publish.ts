/**
 * Tool publishing functionality (v2)
 * Implements bundle creation and publishing to registry
 */

import type { EnactApiClient } from "./client";
import type { AttestationResponse, PublishResponse } from "./types";

/**
 * Publish options
 */
export interface PublishOptions {
  /** Tool name (e.g., "alice/utils/greeter") */
  name: string;
  /** Tool version (e.g., "1.2.0") */
  version: string;
  /** Bundle data (tar.gz) */
  bundle: ArrayBuffer | Uint8Array;
}

/**
 * Publish result
 */
export interface PublishResult {
  /** Tool name */
  name: string;
  /** Published version */
  version: string;
  /** Publication timestamp */
  publishedAt: Date;
  /** Bundle hash */
  bundleHash: string;
}

/**
 * Bundle info (for createBundle)
 */
export interface BundleInfo {
  /** Bundle data */
  data: Uint8Array;
  /** SHA-256 hash */
  hash: string;
  /** Size in bytes */
  size: number;
}

/**
 * Attestation submission options (v2)
 */
export interface SubmitAttestationOptions {
  /** Tool name */
  name: string;
  /** Tool version */
  version: string;
  /** Sigstore bundle (full bundle object) */
  sigstoreBundle: Record<string, unknown>;
}

/**
 * Attestation submission result (v2)
 */
export interface AttestationResult {
  /** Auditor email */
  auditor: string;
  /** OAuth provider */
  auditorProvider: string;
  /** Signing timestamp */
  signedAt: Date;
  /** Rekor log ID */
  rekorLogId: string;
  /** Rekor log index */
  rekorLogIndex?: number | undefined;
  /** Verification result */
  verification: {
    verified: boolean;
    verifiedAt: Date;
    rekorVerified: boolean;
    certificateVerified: boolean;
    signatureVerified: boolean;
  };
}

/**
 * Create a bundle from tool directory
 *
 * This is a placeholder that would typically:
 * 1. Read all files from the tool directory
 * 2. Create a tar.gz archive
 * 3. Compute SHA-256 hash
 *
 * @param toolDir - Path to tool directory
 * @returns Bundle info with data and hash
 */
export async function createBundle(toolDir: string): Promise<BundleInfo> {
  // This would use @enactprotocol/shared utilities to:
  // 1. Read files from toolDir
  // 2. Create tarball
  // 3. Compute hash

  // For now, this is a placeholder that throws
  // The actual implementation would integrate with the shared package
  throw new Error(`createBundle not yet implemented for: ${toolDir}`);
}

/**
 * Tool visibility levels
 */
export type ToolVisibility = "public" | "private" | "unlisted";

/**
 * Publish a tool to the registry (v2 - multipart upload)
 *
 * @param client - API client instance (must be authenticated)
 * @param options - Publish options with manifest and bundle
 * @returns Publish result
 *
 * @example
 * ```ts
 * const bundle = await createBundle("./my-tool");
 * const result = await publishTool(client, {
 *   name: "alice/utils/greeter",
 *   manifest: { enact: "2.0.0", name: "alice/utils/greeter", version: "1.2.0", ... },
 *   bundle: bundle.data,
 *   rawManifest: "---\nenact: 2.0.0\n...\n---\n# My Tool\n\nDescription...",
 *   visibility: "private"
 * });
 * console.log(`Published: ${result.bundleHash}`);
 * ```
 */
export async function publishTool(
  client: EnactApiClient,
  options: {
    name: string;
    manifest: Record<string, unknown>;
    bundle: ArrayBuffer | Uint8Array;
    /** The raw enact.md file content (frontmatter + markdown documentation) */
    rawManifest?: string | undefined;
    /** Tool visibility: public, private, or unlisted */
    visibility?: ToolVisibility | undefined;
    /** Pre-signed checksum manifest (for manifest-based signing) */
    checksumManifest?: Record<string, unknown> | undefined;
    /** Pre-signed Sigstore bundle */
    sigstoreBundle?: Record<string, unknown> | undefined;
  }
): Promise<PublishResult> {
  const {
    name,
    manifest,
    bundle,
    rawManifest,
    visibility = "private",
    checksumManifest,
    sigstoreBundle,
  } = options;

  // Create FormData for multipart upload
  const formData = new FormData();

  // Add manifest as JSON
  formData.append("manifest", JSON.stringify(manifest));

  // Add bundle as file
  const bundleBlob =
    bundle instanceof ArrayBuffer
      ? new Blob([bundle], { type: "application/gzip" })
      : new Blob([bundle], { type: "application/gzip" });
  formData.append("bundle", bundleBlob, "bundle.tar.gz");

  // Add optional raw manifest (enact.md content)
  if (rawManifest) {
    formData.append("raw_manifest", rawManifest);
  }

  // Add visibility
  formData.append("visibility", visibility);

  // Add pre-signed attestation if provided
  if (checksumManifest && sigstoreBundle) {
    formData.append("checksum_manifest", JSON.stringify(checksumManifest));
    formData.append("sigstore_bundle", JSON.stringify(sigstoreBundle));
  }

  // Make multipart request (v2 endpoint is POST /tools/{name})
  const response = await fetch(`${client.getBaseUrl()}/tools/${name}`, {
    method: "POST",
    headers: {
      Authorization: client.getAuthToken() ? `Bearer ${client.getAuthToken()}` : "",
      "User-Agent": client.getUserAgent() || "enact-cli/0.1.0",
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();

    // Try to parse as JSON to get a more meaningful error message
    try {
      const errorJson = JSON.parse(errorText);
      const error = errorJson.error;

      if (error?.code && error?.message) {
        // Provide user-friendly error messages based on error code
        switch (error.code) {
          case "NAMESPACE_MISMATCH":
            throw new Error(
              `Namespace mismatch: ${error.message}\n` +
                `Hint: You can only publish tools under your own namespace (${error.details?.userNamespace || "your username"}).`
            );
          case "CONFLICT":
            throw new Error(
              `Version conflict: ${error.message}\nHint: Bump the version number in your enact.md file and try again.`
            );
          case "UNAUTHORIZED":
            throw new Error(
              `Authentication required: ${error.message}\nHint: Run 'enact auth login' to authenticate.`
            );
          case "VALIDATION_ERROR":
            throw new Error(`Validation error: ${error.message}`);
          case "BUNDLE_TOO_LARGE":
            throw new Error(`Bundle too large: ${error.message}`);
          default:
            throw new Error(`Publish failed (${error.code}): ${error.message}`);
        }
      }
    } catch (parseError) {
      // If JSON parsing fails, fall back to the raw error text
      if (parseError instanceof Error && parseError.message.startsWith("Namespace mismatch:")) {
        throw parseError;
      }
      if (parseError instanceof Error && parseError.message.startsWith("Version conflict:")) {
        throw parseError;
      }
      if (
        parseError instanceof Error &&
        parseError.message.startsWith("Authentication required:")
      ) {
        throw parseError;
      }
      if (parseError instanceof Error && parseError.message.startsWith("Validation error:")) {
        throw parseError;
      }
      if (parseError instanceof Error && parseError.message.startsWith("Bundle too large:")) {
        throw parseError;
      }
      if (parseError instanceof Error && parseError.message.startsWith("Publish failed (")) {
        throw parseError;
      }
    }

    throw new Error(`Publish failed: ${response.status} - ${errorText}`);
  }

  const json = (await response.json()) as { data: PublishResponse } | PublishResponse;
  // Handle both wrapped and unwrapped responses
  const data = "data" in json ? json.data : json;

  return {
    name: data.name,
    version: data.version,
    publishedAt: new Date(data.published_at),
    bundleHash: data.bundle_hash,
  };
}

/**
 * Submit an attestation for a tool version (v2)
 *
 * @param client - API client instance (must be authenticated via OIDC)
 * @param options - Attestation options
 * @returns Attestation result
 */
export async function submitAttestation(
  client: EnactApiClient,
  options: SubmitAttestationOptions
): Promise<AttestationResult> {
  const { name, version, sigstoreBundle } = options;

  const response = await client.post<AttestationResponse>(
    `/tools/${name}/versions/${version}/attestations`,
    {
      bundle: sigstoreBundle,
    }
  );

  return {
    auditor: response.data.auditor,
    auditorProvider: response.data.auditor_provider,
    signedAt: new Date(response.data.signed_at),
    rekorLogId: response.data.rekor_log_id,
    rekorLogIndex: response.data.rekor_log_index,
    verification: {
      verified: response.data.verification.verified,
      verifiedAt: new Date(response.data.verification.verified_at),
      rekorVerified: response.data.verification.rekor_verified,
      certificateVerified: response.data.verification.certificate_verified,
      signatureVerified: response.data.verification.signature_verified,
    },
  };
}

/**
 * Yank a tool version (v2)
 *
 * Yanked versions remain downloadable but are excluded from version listings
 * by default and show warnings to users.
 *
 * @param client - API client instance (must be authenticated and owner)
 * @param name - Tool name
 * @param version - Version to yank
 * @param options - Yank options (reason, replacement)
 * @returns Yank result
 *
 * @example
 * ```ts
 * const result = await yankVersion(client, "alice/utils/greeter", "1.1.0", {
 *   reason: "Security vulnerability CVE-2025-1234",
 *   replacementVersion: "1.2.0"
 * });
 * ```
 */
export async function yankVersion(
  client: EnactApiClient,
  name: string,
  version: string,
  options?: {
    reason?: string | undefined;
    replacementVersion?: string | undefined;
  }
): Promise<{
  yanked: true;
  version: string;
  reason?: string | undefined;
  replacementVersion?: string | undefined;
  yankedAt: Date;
}> {
  const response = await client.post<{
    yanked: true;
    version: string;
    reason?: string | undefined;
    replacement_version?: string | undefined;
    yanked_at: string;
  }>(`/tools/${name}/versions/${version}/yank`, {
    reason: options?.reason,
    replacement_version: options?.replacementVersion,
  });

  return {
    yanked: response.data.yanked,
    version: response.data.version,
    reason: response.data.reason,
    replacementVersion: response.data.replacement_version,
    yankedAt: new Date(response.data.yanked_at),
  };
}

/**
 * Unyank a tool version (v2)
 *
 * Restore a previously yanked version.
 *
 * @param client - API client instance (must be authenticated and owner)
 * @param name - Tool name
 * @param version - Version to unyank
 * @returns Unyank result
 *
 * @example
 * ```ts
 * const result = await unyankVersion(client, "alice/utils/greeter", "1.1.0");
 * ```
 */
export async function unyankVersion(
  client: EnactApiClient,
  name: string,
  version: string
): Promise<{
  yanked: false;
  version: string;
  unyankedAt: Date;
}> {
  const response = await client.post<{
    yanked: false;
    version: string;
    unyanked_at: string;
  }>(`/tools/${name}/versions/${version}/unyank`);

  return {
    yanked: response.data.yanked,
    version: response.data.version,
    unyankedAt: new Date(response.data.unyanked_at),
  };
}

/**
 * Delete a tool from the registry
 *
 * @param client - API client instance (must be authenticated and owner)
 * @param name - Tool name to delete
 */
export async function deleteTool(client: EnactApiClient, name: string): Promise<void> {
  await client.delete(`/tools/${name}`);
}
