/**
 * enact trust command
 *
 * Manage trusted identities for attestation verification.
 * Uses a unified model: all trust is based on cryptographic attestations.
 * Publishers who want their tools trusted should self-sign them.
 */

import {
  type AttestationListResponse,
  addTrustedAuditor as addTrustedAuditorToRegistry,
  createApiClient,
  getAttestationList,
  getMyTrustedAuditors,
  getToolVersion,
  removeTrustedAuditor as removeTrustedAuditorFromRegistry,
  verifyAllAttestations,
} from "@enactprotocol/api";
import { getSecret } from "@enactprotocol/secrets";
import {
  addTrustedIdentity,
  getMinimumAttestations,
  getTrustPolicy,
  getTrustedIdentities,
  removeTrustedIdentity,
} from "@enactprotocol/shared";
import type { Command } from "commander";
import type { CommandContext, GlobalOptions } from "../../types";
import {
  dim,
  error,
  formatError,
  header,
  info,
  json,
  keyValue,
  listItem,
  newline,
  success,
  warning,
} from "../../utils";

/** Auth namespace for token storage */
const AUTH_NAMESPACE = "enact:auth";
const ACCESS_TOKEN_KEY = "access_token";

interface TrustOptions extends GlobalOptions {
  remove?: boolean;
  sync?: boolean;
}

interface TrustCheckOptions extends GlobalOptions {}

interface TrustListOptions extends GlobalOptions {
  sync?: boolean;
}

/**
 * Validate identity format
 * Must be provider:identity format (e.g., github:alice, google:user@example.com)
 */
function validateIdentity(identity: string): { valid: boolean; error?: string } {
  if (!identity.includes(":")) {
    return {
      valid: false,
      error:
        "Invalid identity format. Use provider:identity format (e.g., github:alice, google:user@example.com)",
    };
  }

  const [provider, ...rest] = identity.split(":");
  const id = rest.join(":"); // Handle cases like google:user@example.com

  if (!provider || !id) {
    return {
      valid: false,
      error: "Invalid identity format. Use provider:identity format (e.g., github:alice)",
    };
  }

  const validProviders = ["github", "google", "microsoft", "gitlab"];
  if (!validProviders.includes(provider) && !provider.startsWith("http")) {
    warning(`Unknown provider '${provider}'. Common providers: ${validProviders.join(", ")}`);
  }

  return { valid: true };
}

/**
 * Add a trusted identity
 */
async function addTrust(
  identity: string,
  options: TrustOptions,
  _ctx: CommandContext
): Promise<void> {
  // Validate identity format
  const validation = validateIdentity(identity);
  if (!validation.valid) {
    error(validation.error!);
    process.exit(1);
  }

  // Add to local config
  const added = addTrustedIdentity(identity);
  if (added) {
    success(`Added ${identity} to trusted identities`);
  } else {
    info(`${identity} is already trusted`);
  }

  // Sync to registry if authenticated and --sync flag
  if (options.sync) {
    const authToken = await getSecret(AUTH_NAMESPACE, ACCESS_TOKEN_KEY);
    if (authToken) {
      const client = createApiClient();
      client.setAuthToken(authToken);
      try {
        await addTrustedAuditorToRegistry(client, identity);
        success(`Synced ${identity} to registry`);
      } catch (err) {
        warning(`Failed to sync to registry: ${formatError(err)}`);
      }
    } else {
      dim("Not authenticated - skipping registry sync");
      dim("Run 'enact auth login' to enable registry sync");
    }
  }

  if (options.json) {
    json({ added: true, identity });
  }
}

/**
 * Remove a trusted identity
 */
