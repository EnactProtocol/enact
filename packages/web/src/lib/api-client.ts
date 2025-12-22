/**
 * Browser-native API client for Enact Registry
 *
 * This is a self-contained implementation that doesn't depend on @enactprotocol/api
 * to avoid Node.js-specific dependencies like node:crypto.
 */

// =============================================================================
// Types
// =============================================================================

export interface ApiClientOptions {
  baseUrl?: string;
  authToken?: string;
  timeout?: number;
}

export interface ApiAuthor {
  username: string;
  avatar_url?: string;
}

export interface ToolSearchResult {
  name: string;
  description: string;
  tags: string[];
  version: string;
  author: ApiAuthor;
  downloads: number;
  trust_status?: {
    auditor_count: number;
  };
}

export interface SearchResult {
  name: string;
  description: string;
  tags: string[];
  version: string;
  author: {
    username: string;
    avatarUrl?: string;
  };
  downloads: number;
  trustStatus?: {
    auditorCount: number;
  };
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface SearchOptions {
  query: string;
  tags?: string | string[];
  limit?: number;
  offset?: number;
}

export interface VersionMetadata {
  version: string;
  published_at: string;
  downloads: number;
  bundle_hash: string;
  bundle_size?: number;
  yanked: boolean;
}

export interface ToolMetadata {
  name: string;
  description: string;
  tags: string[];
  license: string;
  author: ApiAuthor;
  repository?: string;
  homepage?: string;
  created_at: string;
  updated_at: string;
  latest_version: string;
  versions: VersionMetadata[];
  versions_total: number;
  total_downloads: number;
}

export interface ToolInfo {
  name: string;
  description: string;
  tags: string[];
  license: string;
  author: {
    username: string;
    avatarUrl?: string;
  };
  repository?: string;
  createdAt: Date;
  updatedAt: Date;
  latestVersion: string;
  versions: Array<{
    version: string;
    publishedAt: Date;
    downloads: number;
    bundleHash: string;
    yanked: boolean;
  }>;
  versionsTotal: number;
  totalDownloads: number;
}

export interface Attestation {
  auditor: string;
  auditor_provider: string;
  signed_at: string;
  rekor_log_id: string;
  rekor_log_index?: number;
  verification?: {
    verified: boolean;
    verified_at: string;
    rekor_verified: boolean;
    certificate_verified: boolean;
    signature_verified: boolean;
  };
}

export interface BundleInfo {
  hash: string;
  size: number;
  download_url: string;
}

export interface ToolVersionDetails {
  name: string;
  version: string;
  description: string;
  license: string;
  yanked: boolean;
  yank_reason?: string;
  yank_replacement?: string;
  yanked_at?: string;
  manifest: Record<string, unknown>;
  bundle: BundleInfo;
  attestations: Attestation[];
  published_by: ApiAuthor;
  published_at: string;
  downloads: number;
}

export interface ToolVersionInfo {
  name: string;
  version: string;
  description: string;
  license: string;
  yanked: boolean;
  yankReason?: string;
  yankReplacement?: string;
  yankedAt?: Date;
  manifest: Record<string, unknown>;
  bundle: {
    hash: string;
    size: number;
    downloadUrl: string;
  };
  attestations: Array<{
    auditor: string;
    auditorProvider: string;
    signedAt: Date;
    rekorLogId: string;
    verified: boolean;
  }>;
  publishedBy: {
    username: string;
    avatarUrl?: string;
  };
  publishedAt: Date;
  downloads: number;
}

// =============================================================================
// API Client
// =============================================================================

export class EnactApiClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private authToken: string | undefined;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "https://siikwkfgsmouioodghho.supabase.co/functions/v1";
    this.timeout = options.timeout ?? 30000;
    this.authToken = options.authToken;
  }

  setAuthToken(token: string | undefined): void {
    this.authToken = token;
  }

  getAuthToken(): string | undefined {
    return this.authToken;
  }

  isAuthenticated(): boolean {
    return this.authToken !== undefined;
  }

  private buildHeaders(): Headers {
    const headers = new Headers();
    headers.set("Accept", "application/json");
    headers.set("Content-Type", "application/json");

    if (this.authToken) {
      headers.set("Authorization", `Bearer ${this.authToken}`);
    }

    return headers;
  }

  async get<T>(path: string): Promise<{ data: T; status: number }> {
    const url = `${this.baseUrl}${path}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: this.buildHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as T;
      return { data, status: response.status };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async post<T>(path: string, body?: unknown): Promise<{ data: T; status: number }> {
    const url = `${this.baseUrl}${path}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.buildHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as T;
      return { data, status: response.status };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

// =============================================================================
// API Functions
// =============================================================================

interface RawSearchResponse {
  tools: ToolSearchResult[];
  total: number;
  limit: number;
  offset: number;
}

function toSearchResult(raw: ToolSearchResult): SearchResult {
  return {
    name: raw.name,
    description: raw.description,
    tags: raw.tags,
    version: raw.version,
    author: {
      username: raw.author.username,
      avatarUrl: raw.author.avatar_url,
    },
    downloads: raw.downloads,
    trustStatus: raw.trust_status ? { auditorCount: raw.trust_status.auditor_count } : undefined,
  };
}

export async function searchTools(
  client: EnactApiClient,
  options: SearchOptions
): Promise<SearchResponse> {
  const params = new URLSearchParams();

  params.set("q", options.query);

  if (options.tags) {
    const tagsStr = Array.isArray(options.tags) ? options.tags.join(",") : options.tags;
    params.set("tags", tagsStr);
  }

  if (options.limit !== undefined) {
    params.set("limit", String(Math.min(options.limit, 100)));
  }

  if (options.offset !== undefined) {
    params.set("offset", String(options.offset));
  }

  const response = await client.get<RawSearchResponse>(`/tools/search?${params.toString()}`);
  const results = response.data.tools.map(toSearchResult);

  return {
    results,
    total: response.data.total,
    limit: response.data.limit,
    offset: response.data.offset,
    hasMore: response.data.offset + results.length < response.data.total,
  };
}

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

export async function getToolInfo(client: EnactApiClient, name: string): Promise<ToolInfo> {
  const response = await client.get<ToolMetadata>(`/tools/${name}`);
  return toToolInfo(response.data);
}

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

export async function getToolVersion(
  client: EnactApiClient,
  name: string,
  version: string
): Promise<ToolVersionInfo> {
  const response = await client.get<ToolVersionDetails>(`/tools/${name}/versions/${version}`);
  return toToolVersionInfo(response.data);
}

// =============================================================================
// File Browsing
// =============================================================================

export interface ToolFile {
  path: string;
  size: number;
  type: "file" | "directory";
}

export interface ToolFilesResponse {
  files: ToolFile[];
  total: number;
}

export interface FileContentResponse {
  path: string;
  content: string;
  size: number;
  encoding: "utf-8" | "base64";
}

export interface UserProfile {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  public_tool_count: number;
}

export interface UserTool {
  name: string;
  description: string;
  tags: string[];
  license: string;
  visibility: "public" | "private" | "unlisted";
  version: string;
  downloads: number;
  created_at: string;
  updated_at: string;
}

export interface UserToolsResponse {
  tools: UserTool[];
  total: number;
  limit: number;
  offset: number;
  is_own_profile: boolean;
}

/**
 * Get list of files in a tool bundle
 */
export async function getToolFiles(
  client: EnactApiClient,
  name: string,
  version: string
): Promise<ToolFilesResponse> {
  const response = await client.get<ToolFilesResponse>(`/tools/${name}/versions/${version}/files`);
  return response.data;
}

/**
 * Get content of a specific file in a tool bundle
 */
export async function getFileContent(
  client: EnactApiClient,
  name: string,
  version: string,
  filePath: string
): Promise<FileContentResponse> {
  const encodedPath = encodeURIComponent(filePath);
  const response = await client.get<FileContentResponse>(
    `/tools/${name}/versions/${version}/files/${encodedPath}`
  );
  return response.data;
}

/**
 * Get user profile by username
 */
export async function getUserProfile(
  client: EnactApiClient,
  username: string
): Promise<UserProfile> {
  const response = await client.get<UserProfile>(`/tools/users/${username}`);
  return response.data;
}

/**
 * Get user's tools
 */
export async function getUserTools(
  client: EnactApiClient,
  username: string,
  options: { includePrivate?: boolean; limit?: number; offset?: number } = {}
): Promise<UserToolsResponse> {
  const params = new URLSearchParams();
  if (options.includePrivate) params.set("include_private", "true");
  if (options.limit) params.set("limit", options.limit.toString());
  if (options.offset) params.set("offset", options.offset.toString());

  const queryString = params.toString();
  const url = `/tools/users/${username}/tools${queryString ? `?${queryString}` : ""}`;
  const response = await client.get<UserToolsResponse>(url);
  return response.data;
}
