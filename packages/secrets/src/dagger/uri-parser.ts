/**
 * Dagger Secret URI parser and resolver
 *
 * Supports secret URIs:
 * - env://VAR_NAME - Environment variable
 * - file://PATH - File contents
 * - cmd://COMMAND - Command output
 * - op://VAULT/ITEM/FIELD - 1Password
 * - vault://PATH - HashiCorp Vault
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DaggerSecretScheme, DaggerSecretUri } from "../types";

/**
 * Valid URI schemes
 */
const VALID_SCHEMES = new Set<DaggerSecretScheme>(["env", "file", "cmd", "op", "vault"]);

/**
 * Parse a Dagger secret URI
 *
 * @param uri - The URI to parse (e.g., "env://API_KEY")
 * @returns Parsed URI with scheme and value
 * @throws Error if URI is invalid
 */
export function parseSecretUri(uri: string): DaggerSecretUri {
  const match = uri.match(/^([a-z]+):\/\/(.+)$/);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid secret URI format: ${uri}. Expected format: scheme://value`);
  }

  const schemeStr = match[1];
  const value = match[2];
  const scheme = schemeStr as DaggerSecretScheme;

  if (!VALID_SCHEMES.has(scheme)) {
    throw new Error(
      `Invalid secret URI scheme: ${scheme}. Valid schemes: ${Array.from(VALID_SCHEMES).join(", ")}`
    );
  }

  return {
    scheme,
    value,
    original: uri,
  };
}

/**
 * Check if a string is a valid secret URI
 */
export function isSecretUri(uri: string): boolean {
  try {
    parseSecretUri(uri);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a secret URI to its actual value
 *
 * @param uri - The URI to resolve
 * @returns The secret value
 * @throws Error if resolution fails
 */
export async function resolveSecretUri(uri: string): Promise<string> {
  const parsed = parseSecretUri(uri);

  switch (parsed.scheme) {
    case "env":
      return resolveEnvUri(parsed.value);
    case "file":
      return resolveFileUri(parsed.value);
    case "cmd":
      return resolveCmdUri(parsed.value);
    case "op":
      return resolveOpUri(parsed.value);
    case "vault":
      return resolveVaultUri(parsed.value);
    default:
      throw new Error(`Unsupported secret scheme: ${parsed.scheme}`);
  }
}

/**
 * Resolve env:// URI - read from environment variable
 */
function resolveEnvUri(varName: string): string {
  const value = process.env[varName];
  if (value === undefined) {
    throw new Error(`Environment variable '${varName}' is not set (from env://${varName})`);
  }
  return value;
}

/**
 * Resolve file:// URI - read file contents
 */
function resolveFileUri(path: string): string {
  // Handle relative paths
  const resolvedPath = resolve(path);

  if (!existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath} (from file://${path})`);
  }

  return readFileSync(resolvedPath, "utf-8").trim();
}

/**
 * Resolve cmd:// URI - execute command and capture output
 */
function resolveCmdUri(command: string): string {
  try {
    const output = execSync(command, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output.trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Command failed: ${command} (from cmd://${command}): ${message}`);
  }
}

/**
 * Resolve op:// URI - 1Password CLI
 * Format: op://vault/item/field
 *
 * Requires 1Password CLI (op) to be installed and authenticated
 */
function resolveOpUri(path: string): string {
  const opUri = `op://${path}`;
  try {
    const output = execSync(`op read "${opUri}"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output.trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `1Password read failed for ${opUri}. Ensure 'op' CLI is installed and authenticated: ${message}`
    );
  }
}

/**
 * Resolve vault:// URI - HashiCorp Vault
 * Format: vault://path/to/secret#field
 *
 * Requires Vault CLI and VAULT_ADDR, VAULT_TOKEN environment variables
 */
function resolveVaultUri(path: string): string {
  // Parse path and optional field
  const [secretPath, field] = path.split("#");

  try {
    const command = `vault kv get -format=json "${secretPath}"`;
    const output = execSync(command, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const data = JSON.parse(output);
    const secretData = data.data?.data ?? data.data;

    if (field) {
      if (!(field in secretData)) {
        throw new Error(`Field '${field}' not found in secret at ${secretPath}`);
      }
      return String(secretData[field]);
    }

    // If no field specified, return first value or JSON
    const values = Object.values(secretData);
    if (values.length === 1) {
      return String(values[0]);
    }
    return JSON.stringify(secretData);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        `Failed to parse Vault response for ${path}. Ensure VAULT_ADDR and VAULT_TOKEN are set.`
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Vault read failed for ${path}: ${message}`);
  }
}

/**
 * Get supported URI schemes
 */
export function getSupportedSchemes(): DaggerSecretScheme[] {
  return Array.from(VALID_SCHEMES);
}
