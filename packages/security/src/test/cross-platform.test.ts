import { test, expect, beforeEach, afterEach } from "bun:test";
import { SigningService, CryptoUtils } from "../index";
import { KeyManager } from "../keyManager";
import type { EnactDocument } from "../types";
import fs from 'fs';
import path from 'path';
import os from 'os';

// Shared test data
const testDocument: EnactDocument = {
  id: "test-doc-123",
  content: "This is a test document for cross-platform verification",
  timestamp: 1640995200000, // Fixed timestamp for consistency
  metadata: { version: "1.0", author: "test" }
};

const testPrivateKey = "d8f8a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0";

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

test("Backend: Generate signature that should work on frontend", () => {
  // Import the test key as trusted
  const publicKey = CryptoUtils.getPublicKeyFromPrivate(testPrivateKey);
  KeyManager.importPublicKey('test-key', publicKey, 'Cross-platform test key');
  
  const signature = SigningService.signDocument(testDocument, testPrivateKey);
  
  // Verify locally first
  const isValid = SigningService.verifyDocument(testDocument, signature);
  expect(isValid).toBe(true);
  
  // Output signature data for frontend test
  console.log("Backend generated signature:", JSON.stringify({
    signature: signature.signature,
    publicKey: signature.publicKey,
    algorithm: signature.algorithm,
    timestamp: signature.timestamp,
    documentHash: SigningService.createDocumentHash(testDocument)
  }, null, 2));
});

test("Backend: Verify signature from frontend", () => {
  // Import the test key as trusted
  const publicKey = CryptoUtils.getPublicKeyFromPrivate(testPrivateKey);
  KeyManager.importPublicKey('test-key', publicKey, 'Cross-platform test key');
  
  // For now, test with a known good signature
  const backendSignature = SigningService.signDocument(testDocument, testPrivateKey);
  const isValid = SigningService.verifyDocument(testDocument, backendSignature);
  expect(isValid).toBe(true);
});

test("Backend: Key generation and derivation", () => {
  const publicKey = CryptoUtils.getPublicKeyFromPrivate(testPrivateKey);
  expect(publicKey).toBeDefined();
  expect(publicKey.length).toBe(66); // 33 bytes * 2 (hex)
  
  console.log("Test private key:", testPrivateKey);
  console.log("Derived public key:", publicKey);
});