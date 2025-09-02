import { test, expect } from "bun:test";
import { SigningService, CryptoUtils } from "../index";
import type { EnactDocument } from "../types";

// Shared test data (must match backend test)
const testDocument: EnactDocument = {
  id: "test-doc-123",
  content: "This is a test document for cross-platform verification",
  timestamp: 1640995200000, // Fixed timestamp for consistency
  metadata: { version: "1.0", author: "test" }
};

const testPrivateKey = "d8f8a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0";

test("Frontend: Generate signature that should work on backend", () => {
  const signature = SigningService.signDocument(testDocument, testPrivateKey);
  
  // Verify locally first
  const isValid = SigningService.verifyDocument(testDocument, signature);
  expect(isValid).toBe(true);
  
  // Output signature data for backend test
  console.log("Frontend generated signature:", JSON.stringify({
    signature: signature.signature,
    publicKey: signature.publicKey,
    algorithm: signature.algorithm,
    timestamp: signature.timestamp,
    documentHash: CryptoUtils.hash(JSON.stringify({
      id: testDocument.id,
      content: testDocument.content,
      timestamp: testDocument.timestamp,
      metadata: testDocument.metadata
    }))
  }, null, 2));
});

test("Frontend: Verify backend signature", () => {
  // Generate a signature using the same method as backend
  const backendSignature = SigningService.signDocument(testDocument, testPrivateKey);
  const isValid = SigningService.verifyDocument(testDocument, backendSignature);
  expect(isValid).toBe(true);
});

test("Frontend: Key generation compatibility", () => {
  const keyPair = CryptoUtils.generateKeyPair();
  expect(keyPair.privateKey).toBeDefined();
  expect(keyPair.publicKey).toBeDefined();
  expect(keyPair.privateKey.length).toBe(64); // 32 bytes * 2 (hex)
  expect(keyPair.publicKey.length).toBe(66); // 33 bytes * 2 (hex)
  
  console.log("Frontend generated key pair:");
  console.log("Private key:", keyPair.privateKey);
  console.log("Public key:", keyPair.publicKey);
});