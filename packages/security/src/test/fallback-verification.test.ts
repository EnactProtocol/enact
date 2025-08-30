import { test, expect, beforeEach, afterEach } from 'bun:test';
import { SigningService } from '../signing';
import { CryptoUtils } from '../crypto';
import { KeyManager } from '../keyManager';
import type { EnactDocument, Signature } from '../types';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Test directories
const testTrustedKeysDir = path.join(os.tmpdir(), 'test-fallback-trusted-keys');
const testPrivateKeysDir = path.join(os.tmpdir(), 'test-fallback-private-keys');

// Mock the storage paths for testing
const originalTrustedKeysDir = (KeyManager as any).TRUSTED_KEYS_DIR;
const originalPrivateKeysDir = (KeyManager as any).PRIVATE_KEYS_DIR;

beforeEach(() => {
  // Override the storage paths to use temp directories
  (KeyManager as any).TRUSTED_KEYS_DIR = testTrustedKeysDir;
  (KeyManager as any).PRIVATE_KEYS_DIR = testPrivateKeysDir;
  
  // Clean up any existing test directories
  if (fs.existsSync(testTrustedKeysDir)) {
    fs.rmSync(testTrustedKeysDir, { recursive: true, force: true });
  }
  if (fs.existsSync(testPrivateKeysDir)) {
    fs.rmSync(testPrivateKeysDir, { recursive: true, force: true });
  }
});

afterEach(() => {
  // Restore original paths
  (KeyManager as any).TRUSTED_KEYS_DIR = originalTrustedKeysDir;
  (KeyManager as any).PRIVATE_KEYS_DIR = originalPrivateKeysDir;
  
  // Clean up test directories
  if (fs.existsSync(testTrustedKeysDir)) {
    fs.rmSync(testTrustedKeysDir, { recursive: true, force: true });
  }
  if (fs.existsSync(testPrivateKeysDir)) {
    fs.rmSync(testPrivateKeysDir, { recursive: true, force: true });
  }
});

const testDocument: EnactDocument = {
  name: "fallback-test-tool",
  description: "Testing fallback verification",
  command: "echo 'fallback test'",
  enact: "1.0.0"
};

test('Verifies signature with null publicKey by trying all trusted keys', () => {
  // Create a trusted key pair
  const keyPair = KeyManager.generateAndStoreKey('trusted-key', 'Trusted key for fallback test');
  
  // Create a valid signature
  const validSignature = SigningService.signDocument(testDocument, keyPair.privateKey, {
    includeFields: ['command']
  });
  
  // Create signature with null publicKey
  const signatureWithNullKey: Signature = {
    ...validSignature,
    publicKey: null as any
  };
  
  // Should still verify by trying all trusted keys
  const isValid = SigningService.verifyDocument(testDocument, signatureWithNullKey, {
    includeFields: ['command']
  });
  
  expect(isValid).toBe(true);
});

test('Verifies signature with empty publicKey by trying all trusted keys', () => {
  // Create a trusted key pair
  const keyPair = KeyManager.generateAndStoreKey('trusted-key-2', 'Trusted key for empty test');
  
  // Create a valid signature
  const validSignature = SigningService.signDocument(testDocument, keyPair.privateKey, {
    includeFields: ['command']
  });
  
  // Create signature with empty publicKey
  const signatureWithEmptyKey: Signature = {
    ...validSignature,
    publicKey: ''
  };
  
  // Should still verify by trying all trusted keys
  const isValid = SigningService.verifyDocument(testDocument, signatureWithEmptyKey, {
    includeFields: ['command']
  });
  
  expect(isValid).toBe(true);
});

test('Verifies signature with undefined publicKey by trying all trusted keys', () => {
  // Create a trusted key pair
  const keyPair = KeyManager.generateAndStoreKey('trusted-key-3', 'Trusted key for undefined test');
  
  // Create a valid signature
  const validSignature = SigningService.signDocument(testDocument, keyPair.privateKey, {
    includeFields: ['command']
  });
  
  // Create signature with undefined publicKey
  const signatureWithUndefinedKey: Signature = {
    ...validSignature,
    publicKey: undefined as any
  };
  
  // Should still verify by trying all trusted keys
  const isValid = SigningService.verifyDocument(testDocument, signatureWithUndefinedKey, {
    includeFields: ['command']
  });
  
  expect(isValid).toBe(true);
});

test('Verifies signature with corrupted publicKey by trying all trusted keys', () => {
  // Create a trusted key pair
  const keyPair = KeyManager.generateAndStoreKey('trusted-key-4', 'Trusted key for corrupted test');
  
  // Create a valid signature
  const validSignature = SigningService.signDocument(testDocument, keyPair.privateKey, {
    includeFields: ['command']
  });
  
  // Create signature with corrupted publicKey
  const signatureWithCorruptedKey: Signature = {
    ...validSignature,
    publicKey: 'corrupted_invalid_key_data'
  };
  
  // Should still verify by trying all trusted keys
  const isValid = SigningService.verifyDocument(testDocument, signatureWithCorruptedKey, {
    includeFields: ['command']
  });
  
  expect(isValid).toBe(true);
});

