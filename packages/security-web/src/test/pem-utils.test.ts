import { test, expect, beforeEach } from "bun:test";
import { PemUtils } from '../pemUtils';
import { CryptoUtils } from '../crypto';

// Mock localStorage for testing
const mockLocalStorage = {
  store: new Map<string, string>(),
  getItem: function(key: string): string | null {
    return this.store.get(key) || null;
  },
  setItem: function(key: string, value: string): void {
    this.store.set(key, value);
  },
  removeItem: function(key: string): void {
    this.store.delete(key);
  },
  clear: function(): void {
    this.store.clear();
  }
};

// Setup global localStorage mock
beforeEach(() => {
  global.localStorage = mockLocalStorage as any;
  mockLocalStorage.clear();
});

test("PemUtils should generate key pair in PEM format", () => {
  const result = PemUtils.generateKeyPairAsPem();
  
  expect(result.privateKeyPem).toContain('-----BEGIN PRIVATE KEY-----');
  expect(result.privateKeyPem).toContain('-----END PRIVATE KEY-----');
  expect(result.publicKeyPem).toContain('-----BEGIN PUBLIC KEY-----');
  expect(result.publicKeyPem).toContain('-----END PUBLIC KEY-----');
  
  // Should be able to convert back to hex
  const convertedBack = PemUtils.pemToKeyPair(result.privateKeyPem, result.publicKeyPem);
  expect(convertedBack.privateKey).toBe(result.keyPair.privateKey);
  expect(convertedBack.publicKey).toBe(result.keyPair.publicKey);
});

test("PemUtils should convert hex to PEM and back", () => {
  const originalKeyPair = CryptoUtils.generateKeyPair();
  
  const { privateKeyPem, publicKeyPem } = PemUtils.keyPairToPem(originalKeyPair);
  const convertedBack = PemUtils.pemToKeyPair(privateKeyPem, publicKeyPem);
  
  expect(convertedBack.privateKey).toBe(originalKeyPair.privateKey);
  expect(convertedBack.publicKey).toBe(originalKeyPair.publicKey);
});

test("PemUtils should store and retrieve keys from localStorage", () => {
  const userId = 'test-user-123';
  const keyPair = CryptoUtils.generateKeyPair();
  
  // Clear any existing keys
  PemUtils.clearAllKeys(userId);
  
  // Store a key
  const storedKey = PemUtils.storeKeyPairInLocalStorage(userId, {
    name: 'Test Key',
    keyPair,
    purpose: 'testing',
    isActive: true
  });
  
  expect(storedKey.name).toBe('Test Key');
  expect(storedKey.purpose).toBe('testing');
  expect(storedKey.isActive).toBe(true);
  
  // Retrieve keys
  const allKeys = PemUtils.getStoredKeyPairs(userId);
  expect(allKeys).toHaveLength(1);
  expect(allKeys[0].id).toBe(storedKey.id);
  
  // Get specific key
  const retrievedKey = PemUtils.getStoredKeyPair(userId, storedKey.id);
  expect(retrievedKey).toBeDefined();
  expect(retrievedKey!.name).toBe('Test Key');
  
  // Get active key
  const activeKey = PemUtils.getActiveKeyPair(userId);
  expect(activeKey).toBeDefined();
  expect(activeKey!.id).toBe(storedKey.id);
  
  // Convert back to hex for use
  const hexKeys = PemUtils.getHexKeysFromStored(storedKey);
  expect(hexKeys.privateKey).toBe(keyPair.privateKey);
  expect(hexKeys.publicKey).toBe(keyPair.publicKey);
  
  // Clean up
  PemUtils.clearAllKeys(userId);
});

test("PemUtils should set active key correctly", () => {
  const userId = 'test-user-456';
  PemUtils.clearAllKeys(userId);
  
  const keyPair1 = CryptoUtils.generateKeyPair();
  const keyPair2 = CryptoUtils.generateKeyPair();
  
  // Store two keys
  const key1 = PemUtils.storeKeyPairInLocalStorage(userId, {
    name: 'Key 1',
    keyPair: keyPair1,
    isActive: true
  });
  
  const key2 = PemUtils.storeKeyPairInLocalStorage(userId, {
    name: 'Key 2',
    keyPair: keyPair2,
    isActive: false
  });
  
  // Key 1 should be active
  let activeKey = PemUtils.getActiveKeyPair(userId);
  expect(activeKey!.id).toBe(key1.id);
  
  // Set key 2 as active
  const success = PemUtils.setActiveKey(userId, key2.id);
  expect(success).toBe(true);
  
  // Key 2 should now be active
  activeKey = PemUtils.getActiveKeyPair(userId);
  expect(activeKey!.id).toBe(key2.id);
  
  // Key 1 should no longer be active
  const key1Updated = PemUtils.getStoredKeyPair(userId, key1.id);
  expect(key1Updated!.isActive).toBe(false);
  
  PemUtils.clearAllKeys(userId);
});

test("PemUtils should validate key pairs correctly", () => {
  const keyPair = CryptoUtils.generateKeyPair();
  const { privateKeyPem, publicKeyPem } = PemUtils.keyPairToPem(keyPair);
  
  // Valid key pair
  const validationResult = PemUtils.validateKeyPair(privateKeyPem, publicKeyPem);
  expect(validationResult.isValid).toBe(true);
  expect(validationResult.error).toBeUndefined();
  
  // Invalid PEM format
  const invalidResult = PemUtils.validateKeyPair('invalid-pem-content');
  expect(invalidResult.isValid).toBe(false);
  expect(invalidResult.error).toBeDefined();
});

test("PemUtils should import key pairs from PEM", () => {
  const userId = 'test-user-789';
  PemUtils.clearAllKeys(userId);
  
  const originalKeyPair = CryptoUtils.generateKeyPair();
  const { privateKeyPem, publicKeyPem } = PemUtils.keyPairToPem(originalKeyPair);
  
  // Import the key pair
  const importedKey = PemUtils.importKeyPairFromPem(
    userId,
    'Imported Key',
    privateKeyPem,
    publicKeyPem,
    'imported'
  );
  
  expect(importedKey.name).toBe('Imported Key');
  expect(importedKey.purpose).toBe('imported');
  
  // Verify it's stored correctly
  const retrievedKey = PemUtils.getStoredKeyPair(userId, importedKey.id);
  expect(retrievedKey).toBeDefined();
  
  // Verify the keys match
  const hexKeys = PemUtils.getHexKeysFromStored(importedKey);
  expect(hexKeys.privateKey).toBe(originalKeyPair.privateKey);
  expect(hexKeys.publicKey).toBe(originalKeyPair.publicKey);
  
  PemUtils.clearAllKeys(userId);
});

test("PemUtils should delete keys correctly", () => {
  const userId = 'test-user-delete';
  PemUtils.clearAllKeys(userId);
  
  const keyPair = CryptoUtils.generateKeyPair();
  
  const storedKey = PemUtils.storeKeyPairInLocalStorage(userId, {
    name: 'Key to Delete',
    keyPair
  });
  
  // Verify key exists
  let allKeys = PemUtils.getStoredKeyPairs(userId);
  expect(allKeys).toHaveLength(1);
  
  // Delete the key
  const deleted = PemUtils.deleteStoredKeyPair(userId, storedKey.id);
  expect(deleted).toBe(true);
  
  // Verify key is gone
  allKeys = PemUtils.getStoredKeyPairs(userId);
  expect(allKeys).toHaveLength(0);
  
  // Try to delete non-existent key
  const notDeleted = PemUtils.deleteStoredKeyPair(userId, 'non-existent-id');
  expect(notDeleted).toBe(false);
});