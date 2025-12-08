/**
 * enact sign command
 *
 * Cryptographically sign a tool using Sigstore keyless signing.
 * Creates an in-toto attestation, logs to Rekor transparency log,
 * and submits the attestation to the Enact registry.
 *
 * Supports both local paths and remote tool references:
 *   - Local: enact sign ./my-tool
 *   - Remote: enact sign author/tool@1.0.0
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  createApiClient,
  getToolVersion,
  submitAttestation as submitAttestationToRegistry,
} from "@enactprotocol/api";
import { getSecret } from "@enactprotocol/secrets";
import {
  addTrustedAuditor,
  emailToProviderIdentity,
  getTrustedAuditors,
  loadConfig,
  loadManifestFromDir,
  tryLoadManifest,
  validateManifest,
} from "@enactprotocol/shared";
import {
  type EnactToolAttestationOptions,
  type SigstoreBundle,
  createEnactToolStatement,
  signAttestation,
} from "@enactprotocol/trust";
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import {
  colors,
  confirm,
  dim,
  error,
  formatError,
  info,
  json,
  keyValue,
  newline,
  success,
  symbols,
  warning,
  withSpinner,
} from "../../utils";

/** Auth namespace for token storage */
const AUTH_NAMESPACE = "enact:auth";
const ACCESS_TOKEN_KEY = "access_token";

interface SignOptions extends GlobalOptions {
  identity?: string;
  output?: string;
  dryRun?: boolean;
  local?: boolean;
}

/** Default output filename for the signature bundle */
const DEFAULT_BUNDLE_FILENAME = ".sigstore-bundle.json";

/**
 * Parse a remote tool reference like "author/tool@1.0.0"
 * Returns null if not a valid remote reference
 */
function parseRemoteToolRef(ref: string): { name: string; version: string } | null {
  // Remote refs look like: author/tool@version or org/author/tool@version
  // They don't start with . or / and contain @ for version
  if (ref.startsWith(".") || ref.startsWith("/") || ref.startsWith("~")) {
    return null;
  }

  const atIndex = ref.lastIndexOf("@");
  if (atIndex === -1 || atIndex === 0) {
    return null;
  }

  const name = ref.substring(0, atIndex);
  const version = ref.substring(atIndex + 1);

  // Must have at least one / in the name (author/tool)
  if (!name.includes("/") || !version) {
    return null;
  }

  return { name, version };
}

/**
 * Find the manifest file in a directory or at a path
 */
function findManifestPath(pathArg: string): { manifestPath: string; manifestDir: string } {
  const absolutePath = resolve(pathArg);

  // Check if it's a directory or file
  try {
    // Try loading from directory first
    const loaded = loadManifestFromDir(absolutePath);
    return {
      manifestPath: loaded.filePath,
      manifestDir: absolutePath,
    };
  } catch {
    // Try as a direct file path
    const loaded = tryLoadManifest(absolutePath);
    if (loaded) {
      return {
        manifestPath: absolutePath,
        manifestDir: dirname(absolutePath),
      };
    }
    throw new Error(`No manifest found at: ${pathArg}`);
  }
}

/**
 * Display signing preview (dry run)
 */
function displayDryRun(
  manifestPath: string,
  manifest: { name: string; version?: string; description?: string },
  outputPath: string,
  options: SignOptions
): void {
  newline();
  info(colors.bold("Dry Run Preview - Signing"));
  newline();

  keyValue("Tool", manifest.name);
  keyValue("Version", manifest.version ?? "unversioned");
  keyValue("Manifest", manifestPath);
  keyValue("Output", outputPath);
  keyValue("Submit to registry", options.local ? "No (local only)" : "Yes");
  newline();

  info("Actions that would be performed:");
  dim("  1. Authenticate via OIDC (browser-based OAuth flow)");
  dim("  2. Create in-toto attestation for tool manifest");
  dim("  3. Request signing certificate from Fulcio");
  dim("  4. Sign attestation with ephemeral keypair");
  dim("  5. Log signature to Rekor transparency log");
  dim(`  6. Write bundle to ${outputPath}`);
  if (!options.local) {
    dim("  7. Submit attestation to Enact registry");
  }
  newline();

  warning("Note: Actual signing requires OIDC authentication.");
  dim("You will be prompted to authenticate in your browser.");
}

/**
 * Prompt user to add themselves to trusted auditors list (local config)
 */
