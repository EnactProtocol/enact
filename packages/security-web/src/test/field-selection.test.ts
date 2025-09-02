import { test, expect } from 'bun:test';
import { SigningService, CryptoUtils } from '../index';
import type { EnactDocument } from '../types';

// Test key pair for consistent testing
const testKeyPair = {
  privateKey: 'd8f8a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
  publicKey: CryptoUtils.getPublicKeyFromPrivate('d8f8a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0')
};

test('Frontend: Can sign and verify only the command field', () => {
  const documentWithExtraFields: EnactDocument = {
    name: "test-tool",
    description: "A test tool that does something",
    command: "echo 'hello world'",
    enact: "1.0.0",
    version: "2.1.0",
    metadata: { author: "test" },
    timestamp: Date.now()
  };
  
  // Sign only the command field
  const signature = SigningService.signDocument(documentWithExtraFields, testKeyPair.privateKey, {
    includeFields: ['command']
  });
  
  // Verify with same field specification
  const isValid = SigningService.verifyDocument(documentWithExtraFields, signature, {
    includeFields: ['command']
  });
  
  expect(isValid).toBe(true);
});

test('Frontend: Command-only signature allows modification of other fields', () => {
  const originalDocument: EnactDocument = {
    name: "original-tool",
    description: "Original description",
    command: "echo 'hello'",
    enact: "1.0.0"
  };
  
  // Sign only the command field
  const signature = SigningService.signDocument(originalDocument, testKeyPair.privateKey, {
    includeFields: ['command']
  });
  
  // Create modified document with different name and description but same command
  const modifiedDocument: EnactDocument = {
    name: "modified-tool",
    description: "Modified description",
    command: "echo 'hello'", // Same command
    enact: "2.0.0" // Different version
  };
  
  // Signature should still be valid because only command was signed
  const isValid = SigningService.verifyDocument(modifiedDocument, signature, {
    includeFields: ['command']
  });
  
  expect(isValid).toBe(true);
});

test('Frontend: Command-only signature fails when command is modified', () => {
  const originalDocument: EnactDocument = {
    name: "test-tool",
    description: "A test tool",
    command: "echo 'original'",
    enact: "1.0.0"
  };
  
  // Sign only the command field
  const signature = SigningService.signDocument(originalDocument, testKeyPair.privateKey, {
    includeFields: ['command']
  });
  
  // Create document with modified command
  const modifiedDocument: EnactDocument = {
    ...originalDocument,
    command: "echo 'modified'" // Changed command
  };
  
  // Signature should be invalid because command was changed
  const isValid = SigningService.verifyDocument(modifiedDocument, signature, {
    includeFields: ['command']
  });
  
  expect(isValid).toBe(false);
});

test('Frontend: Command-only vs default field selection', () => {
  const document: EnactDocument = {
    name: "test-tool",
    description: "A test tool",
    command: "echo 'test'",
    enact: "1.0.0"
  };
  
  // Get canonical document when signing only command
  const commandOnlyCanonical = SigningService.getCanonicalDocument(document, {
    includeFields: ['command']
  });
  
  // Get canonical document when using enact defaults
  const defaultCanonical = SigningService.getCanonicalDocument(document, {
    useEnactDefaults: true
  });
  
  // They should be different
  expect(commandOnlyCanonical).not.toEqual(defaultCanonical);
  
  // Command-only should only contain the command field
  expect(Object.keys(commandOnlyCanonical)).toEqual(['command']);
  expect(commandOnlyCanonical.command).toBe("echo 'test'");
  
  // Default should contain multiple fields
  expect(Object.keys(defaultCanonical).length).toBeGreaterThan(1);
  expect(defaultCanonical).toHaveProperty('command');
  expect(defaultCanonical).toHaveProperty('name');
  expect(defaultCanonical).toHaveProperty('description');
});

test('Frontend: Multiple field inclusion works correctly', () => {
  const document: EnactDocument = {
    name: "test-tool",
    description: "A test tool",
    command: "echo 'test'",
    enact: "1.0.0",
    version: "2.1.0",
    metadata: { author: "test" }
  };
  
  // Sign specific fields
  const signature = SigningService.signDocument(document, testKeyPair.privateKey, {
    includeFields: ['command', 'name']
  });
  
  // Get canonical document to verify field selection
  const canonical = SigningService.getCanonicalDocument(document, {
    includeFields: ['command', 'name']
  });
  
  // Should only contain the specified fields
  expect(Object.keys(canonical).sort()).toEqual(['command', 'name']);
  expect(canonical.command).toBe("echo 'test'");
  expect(canonical.name).toBe("test-tool");
  
  // Verify signature
  const isValid = SigningService.verifyDocument(document, signature, {
    includeFields: ['command', 'name']
  });
  
  expect(isValid).toBe(true);
});

test('Frontend: Exclude fields works correctly', () => {
  const document: EnactDocument = {
    name: "test-tool",
    description: "A test tool",
    command: "echo 'test'",
    enact: "1.0.0",
    version: "2.1.0"
  };
  
  // Use enact defaults but exclude version
  const canonical = SigningService.getCanonicalDocument(document, {
    useEnactDefaults: true,
    excludeFields: ['version']
  });
  
  // Should contain enact defaults minus version
  const expectedFields = ['command', 'description', 'enact', 'name'];
  expect(Object.keys(canonical).sort()).toEqual(expectedFields.sort());
  expect(canonical).not.toHaveProperty('version');
});

test('Frontend: Cross-platform signature compatibility for command-only', () => {
  const document: EnactDocument = {
    name: "cross-platform-tool",
    description: "A tool for testing cross-platform compatibility",
    command: "echo 'cross-platform test'",
    enact: "1.0.0"
  };
  
  // Generate signature with command-only on frontend
  const frontendSignature = SigningService.signDocument(document, testKeyPair.privateKey, {
    includeFields: ['command']
  });
  
  // Verify signature on frontend
  const frontendValid = SigningService.verifyDocument(document, frontendSignature, {
    includeFields: ['command']
  });
  
  expect(frontendValid).toBe(true);
  
  // Log signature data for backend verification
  console.log("Frontend command-only signature:", JSON.stringify({
    signature: frontendSignature.signature,
    publicKey: frontendSignature.publicKey,
    algorithm: frontendSignature.algorithm,
    timestamp: frontendSignature.timestamp,
    documentHash: CryptoUtils.hash(JSON.stringify({ command: document.command }))
  }, null, 2));
});