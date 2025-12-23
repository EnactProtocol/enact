/**
 * enact search command
 *
 * Search the Enact registry for tools.
 * With --local or -g, search installed tools instead.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { type SearchResult, createApiClient, searchTools } from "@enactprotocol/api";
import {
  getProjectEnactDir,
  listInstalledTools,
  loadConfig,
  tryLoadManifestFromDir,
} from "@enactprotocol/shared";
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import {
  type TableColumn,
  dim,
  error,
  formatError,
  header,
  info,
  json,
  newline,
  table,
} from "../../utils";

interface SearchOptions extends GlobalOptions {
  tags?: string;
  limit?: string;
  offset?: string;
  threshold?: string;
  local?: boolean;
  global?: boolean;
}

interface SearchResultRow {
  name: string;
  version: string;
  description: string;
  rating: string;
  downloads: string;
  [key: string]: string;
}

/**
 * Format download count for display
 */
function formatDownloads(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return String(count);
}

/**
 * Truncate description to fit table
 */
function truncateDescription(desc: string, maxLen: number): string {
  if (desc.length <= maxLen) return desc;
  return `${desc.substring(0, maxLen - 3)}...`;
}

/**
 * Tool info from local search
 */
interface LocalToolInfo {
  name: string;
  version: string;
  description: string;
  location: string;
  scope: "project" | "global";
}

/**
 * Search installed tools locally
 */
function searchLocalTools(
  query: string,
  scope: "project" | "global",
  cwd: string
): LocalToolInfo[] {
  const tools: LocalToolInfo[] = [];
  const queryLower = query.toLowerCase();

  if (scope === "global") {
    // Search global tools via tools.json
    const installedTools = listInstalledTools("global");

    for (const tool of installedTools) {
      // Load manifest from cache to get description
      const loaded = tryLoadManifestFromDir(tool.cachePath);
      const name = tool.name.toLowerCase();
      const desc = (loaded?.manifest.description ?? "").toLowerCase();

      // Simple fuzzy matching: check if query terms appear in name or description
      const queryTerms = queryLower.split(/\s+/);
      const matches = queryTerms.every((term) => name.includes(term) || desc.includes(term));

      if (matches) {
        tools.push({
          name: tool.name,
          version: tool.version,
          description: loaded?.manifest.description ?? "-",
          location: tool.cachePath,
          scope: "global",
        });
      }
    }
    return tools;
  }

  // Search project tools by walking directory
  const projectDir = getProjectEnactDir(cwd);
  const baseDir = projectDir ? join(projectDir, "tools") : null;

  if (!baseDir || !existsSync(baseDir)) {
    return tools;
  }

  // Walk the tools directory structure
  function walkDir(dir: string): void {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const entryPath = join(dir, entry.name);

        // Try to load manifest from this directory
        const loaded = tryLoadManifestFromDir(entryPath);
        if (loaded) {
          const manifest = loaded.manifest;
          const name = manifest.name.toLowerCase();
          const desc = (manifest.description ?? "").toLowerCase();

          // Simple fuzzy matching: check if query terms appear in name or description
          const queryTerms = queryLower.split(/\s+/);
          const matches = queryTerms.every((term) => name.includes(term) || desc.includes(term));

          if (matches) {
            tools.push({
              name: manifest.name,
              version: manifest.version ?? "-",
              description: manifest.description ?? "-",
              location: entryPath,
              scope: "project",
            });
          }
        } else {
          // Recurse into subdirectories (for nested namespaces)
          walkDir(entryPath);
        }
      }
    } catch {
      // Ignore errors reading directories
    }
  }

  walkDir(baseDir);
  return tools;
}

/**
 * Search command handler
 */
