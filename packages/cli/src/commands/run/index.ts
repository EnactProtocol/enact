/**
 * enact run command
 *
 * Execute a tool in its container environment with the manifest-defined command.
 *
 * Resolution order:
 * 1. Check local sources (project → user → cache)
 * 2. If not found and --local not set, fetch from registry to cache
 * 3. Run from resolved location (never copies to installed tools)
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import * as clack from "@clack/prompts";
import {
  type AttestationListResponse,
  createApiClient,
  downloadBundle,
  getAttestationList,
  getToolInfo,
  getToolVersion,
  verifyAllAttestations,
} from "@enactprotocol/api";
import { DaggerExecutionProvider, type ExecutionResult } from "@enactprotocol/execution";
import { resolveSecrets, resolveToolEnv } from "@enactprotocol/secrets";
import {
  type ToolManifest,
  type ToolResolution,
  applyDefaults,
  getCacheDir,
  getMinimumAttestations,
  getTrustPolicy,
  getTrustedAuditors,
  loadConfig,
  prepareCommand,
  toolNameToPath,
  tryResolveTool,
  tryResolveToolDetailed,
  validateInputs,
} from "@enactprotocol/shared";
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import {
  EXIT_EXECUTION_ERROR,
  ManifestError,
  ToolNotFoundError,
  TrustError,
  ValidationError,
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

interface RunOptions extends GlobalOptions {
  args?: string;
  inputFile?: string;
  input?: string[];
  timeout?: string;
  noCache?: boolean;
  local?: boolean;
  remote?: boolean;
  verbose?: boolean;
  output?: string;
  apply?: boolean;
  debug?: boolean;
}

/**
 * Parse input arguments from various formats
 *
 * Priority order (later sources override earlier):
 * 1. --input-file (JSON file)
 * 2. --args (inline JSON)
 * 3. --input (key=value pairs)
 *
 * Recommended for agents: Use --args or --input-file with JSON
 */
function parseInputArgs(
  argsJson: string | undefined,
  inputFile: string | undefined,
  inputFlags: string[] | undefined
): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};

  // Parse --input-file JSON file (loaded first, can be overridden)
  if (inputFile) {
    try {
      const { readFileSync, existsSync } = require("node:fs");
      const { resolve } = require("node:path");
      const filePath = resolve(inputFile);

      if (!existsSync(filePath)) {
        throw new Error(`Input file not found: ${inputFile}`);
      }

      const content = readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content);
      if (typeof parsed === "object" && parsed !== null) {
        Object.assign(inputs, parsed);
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Input file not found")) {
        throw err;
      }
      throw new Error(`Invalid JSON in input file: ${formatError(err)}`);
    }
  }

  // Parse --args JSON (overrides file)
  if (argsJson) {
    try {
      const parsed = JSON.parse(argsJson);
      if (typeof parsed === "object" && parsed !== null) {
        Object.assign(inputs, parsed);
      }
    } catch (err) {
      throw new Error(`Invalid JSON in --args: ${formatError(err)}`);
    }
  }

  // Parse --input key=value pairs (overrides both)
  if (inputFlags) {
    for (const input of inputFlags) {
      const eqIndex = input.indexOf("=");
      if (eqIndex === -1) {
        throw new Error(`Invalid input format: "${input}". Expected key=value`);
      }
      const key = input.slice(0, eqIndex);
      const value = input.slice(eqIndex + 1);

      // Try to parse as JSON for complex values
      try {
        inputs[key] = JSON.parse(value);
      } catch {
        inputs[key] = value;
      }
    }
  }

  return inputs;
}

/**
 * Input path configuration (file or directory)
 */
interface InputPathConfig {
  /** Absolute path on host */
  path: string;
  /** Whether it's a file or directory */
  type: "file" | "directory";
  /** Named input (for multi-input support, e.g., "left" from --input left=./path) */
  name?: string;
}

/**
 * Parse --input flags to separate key=value parameters from directory/file paths
 *
 * The --input flag is overloaded to handle both:
 * 1. Key=value parameters: --input name=Alice --input count=5
 * 2. Directory/file paths: --input ./data --input left=./old
 *
 * Detection logic:
 * - If value contains '=' and doesn't start with './' or '/' → key=value param
 * - If value is a path (starts with ./, ../, /) → input path
 * - If value exists as a path on disk → input path
 * - Named input: name=./path where path exists → named input
 */
