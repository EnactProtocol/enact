/**
 * Tool download functionality
 * Implements bundle download and tool info retrieval
 */

import type { EnactApiClient } from "./client";
import type { ToolMetadata, ToolVersionDetails } from "./types";

/**
 * Download options
 */
export interface DownloadOptions {
  /** Tool name (e.g., "alice/utils/greeter") */
  name: string;
  /** Tool version (e.g., "1.2.0") */
  version: string;
  /** Verify bundle hash after download */
  verify?: boolean | undefined;
}

/**
 * Download result
 */
export interface DownloadResult {
  /** Downloaded bundle data */
  data: ArrayBuffer;
  /** Bundle hash (sha256) */
  hash: string;
  /** Content length in bytes */
  size: number;
  /** Content type */
  contentType: string;
}

/**
 * Tool info (metadata) v2
 */
export interface ToolInfo {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Tool tags */
  tags: string[];
  /** SPDX license */
  license: string;
  /** Author info */
  author: {
    username: string;
    avatarUrl?: string | undefined;
  };
  /** Repository URL */
  repository?: string | undefined;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Latest version */
  latestVersion: string;
  /** All available versions (paginated) */
  versions: Array<{
    version: string;
    publishedAt: Date;
    downloads: number;
    bundleHash: string;
    yanked: boolean;
  }>;
  /** Total number of versions */
  versionsTotal: number;
  /** Total downloads */
  totalDownloads: number;
}

/**
 * Version-specific tool info v2
 */
export interface ToolVersionInfo {
  /** Tool name */
  name: string;
  /** Version */
  version: string;
  /** Description */
  description: string;
  /** License */
  license: string;
  /** Whether yanked */
  yanked: boolean;
  /** Yank reason */
  yankReason?: string | undefined;
  /** Replacement version */
  yankReplacement?: string | undefined;
  /** Yanked timestamp */
  yankedAt?: Date | undefined;
  /** Full manifest (parsed from enact.md frontmatter) */
  manifest: Record<string, unknown>;
  /** The raw enact.md file content (frontmatter + markdown documentation) */
  rawManifest?: string | undefined;
  /** Bundle info */
  bundle: {
    hash: string;
    size: number;
    downloadUrl: string;
  };
  /** Attestations */
  attestations: Array<{
    auditor: string;
    auditorProvider: string;
    signedAt: Date;
    rekorLogId: string;
    verified: boolean;
  }>;
  /** Published by */
  publishedBy: {
    username: string;
    avatarUrl?: string | undefined;
  };
  /** Publication timestamp */
  publishedAt: Date;
  /** Download count */
  downloads: number;
}

/**
 * Convert raw tool metadata to ToolInfo
 */
function toToolInfo(raw: ToolMetadata): ToolInfo {
  return {
    name: raw.name,
    description: raw.description,
    tags: raw.tags,
    license: raw.license,
    author: {
      username: raw.author.username,
      avatarUrl: raw.author.avatar_url,
    },
    repository: raw.repository,
    createdAt: new Date(raw.created_at),
    updatedAt: new Date(raw.updated_at),
    latestVersion: raw.latest_version,
    versions: raw.versions.map((v) => ({
      version: v.version,
      publishedAt: new Date(v.published_at),
      downloads: v.downloads,
      bundleHash: v.bundle_hash,
      yanked: v.yanked,
    })),
    versionsTotal: raw.versions_total,
    totalDownloads: raw.total_downloads,
  };
}

/**
 * Convert raw version details to ToolVersionInfo
 */
