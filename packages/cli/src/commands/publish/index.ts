/**
 * enact publish command
 *
 * Publish a tool to the Enact registry using v2 multipart upload.
 * Supports pre-signed attestations via manifest-based signing.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { createApiClient, publishTool } from "@enactprotocol/api";
import { getSecret } from "@enactprotocol/secrets";
import {
  type LoadedManifest,
  type ToolManifest,
  loadConfig,
  loadManifest,
  loadManifestFromDir,
  validateManifest,
} from "@enactprotocol/shared";
import {
  type ChecksumManifest,
  type SigstoreBundle,
  parseChecksumManifest,
  verifyChecksumManifest,
} from "@enactprotocol/trust";
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import {
  confirm,
  dim,
  error,
  extractNamespace,
  formatError,
  getCurrentUsername,
  header,
  info,
  json,
  keyValue,
  newline,
  success,
  warning,
  withSpinner,
} from "../../utils";
import { loadGitignore, shouldIgnore } from "../../utils/ignore";

/** Auth namespace for token storage */
const AUTH_NAMESPACE = "enact:auth";
const ACCESS_TOKEN_KEY = "access_token";

/** Tool visibility levels */
export type ToolVisibility = "public" | "private" | "unlisted";

interface PublishOptions extends GlobalOptions {
  dryRun?: boolean;
  tag?: string;
  skipAuth?: boolean;
  public?: boolean;
  unlisted?: boolean;
}

/**
 * Recursively collect all files in a directory
 */
function collectFiles(
  dir: string,
  baseDir: string,
  files: Array<{ path: string; relativePath: string }> = [],
  ignorePatterns: string[] = []
): Array<{ path: string; relativePath: string }> {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = relative(baseDir, fullPath);

    // Check if file should be ignored
    if (shouldIgnore(relativePath, entry.name, ignorePatterns)) {
      continue;
    }

    if (entry.isDirectory()) {
      collectFiles(fullPath, baseDir, files, ignorePatterns);
    } else if (entry.isFile()) {
      files.push({ path: fullPath, relativePath });
    }
  }

  return files;
}

/**
 * Create a tar.gz bundle from the tool directory
 */