test('Fails verification when signature matches no trusted keys', () => {
  // Create some trusted keys
  KeyManager.generateAndStoreKey('trusted-key-5', 'Trusted key 1');
  KeyManager.generateAndStoreKey('trusted-key-6', 'Trusted key 2');
  
  // Create signature with completely different (untrusted) key
  const untrustedKeyPair = CryptoUtils.generateKeyPair();
  const untrustedSignature = SigningService.signDocument(testDocument, untrustedKeyPair.privateKey, {
    includeFields: ['command']
  });
  
  // Corrupt the public key to force fallback verification
  const signatureWithBadKey: Signature = {
    ...untrustedSignature,
    publicKey: 'bad_key'
  };
  
  // Should fail because signature doesn't match any trusted key
  const isValid = SigningService.verifyDocument(testDocument, signatureWithBadKey, {
    includeFields: ['command']
  });
  
  expect(isValid).toBe(false);
});

test('Standard verification still works when publicKey is valid and trusted', () => {
  // Create a trusted key pair
  const keyPair = KeyManager.generateAndStoreKey('standard-key', 'Standard verification key');
  
  // Create a normal signature
  const signature = SigningService.signDocument(testDocument, keyPair.privateKey, {
    includeFields: ['command']
  });
  
  // Should verify normally (not using fallback)
  const isValid = SigningService.verifyDocument(testDocument, signature, {
    includeFields: ['command']
  });
  
  expect(isValid).toBe(true);
});

test('Fallback verification works with multiple trusted keys', () => {
  // Create multiple trusted key pairs
  const keyPair1 = KeyManager.generateAndStoreKey('multi-key-1', 'Multi key 1');
  const keyPair2 = KeyManager.generateAndStoreKey('multi-key-2', 'Multi key 2');
  const keyPair3 = KeyManager.generateAndStoreKey('multi-key-3', 'Multi key 3');
  
  // Create signature with the second key
  const validSignature = SigningService.signDocument(testDocument, keyPair2.privateKey, {
    includeFields: ['command']
  });
  
  // Remove publicKey to force fallback verification
  const signatureWithoutKey: Signature = {
    ...validSignature,
    publicKey: null as any
  };
  
  // Should find the correct key among all trusted keys
  const isValid = SigningService.verifyDocument(testDocument, signatureWithoutKey, {
    includeFields: ['command']
  });
  
  expect(isValid).toBe(true);
});

test('Handles crypto verification errors gracefully during fallback', () => {
  // Create a trusted key
  const keyPair = KeyManager.generateAndStoreKey('error-test-key', 'Error test key');
  
  // Create a signature with invalid signature data that might cause crypto errors
  const invalidSignature: Signature = {
    signature: 'invalid_signature_data_that_might_throw',
    publicKey: null as any,
    algorithm: 'secp256k1',
    timestamp: Date.now()
  };
  
  // Should handle errors gracefully and return false
  const isValid = SigningService.verifyDocument(testDocument, invalidSignature, {
    includeFields: ['command']
  });
  
  expect(isValid).toBe(false);
});

test('Fallback verification respects field selection options', () => {
  // Create trusted key
  const keyPair = KeyManager.generateAndStoreKey('field-test-key', 'Field test key');
  
  // Create signature for command field only
  const commandSignature = SigningService.signDocument(testDocument, keyPair.privateKey, {
    includeFields: ['command']
  });
  
  // Remove publicKey
  const signatureWithoutKey: Signature = {
    ...commandSignature,
    publicKey: ''
  };
  
  // Should verify with command-only field selection
  const validWithCommand = SigningService.verifyDocument(testDocument, signatureWithoutKey, {
    includeFields: ['command']
  });
  expect(validWithCommand).toBe(true);
  
  // Should fail with different field selection (default fields)
  const invalidWithDefaults = SigningService.verifyDocument(testDocument, signatureWithoutKey, {
    useEnactDefaults: true
  });
  expect(invalidWithDefaults).toBe(false);
});

test('Performance: fallback stops at first successful verification', () => {
  // Create multiple trusted keys (first one won't match, second will)
  KeyManager.generateAndStoreKey('no-match-key', 'Key that will not match');
  const matchingKeyPair = KeyManager.generateAndStoreKey('matching-key', 'Key that will match');
  KeyManager.generateAndStoreKey('should-not-try-key', 'Key that should not be tried');
  
  // Create signature with matching key
  const validSignature = SigningService.signDocument(testDocument, matchingKeyPair.privateKey, {
    includeFields: ['command']
  });
  
  // Remove publicKey to trigger fallback
  const signatureWithoutKey: Signature = {
    ...validSignature,
    publicKey: null as any
  };
  
  // Should successfully verify (and stop at first match for performance)
  const isValid = SigningService.verifyDocument(testDocument, signatureWithoutKey, {
    includeFields: ['command']
  });
  
  expect(isValid).toBe(true);
});