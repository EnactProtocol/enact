/**
 * OS Keyring integration for secure secret storage
 *
 * Uses the system keychain:
 * - macOS: Keychain
 * - Windows: Credential Manager
 * - Linux: Secret Service (libsecret)
 *
 * All secrets are stored with:
 * - Service: "enact-cli"
 * - Account: "{namespace}:{SECRET_NAME}"
 *
 * NOTE: Uses dynamic import to handle environments where native modules
 * are not available (e.g., Bun compiled binaries). Falls back gracefully
 * with clear error messages.
 */

import { KEYRING_SERVICE, type SecretMetadata } from "./types";

// Lazy-loaded keyring module
let _keyring: typeof import("@zowe/secrets-for-zowe-sdk").keyring | null = null;
let _keyringLoadError: Error | null = null;
let _keyringLoaded = false;

/**
 * Dynamically load the keyring module.
 * This allows the CLI to start even if native modules aren't available.
 */
async function getKeyring(): Promise<typeof import("@zowe/secrets-for-zowe-sdk").keyring> {
  if (_keyringLoaded) {
    if (_keyringLoadError) {
      throw _keyringLoadError;
    }
    return _keyring!;
  }

  try {
    const mod = await import("@zowe/secrets-for-zowe-sdk");
    _keyring = mod.keyring;
    _keyringLoaded = true;
    return _keyring;
  } catch (err) {
    _keyringLoaded = true;
    _keyringLoadError = new Error(
      `Keyring not available. Native keychain access requires Node.js (not a compiled binary).\nSecrets can still be provided via environment variables or .env files.\nOriginal error: ${err instanceof Error ? err.message : String(err)}`
    );
    throw _keyringLoadError;
  }
}

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
  const keyring = await getKeyring();
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
  const keyring = await getKeyring();
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
  const keyring = await getKeyring();
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
  const keyring = await getKeyring();
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
  const keyring = await getKeyring();
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
 *
 * @returns true if keyring operations are available
 */
export async function isKeyringAvailable(): Promise<boolean> {
  try {
    const keyring = await getKeyring();
    // Try to list credentials - this will fail if keyring is not available
    await keyring.findCredentials(KEYRING_SERVICE);
    return true;
  } catch {
    return false;
  }
}
