/**
 * enact install command
 *
 * Install a tool to the project or globally.
 * All tools are extracted to ~/.enact/cache/{tool}/{version}/
 * - Project install: Adds entry to .enact/tools.json
 * - Global install: Adds entry to ~/.enact/tools.json
 *
 * Supports local paths and registry tools with verification.
 */

import { cpSync, existsSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  type AttestationListResponse,
  type ToolVersionInfo,
  createApiClient,
  downloadBundle,
  getAttestationList,
  getToolInfo,
  getToolVersion,
  verifyAllAttestations,
} from "@enactprotocol/api";
import {
  addMcpTool,
  addToolToRegistry,
  getCacheDir,
  getInstalledVersion,
  getMinimumAttestations,
  getProjectEnactDir,
  getToolCachePath,
  getTrustPolicy,
  getTrustedAuditors,
  loadConfig,
  loadManifestFromDir,
  pathExists,
} from "@enactprotocol/shared";
// Trust verification is done using @enactprotocol/api functions
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import {
  EXIT_FAILURE,
  EXIT_TRUST_ERROR,
  ManifestError,
  RegistryError,
  TrustError,
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
  suggest,
  symbols,
  withSpinner,
} from "../../utils";

interface InstallOptions extends GlobalOptions {
  global?: boolean;
  force?: boolean;
  allowYanked?: boolean;
}

/**
 * Parse tool@version syntax
 */
