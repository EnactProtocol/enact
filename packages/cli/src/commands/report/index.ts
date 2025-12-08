/**
 * enact report command
 *
 * Report security vulnerabilities or issues with a tool.
 * Creates a signed attestation with result "failed" and submits to the registry.
 */

import { createApiClient, getToolVersion, submitAttestation } from "@enactprotocol/api";
import { getSecret } from "@enactprotocol/secrets";
import { loadConfig } from "@enactprotocol/shared";
import {
  type EnactAuditAttestationOptions,
  createEnactAuditStatement,
  signAttestation,
} from "@enactprotocol/trust";
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import {
  colors,
  dim,
  error,
  formatError,
  info,
  json,
  keyValue,
  newline,
  success,
  warning,
  withSpinner,
} from "../../utils";

/** Auth namespace for token storage */
const AUTH_NAMESPACE = "enact:auth";
const ACCESS_TOKEN_KEY = "access_token";

interface ReportOptions extends GlobalOptions {
  reason: string;
  severity?: "critical" | "high" | "medium" | "low";
  category?: "security" | "malware" | "quality" | "license" | "other";
  dryRun?: boolean;
  local?: boolean;
}

/** Valid severity levels */
const SEVERITY_LEVELS = ["critical", "high", "medium", "low"] as const;

/** Valid categories */
const CATEGORIES = ["security", "malware", "quality", "license", "other"] as const;

/**
 * Parse tool@version format
 */
function parseToolVersion(toolArg: string): { name: string; version: string | undefined } {
  const atIndex = toolArg.lastIndexOf("@");

  // Check if @ is part of the tool name (like @scope/package) or version separator
  if (atIndex <= 0 || toolArg.startsWith("@")) {
    // Could be @scope/package or @scope/package@version
    const scopedMatch = toolArg.match(/^(@[^/]+\/[^@]+)(?:@(.+))?$/);
    if (scopedMatch) {
      return {
        name: scopedMatch[1] ?? toolArg,
        version: scopedMatch[2],
      };
    }
    return { name: toolArg, version: undefined };
  }

  return {
    name: toolArg.slice(0, atIndex),
    version: toolArg.slice(atIndex + 1),
  };
}

/**
 * Display report preview (dry run)
 */
function displayDryRun(tool: string, version: string | undefined, options: ReportOptions): void {
  newline();
  info(colors.bold("Dry Run Preview - Report Submission"));
  newline();

  keyValue("Tool", tool);
  if (version) {
    keyValue("Version", version);
  }
  keyValue("Reason", options.reason);
  keyValue("Severity", options.severity ?? "medium");
  keyValue("Category", options.category ?? "other");
  keyValue("Submit to registry", options.local ? "No (local only)" : "Yes");
  newline();

  info("Actions that would be performed:");
  dim("  1. Authenticate via OIDC (browser-based OAuth flow)");
  dim("  2. Create audit attestation with result 'failed'");
  dim("  3. Request signing certificate from Fulcio");
  dim("  4. Sign attestation with ephemeral keypair");
  dim("  5. Log signature to Rekor transparency log");
  if (!options.local) {
    dim("  6. Submit signed report to Enact registry");
  }
  newline();

  warning("Note: False reports may result in account suspension.");
  dim("Your identity will be cryptographically bound to this report.");
}

/**
 * Display report result
 */
