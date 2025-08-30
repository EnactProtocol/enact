import { test, expect, beforeEach, afterEach } from 'bun:test';
import { SigningService as BackendSigning } from '../signing';
import { SigningService as FrontendSigning } from '../../../security-web/src/signing';
import { CryptoUtils as BackendCrypto } from '../crypto';
import { CryptoUtils as FrontendCrypto } from '../../../security-web/src/crypto';
import { KeyManager } from '../keyManager';
import type { EnactDocument } from '../types';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Test directories
const testTrustedKeysDir = path.join(os.tmpdir(), 'test-cross-platform-trusted-keys');
const testPrivateKeysDir = path.join(os.tmpdir(), 'test-cross-platform-private-keys');

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
  name: "cross-platform-tool",
  description: "A tool for testing cross-platform signatures",
  command: "echo 'Hello from frontend!'",
  enact: "1.0.0"
};

const testPrivateKey = "d8f8a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0";

test('Frontend signs, Backend verifies (with trusted key setup)', () => {
  // Step 1: Generate signature in frontend (security-web)
  const frontendSignature = FrontendSigning.signDocument(testDocument, testPrivateKey, {
    useEnactDefaults: true
  });
  
  // Step 2: Import the public key to backend trusted keys
  const publicKey = FrontendCrypto.getPublicKeyFromPrivate(testPrivateKey);
  KeyManager.importPublicKey('frontend-key', publicKey, 'Key from frontend');
  
  // Step 3: Verify signature in backend (security)
  const backendVerifies = BackendSigning.verifyDocument(testDocument, frontendSignature, {
    useEnactDefaults: true
  });
  
  expect(backendVerifies).toBe(true);
});

test('Frontend signs command-only, Backend verifies', () => {
  // Step 1: Generate command-only signature in frontend
  const frontendSignature = FrontendSigning.signDocument(testDocument, testPrivateKey, {
    includeFields: ['command']
  });
  
  // Step 2: Import the public key to backend trusted keys
  const publicKey = FrontendCrypto.getPublicKeyFromPrivate(testPrivateKey);
  KeyManager.importPublicKey('frontend-command-key', publicKey, 'Frontend command-only key');
  
  // Step 3: Verify command-only signature in backend
  const backendVerifies = BackendSigning.verifyDocument(testDocument, frontendSignature, {
    includeFields: ['command']
  });
  
  expect(backendVerifies).toBe(true);
});

test('Backend signs, Frontend verifies (no trusted key required)', () => {
  // Step 1: Generate key pair and store in backend
  const keyPair = KeyManager.generateAndStoreKey('backend-key', 'Backend signing key');
  
  // Step 2: Generate signature in backend
  const backendSignature = BackendSigning.signDocument(testDocument, keyPair.privateKey, {
    useEnactDefaults: true
  });
  
  // Step 3: Verify signature in frontend (no trusted keys validation)
  const frontendVerifies = FrontendSigning.verifyDocument(testDocument, backendSignature, {
    useEnactDefaults: true
  });
  
  expect(frontendVerifies).toBe(true);
});

test('Canonical documents match across platforms', () => {
  // Test with default fields
  const backendCanonical = BackendSigning.getCanonicalDocument(testDocument, {
    useEnactDefaults: true
  });
  
  const frontendCanonical = FrontendSigning.getCanonicalDocument(testDocument, {
    useEnactDefaults: true
  });
  
  expect(backendCanonical).toEqual(frontendCanonical);
  
  // Test with command-only
  const backendCommandOnly = BackendSigning.getCanonicalDocument(testDocument, {
    includeFields: ['command']
  });
  
  const frontendCommandOnly = FrontendSigning.getCanonicalDocument(testDocument, {
    includeFields: ['command']
  });
  
  expect(backendCommandOnly).toEqual(frontendCommandOnly);
  expect(backendCommandOnly).toEqual({ command: "echo 'Hello from frontend!'" });
});

test('Cross-platform signature with document modification', () => {
  // Frontend signs only the command
  const frontendSignature = FrontendSigning.signDocument(testDocument, testPrivateKey, {
    includeFields: ['command']
  });
  
  // Import key to backend
  const publicKey = FrontendCrypto.getPublicKeyFromPrivate(testPrivateKey);
  KeyManager.importPublicKey('modification-test-key', publicKey, 'Modification test key');
  
  // Modify other fields (should still verify since only command was signed)
  const modifiedDocument: EnactDocument = {
    ...testDocument,
    name: "modified-tool",
    description: "Modified description",
    version: "2.0.0"
    // command stays the same
  };
  
  // Backend should still verify the signature
  const backendVerifies = BackendSigning.verifyDocument(modifiedDocument, frontendSignature, {
    includeFields: ['command']
  });
  
  expect(backendVerifies).toBe(true);
  
  // But if we modify the command, it should fail
  const commandModifiedDocument: EnactDocument = {
    ...modifiedDocument,
    command: "echo 'Modified command!'"
  };
  
  const backendVerifiesModifiedCommand = BackendSigning.verifyDocument(commandModifiedDocument, frontendSignature, {
    includeFields: ['command']
  });
  
  expect(backendVerifiesModifiedCommand).toBe(false);
});

test('Multiple signature cross-platform verification', () => {
  // Generate two different key pairs
  const keyPair1 = KeyManager.generateAndStoreKey('multi-sig-1', 'Multi-sig key 1');
  const keyPair2 = KeyManager.generateAndStoreKey('multi-sig-2', 'Multi-sig key 2');
  
  // Frontend signs with first key
  const frontendSignature = FrontendSigning.signDocument(testDocument, keyPair1.privateKey, {
    includeFields: ['command']
  });
  
  // Backend signs with second key
  const backendSignature = BackendSigning.signDocument(testDocument, keyPair2.privateKey, {
    includeFields: ['command']
  });
  
  // Create document with both signatures
  const multiSignedDocument: EnactDocument = {
    ...testDocument,
    signatures: [frontendSignature, backendSignature]
  };
  
  // Backend should verify both signatures (since both keys are trusted)
  const backendVerifies = BackendSigning.verifyDocument(multiSignedDocument, frontendSignature, {
    includeFields: ['command']
  });
  
  expect(backendVerifies).toBe(true);
});

test('Key generation compatibility', () => {
  // Generate keys with both crypto utilities
  const backendKeyPair = BackendCrypto.generateKeyPair();
  const frontendKeyPair = FrontendCrypto.generateKeyPair();
  
  // Both should generate valid key pairs
  expect(backendKeyPair.privateKey.length).toBe(64); // 32 bytes * 2 (hex)
  expect(backendKeyPair.publicKey.length).toBe(66);  // 33 bytes * 2 (hex)
  expect(frontendKeyPair.privateKey.length).toBe(64);
  expect(frontendKeyPair.publicKey.length).toBe(66);
  
  // Test that backend can derive public key from frontend private key
  const derivedFromFrontend = BackendCrypto.getPublicKeyFromPrivate(frontendKeyPair.privateKey);
  expect(derivedFromFrontend).toBe(frontendKeyPair.publicKey);
  
  // Test that frontend can derive public key from backend private key  
  const derivedFromBackend = FrontendCrypto.getPublicKeyFromPrivate(backendKeyPair.privateKey);
  expect(derivedFromBackend).toBe(backendKeyPair.publicKey);
});