async function createBundleFromDir(toolDir: string): Promise<Uint8Array> {
  // Load gitignore patterns (ALWAYS_IGNORE is already checked in shouldIgnore)
  const gitignorePatterns = loadGitignore(toolDir);

  // Collect all files to include (respecting ignore patterns)
  const files = collectFiles(toolDir, toolDir, [], gitignorePatterns);

  // Use tar to create the bundle (available on all supported platforms)
  const tempDir = join(process.env.TMPDIR ?? "/tmp", `enact-bundle-${Date.now()}`);
  const tempBundle = join(tempDir, "bundle.tar.gz");

  const { mkdirSync, rmSync } = await import("node:fs");
  mkdirSync(tempDir, { recursive: true });

  try {
    // Create tar.gz using tar command
    const fileList = files.map((f) => f.relativePath).join("\n");
    const fileListPath = join(tempDir, "files.txt");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(fileListPath, fileList);

    // Use COPYFILE_DISABLE=1 to prevent macOS from adding AppleDouble (._) files
    const proc = Bun.spawn(["tar", "-czf", tempBundle, "-C", toolDir, "-T", fileListPath], {
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        COPYFILE_DISABLE: "1", // Prevents macOS extended attributes/resource forks
      },
    });

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`Failed to create bundle: ${stderr}`);
    }

    // Read the bundle
    const bundleData = readFileSync(tempBundle);
    return new Uint8Array(bundleData);
  } finally {
    // Clean up temp files
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Load the raw markdown manifest file content (full documentation with frontmatter)
 * Checks for SKILL.md first (preferred), then falls back to enact.md
 */
function loadRawManifest(toolDir: string): string | undefined {
  // Check SKILL.md first (preferred format)
  const skillMdPath = join(toolDir, "SKILL.md");
  if (existsSync(skillMdPath)) {
    return readFileSync(skillMdPath, "utf-8");
  }
  // Fall back to enact.md
  const enactMdPath = join(toolDir, "enact.md");
  if (existsSync(enactMdPath)) {
    return readFileSync(enactMdPath, "utf-8");
  }
  return undefined;
}

/**
 * Load and validate manifest from file or directory
 */
async function loadAndValidateManifest(
  pathArg: string,
  ctx: CommandContext
): Promise<{ manifest: ToolManifest; toolDir: string }> {
  const fullPath = resolve(ctx.cwd, pathArg);

  if (!existsSync(fullPath)) {
    throw new Error(`Path not found: ${fullPath}`);
  }

  // Load manifest - handle both files and directories
  let loaded: LoadedManifest | undefined;
  const stats = statSync(fullPath);
  if (stats.isDirectory()) {
    loaded = loadManifestFromDir(fullPath);
  } else {
    loaded = loadManifest(fullPath);
  }

  if (!loaded) {
    throw new Error(`Could not load manifest from: ${fullPath}`);
  }

  // Validate manifest
  const validation = validateManifest(loaded.manifest);
  if (!validation.valid) {
    const errors = validation.errors?.map((e) => `  - ${e}`).join("\n");
    throw new Error(`Invalid manifest:\n${errors}`);
  }

  return {
    manifest: loaded.manifest,
    toolDir: dirname(loaded.filePath),
  };
}

/**
 * Publish command handler
 */
async function publishHandler(
  pathArg: string,
  options: PublishOptions,
  ctx: CommandContext
): Promise<void> {
  // Load and validate manifest
  const { manifest, toolDir } = await loadAndValidateManifest(pathArg, ctx);

  const toolName = manifest.name;
  const version = manifest.version ?? "0.0.0";

  header(`Publishing ${toolName}@${version}`);
  newline();

  // Check for pre-signed attestation (manifest-based signing)
  const checksumManifestPath = join(toolDir, ".enact-manifest.json");
  const sigstoreBundlePath = join(toolDir, ".sigstore-bundle.json");

  let checksumManifest: ChecksumManifest | undefined;
  let sigstoreBundle: SigstoreBundle | undefined;
  let hasPreSignedAttestation = false;

  if (existsSync(checksumManifestPath) && existsSync(sigstoreBundlePath)) {
    info("Found pre-signed attestation files");

    try {
      // Load and parse the checksum manifest
      const manifestContent = readFileSync(checksumManifestPath, "utf-8");
      checksumManifest = parseChecksumManifest(manifestContent);

      // Load the sigstore bundle
      const bundleContent = readFileSync(sigstoreBundlePath, "utf-8");
      sigstoreBundle = JSON.parse(bundleContent) as SigstoreBundle;

      // Verify the checksum manifest matches current files
      const ignorePatterns = loadGitignore(toolDir);
      const verification = await verifyChecksumManifest(toolDir, checksumManifest, {
        ignorePatterns,
      });

      if (!verification.valid) {
        newline();
        warning("Pre-signed attestation is outdated - files have changed since signing:");
        if (verification.modifiedFiles?.length) {
          for (const file of verification.modifiedFiles) {
            dim(`  • Modified: ${file}`);
          }
        }
        if (verification.missingFiles?.length) {
          for (const file of verification.missingFiles) {
            dim(`  • Missing: ${file}`);
          }
        }
        if (verification.extraFiles?.length) {
          for (const file of verification.extraFiles) {
            dim(`  • New file: ${file}`);
          }
        }
        newline();

        if (ctx.isInteractive) {
          const continueWithoutAttestation = await confirm(
            "Continue publishing without the pre-signed attestation?",
            false
          );
          if (!continueWithoutAttestation) {
            info("Publishing cancelled. Please re-sign with 'enact sign .' after making changes.");
            return;
          }
          // Clear the attestation since it's outdated
          checksumManifest = undefined;
          sigstoreBundle = undefined;
        } else {
          error("Pre-signed attestation does not match current files.");
          dim(
            "Please re-sign with 'enact sign .' or remove .enact-manifest.json and .sigstore-bundle.json"
          );
          process.exit(1);
        }
      } else {
        hasPreSignedAttestation = true;
        keyValue("Attestation", "Pre-signed (valid)");
        keyValue("Manifest hash", `${checksumManifest.manifestHash.digest.slice(0, 16)}...`);
        keyValue("Files in attestation", String(checksumManifest.files.length));
      }
    } catch (err) {
      warning("Failed to load pre-signed attestation:");
      if (err instanceof Error) {
        dim(`  ${err.message}`);
      }
      dim("Continuing without attestation...");
      checksumManifest = undefined;
      sigstoreBundle = undefined;
    }
  }

  // Determine visibility (private by default for security)
  const visibility: ToolVisibility = options.public
    ? "public"
    : options.unlisted
      ? "unlisted"
      : "private";

  // Show what we're publishing
  keyValue("Name", toolName);
  keyValue("Version", version);
  keyValue("Description", manifest.description);
  keyValue("Visibility", visibility);
  if (manifest.tags && manifest.tags.length > 0) {
    keyValue("Tags", manifest.tags.join(", "));
  }
  newline();

  // Pre-flight namespace check (skip in local dev mode)
  if (!options.skipAuth) {
    const currentUsername = await getCurrentUsername();
    if (currentUsername) {
      const toolNamespace = extractNamespace(toolName);
      if (toolNamespace !== currentUsername) {
        error(
          `Namespace mismatch: Tool namespace "${toolNamespace}" does not match your username "${currentUsername}".`
        );
        newline();
        dim("You can only publish tools under your own namespace.");
        dim("Either:");
        dim(
          `  1. Change the tool name to "${currentUsername}/${toolName.split("/").slice(1).join("/")}" in your enact.md`
        );
        dim(`  2. Or login as a user with the "${toolNamespace}" username`);
        process.exit(1);
      }
    }
  }

  // Get registry URL from config or environment
  const config = loadConfig();
  const registryUrl =
    process.env.ENACT_REGISTRY_URL ??
    config.registry?.url ??
    "https://siikwkfgsmouioodghho.supabase.co/functions/v1";

  if (options.verbose) {
    keyValue("Registry", registryUrl);
  }

  // Check for auth token from keyring (skip in local dev mode)
  let authToken: string | undefined;
  if (options.skipAuth) {
    warning("Skipping authentication (local development mode)");
    // For local dev, use the Supabase anon key from environment or default local key
    authToken =
      process.env.SUPABASE_ANON_KEY ??
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
  } else {
    const secretToken = await getSecret(AUTH_NAMESPACE, ACCESS_TOKEN_KEY);
    authToken = secretToken ?? undefined;
    if (!authToken) {
      // Check config registry authToken
      authToken = config.registry?.authToken;
    }
    if (!authToken) {
      // Also check environment variable for CI/local dev
      authToken = process.env.ENACT_AUTH_TOKEN;
    }
    if (!authToken) {
      // Fallback to official registry anon key if using official registry
      if (registryUrl.includes("siikwkfgsmouioodghho.supabase.co")) {
        authToken =
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpaWt3a2Znc21vdWlvb2RnaGhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MTkzMzksImV4cCI6MjA4MDE5NTMzOX0.kxnx6-IPFhmGx6rzNx36vbyhFMFZKP_jFqaDbKnJ_E0";
      }
    }
    if (!authToken) {
      error("Not authenticated. Please run: enact auth login");
      dim("Or set ENACT_AUTH_TOKEN environment variable");
      dim("Or use --skip-auth for local development");
      process.exit(1);
    }
  }

  const client = createApiClient({ baseUrl: registryUrl });
  if (authToken) {
    client.setAuthToken(authToken);
  }

  // Dry run mode
  if (options.dryRun) {
    warning("Dry run mode - not actually publishing");
    newline();
    info("Would publish to registry:");
    keyValue("Tool", toolName);
    keyValue("Version", version);
    keyValue("Visibility", visibility);
    keyValue("Source", toolDir);

    // Show files that would be bundled
    const files = collectFiles(toolDir, toolDir);
    info(`Would bundle ${files.length} files`);
    if (options.verbose) {
      for (const file of files.slice(0, 10)) {
        dim(`  ${file.relativePath}`);
      }
      if (files.length > 10) {
        dim(`  ... and ${files.length - 10} more`);
      }
    }
    return;
  }

  // Load the full markdown manifest content (SKILL.md or enact.md)
  const rawManifestContent = loadRawManifest(toolDir);
  if (rawManifestContent) {
    info("Found markdown documentation (SKILL.md or enact.md)");
  }

  // Create bundle
  const bundle = await withSpinner("Creating bundle...", async () => {
    return await createBundleFromDir(toolDir);
  });

  info(`Bundle size: ${(bundle.length / 1024).toFixed(1)} KB`);

  // Publish to registry using v2 multipart API
  const result = await withSpinner("Publishing to registry...", async () => {
    return await publishTool(client, {
      name: toolName,
      manifest: manifest as unknown as Record<string, unknown>,
      bundle,
      rawManifest: rawManifestContent,
      visibility,
      // Include pre-signed attestation if available (cast to Record for API compatibility)
      checksumManifest: hasPreSignedAttestation
        ? (checksumManifest as unknown as Record<string, unknown>)
        : undefined,
      sigstoreBundle: hasPreSignedAttestation
        ? (sigstoreBundle as unknown as Record<string, unknown>)
        : undefined,
    });
  });

  // JSON output
  if (options.json) {
    json({
      ...result,
      hasAttestation: hasPreSignedAttestation,
    });
    return;
  }

  // Success output
  newline();
  success(`Published ${result.name}@${result.version} (${visibility})`);
  keyValue("Bundle Hash", result.bundleHash);
  keyValue("Published At", result.publishedAt.toISOString());
  if (hasPreSignedAttestation) {
    keyValue("Attestation", "Included (pre-signed)");
  }
  newline();
  if (visibility === "private") {
    dim("This tool is private - only you can access it.");
  } else if (visibility === "unlisted") {
    dim("This tool is unlisted - accessible via direct link, not searchable.");
  }
  dim(`Install with: enact install ${toolName}`);

  if (!hasPreSignedAttestation) {
    newline();
    info("Tip: Sign your tool before publishing for verified attestations:");
    dim(`  1. enact sign ${pathArg}    # Create pre-signed attestation`);
    dim(`  2. enact publish ${pathArg}  # Publish with attestation`);
  }
}

/**
 * Configure the publish command
 */
export function configurePublishCommand(program: Command): void {
  program
    .command("publish [path]")
    .description("Publish a tool to the Enact registry")
    .option("-n, --dry-run", "Show what would be published without publishing")
    .option("-t, --tag <tag>", "Add a release tag (e.g., latest, beta)")
    .option("-v, --verbose", "Show detailed output")
    .option("--skip-auth", "Skip authentication (for local development)")
    .option("--json", "Output as JSON")
    .option("--public", "Publish as public (searchable by everyone)")
    .option("--unlisted", "Publish as unlisted (accessible via direct link, not searchable)")
    .action(async (pathArg: string | undefined, options: PublishOptions) => {
      const resolvedPath = pathArg ?? ".";
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await publishHandler(resolvedPath, options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });
}
