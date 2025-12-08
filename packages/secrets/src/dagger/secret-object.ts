/**
 * Get secret objects for Dagger integration
 *
 * Combines keyring secrets with Dagger URI overrides
 */

import { resolveSecret } from "../resolver";
import type { GetSecretOptions, SecretObject } from "../types";
import { isSecretUri, resolveSecretUri } from "./uri-parser";

/**
 * Get a secret object for Dagger
 *
 * If an override URI is provided, resolves that instead of keyring.
 * Otherwise, resolves from keyring with namespace inheritance.
 *
 * @param toolPath - The tool path for namespace resolution
 * @param secretName - The secret name
 * @param options - Options including override URI
 * @returns Secret object with name, value, and source info
 * @throws Error if secret not found
 */
export async function getSecretObject(
  toolPath: string,
  secretName: string,
  options: GetSecretOptions = {}
): Promise<SecretObject> {
  const { overrideUri } = options;

  // If override URI is provided, resolve it
  if (overrideUri) {
    const value = await resolveSecretUri(overrideUri);
    return {
      name: secretName,
      value,
      source: "override",
      overrideUri,
    };
  }

  // Otherwise, resolve from keyring
  const result = await resolveSecret(toolPath, secretName);

  if (!result.found) {
    throw new Error(
      `Secret '${secretName}' not found for tool '${toolPath}'. ` +
        `Searched namespaces: ${result.searchedNamespaces.join(", ")}. ` +
        `Set with: enact env set ${secretName} --secret --namespace <namespace>`
    );
  }

  return {
    name: secretName,
    value: result.value,
    source: "keyring",
    namespace: result.namespace,
  };
}

/**
 * Get multiple secret objects for a tool
 *
 * @param toolPath - The tool path for namespace resolution
 * @param secrets - Map of secret name to optional override URI
 * @returns Map of secret name to secret object
 */
export async function getSecretObjects(
  toolPath: string,
  secrets: Record<string, string | undefined>
): Promise<Map<string, SecretObject>> {
  const results = new Map<string, SecretObject>();

  for (const [name, overrideUri] of Object.entries(secrets)) {
    const obj = await getSecretObject(toolPath, name, overrideUri ? { overrideUri } : {});
    results.set(name, obj);
  }

  return results;
}

/**
 * Parse a secret override from CLI format
 *
 * Format: SECRET_NAME=uri
 * Example: API_TOKEN=env://MY_API_TOKEN
 *
 * @param override - The override string
 * @returns Parsed name and URI, or null if invalid
 */
export function parseSecretOverride(override: string): { name: string; uri: string } | null {
  const eqIndex = override.indexOf("=");
  if (eqIndex === -1) {
    return null;
  }

  const name = override.slice(0, eqIndex).trim();
  const uri = override.slice(eqIndex + 1).trim();

  if (!name || !isSecretUri(uri)) {
    return null;
  }

  return { name, uri };
}

/**
 * Parse multiple secret overrides from CLI
 *
 * @param overrides - Array of override strings
 * @returns Map of secret name to override URI
 */
export function parseSecretOverrides(overrides: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (const override of overrides) {
    const parsed = parseSecretOverride(override);
    if (parsed) {
      result[parsed.name] = parsed.uri;
    }
  }

  return result;
}

// Re-export URI functions
export { parseSecretUri, resolveSecretUri, isSecretUri, getSupportedSchemes } from "./uri-parser";
