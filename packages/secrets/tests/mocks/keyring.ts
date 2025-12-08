/**
 * Mock keyring for testing
 *
 * Provides an in-memory implementation of the keyring interface
 * that can be used in tests without touching the real system keyring.
 */

import type { SecretMetadata } from "../../src/types";

interface Credential {
  account: string;
  password: string;
}

/**
 * In-memory credential store
 */
const store = new Map<string, Map<string, string>>();

/**
 * Mock keyring implementation
 */
export const mockKeyring = {
  /**
   * Set a password in the mock keyring
   */
  async setPassword(service: string, account: string, password: string): Promise<void> {
    if (!store.has(service)) {
      store.set(service, new Map());
    }
    store.get(service)?.set(account, password);
  },

  /**
   * Get a password from the mock keyring
   */
  async getPassword(service: string, account: string): Promise<string | null> {
    const serviceStore = store.get(service);
    if (!serviceStore) {
      return null;
    }
    return serviceStore.get(account) ?? null;
  },

  /**
   * Delete a password from the mock keyring
   */
  async deletePassword(service: string, account: string): Promise<boolean> {
    const serviceStore = store.get(service);
    if (!serviceStore) {
      return false;
    }
    return serviceStore.delete(account);
  },

  /**
   * Find all credentials for a service
   */
  async findCredentials(service: string): Promise<Credential[]> {
    const serviceStore = store.get(service);
    if (!serviceStore) {
      return [];
    }

    const credentials: Credential[] = [];
    for (const [account, password] of serviceStore.entries()) {
      credentials.push({ account, password });
    }
    return credentials;
  },

  /**
   * Clear all credentials (for test cleanup)
   */
  clear(): void {
    store.clear();
  },

  /**
   * Clear credentials for a specific service
   */
  clearService(service: string): void {
    store.delete(service);
  },

  /**
   * Get all stored credentials (for debugging)
   */
  getAll(): Map<string, Map<string, string>> {
    return new Map(store);
  },
};

/**
 * Create mock keyring functions that use the mock store
 * These have the same signature as the real keyring functions
 */
export function createMockKeyringFunctions(service: string) {
  const getSecretFn = async (namespace: string, name: string): Promise<string | null> => {
    const account = `${namespace}:${name}`;
    return mockKeyring.getPassword(service, account);
  };

  return {
    async setSecret(namespace: string, name: string, value: string): Promise<void> {
      const account = `${namespace}:${name}`;
      await mockKeyring.setPassword(service, account, value);
    },

    getSecret: getSecretFn,

    async deleteSecret(namespace: string, name: string): Promise<boolean> {
      const account = `${namespace}:${name}`;
      return mockKeyring.deletePassword(service, account);
    },

    async listSecrets(namespace: string): Promise<string[]> {
      const credentials = await mockKeyring.findCredentials(service);
      const prefix = `${namespace}:`;
      return credentials
        .filter((cred) => cred.account.startsWith(prefix))
        .map((cred) => cred.account.slice(prefix.length));
    },

    async listAllSecrets(): Promise<SecretMetadata[]> {
      const credentials = await mockKeyring.findCredentials(service);
      return credentials.map((cred) => {
        const colonIndex = cred.account.lastIndexOf(":");
        return {
          key: cred.account.slice(colonIndex + 1),
          namespace: cred.account.slice(0, colonIndex),
        };
      });
    },

    async secretExists(namespace: string, name: string): Promise<boolean> {
      const value = await getSecretFn(namespace, name);
      return value !== null;
    },
  };
}

/**
 * Reset the mock keyring between tests
 */
export function resetMockKeyring(): void {
  mockKeyring.clear();
}

/**
 * Seed the mock keyring with test data
 */
export function seedMockKeyring(
  service: string,
  secrets: Array<{ namespace: string; name: string; value: string }>
): void {
  for (const { namespace, name, value } of secrets) {
    const account = `${namespace}:${name}`;
    if (!store.has(service)) {
      store.set(service, new Map());
    }
    store.get(service)?.set(account, value);
  }
}