async function removeTrust(
  identity: string,
  options: TrustOptions,
  _ctx: CommandContext
): Promise<void> {
  // Remove from local config
  const removed = removeTrustedIdentity(identity);
  if (removed) {
    success(`Removed ${identity} from trusted identities`);
  } else {
    info(`${identity} was not in trusted list`);
  }

  // Sync to registry if authenticated and --sync flag
  if (options.sync) {
    const authToken = await getSecret(AUTH_NAMESPACE, ACCESS_TOKEN_KEY);
    if (authToken) {
      const client = createApiClient();
      client.setAuthToken(authToken);
      try {
        await removeTrustedAuditorFromRegistry(client, identity);
        success(`Removed ${identity} from registry`);
      } catch (err) {
        warning(`Failed to sync to registry: ${formatError(err)}`);
      }
    } else {
      dim("Not authenticated - skipping registry sync");
    }
  }

  if (options.json) {
    json({ removed: true, identity });
  }
}

/**
 * Trust command handler (add or remove)
 */
async function trustHandler(
  identity: string,
  options: TrustOptions,
  ctx: CommandContext
): Promise<void> {
  if (options.remove) {
    return removeTrust(identity, options, ctx);
  }
  return addTrust(identity, options, ctx);
}

/**
 * List trusted identities
 */
async function trustListHandler(options: TrustListOptions, _ctx: CommandContext): Promise<void> {
  const auditors = getTrustedIdentities();
  const policy = getTrustPolicy();
  const minimumAttestations = getMinimumAttestations();

  // Get remote identities if authenticated and --sync flag
  let remoteIdentities: string[] = [];
  if (options.sync) {
    const authToken = await getSecret(AUTH_NAMESPACE, ACCESS_TOKEN_KEY);
    if (authToken) {
      const client = createApiClient();
      client.setAuthToken(authToken);
      try {
        remoteIdentities = await getMyTrustedAuditors(client);
      } catch (err) {
        warning(`Failed to fetch remote trust config: ${formatError(err)}`);
      }
    } else {
      dim("Not authenticated - showing local config only");
    }
  }

  if (options.json) {
    json({
      identities: auditors,
      remoteIdentities: options.sync ? remoteIdentities : undefined,
      policy,
      minimum_attestations: minimumAttestations,
    });
    return;
  }

  header("Trusted Identities");
  newline();
  if (auditors.length === 0) {
    dim("  No trusted identities configured");
    dim("  Add with: enact trust provider:identity");
  } else {
    for (const identity of auditors) {
      listItem(identity, 2);
    }
  }

  if (options.sync && remoteIdentities.length > 0) {
    newline();
    header("Trusted Identities (Registry)");
    newline();
    for (const identity of remoteIdentities) {
      listItem(identity, 2);
    }
  }

  newline();
  dim(`Policy: ${policy}`);
  dim(`Minimum attestations: ${minimumAttestations}`);
}

/**
 * Parse tool@version syntax
 */
function parseToolSpec(spec: string): { name: string; version: string | undefined } {
  const atIndex = spec.lastIndexOf("@");
  if (atIndex === -1 || atIndex === 0) {
    return { name: spec, version: undefined };
  }
  return {
    name: spec.slice(0, atIndex),
    version: spec.slice(atIndex + 1),
  };
}

/**
 * Check trust status of a tool
 */