async function promptAddToTrustList(
  auditorEmail: string,
  isInteractive: boolean
): Promise<boolean> {
  if (!isInteractive) {
    return false;
  }

  try {
    // Convert email to provider:identity format (e.g., github:alice)
    const providerIdentity = emailToProviderIdentity(auditorEmail);

    // Check if already in local trust list
    const trustedAuditors = getTrustedAuditors();
    if (trustedAuditors.includes(providerIdentity)) {
      // Already trusted
      return false;
    }

    newline();
    info(colors.command("Trust Configuration"));
    newline();
    dim(`You signed this tool with: ${colors.bold(auditorEmail)}`);
    dim(`Identity format: ${colors.bold(providerIdentity)}`);
    dim("This identity is not currently in your local trusted auditors list.");
    newline();

    const shouldAdd = await confirm(
      "Would you like to add this identity to ~/.enact/config.yaml?",
      true
    );

    if (!shouldAdd) {
      return false;
    }

    // Add to local config file
    const added = addTrustedAuditor(providerIdentity);

    if (added) {
      newline();
      success(`Added ${providerIdentity} to ~/.enact/config.yaml`);
      dim("This tool (and others you sign) will now be automatically trusted");
      return true;
    }

    return false;
  } catch (err) {
    // Silently fail if trust update fails - don't block signing
    if (err instanceof Error) {
      dim(`Note: Could not update trust list: ${err.message}`);
    }
    return false;
  }
}

/**
 * Display signing result
 */
function displayResult(
  bundle: SigstoreBundle,
  outputPath: string,
  manifest: { name: string; version?: string },
  options: SignOptions,
  registryResult?: { auditor: string; rekorLogIndex: number | undefined }
): void {
  if (options.json) {
    json({
      success: true,
      tool: manifest.name,
      version: manifest.version ?? "unversioned",
      bundlePath: outputPath,
      bundle,
      registry: registryResult
        ? {
            submitted: true,
            auditor: registryResult.auditor,
            rekorLogIndex: registryResult.rekorLogIndex,
          }
        : { submitted: false },
    });
    return;
  }

  newline();
  success(`Successfully signed ${manifest.name}@${manifest.version ?? "unversioned"}`);
  newline();

  keyValue("Bundle saved to", outputPath);

  // Show some bundle details
  if (bundle.verificationMaterial?.tlogEntries?.[0]) {
    const entry = bundle.verificationMaterial.tlogEntries[0];
    if (entry.logIndex !== undefined) {
      keyValue("Rekor log index", String(entry.logIndex));
    }
  }

  // Show registry submission result
  if (registryResult) {
    newline();
    success("Attestation submitted to registry");
    keyValue("Auditor identity", registryResult.auditor);
  } else if (!options.local) {
    newline();
    warning("Attestation was not submitted to registry (use --local to suppress this warning)");
  }

  newline();
  if (options.local) {
    info("Note: Attestation saved locally only (--local flag)");
    dim("  • Run 'enact sign .' without --local to submit to registry");
  }
}

/**
 * Sign a remote tool from the registry
 */
