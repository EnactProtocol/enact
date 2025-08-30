import { test, expect, beforeEach, afterEach } from 'bun:test';
import { KeyManager } from '../keyManager';
import { SigningService } from '../signing';
import { CryptoUtils } from '../crypto';
import type { EnactDocument } from '../types';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Test document
const testDocument: EnactDocument = {
  name: "test-tool",
  description: "A test tool",
  command: "echo 'test'",
  enact: "1.0.0"
};

// Test directories
const testTrustedKeysDir = path.join(os.tmpdir(), 'test-enact-trusted-keys');
const testPrivateKeysDir = path.join(os.tmpdir(), 'test-enact-private-keys');

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

test('KeyManager.getAllTrustedPublicKeys() returns empty array when no trusted keys exist', () => {
  const trustedKeys = KeyManager.getAllTrustedPublicKeys();
  expect(trustedKeys).toEqual([]);
});

test('KeyManager.getAllTrustedPublicKeys() returns all trusted public keys', () => {
  // Generate and store some test keys
  const keyPair1 = KeyManager.generateAndStoreKey('test-key-1', 'Test key 1');
  const keyPair2 = KeyManager.generateAndStoreKey('test-key-2', 'Test key 2');
  
  // Import a public-only key
  const keyPair3 = CryptoUtils.generateKeyPair();
  KeyManager.importPublicKey('test-key-3', keyPair3.publicKey, 'Test key 3');
  
  const trustedKeys = KeyManager.getAllTrustedPublicKeys();
  
  expect(trustedKeys).toHaveLength(3);
  expect(trustedKeys).toContain(keyPair1.publicKey);
  expect(trustedKeys).toContain(keyPair2.publicKey);
  expect(trustedKeys).toContain(keyPair3.publicKey);
});

test('KeyManager.getAllTrustedPublicKeys() handles corrupted key files gracefully', () => {
  // Create a valid key first
  const keyPair = KeyManager.generateAndStoreKey('valid-key', 'Valid key');
  
  // Create a corrupted key file that will cause a read error
  fs.mkdirSync(testTrustedKeysDir, { recursive: true });
  // Create a directory instead of a file to cause a read error
  fs.mkdirSync(path.join(testTrustedKeysDir, 'corrupted-key.pub'));
  
  const trustedKeys = KeyManager.getAllTrustedPublicKeys();
  
  // Should return only the valid key, ignoring the corrupted one
  expect(trustedKeys).toHaveLength(1);
  expect(trustedKeys[0]).toBe(keyPair.publicKey);
});

test('SigningService.verifyDocument() accepts signatures from trusted keys', () => {
  // Generate a key pair and store it in trusted keys
  const keyPair = KeyManager.generateAndStoreKey('trusted-key', 'Trusted signing key');
  
  // Sign the document
  const signature = SigningService.signDocument(testDocument, keyPair.privateKey, { useEnactDefaults: true });
  
  // Verify should succeed because the key is trusted
  const isValid = SigningService.verifyDocument(
    testDocument,
    signature,
    { useEnactDefaults: true }
  );
  
  expect(isValid).toBe(true);
});

test('SigningService.verifyDocument() rejects signatures from untrusted keys', () => {
  // Generate a key pair but don't store it in trusted keys
  const untrustedKeyPair = CryptoUtils.generateKeyPair();
  
  // Sign the document with the untrusted key
  const signature = SigningService.signDocument(testDocument, untrustedKeyPair.privateKey, { useEnactDefaults: true });
  
  // Verify should fail because the key is not trusted
  const isValid = SigningService.verifyDocument(
    testDocument,
    signature,
    { useEnactDefaults: true }
  );
  
  expect(isValid).toBe(false);
});

test('SigningService.verifyDocument() handles multiple signatures with mixed trust levels', () => {
  // Create one trusted key and one untrusted key
  const trustedKeyPair = KeyManager.generateAndStoreKey('trusted-key', 'Trusted key');
  const untrustedKeyPair = CryptoUtils.generateKeyPair();
  
  // Sign with both keys
  const trustedSignature = SigningService.signDocument(testDocument, trustedKeyPair.privateKey, { useEnactDefaults: true });
  const untrustedSignature = SigningService.signDocument(testDocument, untrustedKeyPair.privateKey, { useEnactDefaults: true });
  
  // Document with both signatures
  const documentWithMixedSignatures: EnactDocument = {
    ...testDocument,
    signatures: [trustedSignature, untrustedSignature]
  };
  
  // Should fail because one signature is from an untrusted key
  const isValid = SigningService.verifyDocument(
    documentWithMixedSignatures,
    trustedSignature, // This parameter is ignored when document has signatures array
    { useEnactDefaults: true }
  );
  
  expect(isValid).toBe(false);
});