async function searchHandler(
  query: string,
  options: SearchOptions,
  ctx: CommandContext
): Promise<void> {
  // Handle local search (--local or -g)
  if (options.local || options.global) {
    const scope = options.global ? "global" : "project";
    const results = searchLocalTools(query, scope, ctx.cwd);

    // JSON output
    if (options.json) {
      json({ query, scope, results, total: results.length });
      return;
    }

    // No results
    if (results.length === 0) {
      info(`No ${scope} tools found matching "${query}"`);
      dim(
        scope === "project"
          ? "Try 'enact search -g' to search global tools, or search the registry without flags"
          : "Try searching the registry without the -g flag"
      );
      return;
    }

    header(`${scope === "global" ? "Global" : "Project"} Tools matching "${query}"`);
    newline();

    const columns: TableColumn[] = [
      { key: "name", header: "Name", width: 28 },
      { key: "description", header: "Description", width: 50 },
    ];

    if (ctx.options.verbose) {
      columns.push({ key: "version", header: "Version", width: 10 });
      columns.push({ key: "location", header: "Location", width: 40 });
    }

    const rows = results.map((r) => ({
      name: r.name,
      description: truncateDescription(r.description, 48),
      version: r.version,
      location: r.location,
    }));

    table(rows, columns);
    newline();
    dim(`Found ${results.length} matching tool(s)`);
    return;
  }

  // Default: Registry search
  const config = loadConfig();
  const registryUrl =
    process.env.ENACT_REGISTRY_URL ??
    config.registry?.url ??
    "https://siikwkfgsmouioodghho.supabase.co/functions/v1";

  // Get auth token - try stored JWT first (for private tools), then fall back to config/env/anon
  const { getValidToken } = await import("../auth/index.js");
  let authToken: string | undefined = (await getValidToken()) ?? undefined;
  if (!authToken) {
    authToken = config.registry?.authToken ?? process.env.ENACT_AUTH_TOKEN;
  }
  // Fall back to anon key for unauthenticated public access
  if (!authToken && registryUrl.includes("siikwkfgsmouioodghho.supabase.co")) {
    authToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpaWt3a2Znc21vdWlvb2RnaGhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MTkzMzksImV4cCI6MjA4MDE5NTMzOX0.kxnx6-IPFhmGx6rzNx36vbyhFMFZKP_jFqaDbKnJ_E0";
  }

  const client = createApiClient({
    baseUrl: registryUrl,
    authToken: authToken,
  });

  const limit = options.limit ? Number.parseInt(options.limit, 10) : 20;
  const offset = options.offset ? Number.parseInt(options.offset, 10) : 0;
  const threshold = options.threshold ? Number.parseFloat(options.threshold) : undefined;

  if (ctx.options.verbose) {
    info(`Searching for: "${query}"`);
    if (options.tags) {
      info(`Tags: ${options.tags}`);
    }
    if (threshold !== undefined) {
      info(`Similarity threshold: ${threshold}`);
    }
  }

  try {
    const response = await searchTools(client, {
      query,
      tags: options.tags,
      limit,
      offset,
      threshold,
    });

    // Show search type in verbose mode
    if (ctx.options.verbose && response.searchType) {
      const searchTypeLabel =
        response.searchType === "hybrid" ? "semantic + text (hybrid)" : "text only (no OpenAI key)";
      info(`Search mode: ${searchTypeLabel}`);
    }

    // JSON output
    if (options.json) {
      json({
        query,
        results: response.results,
        total: response.total,
        limit: response.limit,
        offset: response.offset,
        hasMore: response.hasMore,
        searchType: response.searchType,
      });
      return;
    }

    // No results
    if (response.results.length === 0) {
      info(`No tools found matching "${query}"`);
      if (response.searchType === "text") {
        dim("Note: Semantic search unavailable (OpenAI key not configured on server)");
      }
      dim("Try a different search term or remove tag filters");
      return;
    }

    // Format results for table
    const rows: SearchResultRow[] = response.results.map((result: SearchResult) => ({
      name: result.name,
      version: result.version,
      description: truncateDescription(result.description, 40),
      rating: result.trustStatus ? `${result.trustStatus.auditorCount} ✓` : "-",
      downloads: formatDownloads(result.downloads),
    }));

    header(`Search Results for "${query}"`);
    newline();

    const columns: TableColumn[] = [
      { key: "name", header: "Name", width: 30 },
      { key: "version", header: "Version", width: 10 },
      { key: "description", header: "Description", width: 42 },
      { key: "rating", header: "Rating", width: 8 },
      { key: "downloads", header: "↓", width: 8 },
    ];

    table(rows, columns);
    newline();

    // Pagination info
    const showing = offset + response.results.length;
    dim(`Showing ${offset + 1}-${showing} of ${response.total} results`);

    if (response.hasMore) {
      dim(`Use --offset ${showing} to see more results`);
    }
  } catch (err) {
    // Handle specific error types
    if (err instanceof Error) {
      const message = err.message.toLowerCase();

      // Connection errors
      if (
        message.includes("fetch") ||
        message.includes("econnrefused") ||
        message.includes("network") ||
        message.includes("timeout") ||
        err.name === "AbortError"
      ) {
        error("Unable to connect to registry");
        dim("Check your internet connection or try again later");
        dim(`Registry URL: ${registryUrl}`);
        process.exit(1);
      }

      // JSON parsing errors (server returned non-JSON)
      if (message.includes("json") || message.includes("unexpected token")) {
        error("Registry returned an invalid response");
        dim("The server may be down or experiencing issues");
        dim(`Registry URL: ${registryUrl}`);
        process.exit(1);
      }
    }

    // Re-throw other errors
    throw err;
  }
}

/**
 * Configure the search command
 */
export function configureSearchCommand(program: Command): void {
  program
    .command("search <query>")
    .description("Search the Enact registry for tools")
    .option("--local", "Search project tools (.enact/tools/) instead of registry")
    .option("-g, --global", "Search global tools (~/.enact/tools/) instead of registry")
    .option("-t, --tags <tags>", "Filter by tags (comma-separated, registry only)")
    .option("-l, --limit <number>", "Maximum results to return (default: 20, registry only)")
    .option("-o, --offset <number>", "Pagination offset (default: 0, registry only)")
    .option(
      "--threshold <number>",
      "Similarity threshold for semantic search (0.0-1.0, default: 0.1)"
    )
    .option("-v, --verbose", "Show detailed output")
    .option("--json", "Output as JSON")
    .action(async (query: string, options: SearchOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await searchHandler(query, options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });
}
