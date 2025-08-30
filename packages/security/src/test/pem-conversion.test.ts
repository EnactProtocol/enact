import { test, expect, beforeEach, afterEach } from "bun:test";
import { CryptoUtils } from '../crypto';
import { SigningService } from '../signing';
import { KeyManager } from '../keyManager';
import fs from 'fs';
import path from 'path';
import os from 'os';

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

test("PEM conversion should produce consistent signing and verification", () => {
  // Generate a key pair
  const keyPair = CryptoUtils.generateKeyPair();
  
  // Convert to PEM format
  const privateKeyPem = CryptoUtils.hexToPem(keyPair.privateKey, 'PRIVATE');
  const publicKeyPem = CryptoUtils.hexToPem(keyPair.publicKey, 'PUBLIC');
  
  // Convert back to hex using pemToHex
  const privateKeyHex = CryptoUtils.pemToHex(privateKeyPem, 'PRIVATE');
  const publicKeyHex = CryptoUtils.pemToHex(publicKeyPem, 'PUBLIC');
  
  // Keys should match original
  expect(privateKeyHex).toBe(keyPair.privateKey);
  expect(publicKeyHex).toBe(keyPair.publicKey);
});

test("Manual PEM parsing vs proper PEM parsing should produce different results", () => {
  // Generate a key pair and convert to PEM
  const keyPair = CryptoUtils.generateKeyPair();
  const privateKeyPem = CryptoUtils.hexToPem(keyPair.privateKey, 'PRIVATE');
  const publicKeyPem = CryptoUtils.hexToPem(keyPair.publicKey, 'PUBLIC');
  
  // Manual parsing (flawed method)
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = privateKeyPem.substring(pemHeader.length, privateKeyPem.length - pemFooter.length).replace(/\s/g, '');
  const manualPrivateKeyHex = Array.from(atob(pemContents), c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  
  // Proper parsing
  const properPrivateKeyHex = CryptoUtils.pemToHex(privateKeyPem, 'PRIVATE');
  
  // They should be different
  expect(manualPrivateKeyHex).not.toBe(properPrivateKeyHex);
  expect(properPrivateKeyHex).toBe(keyPair.privateKey);
});

test("Tool signature with command field should work with proper PEM conversion", () => {
  // Generate a key pair
  const keyPair = CryptoUtils.generateKeyPair();
  const privateKeyPem = CryptoUtils.hexToPem(keyPair.privateKey, 'PRIVATE');
  
  // Add the public key to trusted keys
  KeyManager.importPublicKey('test-key', keyPair.publicKey, 'Test key for PEM conversion');
  
  // Create a tool document
  const toolDocument = {
    name: 'kgroves88/tool/example',
    description: 'This tool does stuff.',
    command: 'echo "This tool works"',
    version: '1.0.0',
    timeout: '30s',
    tags: [],
    from: undefined,
    inputSchema: undefined,
    outputSchema: undefined,
    env: undefined,
    namespace: undefined,
    resources: undefined
  };
  
  // Convert PEM to hex properly
  const privateKeyHex = CryptoUtils.pemToHex(privateKeyPem, 'PRIVATE');
  
  // Sign the document with only command field
  const signature = SigningService.signDocument(toolDocument, privateKeyHex, {
    includeFields: ['command']
  });
  
  // Verify the signature
  const isValid = SigningService.verifyDocument(toolDocument, signature, {
    includeFields: ['command']
  });
  
  expect(isValid).toBe(true);
  expect(signature.publicKey).toBe(keyPair.publicKey);
});

test("Tool signature verification should fail with mismatched includeFields", () => {
  // Generate a key pair
  const keyPair = CryptoUtils.generateKeyPair();
  
  // Add the public key to trusted keys
  KeyManager.importPublicKey('test-key', keyPair.publicKey, 'Test key for field verification');
  
  // Create a tool document
  const toolDocument = {
    name: 'kgroves88/tool/example',
    description: 'This tool does stuff.',
    command: 'echo "This tool works"',
    version: '1.0.0'
  };
  
  // Sign with command field only
  const signature = SigningService.signDocument(toolDocument, keyPair.privateKey, {
    includeFields: ['command']
  });
  
  // Try to verify with different fields
  const isValidWithName = SigningService.verifyDocument(toolDocument, signature, {
    includeFields: ['name', 'command']
  });
  
  const isValidWithCorrectFields = SigningService.verifyDocument(toolDocument, signature, {
    includeFields: ['command']
  });
  
  expect(isValidWithName).toBe(false);
  expect(isValidWithCorrectFields).toBe(true);
});

test("Cross-platform verification: manual PEM vs proper PEM should fail", () => {
  // Generate a key pair and convert to PEM
  const keyPair = CryptoUtils.generateKeyPair();
  const privateKeyPem = CryptoUtils.hexToPem(keyPair.privateKey, 'PRIVATE');
  
  // Add the public key to trusted keys
  KeyManager.importPublicKey('test-key', keyPair.publicKey, 'Test key for cross-platform verification');
  
  const toolDocument = {
    command: 'echo "test"'
  };
  
  // Get the proper private key for comparison
  const properPrivateKeyHex = CryptoUtils.pemToHex(privateKeyPem, 'PRIVATE');
  const properSignature = SigningService.signDocument(toolDocument, properPrivateKeyHex, {
    includeFields: ['command']
  });
  
  // Test that proper signature verifies correctly
  const isProperValid = SigningService.verifyDocument(toolDocument, properSignature, {
    includeFields: ['command']
  });
  
  expect(isProperValid).toBe(true);
  
  // Manual PEM parsing (simulating frontend bug) - demonstrate the issue
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = privateKeyPem.substring(pemHeader.length, privateKeyPem.length - pemFooter.length).replace(/\s/g, '');
  const manualPrivateKeyHex = Array.from(atob(pemContents), c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  
  // Manual parsing should produce different hex than proper parsing
  expect(manualPrivateKeyHex).not.toBe(properPrivateKeyHex);
  
  // Note: We can't actually sign with the manual key because it's invalid,
  // but we can demonstrate that the parsing produces different results
  expect(manualPrivateKeyHex.length).toBeGreaterThan(properPrivateKeyHex.length);
});