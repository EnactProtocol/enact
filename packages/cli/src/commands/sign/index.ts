/**
 * enact sign command
 *
 * Cryptographically sign a tool using Sigstore keyless signing.
 * Creates an in-toto attestation based on a checksum manifest,
 * logs to Rekor transparency log, and optionally submits to the registry.
 *
 * Uses manifest-based signing (per Sigstore team recommendation):
 * - Creates deterministic checksum manifest of all files
 * - Signs the manifest hash (not tar.gz bundle hash)
 * - Enables pre-publish signing workflow
 *
 * Supports both local paths and remote tool references:
 *   - Local: enact sign ./my-tool
 *   - Remote: enact sign author/tool         (prompts for version)
 *   - Remote: enact sign author/tool@1.0.0   (specific version)
 */

import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  createApiClient,
  getToolInfo,
  getToolVersion,
  submitAttestationToRegistry,
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
  type ChecksumManifest,
  type EnactToolAttestationOptions,
  type SigstoreBundle,
  createChecksumManifest,
  createEnactToolStatement,
  extractCertificateFromBundle,
  serializeChecksumManifest,
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
  select,
  success,
  symbols,
  warning,
  withSpinner,
} from "../../utils";
import { loadGitignore } from "../../utils/ignore";

/** Auth namespace for token storage */
const AUTH_NAMESPACE = "enact:auth";
const ACCESS_TOKEN_KEY = "access_token";

interface SignOptions extends GlobalOptions {
  identity?: string;
  output?: string;
  dryRun?: boolean;
  local?: boolean;
}

/** Default output filenames for signing artifacts */
const DEFAULT_BUNDLE_FILENAME = ".sigstore-bundle.json";
const DEFAULT_MANIFEST_FILENAME = ".enact-manifest.json";

/**
 * Parse a remote tool reference like "author/tool@1.0.0" or "author/tool"
 * Version is optional - if not provided, will prompt user to select
 * Returns null if not a valid remote reference (i.e., looks like a local path)
 */
