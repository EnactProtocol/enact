/**
 * enact inspect command
 *
 * Open a tool's page in the browser for inspection/review.
 * Use --download to download locally for deeper code review.
 * This allows reviewers to examine tool code before trusting it.
 */

import { mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createApiClient, downloadBundle, getToolInfo } from "@enactprotocol/api";
import { getCacheDir, loadConfig, pathExists } from "@enactprotocol/shared";
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import {
  EXIT_FAILURE,
  RegistryError,
  colors,
  confirm,
  dim,
  error,
  formatError,
  handleError,
  info,
  json,
  keyValue,
  newline,
  success,
  symbols,
  withSpinner,
} from "../../utils";

interface InspectOptions extends GlobalOptions {
  output?: string;
  force?: boolean;
  download?: boolean;
}

/**
 * Parse tool@version syntax
 */
function parseToolSpec(spec: string): { name: string; version: string | undefined } {
  const match = spec.match(/^(@[^@/]+\/[^@]+|[^@]+)(?:@(.+))?$/);
  if (match?.[1]) {
    return {
      name: match[1],
      version: match[2],
    };
  }
  return { name: spec, version: undefined };
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
}

/**
 * Extract a tar.gz bundle to a directory
 */
async function extractBundle(bundleData: ArrayBuffer, destPath: string): Promise<void> {
  const tempFile = join(getCacheDir(), `inspect-${Date.now()}.tar.gz`);
  mkdirSync(dirname(tempFile), { recursive: true });
  writeFileSync(tempFile, Buffer.from(bundleData));

  mkdirSync(destPath, { recursive: true });

  const proc = Bun.spawn(["tar", "-xzf", tempFile, "-C", destPath], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;

  try {
    unlinkSync(tempFile);
  } catch {
    // Ignore cleanup errors
  }

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to extract bundle: ${stderr}`);
  }
}

/**
 * Inspect command handler
 */
async function inspectHandler(
  toolSpec: string,
  options: InspectOptions,
  ctx: CommandContext
): Promise<void> {
  const { name: toolName, version } = parseToolSpec(toolSpec);

  const config = loadConfig();
  const registryUrl = config.registry?.url ?? "https://registry.enact.tools";

  // Default behavior: open in browser
  // Use --download to download locally instead
  if (!options.download) {
    const toolUrl = version
      ? `${registryUrl}/tools/${toolName}/v/${version}`
      : `${registryUrl}/tools/${toolName}`;

    info(`Opening ${toolName} in browser...`);

    // Open URL in default browser
    const openCmd =
      process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";

    const proc = Bun.spawn([openCmd, toolUrl], {
      stdout: "ignore",
      stderr: "ignore",
    });
    await proc.exited;

    if (options.json) {
      json({ opened: true, url: toolUrl });
    } else {
      success(`Opened: ${toolUrl}`);
    }
    return;
  }

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

  // Determine target version
  let targetVersion = version;

  try {
    if (!targetVersion) {
      const metadata = await withSpinner(
        `Fetching ${toolName} info...`,
        async () => getToolInfo(client, toolName),
        `${symbols.success} Found ${toolName}`
      );
      targetVersion = metadata.latestVersion;
    }
  } catch (err) {
    throw new RegistryError(`Failed to fetch tool info: ${formatError(err)}`);
  }

  // Determine output directory
  const outputDir = options.output
    ? resolve(ctx.cwd, options.output)
    : resolve(ctx.cwd, toolName.split("/").pop() ?? toolName);

  // Check if output already exists
  if (pathExists(outputDir) && !options.force) {
    if (ctx.isInteractive) {
      const shouldOverwrite = await confirm(`Directory ${outputDir} already exists. Overwrite?`);
      if (!shouldOverwrite) {
        info("Inspection cancelled.");
        return;
      }
      rmSync(outputDir, { recursive: true, force: true });
    } else {
      error(`Directory ${outputDir} already exists. Use --force to overwrite.`);
      process.exit(EXIT_FAILURE);
    }
  }

  // Download bundle (no trust verification - this is for inspection)
  let bundleResult: { data: ArrayBuffer; hash: string; size: number };
  try {
    bundleResult = await withSpinner(
      `Downloading ${toolName}@${targetVersion}...`,
      async () =>
        downloadBundle(client, {
          name: toolName,
          version: targetVersion!,
          verify: true,
        }),
      `${symbols.success} Downloaded`
    );
  } catch (err) {
    throw new RegistryError(`Failed to download bundle: ${formatError(err)}`);
  }

  // Extract to output directory
  try {
    await withSpinner(
      "Extracting...",
      async () => extractBundle(bundleResult.data, outputDir),
      `${symbols.success} Extracted`
    );
  } catch (err) {
    throw new RegistryError(`Failed to extract bundle: ${formatError(err)}`);
  }

  // Output result
  if (options.json) {
    json({
      inspected: true,
      tool: toolName,
      version: targetVersion,
      location: outputDir,
      hash: bundleResult.hash,
      size: bundleResult.size,
    });
    return;
  }

  newline();
  keyValue("Tool", toolName);
  keyValue("Version", targetVersion ?? "unknown");
  keyValue("Location", outputDir);
  keyValue("Size", formatBytes(bundleResult.size));
  keyValue("Hash", `${bundleResult.hash.substring(0, 20)}...`);
  newline();

  success(`Downloaded ${colors.bold(toolName)}@${targetVersion} for inspection`);
  newline();

  info("Next steps:");
  dim(`  cd ${outputDir}`);
  dim("  # Review the code, run security scans, test it");
  dim("  # If it passes review, sign it:");
  dim("  enact sign .");
  dim("  # Or report issues:");
  dim(`  enact report ${toolName}@${targetVersion} --reason "description"`);
}

/**
 * Configure the inspect command
 */
export function configureInspectCommand(program: Command): void {
  program
    .command("inspect <tool[@version]>")
    .description("Open a tool's page in browser for inspection (use --download to save locally)")
    .option("-d, --download", "Download tool locally instead of opening in browser")
    .option(
      "-o, --output <path>",
      "Output directory for download (default: tool name in current directory)"
    )
    .option("-f, --force", "Overwrite existing directory when downloading")
    .option("-v, --verbose", "Show detailed output")
    .option("--json", "Output result as JSON")
    .action(async (toolSpec: string, options: InspectOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await inspectHandler(toolSpec, options, ctx);
      } catch (err) {
        handleError(err, options.verbose ? { verbose: true } : undefined);
      }
    });
}
