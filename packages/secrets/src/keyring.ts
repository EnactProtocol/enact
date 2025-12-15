/**
 * OS Keyring integration for secure secret storage
 *
 * Uses the system keychain:
 * - macOS: Keychain
 * - Windows: Credential Manager
 * - Linux: Secret Service (libsecret)
 * - Fallback: Encrypted file storage (for headless/unsupported systems)
 *
 * All secrets are stored with:
 * - Service: "enact-cli"
 * - Account: "{namespace}:{SECRET_NAME}"
 */

import * as keyring from "@enactprotocol/keyring";
import { KEYRING_SERVICE, type SecretMetadata } from "./types";

/**
 * Build the account string for keyring storage
 * Format: "namespace:SECRET_NAME"
 */
export function buildAccount(namespace: string, secretName: string): string {
  return `${namespace}:${secretName}`;
}

/**
 * Parse an account string back to namespace and secret name
 */
export function parseAccount(account: string): {
  namespace: string;
  secretName: string;
} {
  const colonIndex = account.lastIndexOf(":");
  if (colonIndex === -1) {
    throw new Error(`Invalid account format: ${account}`);
  }
  return {
    namespace: account.slice(0, colonIndex),
    secretName: account.slice(colonIndex + 1),
  };
}

/**
 * Store a secret in the OS keyring
 *
 * @param namespace - The namespace for the secret (e.g., "alice/api")
 * @param name - The secret name (e.g., "API_TOKEN")
 * @param value - The secret value to store
 */
export async function setSecret(namespace: string, name: string, value: string): Promise<void> {
  const account = buildAccount(namespace, name);
  await keyring.setPassword(KEYRING_SERVICE, account, value);
}

/**
 * Retrieve a secret from the OS keyring
 *
 * @param namespace - The namespace for the secret
 * @param name - The secret name
 * @returns The secret value, or null if not found
 */
export async function getSecret(namespace: string, name: string): Promise<string | null> {
  const account = buildAccount(namespace, name);
  const value = await keyring.getPassword(KEYRING_SERVICE, account);
  return value ?? null;
}

/**
 * Delete a secret from the OS keyring
 *
 * @param namespace - The namespace for the secret
 * @param name - The secret name
 * @returns true if deleted, false if not found
 */
export async function deleteSecret(namespace: string, name: string): Promise<boolean> {
  const account = buildAccount(namespace, name);
  return await keyring.deletePassword(KEYRING_SERVICE, account);
}

/**
 * List all secrets for a namespace
 *
 * @param namespace - The namespace to list secrets for
 * @returns Array of secret names in the namespace
 */
export async function listSecrets(namespace: string): Promise<string[]> {
  const credentials = await keyring.findCredentials(KEYRING_SERVICE);
  const prefix = `${namespace}:`;

  return credentials
    .filter((cred) => cred.account.startsWith(prefix))
    .map((cred) => cred.account.slice(prefix.length));
}

/**
 * List all secrets across all namespaces
 *
 * @returns Array of secret metadata
 */
export async function listAllSecrets(): Promise<SecretMetadata[]> {
  const credentials = await keyring.findCredentials(KEYRING_SERVICE);

  return credentials.map((cred) => {
    const { namespace, secretName } = parseAccount(cred.account);
    return {
      key: secretName,
      namespace,
    };
  });
}

/**
 * Check if a secret exists in the keyring
 *
 * @param namespace - The namespace for the secret
 * @param name - The secret name
 * @returns true if the secret exists
 */
export async function secretExists(namespace: string, name: string): Promise<boolean> {
  const value = await getSecret(namespace, name);
  return value !== null;
}

/**
 * Check if the keyring is available on this system
 * (Always returns true since we have fallback storage)
 *
 * @returns true if keyring operations are available
 */
export async function isKeyringAvailable(): Promise<boolean> {
  return true;
}

/**
 * Check if using fallback encrypted file storage instead of OS keyring
 *
 * @returns true if using fallback storage
 */
export function isUsingFallbackStorage(): boolean {
  return keyring.isUsingFallback();
}
