/**
 * Tool search functionality
 * Implements semantic search via registry API
 */

import type { EnactApiClient } from "./client";
import type { ToolSearchResult } from "./types";

/**
 * Search options
 */
export interface SearchOptions {
  /** Search query (semantic) */
  query: string;
  /** Filter by tags (comma-separated or array) */
  tags?: string | string[] | undefined;
  /** Maximum results (default: 20, max: 100) */
  limit?: number | undefined;
  /** Pagination offset */
  offset?: number | undefined;
  /** Similarity threshold for semantic search (0.0 to 1.0, default: 0.3) */
  threshold?: number | undefined;
}

/**
 * Single search result with parsed data (v2)
 */
export interface SearchResult {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Tool tags */
  tags: string[];
  /** Latest version */
  version: string;
  /** Author */
  author: {
    username: string;
    avatarUrl?: string | undefined;
  };
  /** Download count */
  downloads: number;
  /** Trust status */
  trustStatus?:
    | {
        auditorCount: number;
      }
    | undefined;
}

/**
 * Search response with pagination info
 */
export interface SearchResponse {
  /** Search results */
  results: SearchResult[];
  /** Total matching tools */
  total: number;
  /** Results limit used */
  limit: number;
  /** Results offset used */
  offset: number;
  /** Whether more results are available */
  hasMore: boolean;
  /** Search type used: "hybrid" (semantic+text) or "text" (fallback) */
  searchType?: "hybrid" | "text" | undefined;
}

/**
 * Raw API search response v2
 */
interface RawSearchResponse {
  tools: ToolSearchResult[];
  total: number;
  limit: number;
  offset: number;
  search_type?: "hybrid" | "text";
}

/**
 * Convert raw API result to clean SearchResult
 */
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
    trustStatus: raw.trust_status
      ? {
          auditorCount: raw.trust_status.auditor_count,
        }
      : undefined,
  };
}

/**
 * Search for tools in the registry
 *
 * @param client - API client instance
 * @param options - Search options
 * @returns Search results with pagination
 *
 * @example
 * ```ts
 * const client = createApiClient();
 * const results = await searchTools(client, {
 *   query: "pdf extraction",
 *   tags: ["ai", "document"],
 *   limit: 10
 * });
 * ```
 */
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

  if (options.threshold !== undefined) {
    // Clamp threshold between 0 and 1
    const threshold = Math.max(0, Math.min(1, options.threshold));
    params.set("threshold", String(threshold));
  }

  const response = await client.get<RawSearchResponse>(`/tools/search?${params.toString()}`);

  const results = response.data.tools.map(toSearchResult);

  return {
    results,
    total: response.data.total,
    limit: response.data.limit,
    offset: response.data.offset,
    hasMore: response.data.offset + results.length < response.data.total,
    searchType: response.data.search_type,
  };
}
