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

import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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
  validateInputs,
} from "@enactprotocol/shared";
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import {
  EXIT_EXECUTION_ERROR,
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
  quiet?: boolean;
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

  // Get auth token - use user token if available, otherwise use anon key for public access
  let authToken = config.registry?.authToken ?? process.env.ENACT_AUTH_TOKEN;
  if (!authToken && registryUrl.includes("siikwkfgsmouioodghho.supabase.co")) {
    // Use the official Supabase anon key for unauthenticated access
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
  env: Record<string, string>
): void {
  newline();
  info(colors.bold("Dry Run Preview"));
  newline();

  keyValue("Tool", manifest.name);
  keyValue("Version", manifest.version ?? "unversioned");
  keyValue("Container", manifest.from ?? "alpine:latest");
  newline();

  if (Object.keys(inputs).length > 0) {
    info("Inputs:");
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

  info("Command:");
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

    if (result.error?.details) {
      newline();
      dim(JSON.stringify(result.error.details, null, 2));
    }

    if (result.output?.stderr) {
      newline();
      dim("stderr:");
      dim(result.output.stderr);
    }
  }
}

/**
 * Run command handler
 */
async function runHandler(tool: string, options: RunOptions, ctx: CommandContext): Promise<void> {
  let resolution: ToolResolution | null = null;

  // First, try to resolve locally (project → user → cache)
  if (options.quiet) {
    resolution = tryResolveTool(tool, { startDir: ctx.cwd });
  } else {
    const spinner = clack.spinner();
    spinner.start(`Resolving tool: ${tool}`);
    resolution = tryResolveTool(tool, { startDir: ctx.cwd });
    if (resolution) {
      spinner.stop(`${symbols.success} Resolved: ${tool}`);
    } else {
      spinner.stop(`${symbols.info} Checking registry...`);
    }
  }

  // If not found locally and --local flag not set, try fetching from registry
  if (!resolution && !options.local) {
    // Check if this looks like a tool name (namespace/name format)
    if (tool.includes("/") && !tool.startsWith("/") && !tool.startsWith(".")) {
      resolution = options.quiet
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
      throw new ToolNotFoundError(`${tool} (--local flag set, skipped registry)`);
    }
    throw new ToolNotFoundError(tool);
  }

  const manifest = resolution.manifest;

  // Parse inputs
  const inputs = parseInputArgs(options.args, options.inputFile, options.input);

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

  // Prepare command
  const command = prepareCommand(manifest.command, finalInputs);

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

  if (secretDeclarations.length > 0) {
    const namespace = manifest.name.split("/").slice(0, -1).join("/") || manifest.name;
    const secretResults = await resolveSecrets(namespace, secretDeclarations);

    for (const [key, result] of secretResults) {
      if (result.found && result.value) {
        envVars[key] = result.value;
      }
    }
  }

  // Dry run mode
  if (options.dryRun) {
    displayDryRun(manifest, finalInputs, command, envVars);
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

  try {
    await provider.initialize();

    const executeTask = () =>
      provider.execute(
        manifest,
        {
          params: finalInputs,
          envOverrides: envVars,
        },
        {
          // Mount the tool directory to /work in the container
          mountDirs: {
            [resolution.sourceDir]: "/work",
          },
        }
      );

    // Build a descriptive message - container may need to be pulled
    const containerImage = manifest.from ?? "node:18-alpine";
    const spinnerMessage = `Running ${manifest.name} (${containerImage})...`;

    const result = options.quiet
      ? await executeTask()
      : await withSpinner(spinnerMessage, executeTask, `${symbols.success} Execution complete`);

    displayResult(result, options);

    if (!result.success) {
      process.exit(EXIT_EXECUTION_ERROR);
    }
  } finally {
    // Provider doesn't have cleanup - Dagger handles this
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
    .option("-i, --input <key=value...>", "Input arguments as key=value pairs (simple values only)")
    .option("-t, --timeout <duration>", "Execution timeout (e.g., 30s, 5m)")
    .option("--no-cache", "Disable container caching")
    .option("--local", "Only resolve from local sources")
    .option("--dry-run", "Show what would be executed without running")
    .option("-q, --quiet", "Suppress spinner output, show only tool output")
    .option("-v, --verbose", "Show detailed output")
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