function parseInputPaths(inputs: string[] | undefined): {
  params: Record<string, unknown>;
  inputPaths: InputPathConfig[];
} {
  if (!inputs) return { params: {}, inputPaths: [] };

  const params: Record<string, unknown> = {};
  const inputPaths: InputPathConfig[] = [];

  for (const input of inputs) {
    const eqIndex = input.indexOf("=");

    // Check if it's a path (no = or starts with path chars)
    const looksLikePath =
      input.startsWith("./") ||
      input.startsWith("../") ||
      input.startsWith("/") ||
      (eqIndex === -1 && existsSync(input));

    if (looksLikePath) {
      // Simple path: --input ./data
      const absolutePath = resolve(input);
      if (!existsSync(absolutePath)) {
        throw new Error(`Input path does not exist: ${input}`);
      }
      const stat = statSync(absolutePath);
      inputPaths.push({
        path: absolutePath,
        type: stat.isDirectory() ? "directory" : "file",
      });
    } else if (eqIndex > 0) {
      const key = input.slice(0, eqIndex);
      const value = input.slice(eqIndex + 1);

      // Check if value is a path (named input like left=./old)
      const valueLooksLikePath =
        value.startsWith("./") ||
        value.startsWith("../") ||
        value.startsWith("/") ||
        existsSync(value);

      if (valueLooksLikePath && existsSync(value)) {
        // Named input path: --input left=./old
        const absolutePath = resolve(value);
        const stat = statSync(absolutePath);
        inputPaths.push({
          path: absolutePath,
          type: stat.isDirectory() ? "directory" : "file",
          name: key,
        });
      } else {
        // Key=value parameter: --input name=Alice
        try {
          params[key] = JSON.parse(value);
        } catch {
          params[key] = value;
        }
      }
    } else {
      // No = sign and doesn't exist as path - treat as error
      throw new Error(`Invalid input: "${input}". Expected key=value or a valid path.`);
    }
  }

  return { params, inputPaths };
}

/**
 * Atomically replace directory contents with new contents
 *
 * Process:
 * 1. Create backup of original directory
 * 2. Copy new contents to original location
 * 3. Remove backup on success, or restore on failure
 *
 * @param targetDir - Directory to replace contents of
 * @param sourceDir - Directory containing new contents
 */
function atomicReplace(targetDir: string, sourceDir: string): void {
  const backupDir = `${targetDir}.backup-${Date.now()}`;

  try {
    // Step 1: Backup original
    if (existsSync(targetDir)) {
      renameSync(targetDir, backupDir);
    }

    // Step 2: Move new contents to target
    // We copy instead of rename because source might be on different filesystem (temp)
    mkdirSync(targetDir, { recursive: true });
    const entries = readdirSync(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = join(sourceDir, entry.name);
      const destPath = join(targetDir, entry.name);
      cpSync(srcPath, destPath, { recursive: true });
    }

    // Step 3: Remove backup on success
    if (existsSync(backupDir)) {
      rmSync(backupDir, { recursive: true, force: true });
    }
  } catch (err) {
    // Restore backup on failure
    if (existsSync(backupDir)) {
      if (existsSync(targetDir)) {
        rmSync(targetDir, { recursive: true, force: true });
      }
      renameSync(backupDir, targetDir);
    }
    throw err;
  }
}

/**
 * Extract a bundle to the cache directory
 */