async function signRemoteTool(
  toolRef: { name: string; version: string },
  options: SignOptions,
  _ctx: CommandContext
): Promise<void> {
  const config = loadConfig();
  const registryUrl =
    process.env.ENACT_REGISTRY_URL ??
    config.registry?.url ??
    "https://siikwkfgsmouioodghho.supabase.co/functions/v1";
  const client = createApiClient({ baseUrl: registryUrl });

  // Fetch tool info from registry
  info(`Fetching ${toolRef.name}@${toolRef.version} from registry...`);

  let toolInfo: Awaited<ReturnType<typeof getToolVersion>>;
  try {
    toolInfo = await getToolVersion(client, toolRef.name, toolRef.version);
  } catch (err) {
    error(`Tool not found: ${toolRef.name}@${toolRef.version}`);
    if (err instanceof Error) {
      dim(`  ${err.message}`);
    }
    process.exit(1);
  }

  newline();
  keyValue("Tool", toolInfo.name);
  keyValue("Version", toolInfo.version);
  keyValue("Bundle hash", toolInfo.bundle.hash);
  keyValue("Published by", toolInfo.publishedBy.username);

  // Show existing attestations
  if (toolInfo.attestations.length > 0) {
    newline();
    info("Existing attestations:");
    for (const att of toolInfo.attestations) {
      dim(`  • ${att.auditor} (${att.auditorProvider})`);
    }
  }

  // Dry run mode
  if (options.dryRun) {
    newline();
    info(colors.bold("Dry Run - Would perform:"));
    dim("  1. Authenticate via OIDC (browser-based OAuth flow)");
    dim("  2. Create in-toto attestation for bundle hash");
    dim("  3. Request signing certificate from Fulcio");
    dim("  4. Sign attestation with ephemeral keypair");
    dim("  5. Log signature to Rekor transparency log");
    dim("  6. Submit attestation to registry");
    newline();
    warning("Note: Actual signing requires OIDC authentication.");
    return;
  }

  // Check auth before doing anything - remote signing always submits to registry
  const authToken = await getSecret(AUTH_NAMESPACE, ACCESS_TOKEN_KEY);
  if (!authToken) {
    error("Not authenticated with registry");
    dim("Run 'enact auth login' to authenticate before signing remote tools");
    process.exit(1);
  }

  // Confirm signing
  if (_ctx.isInteractive) {
    newline();
    const shouldSign = await confirm(
      `Sign ${toolInfo.name}@${toolInfo.version} with your identity?`,
      true
    );
    if (!shouldSign) {
      info("Signing cancelled");
      return;
    }
  }

  // Sign the attestation (using bundle hash as the artifact)
  const attestationOptions: EnactToolAttestationOptions = {
    name: toolInfo.name,
    version: toolInfo.version,
    publisher: options.identity ?? "unknown",
    description: toolInfo.description,
    buildTimestamp: new Date(),
    bundleHash: toolInfo.bundle.hash,
  };

  // Create the in-toto statement - use bundle hash as the "content" for remote tools
  const statement = createEnactToolStatement(toolInfo.bundle.hash, attestationOptions);

  // Sign it
  const result = await withSpinner("Signing attestation...", async () => {
    try {
      return await signAttestation(statement as unknown as Record<string, unknown>, {
        timeout: 120000, // 2 minutes for OIDC flow
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes("cancelled")) {
        throw new Error("Signing cancelled by user");
      }
      throw err;
    }
  });

  // Submit to registry
  client.setAuthToken(authToken);

  try {
    const attestationResult = await withSpinner(
      "Submitting attestation to registry...",
      async () => {
        return await submitAttestationToRegistry(client, {
          name: toolInfo.name,
          version: toolInfo.version,
          sigstoreBundle: result.bundle as unknown as Record<string, unknown>,
        });
      }
    );

    newline();
    success(`Signed ${toolInfo.name}@${toolInfo.version}`);
    keyValue("Auditor identity", attestationResult.auditor);
    if (attestationResult.rekorLogIndex) {
      keyValue("Rekor log index", String(attestationResult.rekorLogIndex));
    }

    // Prompt to add to trust list
    if (_ctx.isInteractive && !options.json) {
      await promptAddToTrustList(attestationResult.auditor, _ctx.isInteractive);
    }

    if (options.json) {
      json({
        success: true,
        tool: toolInfo.name,
        version: toolInfo.version,
        auditor: attestationResult.auditor,
        rekorLogIndex: attestationResult.rekorLogIndex,
      });
    }
  } catch (err) {
    error("Failed to submit attestation to registry");
    if (err instanceof Error) {
      dim(`  ${err.message}`);
    }
    process.exit(1);
  }
}

/**
 * Sign command handler (local files)
 */
async function signLocalTool(
  pathArg: string,
  options: SignOptions,
  _ctx: CommandContext
): Promise<void> {
  // Find manifest
  const { manifestPath, manifestDir } = findManifestPath(pathArg);
  const manifestContent = readFileSync(manifestPath, "utf-8");

  // Load and validate manifest
  const loaded = tryLoadManifest(manifestPath);
  if (!loaded) {
    error(`Failed to load manifest from: ${manifestPath}`);
    process.exit(1);
  }

  const manifest = loaded.manifest;

  // Validate manifest
  const validation = validateManifest(manifest);
  if (!validation.valid && validation.errors) {
    error("Manifest validation failed:");
    for (const err of validation.errors) {
      dim(`  ${symbols.cross} ${err.path}: ${err.message}`);
    }
    process.exit(1);
  }

  // Determine output path
  const outputPath = options.output
    ? resolve(options.output)
    : join(manifestDir, DEFAULT_BUNDLE_FILENAME);

  // Dry run mode
  if (options.dryRun) {
    displayDryRun(manifestPath, manifest, outputPath, options);
    return;
  }

  // Prepare attestation options
  const attestationOptions: EnactToolAttestationOptions = {
    name: manifest.name,
    version: manifest.version ?? "1.0.0",
    publisher: options.identity ?? "unknown",
    description: manifest.description,
    buildTimestamp: new Date(),
  };

  // Check for git repository for source info
  try {
    const { execSync } = await import("node:child_process");
    const gitCommit = execSync("git rev-parse HEAD", {
      cwd: manifestDir,
      encoding: "utf-8",
    }).trim();
    attestationOptions.sourceCommit = gitCommit;

    const remoteUrl = execSync("git remote get-url origin", {
      cwd: manifestDir,
      encoding: "utf-8",
    }).trim();
    attestationOptions.repository = remoteUrl;
  } catch {
    // Not a git repository or git not available
    if (options.verbose) {
      dim("Note: Not a git repository, skipping source commit info");
    }
  }

  // Create in-toto attestation statement
  const statement = createEnactToolStatement(manifestContent, attestationOptions);

  if (options.verbose) {
    info("Created attestation statement:");
    dim(JSON.stringify(statement, null, 2));
    newline();
  }

  // Sign the attestation
  info("Starting OIDC signing flow...");
  dim("A browser window will open for authentication.");
  newline();

  const result = await withSpinner("Signing attestation...", async () => {
    try {
      // Cast statement to Record<string, unknown> for signAttestation
      return await signAttestation(statement as unknown as Record<string, unknown>, {
        timeout: 120000, // 2 minutes for OIDC flow
      });
    } catch (err) {
      // Re-throw with more context
      if (err instanceof Error) {
        if (err.message.includes("OIDC") || err.message.includes("token")) {
          throw new Error(
            `OIDC authentication failed: ${err.message}\nMake sure you complete the browser authentication flow.`
          );
        }
        if (err.message.includes("Fulcio") || err.message.includes("certificate")) {
          throw new Error(
            `Certificate issuance failed: ${err.message}\nThis may be a temporary issue with the Sigstore infrastructure.`
          );
        }
        if (err.message.includes("Rekor") || err.message.includes("transparency")) {
          throw new Error(
            `Transparency log failed: ${err.message}\nThis may be a temporary issue with the Sigstore infrastructure.`
          );
        }
      }
      throw err;
    }
  });

  // Save the bundle locally
  writeFileSync(outputPath, JSON.stringify(result.bundle, null, 2));

  // Submit attestation to registry (unless --local)
  let registryResult: { auditor: string; rekorLogIndex: number | undefined } | undefined;

  if (!options.local) {
    // Check for auth token from keyring
    const authToken = await getSecret(AUTH_NAMESPACE, ACCESS_TOKEN_KEY);

    if (!authToken) {
      warning("Not authenticated with registry - attestation saved locally only");
      dim("Run 'enact auth login' to authenticate, then sign again to submit");
    } else {
      const client = createApiClient();
      client.setAuthToken(authToken);

      try {
        const attestationResult = await withSpinner(
          "Submitting attestation to registry...",
          async () => {
            // Submit the Sigstore bundle directly (v2 API)
            return await submitAttestationToRegistry(client, {
              name: manifest.name,
              version: manifest.version ?? "1.0.0",
              sigstoreBundle: result.bundle as unknown as Record<string, unknown>,
            });
          }
        );

        registryResult = {
          auditor: attestationResult.auditor,
          rekorLogIndex: attestationResult.rekorLogIndex,
        };

        // Prompt to add auditor to trust list (if interactive and not in JSON mode)
        if (!options.json && _ctx.isInteractive) {
          await promptAddToTrustList(attestationResult.auditor, _ctx.isInteractive);
        }
      } catch (err) {
        warning("Failed to submit attestation to registry");
        if (err instanceof Error) {
          dim(`  ${err.message}`);
        }
        dim("The attestation was saved locally and logged to Rekor.");
        dim("You can try submitting again later.");
      }
    }
  }

  // Display result
  displayResult(result.bundle, outputPath, manifest, options, registryResult);
}

/**
 * Main sign command handler - routes to local or remote
 */
async function signHandler(
  pathArg: string,
  options: SignOptions,
  ctx: CommandContext
): Promise<void> {
  // Check if this is a remote tool reference (author/tool@version)
  const remoteRef = parseRemoteToolRef(pathArg);

  if (remoteRef) {
    // Sign remote tool from registry
    await signRemoteTool(remoteRef, options, ctx);
  } else {
    // Sign local tool
    await signLocalTool(pathArg, options, ctx);
  }
}

/**
 * Configure the sign command
 */
export function configureSignCommand(program: Command): void {
  program
    .command("sign")
    .description("Cryptographically sign a tool and submit attestation to registry")
    .argument(
      "<path>",
      "Path to tool directory, manifest file, or remote tool (author/tool@version)"
    )
    .option("-i, --identity <email>", "Sign with specific identity (uses OAuth)")
    .option("-o, --output <path>", "Output path for signature bundle (local only)")
    .option("--dry-run", "Show what would be signed without signing")
    .option("--local", "Save signature locally only, do not submit to registry")
    .option("-v, --verbose", "Show detailed output")
    .option("--json", "Output result as JSON")
    .action(async (pathArg: string, options: SignOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await signHandler(pathArg, options, ctx);
      } catch (err) {
        error(formatError(err));
        if (options.verbose && err instanceof Error && err.stack) {
          dim(err.stack);
        }
        process.exit(1);
      }
    });
}