function toToolVersionInfo(raw: ToolVersionDetails): ToolVersionInfo {
  return {
    name: raw.name,
    version: raw.version,
    description: raw.description,
    license: raw.license,
    yanked: raw.yanked,
    yankReason: raw.yank_reason,
    yankReplacement: raw.yank_replacement,
    yankedAt: raw.yanked_at ? new Date(raw.yanked_at) : undefined,
    manifest: raw.manifest,
    rawManifest: raw.rawManifest,
    bundle: {
      hash: raw.bundle.hash,
      size: raw.bundle.size,
      downloadUrl: raw.bundle.download_url,
    },
    attestations: raw.attestations.map((a) => ({
      auditor: a.auditor,
      auditorProvider: a.auditor_provider,
      signedAt: new Date(a.signed_at),
      rekorLogId: a.rekor_log_id,
      verified: a.verification?.verified ?? false,
    })),
    publishedBy: {
      username: raw.published_by.username,
      avatarUrl: raw.published_by.avatar_url,
    },
    publishedAt: new Date(raw.published_at),
    downloads: raw.downloads,
  };
}

/**
 * Get tool metadata
 *
 * @param client - API client instance
 * @param name - Tool name (e.g., "alice/utils/greeter")
 * @returns Tool metadata
 *
 * @example
 * ```ts
 * const info = await getToolInfo(client, "alice/utils/greeter");
 * console.log(info.latestVersion);
 * ```
 */
export async function getToolInfo(client: EnactApiClient, name: string): Promise<ToolInfo> {
  const response = await client.get<ToolMetadata>(`/tools/${name}`);
  return toToolInfo(response.data);
}

/**
 * Get version-specific tool information
 *
 * @param client - API client instance
 * @param name - Tool name
 * @param version - Tool version
 * @returns Version-specific tool info
 */
export async function getToolVersion(
  client: EnactApiClient,
  name: string,
  version: string
): Promise<ToolVersionInfo> {
  const response = await client.get<ToolVersionDetails>(`/tools/${name}/versions/${version}`);
  return toToolVersionInfo(response.data);
}

/**
 * Get attestations for a tool version
 *
 * @param client - API client instance
 * @param name - Tool name
 * @param version - Tool version
 * @returns Attestation list
 */
export async function getAttestations(
  client: EnactApiClient,
  name: string,
  version: string
): Promise<
  Array<{
    auditor: string;
    auditorProvider: string;
    signedAt: Date;
    rekorLogId: string;
    verified: boolean;
  }>
> {
  const response = await client.get<ToolVersionDetails>(`/tools/${name}/versions/${version}`);
  return response.data.attestations.map((a) => ({
    auditor: a.auditor,
    auditorProvider: a.auditor_provider,
    signedAt: new Date(a.signed_at),
    rekorLogId: a.rekor_log_id,
    verified: a.verification?.verified ?? false,
  }));
}

/**
 * Download a tool bundle (v2 with yank handling)
 *
 * @param client - API client instance
 * @param options - Download options
 * @returns Downloaded bundle data with metadata
 *
 * @example
 * ```ts
 * const result = await downloadBundle(client, {
 *   name: "alice/utils/greeter",
 *   version: "1.2.0",
 *   verify: true
 * });
 * await Bun.write("bundle.tar.gz", result.data);
 * ```
 */
export async function downloadBundle(
  client: EnactApiClient,
  options: DownloadOptions & { acknowledgeYanked?: boolean }
): Promise<DownloadResult> {
  const { name, version, acknowledgeYanked } = options;

  // Build query params for yanked version acknowledgment
  const params = acknowledgeYanked ? "?acknowledge_yanked=true" : "";
  const response = await client.download(`/tools/${name}/versions/${version}/download${params}`);

  const data = await response.arrayBuffer();
  const contentType = response.headers.get("Content-Type") ?? "application/gzip";
  const size = data.byteLength;

  // Extract hash from ETag or compute it
  let hash = response.headers.get("ETag")?.replace(/"/g, "") ?? "";

  // If verify is true and we need to compute hash, do it
  if (options.verify && !hash.startsWith("sha256:")) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    hash = `sha256:${hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  }

  return {
    data,
    hash,
    size,
    contentType,
  };
}