async function extractToCache(
  bundleData: ArrayBuffer,
  toolName: string,
  version: string
): Promise<string> {
  const cacheDir = getCacheDir();
  const toolPath = toolNameToPath(toolName);
  const versionDir = join(cacheDir, toolPath, `v${version.replace(/^v/, "")}`);

  // Create a temporary file for the bundle
  const tempFile = join(cacheDir, `bundle-${Date.now()}.tar.gz`);
  mkdirSync(dirname(tempFile), { recursive: true });
  writeFileSync(tempFile, Buffer.from(bundleData));

  // Create destination directory
  mkdirSync(versionDir, { recursive: true });

  // Extract using tar command
  const proc = Bun.spawn(["tar", "-xzf", tempFile, "-C", versionDir], {
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

  return versionDir;
}

/**
 * Parse tool@version syntax
 */
function parseToolSpec(spec: string): { name: string; version: string | undefined } {
  // Handle namespace/tool@version format
  const match = spec.match(/^([^@]+)(?:@(.+))?$/);
  if (match?.[1]) {
    return {
      name: match[1],
      version: match[2]?.replace(/^v/, ""), // Remove leading 'v' if present
    };
  }
  return { name: spec, version: undefined };
}

/**
 * Fetch a tool from the registry and cache it
 * Verifies attestations according to trust policy before caching
 * Returns ToolResolution if successful
 */
async function fetchAndCacheTool(
  toolSpec: string,
  options: RunOptions,
  ctx: CommandContext
): Promise<ToolResolution> {
  const { name: toolName, version: requestedVersion } = parseToolSpec(toolSpec);

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

  const client = createApiClient({ baseUrl: registryUrl, authToken });

  // Get tool info to find latest version or use requested version
  const toolInfo = await getToolInfo(client, toolName);
  const targetVersion = requestedVersion ?? toolInfo.latestVersion;

  if (!targetVersion) {
    throw new Error(`No published versions for ${toolName}`);
  }

  // Try loading from cache first
  const cached = tryResolveTool(toolName, {
    skipProject: true,
    skipUser: true,
    version: targetVersion,
  });
  if (cached) {
    return cached;
  }

  // Get version details
  const versionInfo = await getToolVersion(client, toolName, targetVersion);

  // Check if version is yanked
  if (versionInfo.yanked && !options.verbose) {
    const yankMessage = versionInfo.yankReason
      ? `Version ${targetVersion} has been yanked: ${versionInfo.yankReason}`
      : `Version ${targetVersion} has been yanked`;
    info(`${symbols.warning} ${yankMessage}`);
    if (versionInfo.yankReplacement) {
      dim(`  Recommended: ${versionInfo.yankReplacement}`);
    }
  }

  // ========================================
  // TRUST VERIFICATION - same as install
  // ========================================
  const trustPolicy = getTrustPolicy();
  const minimumAttestations = getMinimumAttestations();
  const trustedAuditors = getTrustedAuditors();

  // Fetch attestations from registry
  const attestationsResponse: AttestationListResponse = await getAttestationList(
    client,
    toolName,
    targetVersion
  );
  const attestations = attestationsResponse.attestations;

  if (attestations.length === 0) {
    // No attestations found
    info(`${symbols.warning} Tool ${toolName}@${targetVersion} has no attestations.`);

    if (trustPolicy === "require_attestation") {
      throw new TrustError("Trust policy requires attestations. Execution blocked.");
    }
    if (ctx.isInteractive && trustPolicy === "prompt") {
      const proceed = await confirm("Run unverified tool?");
      if (!proceed) {
        info("Execution cancelled.");
        process.exit(0);
      }
    } else if (!ctx.isInteractive && trustPolicy === "prompt") {
      throw new TrustError("Cannot run unverified tools in non-interactive mode.");
    }
    // trustPolicy === "allow" - continue without prompting
  } else {
    // Verify attestations locally (never trust registry's verification status)
    const verifiedAuditors = await verifyAllAttestations(
      client,
      toolName,
      targetVersion,
      versionInfo.bundle.hash ?? ""
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
          throw new TrustError(
            `Trust policy requires at least ${minimumAttestations} attestation(s) from trusted identities.`
          );
        }
        if (ctx.isInteractive && trustPolicy === "prompt") {
          const proceed = await confirm("Run with fewer attestations than required?");
          if (!proceed) {
            info("Execution cancelled.");
            process.exit(0);
          }
        } else if (!ctx.isInteractive && trustPolicy === "prompt") {
          throw new TrustError(
            "Cannot run tool without meeting minimum attestation requirement in non-interactive mode."
          );
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
        dim(`Your trusted auditors: ${trustedAuditors.join(", ")}`);
        dim(`Tool attested by: ${verifiedAuditors.map((a) => a.providerIdentity).join(", ")}`);
        throw new TrustError(
          "Trust policy requires attestations from trusted identities. Execution blocked."
        );
      }
      if (ctx.isInteractive && trustPolicy === "prompt") {
        dim(`Attested by: ${verifiedAuditors.map((a) => a.providerIdentity).join(", ")}`);
        dim(`Your trusted auditors: ${trustedAuditors.join(", ")}`);
        const proceed = await confirm("Run anyway?");
        if (!proceed) {
          info("Execution cancelled.");
          process.exit(0);
        }
      } else if (!ctx.isInteractive && trustPolicy === "prompt") {
        throw new TrustError(
          "Cannot run tool without trusted attestations in non-interactive mode."
        );
      }
      // trustPolicy === "allow" - continue without prompting
    }
  }

  // ========================================
  // Download and cache the bundle
  // ========================================
  const bundleResult = await downloadBundle(client, {
    name: toolName,
    version: targetVersion,
    verify: true,
    acknowledgeYanked: versionInfo.yanked,
  });

  // Verify hash
  if (versionInfo.bundle.hash) {
    const downloadedHash = bundleResult.hash.replace("sha256:", "");
    const expectedHash = versionInfo.bundle.hash.replace("sha256:", "");
    if (downloadedHash !== expectedHash) {
      throw new TrustError("Bundle hash mismatch - download may be corrupted or tampered with");
    }
  }

  // Extract to cache
  const extractedDir = await extractToCache(bundleResult.data, toolName, targetVersion);

  // Resolve the cached tool
  const resolution = tryResolveTool(toolName, {
    skipProject: true,
    skipUser: true,
    version: targetVersion,
  });

  if (!resolution) {
    throw new Error(`Failed to resolve cached tool at ${extractedDir}`);
  }

  return resolution;
}

/**
 * Display dry run information
 */
function displayDryRun(
  manifest: ToolManifest,
  inputs: Record<string, unknown>,
  command: string[],
  env: Record<string, string>,
  inputPaths: InputPathConfig[],
  outputPath: string | undefined,
  apply?: boolean
): void {
  newline();
  info(colors.bold("Dry Run Preview"));
  newline();

  keyValue("Tool", manifest.name);
  keyValue("Version", manifest.version ?? "unversioned");
  keyValue("Container", manifest.from ?? "alpine:latest");
  newline();

  if (Object.keys(inputs).length > 0) {
    info("Parameters:");
    for (const [key, value] of Object.entries(inputs)) {
      dim(`  ${key}: ${JSON.stringify(value)}`);
    }
    newline();
  }

  if (Object.keys(env).length > 0) {
    info("Environment:");
    for (const [key] of Object.entries(env)) {
      dim(`  ${key}: ***`);
    }
    newline();
  }

  if (inputPaths.length > 0) {
    info("Input:");
    for (const input of inputPaths) {
      const target = input.name
        ? `/inputs/${input.name}`
        : input.type === "file"
          ? `/input/${basename(input.path)}`
          : "/input";
      dim(`  ${input.path} → ${target} (${input.type})`);
    }
    newline();
  }

  if (outputPath) {
    info("Output:");
    dim(`  /output → ${outputPath}`);
    if (apply) {
      dim(`  ${colors.warning("(--apply)")} Changes will be atomically applied to ${outputPath}`);
    }
    newline();
  }

  info("Command:");
  dim(`  ${command.join(" ")}`);
  newline();
}

/**
 * Display debug information about parameter resolution
 */
function displayDebugInfo(
  manifest: ToolManifest,
  rawInputs: Record<string, unknown>,
  inputsWithDefaults: Record<string, unknown>,
  finalInputs: Record<string, unknown>,
  env: Record<string, string>,
  command: string[]
): void {
  newline();
  info(colors.bold("Debug: Parameter Resolution"));
  newline();

  // Show schema information
  if (manifest.inputSchema?.properties) {
    info("Schema Properties:");
    const required = new Set(manifest.inputSchema.required || []);
    for (const [name, prop] of Object.entries(manifest.inputSchema.properties)) {
      const propSchema = prop as { type?: string; default?: unknown; description?: string };
      const isRequired = required.has(name);
      const hasDefault = propSchema.default !== undefined;
      const status = isRequired ? colors.error("required") : colors.dim("optional");
      dim(
        `  ${name}: ${propSchema.type || "any"} [${status}]${hasDefault ? ` (default: ${JSON.stringify(propSchema.default)})` : ""}`
      );
    }
    newline();
  }

  // Show raw inputs (what was provided)
  info("Raw Inputs (provided by user):");
  if (Object.keys(rawInputs).length === 0) {
    dim("  (none)");
  } else {
    for (const [key, value] of Object.entries(rawInputs)) {
      dim(`  ${key}: ${JSON.stringify(value)}`);
    }
  }
  newline();

  // Show inputs after defaults applied
  info("After Defaults Applied:");
  for (const [key, value] of Object.entries(inputsWithDefaults)) {
    const wasDefault = rawInputs[key] === undefined;
    dim(`  ${key}: ${JSON.stringify(value)}${wasDefault ? colors.dim(" (default)") : ""}`);
  }
  newline();

  // Show final inputs (after coercion)
  info("Final Inputs (after validation/coercion):");
  for (const [key, value] of Object.entries(finalInputs)) {
    dim(`  ${key}: ${JSON.stringify(value)}`);
  }
  newline();

  // Show environment variables
  if (Object.keys(env).length > 0) {
    info("Environment Variables:");
    for (const [key, value] of Object.entries(env)) {
      // Mask potentially sensitive values
      const isSensitive =
        key.toLowerCase().includes("secret") ||
        key.toLowerCase().includes("key") ||
        key.toLowerCase().includes("token") ||
        key.toLowerCase().includes("password");
      dim(`  ${key}=${isSensitive ? "***" : value}`);
    }
    newline();
  }

  // Show final command
  info("Final Command:");
  dim(`  ${command.join(" ")}`);
  newline();
}

/**
 * Display execution result
 */
function displayResult(result: ExecutionResult, options: RunOptions): void {
  if (options.json) {
    json(result);
    return;
  }

  if (result.success) {
    if (result.output?.stdout) {
      // Print stdout directly (most common use case)
      process.stdout.write(result.output.stdout);
      // Ensure newline at end
      if (!result.output.stdout.endsWith("\n")) {
        newline();
      }
    }

    if (options.verbose && result.output?.stderr) {
      dim(`stderr: ${result.output.stderr}`);
    }

    if (options.verbose && result.metadata) {
      newline();
      dim(`Duration: ${result.metadata.durationMs}ms`);
      dim(`Exit code: ${result.output?.exitCode ?? 0}`);
    }
  } else {
    error(`Execution failed: ${result.error?.message ?? "Unknown error"}`);

    // Show stdout if present (useful for debugging - command may have printed before failing)
    if (result.output?.stdout?.trim()) {
      newline();
      info("stdout:");
      console.log(result.output.stdout);
    }

    // Show stderr (the actual error output)
    if (result.output?.stderr?.trim()) {
      newline();
      error("stderr:");
      console.log(result.output.stderr);
    }

    // Show additional error details if present (and different from stderr)
    if (result.error?.details) {
      const detailsStr = JSON.stringify(result.error.details, null, 2);
      // Only show if it adds new information (not just duplicating stderr)
      const stderrInDetails = result.error.details.stderr;
      if (!stderrInDetails || stderrInDetails !== result.output?.stderr) {
        newline();
        dim("Additional details:");
        dim(detailsStr);
      }
    }
  }
}

/**
 * Run command handler
 */
async function runHandler(tool: string, options: RunOptions, ctx: CommandContext): Promise<void> {
  let resolution: ToolResolution | null = null;
  let resolveResult: ReturnType<typeof tryResolveToolDetailed> | null = null;

  // Check if --remote flag is valid (requires namespace/name format)
  const isRegistryFormat = tool.includes("/") && !tool.startsWith("/") && !tool.startsWith(".");
  if (options.remote && !isRegistryFormat) {
    throw new ValidationError(
      `--remote requires a registry tool name (e.g., user/tool), got: ${tool}`
    );
  }

  // Skip local resolution if --remote is set
  if (!options.remote) {
    // First, try to resolve locally (project → user → cache)
    if (!options.verbose) {
      resolveResult = tryResolveToolDetailed(tool, { startDir: ctx.cwd });
      resolution = resolveResult.resolution;
    } else {
      const spinner = clack.spinner();
      spinner.start(`Resolving tool: ${tool}`);
      resolveResult = tryResolveToolDetailed(tool, { startDir: ctx.cwd });
      resolution = resolveResult.resolution;
      if (resolution) {
        spinner.stop(`${symbols.success} Resolved: ${tool}`);
      } else {
        spinner.stop(`${symbols.info} Checking registry...`);
      }
    }

    // If manifest was found but had errors, throw a descriptive error immediately
    if (!resolution && resolveResult?.manifestFound && resolveResult?.error) {
      const errorMessage = resolveResult.error.message;
      const manifestPath = resolveResult.manifestPath;
      throw new ManifestError(
        `Invalid manifest${manifestPath ? ` at ${manifestPath}` : ""}: ${errorMessage}`
      );
    }
  }

  // If not found locally and --local flag not set, try fetching from registry
  if (!resolution && !options.local) {
    // Check if this looks like a tool name (namespace/name format)
    if (isRegistryFormat) {
      resolution = !options.verbose
        ? await fetchAndCacheTool(tool, options, ctx)
        : await withSpinner(
            `Fetching ${tool} from registry...`,
            async () => fetchAndCacheTool(tool, options, ctx),
            `${symbols.success} Cached: ${tool}`
          );
    }
  }

  if (!resolution) {
    if (options.local) {
      throw new ToolNotFoundError(tool, {
        localOnly: true,
        ...(resolveResult?.searchedLocations && {
          searchedLocations: resolveResult.searchedLocations,
        }),
      });
    }
    throw new ToolNotFoundError(tool, {
      ...(resolveResult?.searchedLocations && {
        searchedLocations: resolveResult.searchedLocations,
      }),
    });
  }

  const manifest = resolution.manifest;

  // Parse --input flags to separate key=value params from path inputs
  const { params: pathParams, inputPaths } = parseInputPaths(options.input);

  // Parse other input sources (--args, --input-file)
  const otherInputs = parseInputArgs(options.args, options.inputFile, undefined);

  // Merge inputs: path params override other inputs
  const inputs = { ...otherInputs, ...pathParams };

  // Apply defaults from schema
  const inputsWithDefaults = manifest.inputSchema
    ? applyDefaults(inputs, manifest.inputSchema)
    : inputs;

  // Validate inputs against schema
  const validation = validateInputs(inputsWithDefaults, manifest.inputSchema);
  if (!validation.valid) {
    const errors = validation.errors.map((err) => `${err.path}: ${err.message}`).join(", ");
    throw new ValidationError(`Input validation failed: ${errors}`);
  }

  // Use coerced values from validation (or inputs with defaults)
  const finalInputs = validation.coercedValues ?? inputsWithDefaults;

  // Validate output path if provided
  if (options.output) {
    const outputDir = dirname(resolve(options.output));
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
  }

  // Validate --apply flag requirements
  // --apply requires exactly one input directory and output path
  let applyInputPath: string | undefined;
  if (options.apply) {
    // Must have exactly one directory input
    const dirInputs = inputPaths.filter((p) => p.type === "directory" && !p.name);
    if (dirInputs.length !== 1) {
      throw new ValidationError(
        "--apply requires exactly one unnamed directory input (e.g., --input ./src)"
      );
    }
    applyInputPath = dirInputs[0]?.path;

    // Must have output path
    if (!options.output) {
      throw new ValidationError("--apply requires --output to be specified");
    }

    // Output should point to same location as input for in-place apply
    const resolvedOutput = resolve(options.output);
    if (applyInputPath && resolvedOutput !== applyInputPath) {
      // Warn but allow - user might want to apply to a different location
      if (options.verbose) {
        dim(
          `Note: --apply with different input/output paths will copy results to ${resolvedOutput}`
        );
      }
    }
  }

  // Check if this is an instruction-based tool (no command)
  if (!manifest.command) {
    // For instruction tools, just display the markdown body
    let instructions: string | undefined;

    // Try to get body from markdown file
    if (resolution.manifestPath.endsWith(".md")) {
      const { readFileSync } = await import("node:fs");
      const content = readFileSync(resolution.manifestPath, "utf-8");
      // Extract body after frontmatter
      const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
      if (match?.[1]) {
        instructions = match[1].trim();
      }
    }

    // Fall back to doc field or description
    instructions = instructions || manifest.doc || manifest.description;

    if (options.json) {
      json({
        type: "instruction-tool",
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        inputs: finalInputs,
        instructions,
      });
    } else {
      // Display the markdown instructions
      if (instructions) {
        process.stdout.write(instructions);
        if (!instructions.endsWith("\n")) {
          newline();
        }
      } else {
        info(`Tool "${manifest.name}" has no instructions defined.`);
      }
    }
    return;
  }

  // Prepare command - only substitute ${...} patterns that match inputSchema properties
  const knownParameters = manifest.inputSchema?.properties
    ? new Set(Object.keys(manifest.inputSchema.properties))
    : undefined;
  const command = prepareCommand(
    manifest.command,
    finalInputs,
    knownParameters ? { knownParameters } : {}
  );

  // Resolve environment variables (non-secrets)
  const { resolved: envResolved } = resolveToolEnv(manifest.env ?? {}, ctx.cwd);
  const envVars: Record<string, string> = {};
  for (const [key, resolution] of envResolved) {
    envVars[key] = resolution.value;
  }

  // Resolve secrets
  const secretDeclarations = Object.entries(manifest.env ?? {})
    .filter(([_, v]) => v.secret)
    .map(([k]) => k);

  const missingSecrets: string[] = [];
  if (secretDeclarations.length > 0) {
    const namespace = manifest.name.split("/").slice(0, -1).join("/") || manifest.name;
    const secretResults = await resolveSecrets(namespace, secretDeclarations);

    for (const [key, result] of secretResults) {
      if (result.found && result.value) {
        envVars[key] = result.value;
      } else {
        missingSecrets.push(key);
      }
    }

    // Warn about missing secrets
    if (missingSecrets.length > 0) {
      const namespace = manifest.name.split("/").slice(0, -1).join("/") || manifest.name;
      clack.log.warn(
        `Missing secret${missingSecrets.length > 1 ? "s" : ""}: ${missingSecrets.join(", ")}\n` +
          `  To set: enact env set ${missingSecrets[0]} <value> --secret --namespace ${namespace}`
      );
    }
  }

  // Build mount configuration
  // Tool source directory is mounted to /workspace
  const mountDirs: Record<string, string> = {
    [resolution.sourceDir]: "/workspace",
  };

  // Add input paths to mount configuration
  for (const input of inputPaths) {
    if (input.name) {
      // Named input: --input left=./old → /inputs/left
      mountDirs[input.path] = `/inputs/${input.name}`;
    } else if (input.type === "file") {
      // Single file: mount parent dir and we'll use withFile in provider
      // For now, mount as /input/<filename>
      // Note: Dagger's withFile is better but requires provider changes
      mountDirs[input.path] = `/input/${basename(input.path)}`;
    } else {
      // Single directory: --input ./data → /input
      mountDirs[input.path] = "/input";
    }
  }

  // Debug mode - show detailed parameter resolution info
  if (options.debug) {
    displayDebugInfo(manifest, inputs, inputsWithDefaults, finalInputs, envVars, command);
  }

  // Dry run mode
  if (options.dryRun) {
    displayDryRun(
      manifest,
      finalInputs,
      command,
      envVars,
      inputPaths,
      options.output,
      options.apply
    );
    return;
  }

  // Execute the tool
  const providerConfig: { defaultTimeout?: number; verbose?: boolean } = {};
  if (options.timeout) {
    providerConfig.defaultTimeout = parseTimeout(options.timeout);
  }
  if (options.verbose) {
    providerConfig.verbose = true;
  }

  const provider = new DaggerExecutionProvider(providerConfig);

  // For --apply, we export to a temp directory first, then atomically replace
  let tempOutputDir: string | undefined;
  if (options.apply && options.output) {
    tempOutputDir = mkdtempSync(join(tmpdir(), "enact-apply-"));
  }

  try {
    await provider.initialize();

    const executeTask = () => {
      const execOptions: {
        mountDirs: Record<string, string>;
        inputPaths: typeof inputPaths;
        outputPath?: string;
      } = {
        mountDirs,
        inputPaths,
      };

      // When using --apply, export to temp dir first
      if (tempOutputDir) {
        execOptions.outputPath = tempOutputDir;
      } else if (options.output) {
        execOptions.outputPath = resolve(options.output);
      }

      return provider.execute(
        manifest,
        {
          params: finalInputs,
          envOverrides: envVars,
        },
        execOptions
      );
    };

    // Build a descriptive message - container may need to be pulled
    const containerImage = manifest.from ?? "node:18-alpine";
    const spinnerMessage = `Running ${manifest.name} (${containerImage})...`;

    const result = !options.verbose
      ? await executeTask()
      : await withSpinner(spinnerMessage, executeTask, `${symbols.success} Execution complete`);

    displayResult(result, options);

    if (!result.success) {
      process.exit(EXIT_EXECUTION_ERROR);
    }

    // Apply atomically if --apply was used and execution succeeded
    if (options.apply && tempOutputDir && options.output) {
      const targetPath = resolve(options.output);

      if (options.verbose) {
        info(`Applying changes atomically to ${targetPath}...`);
      }

      try {
        atomicReplace(targetPath, tempOutputDir);
        if (options.verbose) {
          success(`Changes applied to ${targetPath}`);
        }
      } catch (applyErr) {
        error(`Failed to apply changes: ${formatError(applyErr)}`);
        dim("Original directory preserved. Changes available in temp directory.");
        throw applyErr;
      }
    }
  } finally {
    // Clean up temp directory if it exists
    if (tempOutputDir && existsSync(tempOutputDir)) {
      try {
        rmSync(tempOutputDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Parse timeout string (e.g., "30s", "5m", "1h")
 */
function parseTimeout(timeout: string): number {
  const match = timeout.match(/^(\d+)(s|m|h)?$/);
  if (!match) {
    throw new Error(`Invalid timeout format: ${timeout}. Use format like "30s", "5m", or "1h".`);
  }

  const value = Number.parseInt(match[1] ?? "0", 10);
  const unit = match[2] || "s";

  switch (unit) {
    case "h":
      return value * 60 * 60 * 1000;
    case "m":
      return value * 60 * 1000;
    default:
      return value * 1000;
  }
}

/**
 * Configure the run command
 */
export function configureRunCommand(program: Command): void {
  program
    .command("run")
    .description("Execute a tool with its manifest-defined command")
    .argument("<tool>", "Tool to run (name, path, or '.' for current directory)")
    .option("-a, --args <json>", "Input arguments as JSON string (recommended)")
    .option("-f, --input-file <path>", "Load input arguments from JSON file")
    .option(
      "-i, --input <value...>",
      "Input: key=value params, ./path for data, or name=./path for named inputs"
    )
    .option("-o, --output <path>", "Export /output directory to this path after execution")
    .option(
      "--apply",
      "Apply output back to input directory atomically (use with --input and --output pointing to same path)"
    )
    .option("-t, --timeout <duration>", "Execution timeout (e.g., 30s, 5m)")
    .option("--no-cache", "Disable container caching")
    .option("--local", "Only resolve from local sources")
    .option("-r, --remote", "Skip local resolution and fetch from registry")
    .option("--dry-run", "Show what would be executed without running")
    .option("--debug", "Show detailed parameter and environment variable resolution")
    .option("-v, --verbose", "Show progress spinners and detailed output")
    .option("--json", "Output result as JSON")
    .action(async (tool: string, options: RunOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await runHandler(tool, options, ctx);
      } catch (err) {
        handleError(err, options.verbose ? { verbose: true } : undefined);
      }
    });
}
