/**
 * enact cache command
 *
 * Manage the local tool cache.
 */

import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { getCacheDir, tryLoadManifestFromDir } from "@enactprotocol/shared";
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import {
  type TableColumn,
  confirm,
  dim,
  error,
  formatError,
  header,
  info,
  json,
  keyValue,
  newline,
  success,
  table,
  warning,
} from "../../utils";

interface CacheOptions extends GlobalOptions {
  force?: boolean;
}

interface CachedTool {
  name: string;
  version: string;
  size: string;
  path: string;
  [key: string]: string;
}

/**
 * Format bytes to human readable
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Get directory size recursively
 */
function getDirSize(dirPath: string): number {
  let size = 0;
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        size += getDirSize(entryPath);
      } else {
        size += statSync(entryPath).size;
      }
    }
  } catch {
    // Ignore errors
  }
  return size;
}

/**
 * List cached tools
 */
function listCachedTools(cacheDir: string): CachedTool[] {
  const tools: CachedTool[] = [];

  if (!existsSync(cacheDir)) {
    return tools;
  }

  function walkDir(dir: string, prefix = ""): void {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const entryPath = join(dir, entry.name);
        const toolName = prefix ? `${prefix}/${entry.name}` : entry.name;

        const loaded = tryLoadManifestFromDir(entryPath);
        if (loaded) {
          const size = getDirSize(entryPath);
          tools.push({
            name: loaded.manifest.name,
            version: loaded.manifest.version ?? "-",
            size: formatSize(size),
            path: entryPath,
          });
        } else {
          walkDir(entryPath, toolName);
        }
      }
    } catch {
      // Ignore errors
    }
  }

  walkDir(cacheDir);
  return tools;
}

/**
 * Cache list handler
 */
async function listHandler(options: CacheOptions, _ctx: CommandContext): Promise<void> {
  const cacheDir = getCacheDir();
  const tools = listCachedTools(cacheDir);

  if (options.json) {
    json({ cacheDir, tools, count: tools.length });
    return;
  }

  header("Cached Tools");
  newline();

  if (tools.length === 0) {
    info("No tools cached.");
    dim(`Cache directory: ${cacheDir}`);
    return;
  }

  const columns: TableColumn[] = [
    { key: "name", header: "Name", width: 35 },
    { key: "version", header: "Version", width: 12 },
    { key: "size", header: "Size", width: 10 },
  ];

  if (options.verbose) {
    columns.push({ key: "path", header: "Path", width: 50 });
  }

  table(tools, columns);
  newline();

  const totalSize = tools.reduce((sum, t) => {
    const match = t.size.match(/^([\d.]+)\s*(\w+)$/);
    if (!match) return sum;
    const [, num, unit] = match;
    const multipliers: Record<string, number> = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
    };
    return sum + Number.parseFloat(num ?? "0") * (multipliers[unit ?? "B"] ?? 1);
  }, 0);

  dim(`Total: ${tools.length} tool(s), ${formatSize(totalSize)}`);
  dim(`Cache directory: ${cacheDir}`);
}

/**
 * Cache clean handler - remove old/unused tools
 */
async function cleanHandler(options: CacheOptions, ctx: CommandContext): Promise<void> {
  const cacheDir = getCacheDir();
  const tools = listCachedTools(cacheDir);

  if (tools.length === 0) {
    info("Cache is already empty.");
    return;
  }

  // For now, clean removes everything (future: could be smarter)
  if (!options.force && ctx.isInteractive) {
    const shouldProceed = await confirm(`Remove ${tools.length} cached tool(s)?`);
    if (!shouldProceed) {
      info("Cancelled.");
      return;
    }
  }

  let removed = 0;
  for (const tool of tools) {
    try {
      rmSync(tool.path, { recursive: true, force: true });
      removed++;
      if (options.verbose) {
        dim(`Removed: ${tool.name}@${tool.version}`);
      }
    } catch {
      warning(`Failed to remove: ${tool.path}`);
    }
  }

  if (options.json) {
    json({ removed, total: tools.length });
    return;
  }

  success(`Removed ${removed} cached tool(s)`);
}

/**
 * Cache clear handler - remove entire cache
 */
async function clearHandler(options: CacheOptions, ctx: CommandContext): Promise<void> {
  const cacheDir = getCacheDir();

  if (!existsSync(cacheDir)) {
    info("Cache directory does not exist.");
    return;
  }

  const size = getDirSize(cacheDir);

  if (!options.force && ctx.isInteractive) {
    const shouldProceed = await confirm(`Clear entire cache (${formatSize(size)})?`);
    if (!shouldProceed) {
      info("Cancelled.");
      return;
    }
  }

  try {
    rmSync(cacheDir, { recursive: true, force: true });

    if (options.json) {
      json({ cleared: true, size: formatSize(size) });
      return;
    }

    success(`Cleared cache (${formatSize(size)})`);
  } catch (err) {
    error(`Failed to clear cache: ${formatError(err)}`);
    process.exit(1);
  }
}

/**
 * Cache info handler
 */
async function infoHandler(options: CacheOptions, _ctx: CommandContext): Promise<void> {
  const cacheDir = getCacheDir();
  const exists = existsSync(cacheDir);
  const tools = exists ? listCachedTools(cacheDir) : [];
  const size = exists ? getDirSize(cacheDir) : 0;

  if (options.json) {
    json({
      directory: cacheDir,
      exists,
      toolCount: tools.length,
      totalSize: size,
      totalSizeFormatted: formatSize(size),
    });
    return;
  }

  header("Cache Information");
  newline();

  keyValue("Directory", cacheDir);
  keyValue("Exists", exists ? "Yes" : "No");
  keyValue("Tools", String(tools.length));
  keyValue("Total Size", formatSize(size));
}

/**
 * Configure the cache command
 */
export function configureCacheCommand(program: Command): void {
  const cache = program.command("cache").description("Manage the local tool cache");

  cache
    .command("list")
    .alias("ls")
    .description("List cached tools")
    .option("-v, --verbose", "Show detailed output including paths")
    .option("--json", "Output as JSON")
    .action(async (options: CacheOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await listHandler(options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });

  cache
    .command("clean")
    .description("Remove old or unused cached tools")
    .option("-f, --force", "Skip confirmation")
    .option("-v, --verbose", "Show detailed output")
    .option("--json", "Output as JSON")
    .action(async (options: CacheOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await cleanHandler(options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });

  cache
    .command("clear")
    .description("Clear the entire cache")
    .option("-f, --force", "Skip confirmation")
    .option("--json", "Output as JSON")
    .action(async (options: CacheOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await clearHandler(options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });

  cache
    .command("info")
    .description("Show cache information")
    .option("--json", "Output as JSON")
    .action(async (options: CacheOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await infoHandler(options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });
}
