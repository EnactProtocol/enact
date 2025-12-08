/**
 * Browser-only registry API client
 * Makes direct HTTP calls to the Enact registry without Node.js dependencies
 */

import { API_URL } from "./supabase";

export interface ToolSearchResult {
  name: string;
  description: string;
  owner: string;
  latestVersion: string;
  totalDownloads: number;
  tags?: string[];
  verified?: boolean;
}

export interface SearchResponse {
  tools: ToolSearchResult[];
  total: number;
  limit: number;
  offset: number;
}

export interface ToolAuthor {
  username: string;
  email?: string;
}

export interface ToolInfo {
  name: string;
  owner: string;
  description: string;
  latestVersion: string;
  totalDownloads: number;
  tags?: string[];
  license?: string;
  author: ToolAuthor;
  versions: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ToolVersionInfo {
  version: string;
  hash: string;
  size: number;
  yanked: boolean;
  createdAt: string;
}

/**
 * Search for tools in the registry
 */
export async function searchTools(
  query = "",
  options: {
    limit?: number;
    offset?: number;
    tags?: string[];
  } = {}
): Promise<SearchResponse> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (options.limit) params.set("limit", options.limit.toString());
  if (options.offset) params.set("offset", options.offset.toString());
  if (options.tags?.length) params.set("tags", options.tags.join(","));

  const response = await fetch(`${API_URL}/tools/search?${params}`);
  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get detailed information about a tool
 */
export async function getToolInfo(toolName: string): Promise<ToolInfo> {
  const response = await fetch(`${API_URL}/tools/${encodeURIComponent(toolName)}`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    throw new Error(`Failed to fetch tool info: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get information about a specific tool version
 */
export async function getToolVersion(toolName: string, version: string): Promise<ToolVersionInfo> {
  const response = await fetch(
    `${API_URL}/tools/${encodeURIComponent(toolName)}/versions/${version}`
  );
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Version not found: ${toolName}@${version}`);
    }
    throw new Error(`Failed to fetch version info: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get the source code for a tool
 */
export async function getToolSource(
  toolName: string,
  version: string
): Promise<{
  files: Record<string, string>;
  manifest: string;
}> {
  const response = await fetch(
    `${API_URL}/tools/${encodeURIComponent(toolName)}/versions/${version}/source`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch source: ${response.statusText}`);
  }

  return response.json();
}