test('SigningService.verifyDocument() accepts multiple signatures from trusted keys', () => {
  // Create two trusted keys
  const keyPair1 = KeyManager.generateAndStoreKey('trusted-key-1', 'Trusted key 1');
  const keyPair2 = KeyManager.generateAndStoreKey('trusted-key-2', 'Trusted key 2');
  
  // Sign with both keys
  const signature1 = SigningService.signDocument(testDocument, keyPair1.privateKey, { useEnactDefaults: true });
  const signature2 = SigningService.signDocument(testDocument, keyPair2.privateKey, { useEnactDefaults: true });
  
  // Document with both signatures
  const documentWithMultipleSignatures: EnactDocument = {
    ...testDocument,
    signatures: [signature1, signature2]
  };
  
  // Should succeed because both signatures are from trusted keys
  const isValid = SigningService.verifyDocument(
    documentWithMultipleSignatures,
    signature1, // This parameter is ignored when document has signatures array
    { useEnactDefaults: true }
  );
  
  expect(isValid).toBe(true);
});

test('SigningService.verifyDocument() rejects valid signatures from untrusted keys', () => {
  // Create a key pair but don't add to trusted keys
  const untrustedKeyPair = CryptoUtils.generateKeyPair();
  
  // Sign document (signature will be cryptographically valid)
  const signature = SigningService.signDocument(testDocument, untrustedKeyPair.privateKey, { useEnactDefaults: true });
  
  // Verify that the signature would be valid if we bypassed trust check
  const messageHash = SigningService.createDocumentHash(testDocument, { useEnactDefaults: true });
  const cryptoValid = CryptoUtils.verify(signature.publicKey, messageHash, signature.signature);
  expect(cryptoValid).toBe(true); // Signature is cryptographically valid
  
  // But verification should fail due to untrusted key
  const isValid = SigningService.verifyDocument(
    testDocument,
    signature,
    { useEnactDefaults: true }
  );
  
  expect(isValid).toBe(false);
});

test('SigningService.verifyDocument() handles empty trusted keys directory', () => {
  // Ensure directory exists but is empty
  fs.mkdirSync(testTrustedKeysDir, { recursive: true });
  
  // Generate an untrusted key
  const keyPair = CryptoUtils.generateKeyPair();
  const signature = SigningService.signDocument(testDocument, keyPair.privateKey, { useEnactDefaults: true });
  
  // Should fail because no keys are trusted
  const isValid = SigningService.verifyDocument(
    testDocument,
    signature,
    { useEnactDefaults: true }
  );
  
  expect(isValid).toBe(false);
});

test('SigningService.verifyDocument() works after key is removed from trusted keys', () => {
  // Generate and store a key
  const keyPair = KeyManager.generateAndStoreKey('temp-key', 'Temporary key');
  
  // Sign document
  const signature = SigningService.signDocument(testDocument, keyPair.privateKey, { useEnactDefaults: true });
  
  // Initially should work
  let isValid = SigningService.verifyDocument(
    testDocument,
    signature,
    { useEnactDefaults: true }
  );
  expect(isValid).toBe(true);
  
  // Remove key from trusted keys
  KeyManager.removeKey('temp-key');
  
  // Now should fail
  isValid = SigningService.verifyDocument(
    testDocument,
    signature,
    { useEnactDefaults: true }
  );
  expect(isValid).toBe(false);
});

test('SigningService.verifyDocument() works after public key is imported', () => {
  // Generate a key pair
  const keyPair = CryptoUtils.generateKeyPair();
  
  // Sign document
  const signature = SigningService.signDocument(testDocument, keyPair.privateKey, { useEnactDefaults: true });
  
  // Initially should fail (key not trusted)
  let isValid = SigningService.verifyDocument(
    testDocument,
    signature,
    { useEnactDefaults: true }
  );
  expect(isValid).toBe(false);
  
  // Import the public key to trusted keys
  KeyManager.importPublicKey('imported-key', keyPair.publicKey, 'Imported key');
  
  // Now should succeed
  isValid = SigningService.verifyDocument(
    testDocument,
    signature,
    { useEnactDefaults: true }
  );
  expect(isValid).toBe(true);
});