async function trustCheckHandler(
  tool: string,
  options: TrustCheckOptions,
  _ctx: CommandContext
): Promise<void> {
  const { name, version } = parseToolSpec(tool);

  if (!version) {
    error("Please specify a version: tool-name@version");
    process.exit(1);
  }

  const trustedIdentities = getTrustedIdentities();
  const client = createApiClient();

  const trustedBy: string[] = [];
  let verifiedAuditors: string[] = [];
  let allAttestors: string[] = [];
  let bundleHash = "";

  try {
    // Fetch tool version info to get bundle hash
    const toolVersion = await getToolVersion(client, name, version);
    bundleHash = toolVersion.bundle?.hash ?? "";

    if (!bundleHash) {
      warning("Cannot verify attestations: tool bundle hash not found");
    } else {
      // Fetch attestations from registry
      const attestationsResponse: AttestationListResponse = await getAttestationList(
        client,
        name,
        version
      );
      const attestations = attestationsResponse.attestations;

      // Collect all attestors
      allAttestors = attestations.map((att: { auditor: string }) => att.auditor);

      if (attestations.length > 0) {
        // Verify all attestations locally (never trust registry's verification status)
        const verifiedResults = await verifyAllAttestations(client, name, version, bundleHash);

        // Update verifiedAuditors with the new format
        verifiedAuditors = verifiedResults.map((a) => a.providerIdentity);

        // Check which verified auditors are trusted
        for (const result of verifiedResults) {
          if (trustedIdentities.includes(result.providerIdentity)) {
            trustedBy.push(result.providerIdentity);
          }
        }
      }
    }
  } catch (err) {
    if (options.json) {
      json({
        tool: name,
        version,
        trusted: false,
        error: formatError(err),
      });
      return;
    }
    warning(`Failed to check attestations: ${formatError(err)}`);
  }

  const trusted = trustedBy.length > 0;
  const hasAnyAttestation = allAttestors.length > 0;
  const verifiedCount = verifiedAuditors.length;

  if (options.json) {
    json({
      tool: name,
      version,
      trusted,
      trustedBy,
      verifiedAuditors,
      totalAttestations: allAttestors.length,
      verifiedAttestations: verifiedCount,
      checkedIdentities: trustedIdentities.length,
    });
    return;
  }

  header(`Trust Status: ${name}@${version}`);
  newline();

  if (trusted) {
    success("✓ Trusted");
    keyValue("Verified by trusted identity(ies)", trustedBy.join(", "));
  } else if (hasAnyAttestation) {
    warning("⚠ Not trusted by any configured identities");
    if (verifiedCount > 0) {
      keyValue("Verified attestations", verifiedAuditors.join(", "));
    }
  } else {
    warning("⚠ No attestations found");
  }

  newline();
  dim(`Total attestations: ${allAttestors.length}`);
  dim(`Cryptographically verified: ${verifiedCount}`);
  dim(`Trusted identities configured: ${trustedIdentities.length}`);

  if (!trusted && verifiedCount > 0) {
    newline();
    info("To trust this tool, add one of the verified identities:");
    for (const identity of verifiedAuditors.slice(0, 3)) {
      dim(`  enact trust ${identity}`);
    }
  }
}

/**
 * Configure the trust command
 */
export function configureTrustCommand(program: Command): void {
  const trust = program
    .command("trust")
    .description("Manage trusted publishers and auditors")
    .argument("[identity]", "Identity to trust (format: provider:identity, e.g., github:alice)")
    .option("-r, --remove", "Remove from trusted list instead of adding")
    .option("-s, --sync", "Sync with registry (requires authentication)")
    .option("--json", "Output as JSON")
    .action(async (identity: string | undefined, options: TrustOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        if (!identity) {
          // No identity provided, show list
          await trustListHandler(options, ctx);
        } else {
          await trustHandler(identity, options, ctx);
        }
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });

  // trust list
  trust
    .command("list")
    .description("List all trusted identities")
    .option("-s, --sync", "Also show registry trust config (requires authentication)")
    .option("--json", "Output as JSON")
    .action(async (options: TrustListOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await trustListHandler(options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });

  // trust check
  trust
    .command("check")
    .description("Check trust status of a tool")
    .argument("<tool>", "Tool to check (name@version)")
    .option("--json", "Output as JSON")
    .action(async (tool: string, options: TrustCheckOptions) => {
      const ctx: CommandContext = {
        cwd: process.cwd(),
        options,
        isCI: Boolean(process.env.CI),
        isInteractive: process.stdout.isTTY ?? false,
      };

      try {
        await trustCheckHandler(tool, options, ctx);
      } catch (err) {
        error(formatError(err));
        process.exit(1);
      }
    });
}
