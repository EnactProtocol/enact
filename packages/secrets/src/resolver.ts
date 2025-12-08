/**
 * Secret resolution with namespace inheritance
 *
 * When a tool requests a secret, we walk up the namespace path:
 * Tool: alice/api/slack/notifier
 * Needs: API_TOKEN
 *
 * Lookup:
 *   1. alice/api/slack:API_TOKEN
 *   2. alice/api:API_TOKEN ✓ found
 *   3. alice:API_TOKEN
 *
 * First match wins.
 */

import { getSecret } from "./keyring";
import type {
  SecretResolution,
  SecretResolutionResult,
  SecretTrace,
  SecretTraceEntry,
} from "./types";

/**
 * Get the namespace chain for a tool path
 * Walks up the path segments from most specific to least specific
 *
 * @param toolPath - The full tool path (e.g., "alice/api/slack")
 * @returns Array of namespaces to check in order
 *
 * @example
 * getNamespaceChain("alice/api/slack")
 * // Returns: ["alice/api/slack", "alice/api", "alice"]
 */
export function getNamespaceChain(toolPath: string): string[] {
  const segments = toolPath.split("/").filter(Boolean);
  const chain: string[] = [];

  for (let i = segments.length; i > 0; i--) {
    chain.push(segments.slice(0, i).join("/"));
  }

  return chain;
}

/**
 * Resolve a secret using namespace inheritance
 *
 * @param toolPath - The tool path to resolve secrets for
 * @param secretName - The secret name to find
 * @returns Resolution result with namespace info, or not-found result
 */
export async function resolveSecret(
  toolPath: string,
  secretName: string
): Promise<SecretResolutionResult> {
  const namespaces = getNamespaceChain(toolPath);
  const searchedNamespaces: string[] = [];

  for (const namespace of namespaces) {
    searchedNamespaces.push(namespace);
    const value = await getSecret(namespace, secretName);

    if (value !== null) {
      return {
        namespace,
        value,
        key: secretName,
        found: true,
      };
    }
  }

  return {
    key: secretName,
    found: false,
    searchedNamespaces,
  };
}

/**
 * Trace secret resolution for debugging
 * Shows which namespaces were checked and where the secret was found
 *
 * @param toolPath - The tool path to resolve secrets for
 * @param secretName - The secret name to find
 * @returns Full trace with all namespaces checked
 */
export async function traceSecretResolution(
  toolPath: string,
  secretName: string
): Promise<SecretTrace> {
  const namespaces = getNamespaceChain(toolPath);
  const entries: SecretTraceEntry[] = [];
  let result: SecretResolutionResult | null = null;

  for (const namespace of namespaces) {
    const account = `${namespace}:${secretName}`;
    const value = await getSecret(namespace, secretName);
    const found = value !== null;

    entries.push({ namespace, account, found });

    if (found && !result) {
      result = {
        namespace,
        value,
        key: secretName,
        found: true,
      };
    }
  }

  // If not found anywhere
  if (!result) {
    result = {
      key: secretName,
      found: false,
      searchedNamespaces: namespaces,
    };
  }

  return {
    key: secretName,
    toolPath,
    entries,
    result,
  };
}

/**
 * Resolve multiple secrets for a tool
 *
 * @param toolPath - The tool path to resolve secrets for
 * @param secretNames - Array of secret names to resolve
 * @returns Map of secret name to resolution result
 */
export async function resolveSecrets(
  toolPath: string,
  secretNames: string[]
): Promise<Map<string, SecretResolutionResult>> {
  const results = new Map<string, SecretResolutionResult>();

  for (const name of secretNames) {
    const result = await resolveSecret(toolPath, name);
    results.set(name, result);
  }

  return results;
}

/**
 * Check if all required secrets are available for a tool
 *
 * @param toolPath - The tool path to check
 * @param requiredSecrets - Array of required secret names
 * @returns Object with available and missing secrets
 */
export async function checkRequiredSecrets(
  toolPath: string,
  requiredSecrets: string[]
): Promise<{
  allFound: boolean;
  found: SecretResolution[];
  missing: string[];
}> {
  const found: SecretResolution[] = [];
  const missing: string[] = [];

  for (const name of requiredSecrets) {
    const result = await resolveSecret(toolPath, name);
    if (result.found) {
      found.push(result);
    } else {
      missing.push(name);
    }
  }

  return {
    allFound: missing.length === 0,
    found,
    missing,
  };
}