function parseToolSpec(spec: string): { name: string; version: string | undefined } {
  // Handle scoped packages like @scope/tool@version
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
 * Copy a directory recursively
 */
function copyDir(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
}

/**
 * Check if a tool name looks like a local path
 * Local paths start with ./, ../, or /
 */
function isLocalPath(toolName: string): boolean {
  return (
    toolName === "." ||
    toolName.startsWith("./") ||
    toolName.startsWith("../") ||
    toolName.startsWith("/")
  );
}

/**
 * Extract a tar.gz bundle to a directory
 * Uses tar command (available on all supported platforms)
 */
async function extractBundle(bundleData: ArrayBuffer, destPath: string): Promise<void> {
  // Create a temporary file for the bundle
  const tempFile = join(getCacheDir(), `bundle-${Date.now()}.tar.gz`);
  mkdirSync(dirname(tempFile), { recursive: true });
  writeFileSync(tempFile, Buffer.from(bundleData));

  // Create destination directory
  mkdirSync(destPath, { recursive: true });

  // Extract using tar command (available on all supported platforms)
  const proc = Bun.spawn(["tar", "-xzf", tempFile, "-C", destPath], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;

  // Clean up temp file
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
 * Install from the registry
 */
async function installFromRegistry(
  toolName: string,
  version: string | undefined,
  options: InstallOptions,
  ctx: CommandContext
): Promise<void> {
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

  // Get tool info to find latest version if not specified
  let targetVersion = version;
  let toolInfo: ToolVersionInfo;

  try {
    if (!targetVersion) {
      // Fetch tool metadata to get latest version
      const metadata = await withSpinner(
        `Fetching ${toolName} info...`,
        async () => getToolInfo(client, toolName),
        `${symbols.success} Found ${toolName}`
      );
      targetVersion = metadata.latestVersion;
    }

    // Get version-specific info
    toolInfo = await withSpinner(
      `Fetching ${toolName}@${targetVersion} details...`,
      async () => getToolVersion(client, toolName, targetVersion!),
      `${symbols.success} Got version details`
    );
  } catch (err) {
    throw new RegistryError(`Failed to fetch tool info: ${formatError(err)}`);
  }

  // Check if version is yanked
  if (toolInfo.yanked) {
    const yankMessage = toolInfo.yankReason
      ? `Version ${targetVersion} has been yanked: ${toolInfo.yankReason}`
      : `Version ${targetVersion} has been yanked`;

    if (options.allowYanked) {
      info(`${symbols.warning} ${yankMessage}`);
      if (toolInfo.yankReplacement) {
        dim(`  Recommended replacement: ${toolInfo.yankReplacement}`);
      }
    } else if (ctx.isInteractive) {
      info(`${symbols.warning} ${yankMessage}`);
      if (toolInfo.yankReplacement) {
        info(`Recommended replacement: ${toolInfo.yankReplacement}`);
        const useReplacement = await confirm(`Install ${toolInfo.yankReplacement} instead?`);
        if (useReplacement) {
          // Recursively install the replacement version
          return installFromRegistry(toolName, toolInfo.yankReplacement, options, ctx);
        }
      }
      const proceed = await confirm("Install yanked version anyway?");
      if (!proceed) {
        info("Installation cancelled.");
        process.exit(0);
      }
    } else {
      error(`${yankMessage}`);
      if (toolInfo.yankReplacement) {
        info(`Recommended replacement: ${toolInfo.yankReplacement}`);
        suggest(`Run: enact install ${toolName}@${toolInfo.yankReplacement}`);
      }
      info("Use --allow-yanked to install yanked versions.");
      process.exit(EXIT_FAILURE);
    }
  }

  // Check trust policy - fetch and verify attestations
  try {
    const trustPolicy = getTrustPolicy();
    const minimumAttestations = getMinimumAttestations();
    const trustedAuditors = getTrustedAuditors();

    // Fetch attestations from registry
    const attestationsResponse: AttestationListResponse = await getAttestationList(
      client,
      toolName,
      targetVersion!
    );
    const attestations = attestationsResponse.attestations;

    if (attestations.length === 0) {
      // No attestations found
      info(`${symbols.warning} Tool ${toolName}@${targetVersion} has no attestations.`);

      if (trustPolicy === "require_attestation") {
        error("Trust policy requires attestations. Installation blocked.");
        info("Configure trust policy in ~/.enact/config.yaml");
        process.exit(EXIT_TRUST_ERROR);
      } else if (ctx.isInteractive && trustPolicy === "prompt") {
        const proceed = await confirm("Install unverified tool?");
        if (!proceed) {
          info("Installation cancelled.");
          process.exit(0);
        }
      } else if (!ctx.isInteractive && trustPolicy === "prompt") {
        error("Cannot install unverified tools in non-interactive mode.");
        info("Run interactively to confirm installation.");
        process.exit(EXIT_TRUST_ERROR);
      }
      // trustPolicy === "allow" - continue without prompting
    } else {
      // Verify attestations locally (never trust registry's verification status)
      const verifiedAuditors = await verifyAllAttestations(
        client,
        toolName,
        targetVersion!,
        toolInfo.bundle?.hash ?? ""
      );

      // Check verified auditors against trust config using provider:identity format
      const trustedVerifiedAuditors = verifiedAuditors
        .filter((auditor) => trustedAuditors.includes(auditor.providerIdentity))
        .map((auditor) => auditor.providerIdentity);

      if (trustedVerifiedAuditors.length > 0) {
        // Check if we meet minimum attestations threshold
        if (trustedVerifiedAuditors.length < minimumAttestations) {
          info(
            `${symbols.warning} Tool ${toolName}@${targetVersion} has ${trustedVerifiedAuditors.length} trusted attestation(s), but ${minimumAttestations} required.`
          );
          dim(`Trusted attestations: ${trustedVerifiedAuditors.join(", ")}`);

          if (trustPolicy === "require_attestation") {
            error(
              `Trust policy requires at least ${minimumAttestations} attestation(s) from trusted identities. Installation blocked.`
            );
            suggest("Run 'enact trust <identity>' to add more trusted identities");
            process.exit(EXIT_TRUST_ERROR);
          } else if (ctx.isInteractive && trustPolicy === "prompt") {
            const proceed = await confirm("Install with fewer attestations than required?");
            if (!proceed) {
              info("Installation cancelled.");
              process.exit(0);
            }
          } else if (!ctx.isInteractive && trustPolicy === "prompt") {
            error(
              "Cannot install tool without meeting minimum attestation requirement in non-interactive mode."
            );
            process.exit(EXIT_TRUST_ERROR);
          }
          // trustPolicy === "allow" - continue without prompting
        } else {
          // Tool meets or exceeds minimum attestations
          if (options.verbose) {
            success(
              `Tool verified by ${trustedVerifiedAuditors.length} trusted identity(ies): ${trustedVerifiedAuditors.join(", ")}`
            );
          }
        }
      } else {
        // Has attestations but none from trusted auditors
        info(
          `${symbols.warning} Tool ${toolName}@${targetVersion} has ${verifiedAuditors.length} attestation(s), but none from trusted auditors.`
        );

        if (trustPolicy === "require_attestation") {
          error(
            "Trust policy requires attestations from trusted identities. Installation blocked."
          );
          dim(`Your trusted auditors: ${trustedAuditors.join(", ")}`);
          dim(`Tool attested by: ${verifiedAuditors.map((a) => a.providerIdentity).join(", ")}`);
          suggest("Run 'enact trust <auditor>' to add a trusted auditor");
          process.exit(EXIT_TRUST_ERROR);
        } else if (ctx.isInteractive && trustPolicy === "prompt") {
          dim(`Attested by: ${verifiedAuditors.map((a) => a.providerIdentity).join(", ")}`);
          dim(`Your trusted auditors: ${trustedAuditors.join(", ")}`);
          const proceed = await confirm("Install anyway?");
          if (!proceed) {
            info("Installation cancelled.");
            process.exit(0);
          }
        } else if (!ctx.isInteractive && trustPolicy === "prompt") {
          error("Cannot install tool without trusted attestations in non-interactive mode.");
          process.exit(EXIT_TRUST_ERROR);
        }
        // trustPolicy === "allow" - continue without prompting
      }
    }
  } catch (err) {
    if (options.verbose) {
      dim(`Trust check failed: ${formatError(err)}`);
    }
    // Continue with installation if trust check fails (with warning)
    info(`${symbols.warning} Could not verify trust status. Proceeding with caution.`);
  }

  // Download bundle
  let bundleResult: { data: ArrayBuffer; hash: string; size: number };
  try {
    bundleResult = await withSpinner(
      `Downloading ${toolName}@${targetVersion}...`,
      async () =>
        downloadBundle(client, {
          name: toolName,
          version: targetVersion!,
          verify: true,
          acknowledgeYanked: toolInfo.yanked === true || options.allowYanked === true,
        }),
      `${symbols.success} Downloaded`
    );
  } catch (err) {
    throw new RegistryError(`Failed to download bundle: ${formatError(err)}`);
  }

  // Verify hash if provided
  if (toolInfo.bundle?.hash) {
    const downloadedHash = bundleResult.hash.replace("sha256:", "");
    const expectedHash = toolInfo.bundle.hash.replace("sha256:", "");

    if (downloadedHash !== expectedHash) {
      throw new TrustError(
        `Bundle hash mismatch! The downloaded file may be corrupted or tampered with.${options.verbose ? `\nExpected: ${expectedHash}\nGot: ${downloadedHash}` : ""}`
      );
    }
  }

  // All installs: extract to cache and update tools.json
  const isGlobal = options.global ?? false;
  const scope = isGlobal ? "global" : "project";
  const cachePath = getToolCachePath(toolName, targetVersion!);

  // Check if already installed in the target scope
  const existingVersion = getInstalledVersion(toolName, scope, isGlobal ? undefined : ctx.cwd);
  if (existingVersion && !options.force) {
    if (existingVersion === targetVersion) {
      info(
        `Tool ${toolName}@${targetVersion} is already installed ${isGlobal ? "globally" : "in this project"}.`
      );
      return;
    }
    if (ctx.isInteractive) {
      const shouldOverwrite = await confirm(
        `Tool ${toolName}@${existingVersion} is installed. Update to ${targetVersion}?`
      );
      if (!shouldOverwrite) {
        info("Installation cancelled.");
        return;
      }
    } else {
      error(`Tool ${toolName}@${existingVersion} is already installed. Use --force to update.`);
      process.exit(EXIT_FAILURE);
    }
  }

  // Extract bundle to cache
  try {
    await withSpinner(
      `Extracting ${toolName}...`,
      async () => {
        // Remove existing directory if force
        if (pathExists(cachePath)) {
          rmSync(cachePath, { recursive: true, force: true });
        }
        await extractBundle(bundleResult.data, cachePath);
      },
      `${symbols.success} Extracted to ${cachePath}`
    );
  } catch (err) {
    throw new RegistryError(`Failed to extract bundle: ${formatError(err)}`);
  }

  // Update tools.json for the appropriate scope
  addToolToRegistry(toolName, targetVersion!, scope, isGlobal ? undefined : ctx.cwd);

  // Also add to MCP registry for global installs
  if (isGlobal) {
    addMcpTool(toolName, targetVersion!);
  }

  // Output result
  if (options.json) {
    json({
      installed: true,
      tool: toolName,
      version: targetVersion,
      location: cachePath,
      scope,
      hash: bundleResult.hash,
      size: bundleResult.size,
      verified: true,
    });
    return;
  }

  newline();
  keyValue("Tool", toolName);
  keyValue("Version", targetVersion ?? "unknown");
  keyValue("Location", cachePath);
  keyValue("Scope", isGlobal ? "global (~/.enact/tools.json)" : "project (.enact/tools.json)");
  keyValue("Size", formatBytes(bundleResult.size));
  keyValue("Hash", `${bundleResult.hash.substring(0, 20)}...`);
  newline();
  success(`Installed ${colors.bold(toolName)}@${targetVersion}`);
}

/**
 * Install from a local path
 *
 * Both global and project installs:
 * 1. Copy tool to cache (~/.enact/cache/{tool}/{version}/)
 * 2. Update tools.json (global: ~/.enact/tools.json, project: .enact/tools.json)
 */
async function installFromPath(
  sourcePath: string,
  options: InstallOptions,
  ctx: CommandContext
): Promise<void> {
  const resolvedPath = resolve(ctx.cwd, sourcePath);

  // Load manifest from source
  const loaded = loadManifestFromDir(resolvedPath);
  if (!loaded) {
    throw new ManifestError(`No valid manifest found in: ${resolvedPath}`);
  }

  const manifest = loaded.manifest;
  const isGlobal = options.global ?? false;
  const version = manifest.version ?? "0.0.0";
  const scope = isGlobal ? "global" : "project";

  // All tools go to cache
  const cachePath = getToolCachePath(manifest.name, version);

  // Check if already installed in the target scope
  const existingVersion = getInstalledVersion(manifest.name, scope, isGlobal ? undefined : ctx.cwd);
  if (existingVersion && !options.force) {
    if (existingVersion === version) {
      info(
        `Tool ${manifest.name}@${version} is already installed ${isGlobal ? "globally" : "in this project"}.`
      );
      return;
    }
    if (ctx.isInteractive) {
      const shouldOverwrite = await confirm(
        `Tool ${manifest.name}@${existingVersion} is installed. Update to ${version}?`
      );
      if (!shouldOverwrite) {
        info("Installation cancelled.");
        return;
      }
    } else {
      error(
        `Tool ${manifest.name}@${existingVersion} is already installed. Use --force to update.`
      );
      process.exit(EXIT_FAILURE);
    }
  }

  // Copy tool to cache
  await withSpinner(
    `Installing ${manifest.name}...`,
    async () => {
      if (pathExists(cachePath)) {
        rmSync(cachePath, { recursive: true, force: true });
      }
      mkdirSync(dirname(cachePath), { recursive: true });
      copyDir(resolvedPath, cachePath);
    },
    `${symbols.success} Installed ${manifest.name}`
  );

  // Update tools.json for the appropriate scope
  addToolToRegistry(manifest.name, version, scope, isGlobal ? undefined : ctx.cwd);

  // Also add to MCP registry for global installs
  if (isGlobal) {
    addMcpTool(manifest.name, version);
  }

  if (options.json) {
    json({
      installed: true,
      tool: manifest.name,
      version: manifest.version,
      location: cachePath,
      scope,
    });
    return;
  }

  newline();
  keyValue("Tool", manifest.name);
  keyValue("Version", manifest.version ?? "unversioned");
  keyValue("Location", cachePath);
  keyValue("Scope", isGlobal ? "global (~/.enact/tools.json)" : "project (.enact/tools.json)");
  newline();
  success(`Installed ${colors.bold(manifest.name)}`);
}

/**
 * Install from a tool name (registry tool)
 */
async function installFromName(
  toolSpec: string,
  options: InstallOptions,
  ctx: CommandContext
): Promise<void> {
  const { name: toolName, version } = parseToolSpec(toolSpec);

  // If it looks like a local path, use installFromPath
  if (isLocalPath(toolName)) {
    return installFromPath(toolName, options, ctx);
  }

  // Otherwise, it's a registry tool - fetch from registry
  return installFromRegistry(toolName, version, options, ctx);
}

/**
 * Install all tools from project .enact/tools.json
 */
async function installProjectTools(options: InstallOptions, ctx: CommandContext): Promise<void> {
  const projectDir = getProjectEnactDir(ctx.cwd);

  if (!projectDir) {
    info("No .enact/ directory found. Nothing to install.");
    suggest("Run 'enact install <tool>' to install a specific tool.");
    return;
  }

  const toolsJsonPath = join(projectDir, "tools.json");

  if (!existsSync(toolsJsonPath)) {
    info("No .enact/tools.json found. Nothing to install.");
    suggest("Run 'enact install <tool>' to install a specific tool.");
    return;
  }

  // Parse tools.json
  let toolsConfig: { tools?: Record<string, string> };
  try {
    const content = await Bun.file(toolsJsonPath).text();
    toolsConfig = JSON.parse(content);
  } catch (err) {
    throw new ManifestError(`Failed to parse .enact/tools.json: ${formatError(err)}`);
  }

  if (!toolsConfig.tools || Object.keys(toolsConfig.tools).length === 0) {
    info("No tools specified in .enact/tools.json");
    return;
  }

  // Install each tool
  const tools = Object.entries(toolsConfig.tools);
  info(`Installing ${tools.length} tool(s) from tools.json...`);
  newline();

  let installed = 0;
  let failed = 0;

  for (const [toolName, toolVersion] of tools) {
    try {
      const toolSpec = toolVersion ? `${toolName}@${toolVersion}` : toolName;
      await installFromName(toolSpec, { ...options, json: false }, ctx);
      installed++;
    } catch (err) {
      error(`Failed to install ${toolName}: ${formatError(err)}`);
      failed++;
    }
  }

  newline();
  if (failed === 0) {
    success(`Installed all ${installed} tool(s) successfully`);
  } else {
    info(`Installed ${installed} tool(s), ${failed} failed`);
  }

  if (options.json) {
    json({
      installed,
      failed,
      total: tools.length,
    });
  }
}

/**
 * Install command handler
 */
async function installHandler(
  tool: string | undefined,
  options: InstallOptions,
  ctx: CommandContext
): Promise<void> {
  // If no tool specified, install from project
  if (!tool) {
    return installProjectTools(options, ctx);
  }

  // Check if it's a path
  if (tool === "." || tool.startsWith("./") || tool.startsWith("/") || tool.startsWith("..")) {
    return installFromPath(tool, options, ctx);
  }

  // Otherwise, try to resolve as tool name (local or registry)
  return installFromName(tool, options, ctx);
}

/**
 * Configure the install command
 */
export function configureInstallCommand(program: Command): void {
  program
    .command("install")
    .alias("i")
    .description("Install a tool to the project or globally")
    .argument("[tool]", "Tool to install (name[@version], path, or '.' for current directory)")
    .option("-g, --global", "Install globally (adds to ~/.enact/tools.json)")
    .option("-f, --force", "Overwrite existing installation")
    .option("--allow-yanked", "Allow installing yanked versions")
    .option("-v, --verbose", "Show detailed output")
    .option("--json", "Output result as JSON")
    .action(async (tool: string | undefined, options: InstallOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await installHandler(tool, options, ctx);
      } catch (err) {
        handleError(err, options.verbose ? { verbose: true } : undefined);
      }
    });
}