function displayResult(
  tool: string,
  version: string | undefined,
  options: ReportOptions,
  registryResult?: { auditor: string; rekorLogIndex: number | undefined }
): void {
  if (options.json) {
    json({
      success: true,
      tool,
      version: version ?? "latest",
      reason: options.reason,
      severity: options.severity ?? "medium",
      category: options.category ?? "other",
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
  success(`Report submitted for ${tool}${version ? `@${version}` : ""}`);
  newline();

  keyValue("Severity", options.severity ?? "medium");
  keyValue("Category", options.category ?? "other");

  if (registryResult) {
    keyValue("Auditor identity", registryResult.auditor);
    if (registryResult.rekorLogIndex !== undefined) {
      keyValue("Rekor log index", String(registryResult.rekorLogIndex));
    }
  }

  newline();

  info("What happens next:");
  dim("  • Your signed report is recorded on the Rekor transparency log");
  dim("  • Registry moderators will review your report");
  dim("  • The tool publisher will be notified");
  dim("  • You may be contacted for additional information");
  newline();

  warning("Note: Your identity is cryptographically bound to this report.");
  warning("False reports may result in account suspension.");
}

/**
 * Report command handler
 */
async function reportHandler(
  toolArg: string,
  options: ReportOptions,
  _ctx: CommandContext
): Promise<void> {
  // Parse tool@version
  const { name: toolName, version: parsedVersion } = parseToolVersion(toolArg);

  // Validate required options
  if (!options.reason || options.reason.trim().length === 0) {
    error("--reason is required. Please provide a description of the issue.");
    process.exit(1);
  }

  // Validate severity if provided
  if (options.severity && !SEVERITY_LEVELS.includes(options.severity)) {
    error(`Invalid severity. Must be one of: ${SEVERITY_LEVELS.join(", ")}`);
    process.exit(1);
  }

  // Validate category if provided
  if (options.category && !CATEGORIES.includes(options.category)) {
    error(`Invalid category. Must be one of: ${CATEGORIES.join(", ")}`);
    process.exit(1);
  }

  // Dry run mode
  if (options.dryRun) {
    displayDryRun(toolName, parsedVersion, options);
    return;
  }

  // Create API client to fetch tool info
  const config = loadConfig();
  const registryUrl = config.registry?.url ?? "https://registry.enact.tools";
  const client = createApiClient({ baseUrl: registryUrl });

  // Get version to report - either specified or latest
  let version = parsedVersion;
  if (!version) {
    try {
      const toolInfo = await withSpinner(
        `Fetching ${toolName} info...`,
        async () => getToolVersion(client, toolName, "latest"),
        `Found ${toolName}`
      );
      version = toolInfo.version;
    } catch (err) {
      error(`Failed to find tool ${toolName}: ${formatError(err)}`);
      process.exit(1);
    }
  }

  // Create the audit notes with severity and category
  const notes = `[${(options.category ?? "other").toUpperCase()}] [${(options.severity ?? "medium").toUpperCase()}] ${options.reason}`;

  // Create audit statement with result "failed"
  const auditOptions: EnactAuditAttestationOptions = {
    toolName,
    toolVersion: version,
    auditor: "unknown", // Will be filled by OIDC
    result: "failed",
    timestamp: new Date(),
    notes,
  };

  // Create a simple manifest placeholder for the subject hash
  // In a full implementation, we would fetch the actual manifest from registry
  const manifestPlaceholder = JSON.stringify({
    name: toolName,
    version,
    reported: true,
  });

  const statement = createEnactAuditStatement(manifestPlaceholder, auditOptions);

  if (options.verbose) {
    info("Created report attestation statement:");
    dim(JSON.stringify(statement, null, 2));
    newline();
  }

  // Sign the attestation using Sigstore
  info("Starting OIDC signing flow...");
  dim("A browser window will open for authentication.");
  newline();

  const result = await withSpinner("Signing report...", async () => {
    try {
      return await signAttestation(statement as unknown as Record<string, unknown>, {
        timeout: 120000, // 2 minutes for OIDC flow
      });
    } catch (err) {
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

  // Submit attestation to registry (unless --local)
  let registryResult: { auditor: string; rekorLogIndex: number | undefined } | undefined;

  if (!options.local) {
    // Check for auth token from keyring
    const authToken = await getSecret(AUTH_NAMESPACE, ACCESS_TOKEN_KEY);

    if (!authToken) {
      warning("Not authenticated with registry - report not submitted");
      dim("Run 'enact auth login' to authenticate, then report again");
      dim("Your report is still recorded on the Rekor transparency log.");
    } else {
      client.setAuthToken(authToken);

      try {
        const attestationResult = await withSpinner(
          "Submitting report to registry...",
          async () => {
            return await submitAttestation(client, {
              name: toolName,
              version: version!,
              sigstoreBundle: result.bundle as unknown as Record<string, unknown>,
            });
          }
        );

        registryResult = {
          auditor: attestationResult.auditor,
          rekorLogIndex: attestationResult.rekorLogIndex,
        };
      } catch (err) {
        warning("Failed to submit report to registry");
        if (err instanceof Error) {
          dim(`  ${err.message}`);
        }
        dim("Your report is still recorded on the Rekor transparency log.");
      }
    }
  } else {
    dim("Report signed locally only (--local flag)");
    dim("The signature is recorded on the Rekor transparency log.");
  }

  // Display result
  displayResult(toolName, version, options, registryResult);
}

/**
 * Configure the report command
 */
export function configureReportCommand(program: Command): void {
  program
    .command("report")
    .description(
      "Report security vulnerabilities or issues with a tool (creates signed attestation)"
    )
    .argument("<tool>", "Tool to report (name or name@version)")
    .requiredOption("-r, --reason <description>", "Issue description (required)")
    .option("-s, --severity <level>", "Severity level: critical, high, medium, low", "medium")
    .option(
      "-c, --category <type>",
      "Issue type: security, malware, quality, license, other",
      "other"
    )
    .option("--dry-run", "Show what would be submitted without submitting")
    .option("--local", "Sign locally only, do not submit to registry")
    .option("-v, --verbose", "Show detailed output")
    .option("--json", "Output result as JSON")
    .action(async (toolArg: string, options: ReportOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await reportHandler(toolArg, options, ctx);
      } catch (err) {
        error(formatError(err));
        if (options.verbose && err instanceof Error && err.stack) {
          dim(err.stack);
        }
        process.exit(1);
      }
    });
}
