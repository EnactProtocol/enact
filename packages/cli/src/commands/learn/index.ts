/**
 * enact learn command
 *
 * Display the documentation (enact.md) for a tool.
 * Fetches and displays the raw manifest content for easy reading.
 *
 * Security: For tools fetched from the registry, attestation checks are
 * performed according to the trust policy. This prevents potentially
 * malicious documentation from being displayed to LLMs or users.
 */

import {
  type AttestationListResponse,
  createApiClient,
  getAttestationList,
  getToolInfo,
  getToolVersion,
  verifyAllAttestations,
} from "@enactprotocol/api";
import {
  getMinimumAttestations,
  getTrustPolicy,
  getTrustedAuditors,
  loadConfig,
  tryResolveTool,
} from "@enactprotocol/shared";
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import {
  TrustError,
  confirm,
  dim,
  error,
  formatError,
  header,
  info,
  json,
  newline,
  success,
  symbols,
} from "../../utils";

interface LearnOptions extends GlobalOptions {
  ver?: string;
  local?: boolean;
}

/**
 * Learn command handler
 */
async function learnHandler(
  toolName: string,
  options: LearnOptions,
  ctx: CommandContext
): Promise<void> {
  // First, try to resolve locally (project → user → cache)
  // If the tool is already installed/cached, we trust it
  const resolution = tryResolveTool(toolName, { startDir: ctx.cwd });

  if (resolution) {
    // Tool is installed locally - read documentation from the manifest file
    if (resolution.manifestPath.endsWith(".md")) {
      const { readFileSync } = await import("node:fs");
      const content = readFileSync(resolution.manifestPath, "utf-8");

      if (options.json) {
        json({
          name: toolName,
          version: resolution.manifest.version,
          documentation: content,
          source: "local",
        });
        return;
      }

      header(`${toolName}@${resolution.manifest.version ?? "local"}`);
      dim("(installed locally)");
      newline();
      console.log(content);
      return;
    }

    // Fallback for non-.md manifests
    if (options.json) {
      json({
        name: toolName,
        version: resolution.manifest.version,
        documentation: resolution.manifest.doc ?? resolution.manifest.description ?? null,
        source: "local",
      });
      return;
    }

    header(`${toolName}@${resolution.manifest.version ?? "local"}`);
    dim("(installed locally)");
    newline();
    console.log(
      resolution.manifest.doc ?? resolution.manifest.description ?? "No documentation available."
    );
    return;
  }

  // If --local flag is set, don't fetch from registry
  if (options.local) {
    error(`Tool not found locally: ${toolName}`);
    dim("The tool is not installed. Remove --local to fetch from registry.");
    process.exit(1);
  }

  // Tool not installed - fetch from registry with attestation checks
  const config = loadConfig();
  const registryUrl =
    process.env.ENACT_REGISTRY_URL ??
    config.registry?.url ??
    "https://siikwkfgsmouioodghho.supabase.co/functions/v1";

  // Anon key for public access (learn doesn't require authentication)
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpaWt3a2Znc21vdWlvb2RnaGhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MTkzMzksImV4cCI6MjA4MDE5NTMzOX0.kxnx6-IPFhmGx6rzNx36vbyhFMFZKP_jFqaDbKnJ_E0";

  // Use anon key for public tool access - no auth required for learn command
  const authToken = process.env.ENACT_AUTH_TOKEN ?? config.registry?.authToken ?? SUPABASE_ANON_KEY;

  const client = createApiClient({
    baseUrl: registryUrl,
    authToken: authToken,
  });

  try {
    // Get the version to fetch - either specified or latest
    let version = options.ver;
    if (!version) {
      const toolInfo = await getToolInfo(client, toolName);
      version = toolInfo.latestVersion;
    }

    if (!version) {
      error(`No published versions for ${toolName}`);
      process.exit(1);
    }

    // Get the version info which includes rawManifest
    const versionInfo = await getToolVersion(client, toolName, version);

    // ========================================
    // TRUST VERIFICATION - same as run command
    // ========================================
    const trustPolicy = getTrustPolicy();
    const minimumAttestations = getMinimumAttestations();
    const trustedAuditors = getTrustedAuditors();

    // Fetch attestations from registry
    const attestationsResponse: AttestationListResponse = await getAttestationList(
      client,
      toolName,
      version
    );
    const attestations = attestationsResponse.attestations;

    if (attestations.length === 0) {
      // No attestations found
      info(`${symbols.warning} Tool ${toolName}@${version} has no attestations.`);

      if (trustPolicy === "require_attestation") {
        throw new TrustError(
          "Trust policy requires attestations. Cannot display documentation from unverified tools."
        );
      }
      if (ctx.isInteractive && trustPolicy === "prompt") {
        dim("Documentation from unverified tools may contain malicious content.");
        const proceed = await confirm("View documentation from unverified tool?");
        if (!proceed) {
          info("Cancelled.");
          process.exit(0);
        }
      } else if (!ctx.isInteractive && trustPolicy === "prompt") {
        throw new TrustError(
          "Cannot display documentation from unverified tools in non-interactive mode."
        );
      }
      // trustPolicy === "allow" - continue without prompting
    } else {
      // Verify attestations locally (never trust registry's verification status)
      const verifiedAuditors = await verifyAllAttestations(
        client,
        toolName,
        version,
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
            `${symbols.warning} Tool ${toolName}@${version} has ${trustedVerifiedAuditors.length} trusted attestation(s), but ${minimumAttestations} required.`
          );
          dim(`Trusted attestations: ${trustedVerifiedAuditors.join(", ")}`);

          if (trustPolicy === "require_attestation") {
            throw new TrustError(
              `Trust policy requires at least ${minimumAttestations} attestation(s) from trusted identities.`
            );
          }
          if (ctx.isInteractive && trustPolicy === "prompt") {
            const proceed = await confirm(
              "View documentation with fewer attestations than required?"
            );
            if (!proceed) {
              info("Cancelled.");
              process.exit(0);
            }
          } else if (!ctx.isInteractive && trustPolicy === "prompt") {
            throw new TrustError(
              "Cannot display documentation without meeting minimum attestation requirement in non-interactive mode."
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
          `${symbols.warning} Tool ${toolName}@${version} has ${verifiedAuditors.length} attestation(s), but none from trusted auditors.`
        );

        if (trustPolicy === "require_attestation") {
          dim(`Your trusted auditors: ${trustedAuditors.join(", ")}`);
          dim(`Tool attested by: ${verifiedAuditors.map((a) => a.providerIdentity).join(", ")}`);
          throw new TrustError(
            "Trust policy requires attestations from trusted identities. Cannot display documentation."
          );
        }
        if (ctx.isInteractive && trustPolicy === "prompt") {
          dim(`Attested by: ${verifiedAuditors.map((a) => a.providerIdentity).join(", ")}`);
          dim(`Your trusted auditors: ${trustedAuditors.join(", ")}`);
          const proceed = await confirm("View documentation anyway?");
          if (!proceed) {
            info("Cancelled.");
            process.exit(0);
          }
        } else if (!ctx.isInteractive && trustPolicy === "prompt") {
          throw new TrustError(
            "Cannot display documentation without trusted attestations in non-interactive mode."
          );
        }
        // trustPolicy === "allow" - continue without prompting
      }
    }

    // ========================================
    // Display documentation (trust verified)
    // ========================================
    if (options.json) {
      json({
        name: toolName,
        version: versionInfo.version,
        documentation: versionInfo.rawManifest ?? null,
        source: "registry",
      });
      return;
    }

    if (!versionInfo.rawManifest) {
      error(`No documentation found for ${toolName}@${version}`);
      dim("This tool may not have an enact.md file.");
      process.exit(1);
    }

    // Display the documentation
    header(`${toolName}@${version}`);
    newline();
    console.log(versionInfo.rawManifest);
  } catch (err) {
    if (err instanceof TrustError) {
      error(err.message);
      process.exit(1);
    }
    if (err instanceof Error) {
      if (err.message.includes("not_found") || err.message.includes("404")) {
        error(`Tool not found: ${toolName}`);
        dim("Check the tool name or search with: enact search <query>");
        process.exit(1);
      }
      if (err.message.includes("fetch")) {
        error("Unable to connect to registry. Check your internet connection.");
        process.exit(1);
      }
    }
    throw err;
  }
}

/**
 * Configure the learn command
 */
export function configureLearnCommand(program: Command): void {
  program
    .command("learn <tool>")
    .description("Display documentation (enact.md) for a tool")
    .option("--ver <version>", "Show documentation for a specific version")
    .option("--local", "Only show documentation for locally installed tools")
    .option("--json", "Output as JSON")
    .option("-v, --verbose", "Show detailed output")
    .action(async (toolName: string, options: LearnOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await learnHandler(toolName, options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });
}