function parseRemoteToolRef(ref: string): { name: string; version: string | undefined } | null {
  // Remote refs look like: author/tool@version or org/author/tool@version
  // They don't start with . or / and must contain at least one /
  if (ref.startsWith(".") || ref.startsWith("/") || ref.startsWith("~")) {
    return null;
  }

  // Must have at least one / in the name (author/tool format)
  if (!ref.includes("/")) {
    return null;
  }

  const atIndex = ref.lastIndexOf("@");
  if (atIndex === -1) {
    // No version specified - that's OK, we'll prompt for it
    return { name: ref, version: undefined };
  }

  if (atIndex === 0) {
    return null;
  }

  const name = ref.substring(0, atIndex);
  const version = ref.substring(atIndex + 1);

  // Version after @ must not be empty
  if (!version) {
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
  manifestDir: string,
  options: SignOptions
): void {
  const bundlePath = join(manifestDir, DEFAULT_BUNDLE_FILENAME);
  const checksumManifestPath = join(manifestDir, DEFAULT_MANIFEST_FILENAME);

  newline();
  info(colors.bold("Dry Run Preview - Manifest-Based Signing"));
  newline();

  keyValue("Tool", manifest.name);
  keyValue("Version", manifest.version ?? "unversioned");
  keyValue("Manifest", manifestPath);
  keyValue("Checksum manifest output", checksumManifestPath);
  keyValue("Sigstore bundle output", bundlePath);
  keyValue("Submit to registry", options.local ? "No (local only)" : "Yes");
  newline();

  info("Actions that would be performed:");
  dim("  1. Scan tool directory and compute file checksums");
  dim("  2. Create checksum manifest (.enact-manifest.json)");
  dim("  3. Authenticate via OIDC (browser-based OAuth flow)");
  dim("  4. Create in-toto attestation for manifest hash");
  dim("  5. Request signing certificate from Fulcio");
  dim("  6. Sign attestation with ephemeral keypair");
  dim("  7. Log signature to Rekor transparency log");
  dim(`  8. Write Sigstore bundle to ${bundlePath}`);
  if (!options.local) {
    dim("  9. Submit attestation to Enact registry");
  }
  newline();

  info("This enables pre-publish signing:");
  dim("  • File checksums are deterministic (unlike tar.gz bundles)");
  dim("  • Sign locally, then publish with pre-signed attestation");
  dim("  • Server verifies manifest matches uploaded bundle");
  newline();

  warning("Note: Actual signing requires OIDC authentication.");
  dim("You will be prompted to authenticate in your browser.");
}

/**
 * Prompt user to add themselves to trusted auditors list (local config)
 */
async function promptAddToTrustList(
  auditorEmail: string,
  isInteractive: boolean,
  issuer?: string
): Promise<boolean> {
  if (!isInteractive) {
    return false;
  }

  try {
    // Convert email to provider:identity format (e.g., github:alice)
    // Pass the issuer so we can correctly determine the provider
    const providerIdentity = emailToProviderIdentity(auditorEmail, issuer);

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
  bundlePath: string,
  manifestPath: string,
  checksumManifest: ChecksumManifest,
  manifest: { name: string; version?: string },
  options: SignOptions,
  registryResult?: { auditor: string; rekorLogIndex: number | undefined }
): void {
  if (options.json) {
    json({
      success: true,
      tool: manifest.name,
      version: manifest.version ?? "unversioned",
      checksumManifestPath: manifestPath,
      sigstoreBundlePath: bundlePath,
      manifestHash: checksumManifest.manifestHash.digest,
      fileCount: checksumManifest.files.length,
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

  keyValue("Checksum manifest", manifestPath);
  keyValue("Sigstore bundle", bundlePath);
  keyValue("Manifest hash", `${checksumManifest.manifestHash.digest.slice(0, 16)}...`);
  keyValue("Files signed", String(checksumManifest.files.length));

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
    dim("  • Run 'enact publish .' to publish with this pre-signed attestation");
  } else {
    info("Next step:");
    dim("  • Run 'enact publish .' to publish with this pre-signed attestation");
  }
}

/**
 * Sign a remote tool from the registry
 */
async function signRemoteTool(
  toolRef: { name: string; version: string | undefined },
  options: SignOptions,
  ctx: CommandContext
): Promise<void> {
  const config = loadConfig();
  const registryUrl =
    process.env.ENACT_REGISTRY_URL ??
    config.registry?.url ??
    "https://siikwkfgsmouioodghho.supabase.co/functions/v1";
  const client = createApiClient({ baseUrl: registryUrl });

  // Check auth FIRST - remote signing requires authentication to submit to registry
  // Do this before any other operations to fail fast with a clear error
  const authToken = await getSecret(AUTH_NAMESPACE, ACCESS_TOKEN_KEY);
  if (!authToken && !options.local) {
    error("Not authenticated with registry");
    newline();
    dim("Remote tool signing requires authentication to submit the attestation.");
    dim("Run 'enact auth login' to authenticate first.");
    newline();
    dim("Alternatively, use --local to sign without submitting to the registry");
    dim("(the signature bundle will be saved locally but not recorded).");
    process.exit(1);
  }

  // Warn if using --local with remote tools
  if (options.local) {
    warning("Using --local with remote tools: signature will not be submitted to registry");
    dim("  The attestation will be saved locally but won't be associated with the tool.");
    newline();
  }

  // Resolve version - prompt if not provided
  let targetVersion = toolRef.version;

  if (!targetVersion) {
    // Fetch tool info to get available versions
    info(`Fetching versions for ${toolRef.name}...`);

    let toolMetadata: Awaited<ReturnType<typeof getToolInfo>>;
    try {
      toolMetadata = await getToolInfo(client, toolRef.name);
    } catch (err) {
      error(`Tool not found: ${toolRef.name}`);
      if (err instanceof Error) {
        dim(`  ${err.message}`);
      }
      process.exit(1);
    }

    if (toolMetadata.versions.length === 0) {
      error(`No published versions found for ${toolRef.name}`);
      process.exit(1);
    }

    // Filter out yanked versions for selection (unless there are no non-yanked versions)
    const availableVersions = toolMetadata.versions.filter((v) => !v.yanked);
    const versionsToShow = availableVersions.length > 0 ? availableVersions : toolMetadata.versions;

    if (ctx.isInteractive) {
      // Prompt user to select a version
      newline();
      const selectedVersion = await select(
        "Select a version to sign:",
        versionsToShow.map((v) => {
          const option: { value: string; label: string; hint?: string } = {
            value: v.version,
            label: v.version + (v.version === toolMetadata.latestVersion ? " (latest)" : ""),
          };
          if (v.yanked) {
            option.hint = "yanked";
          }
          return option;
        })
      );

      if (!selectedVersion) {
        info("Signing cancelled");
        return;
      }

      targetVersion = selectedVersion;
    } else {
      // Non-interactive: use latest version
      targetVersion = toolMetadata.latestVersion;
      info(`Using latest version: ${targetVersion}`);
    }
  }

  // Fetch tool info from registry
  info(`Fetching ${toolRef.name}@${targetVersion} from registry...`);

  let toolInfo: Awaited<ReturnType<typeof getToolVersion>>;
  try {
    toolInfo = await getToolVersion(client, toolRef.name, targetVersion);
  } catch (err) {
    error(`Tool not found: ${toolRef.name}@${targetVersion}`);
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
    if (!options.local) {
      dim("  6. Submit attestation to registry");
    } else {
      dim("  6. Save signature bundle locally (--local mode)");
    }
    newline();
    warning("Note: Actual signing requires OIDC authentication.");
    return;
  }

  // Confirm signing
  if (ctx.isInteractive) {
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
      if (err instanceof Error) {
        if (err.message.includes("cancelled")) {
          throw new Error("Signing cancelled by user");
        }
        // Provide more helpful error messages for common issues
        if (err.message.includes("error creating signing certificate")) {
          throw new Error(
            "Failed to create signing certificate from Fulcio.\n" +
              "This usually means the OIDC authentication flow was interrupted or failed.\n" +
              "Please try again and complete the browser authentication."
          );
        }
        if (err.message.includes("IDENTITY_TOKEN")) {
          throw new Error(
            "Failed to obtain identity token for signing.\n" +
              "Please ensure you complete the browser authentication when prompted."
          );
        }
      }
      throw err;
    }
  });

  // Handle --local mode for remote tools
  if (options.local) {
    // Save bundle locally instead of submitting to registry
    const outputPath =
      options.output ??
      join(
        process.cwd(),
        `.sigstore-bundle-${toolInfo.name.replace(/\//g, "-")}-${toolInfo.version}.json`
      );
    writeFileSync(outputPath, JSON.stringify(result.bundle, null, 2));

    newline();
    success(`Signed ${toolInfo.name}@${toolInfo.version} (local only)`);
    keyValue("Bundle saved to", outputPath);
    newline();
    warning("Attestation was NOT submitted to registry (--local mode)");
    dim("  To submit this attestation later, you would need to use the registry API directly.");

    if (options.json) {
      json({
        success: true,
        tool: toolInfo.name,
        version: toolInfo.version,
        bundlePath: outputPath,
        submittedToRegistry: false,
      });
    }
    return;
  }

  // Submit to registry
  client.setAuthToken(authToken!);

  try {
    const attestationResult = await withSpinner(
      "Submitting attestation to registry...",
      async () => {
        return await submitAttestationToRegistry(
          client,
          toolInfo.name,
          toolInfo.version,
          result.bundle as unknown as Record<string, unknown>
        );
      }
    );

    newline();
    success(`Signed ${toolInfo.name}@${toolInfo.version}`);
    keyValue("Auditor identity", attestationResult.auditor);
    if (attestationResult.rekorLogIndex) {
      keyValue("Rekor log index", String(attestationResult.rekorLogIndex));
    }

    // Prompt to add to trust list - extract issuer from bundle for correct identity format
    if (ctx.isInteractive && !options.json) {
      const certificate = extractCertificateFromBundle(result.bundle);
      const issuer = certificate?.identity?.issuer;
      await promptAddToTrustList(attestationResult.auditor, ctx.isInteractive, issuer);
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
      // Provide more context for auth errors
      if (err.message.includes("401") || err.message.includes("Unauthorized")) {
        newline();
        dim("  Your authentication may have expired. Try running 'enact auth login' again.");
      }
    }
    process.exit(1);
  }
}

/**
 * Sign command handler (local files) - uses manifest-based signing
 */
async function signLocalTool(
  pathArg: string,
  options: SignOptions,
  _ctx: CommandContext
): Promise<void> {
  // Find manifest
  const { manifestPath, manifestDir } = findManifestPath(pathArg);

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

  // Output paths
  const bundlePath = options.output
    ? resolve(options.output)
    : join(manifestDir, DEFAULT_BUNDLE_FILENAME);
  const checksumManifestPath = join(manifestDir, DEFAULT_MANIFEST_FILENAME);

  // Dry run mode
  if (options.dryRun) {
    displayDryRun(manifestPath, manifest, manifestDir, options);
    return;
  }

  // Check for existing pre-signed attestation
  if (existsSync(checksumManifestPath) && existsSync(bundlePath)) {
    newline();
    warning("Existing signature files found:");
    dim(`  • ${checksumManifestPath}`);
    dim(`  • ${bundlePath}`);
    newline();

    if (_ctx.isInteractive) {
      const shouldOverwrite = await confirm("Overwrite existing signature?", false);
      if (!shouldOverwrite) {
        info("Signing cancelled. Existing signature preserved.");
        return;
      }
    } else {
      info("Overwriting existing signature (non-interactive mode).");
    }
    newline();
  }

  // Load gitignore patterns for manifest creation
  const ignorePatterns = loadGitignore(manifestDir);

  // Create checksum manifest
  info("Creating checksum manifest...");
  const checksumManifest = await withSpinner(
    "Scanning files and computing checksums...",
    async () => {
      return await createChecksumManifest(manifestDir, manifest.name, manifest.version ?? "1.0.0", {
        ignorePatterns,
        onProgress: options.verbose ? (file) => dim(`  Hashing: ${file}`) : undefined,
      });
    }
  );

  if (options.verbose) {
    newline();
    info(`Checksum manifest created with ${checksumManifest.files.length} files:`);
    for (const file of checksumManifest.files) {
      dim(`  ${file.path} (${file.sha256.slice(0, 12)}...)`);
    }
    newline();
  }

  keyValue("Files to sign", String(checksumManifest.files.length));
  keyValue("Manifest hash", `${checksumManifest.manifestHash.digest.slice(0, 16)}...`);
  newline();

  // Prepare attestation options
  const attestationOptions: EnactToolAttestationOptions = {
    name: manifest.name,
    version: manifest.version ?? "1.0.0",
    publisher: options.identity ?? "unknown",
    description: manifest.description,
    buildTimestamp: new Date(),
    // Use manifest hash as the bundle hash for attestation
    bundleHash: checksumManifest.manifestHash.digest,
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

  // Create in-toto attestation statement using manifest hash as the content identifier
  const statement = createEnactToolStatement(
    checksumManifest.manifestHash.digest,
    attestationOptions
  );

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

  // Save the checksum manifest
  writeFileSync(checksumManifestPath, serializeChecksumManifest(checksumManifest));

  // Save the Sigstore bundle
  writeFileSync(bundlePath, JSON.stringify(result.bundle, null, 2));

  // Submit attestation to registry (unless --local)
  let registryResult: { auditor: string; rekorLogIndex: number | undefined } | undefined;

  if (!options.local) {
    // Check for auth token from keyring
    const authToken = await getSecret(AUTH_NAMESPACE, ACCESS_TOKEN_KEY);

    if (!authToken) {
      warning("Not authenticated with registry - attestation saved locally only");
      dim("Run 'enact auth login' to authenticate, then publish with pre-signed attestation");
    } else {
      const client = createApiClient();
      client.setAuthToken(authToken);

      try {
        const attestationResult = await withSpinner(
          "Submitting attestation to registry...",
          async () => {
            // Submit the Sigstore bundle directly (v2 API)
            return await submitAttestationToRegistry(
              client,
              manifest.name,
              manifest.version ?? "1.0.0",
              result.bundle as unknown as Record<string, unknown>
            );
          }
        );

        registryResult = {
          auditor: attestationResult.auditor,
          rekorLogIndex: attestationResult.rekorLogIndex,
        };

        // Prompt to add auditor to trust list (if interactive and not in JSON mode)
        // Extract issuer from bundle for correct identity format
        if (!options.json && _ctx.isInteractive) {
          const certificate = extractCertificateFromBundle(result.bundle);
          const issuer = certificate?.identity?.issuer;
          await promptAddToTrustList(attestationResult.auditor, _ctx.isInteractive, issuer);
        }
      } catch (err) {
        warning("Failed to submit attestation to registry");
        if (err instanceof Error) {
          dim(`  ${err.message}`);
        }
        dim("The attestation was saved locally and logged to Rekor.");
        dim("You can publish with the pre-signed attestation using 'enact publish .'");
      }
    }
  }

  // Display result
  displayResult(
    result.bundle,
    bundlePath,
    checksumManifestPath,
    checksumManifest,
    manifest,
    options,
    registryResult
  );
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
      "Path to tool directory, manifest file, or remote tool (author/tool or author/tool@version)"
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
