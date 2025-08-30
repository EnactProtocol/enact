import { test, expect, beforeEach, afterEach } from 'bun:test';
import { SigningService, CryptoUtils, DEFAULT_SECURITY_CONFIG } from '../index';
import { KeyManager } from '../keyManager';
import { SecurityConfigManager } from '../securityConfigManager';
import type { EnactDocument, SecurityConfig, Signature } from '../types';
import fs from 'fs';
import path from 'path';
import os from 'os';

const testDocument: EnactDocument = {
  name: "test-tool",
  description: "A test tool",
  command: "echo 'test'",
  enact: "1.0.0"
};

// Test directories
const testTrustedKeysDir = path.join(os.tmpdir(), 'test-security-config-trusted-keys');
const testPrivateKeysDir = path.join(os.tmpdir(), 'test-security-config-private-keys');
const testHomeDir = path.join(os.tmpdir(), 'test-security-config-home');
const testEnactDir = path.join(testHomeDir, '.enact');
const testSecurityDir = path.join(testEnactDir, 'security');
const testConfigFile = path.join(testSecurityDir, 'config.json');

// Mock the storage paths for testing
const originalTrustedKeysDir = (KeyManager as any).TRUSTED_KEYS_DIR;
const originalPrivateKeysDir = (KeyManager as any).PRIVATE_KEYS_DIR;
const originalEnactDir = (SecurityConfigManager as any).ENACT_DIR;
const originalSecurityConfigDir = (SecurityConfigManager as any).SECURITY_DIR;
const originalConfigFile = (SecurityConfigManager as any).CONFIG_FILE;

beforeEach(() => {
  // Override the storage paths to use temp directories
  (KeyManager as any).TRUSTED_KEYS_DIR = testTrustedKeysDir;
  (KeyManager as any).PRIVATE_KEYS_DIR = testPrivateKeysDir;
  (SecurityConfigManager as any).ENACT_DIR = testEnactDir;
  (SecurityConfigManager as any).SECURITY_DIR = testSecurityDir;
  (SecurityConfigManager as any).CONFIG_FILE = testConfigFile;
  
  // Clean up any existing test directories
  if (fs.existsSync(testTrustedKeysDir)) {
    fs.rmSync(testTrustedKeysDir, { recursive: true, force: true });
  }
  if (fs.existsSync(testPrivateKeysDir)) {
    fs.rmSync(testPrivateKeysDir, { recursive: true, force: true });
  }
  if (fs.existsSync(testHomeDir)) {
    fs.rmSync(testHomeDir, { recursive: true, force: true });
  }
  
  // Create test home directory
  fs.mkdirSync(testHomeDir, { recursive: true });
});

afterEach(() => {
  // Restore original paths
  (KeyManager as any).TRUSTED_KEYS_DIR = originalTrustedKeysDir;
  (KeyManager as any).PRIVATE_KEYS_DIR = originalPrivateKeysDir;
  (SecurityConfigManager as any).ENACT_DIR = originalEnactDir;
  (SecurityConfigManager as any).SECURITY_DIR = originalSecurityConfigDir;
  (SecurityConfigManager as any).CONFIG_FILE = originalConfigFile;
  
  // Clean up test directories
  if (fs.existsSync(testTrustedKeysDir)) {
    fs.rmSync(testTrustedKeysDir, { recursive: true, force: true });
  }
  if (fs.existsSync(testPrivateKeysDir)) {
    fs.rmSync(testPrivateKeysDir, { recursive: true, force: true });
  }
  if (fs.existsSync(testHomeDir)) {
    fs.rmSync(testHomeDir, { recursive: true, force: true });
  }
});

test('Default security config allows single signature', () => {
  const keyPair = KeyManager.generateAndStoreKey('test-key', 'Test key for single signature');
  const signature = SigningService.signDocument(testDocument, keyPair.privateKey, { useEnactDefaults: true });
  
  const isValid = SigningService.verifyDocument(
    testDocument, 
    signature, 
    { useEnactDefaults: true }
  );
  
  expect(isValid).toBe(true);
});

test('AllowLocalUnsigned=true allows documents with no signatures', () => {
  const config: SecurityConfig = {
    allowLocalUnsigned: true,
    minimumSignatures: 1
  };
  
  const documentWithoutSignatures: EnactDocument = {
    ...testDocument,
    signatures: []
  };
  
  // Pass empty signature since we're testing documents without signatures
  const dummySignature: Signature = {
    signature: '',
    publicKey: '',
    algorithm: 'secp256k1',
    timestamp: Date.now()
  };
  
  const isValid = SigningService.verifyDocument(
    documentWithoutSignatures,
    dummySignature,
    { useEnactDefaults: true },
    config
  );
  
  expect(isValid).toBe(true);
});

test('AllowLocalUnsigned=false rejects documents with no signatures', () => {
  const config: SecurityConfig = {
    allowLocalUnsigned: false,
    minimumSignatures: 1
  };
  
  const documentWithoutSignatures: EnactDocument = {
    ...testDocument,
    signatures: []
  };
  
  const dummySignature: Signature = {
    signature: '',
    publicKey: '',
    algorithm: 'secp256k1',
    timestamp: Date.now()
  };
  
  const isValid = SigningService.verifyDocument(
    documentWithoutSignatures,
    dummySignature,
    { useEnactDefaults: true },
    config
  );
  
  expect(isValid).toBe(false);
});

test('MinimumSignatures=2 requires at least 2 signatures', () => {
  const config: SecurityConfig = {
    allowLocalUnsigned: false,
    minimumSignatures: 2
  };
  
  const keyPair1 = KeyManager.generateAndStoreKey('test-key-1', 'Test key 1');
  const keyPair2 = KeyManager.generateAndStoreKey('test-key-2', 'Test key 2');
  const signature1 = SigningService.signDocument(testDocument, keyPair1.privateKey, { useEnactDefaults: true });
  const signature2 = SigningService.signDocument(testDocument, keyPair2.privateKey, { useEnactDefaults: true });
  
  const documentWithTwoSignatures: EnactDocument = {
    ...testDocument,
    signatures: [signature1, signature2]
  };
  
  // Should pass with 2 signatures
  const isValid = SigningService.verifyDocument(
    documentWithTwoSignatures,
    signature1, // This gets ignored since document has signatures array
    { useEnactDefaults: true },
    config
  );
  
  expect(isValid).toBe(true);
});

test('MinimumSignatures=2 rejects documents with only 1 signature', () => {
  const config: SecurityConfig = {
    allowLocalUnsigned: false,
    minimumSignatures: 2
  };
  
  const keyPair = KeyManager.generateAndStoreKey('test-key', 'Test key');
  const signature = SigningService.signDocument(testDocument, keyPair.privateKey, { useEnactDefaults: true });
  
  const documentWithOneSignature: EnactDocument = {
    ...testDocument,
    signatures: [signature]
  };
  
  const isValid = SigningService.verifyDocument(
    documentWithOneSignature,
    signature,
    { useEnactDefaults: true },
    config
  );
  
  expect(isValid).toBe(false);
});

test('Invalid signature fails verification regardless of config', () => {
  const config: SecurityConfig = {
    allowLocalUnsigned: true,
    minimumSignatures: 1
  };
  
  const keyPair = KeyManager.generateAndStoreKey('test-key', 'Test key');
  const validSignature = SigningService.signDocument(testDocument, keyPair.privateKey, { useEnactDefaults: true });
  
  // Create invalid signature by corrupting the signature string
  const invalidSignature: Signature = {
    ...validSignature,
    signature: 'invalid_signature_string'
  };
  
  const documentWithInvalidSignature: EnactDocument = {
    ...testDocument,
    signatures: [invalidSignature]
  };
  
  const isValid = SigningService.verifyDocument(
    documentWithInvalidSignature,
    invalidSignature,
    { useEnactDefaults: true },
    config
  );
  
  expect(isValid).toBe(false);
});

test('Mixed valid and invalid signatures fail verification', () => {
  const config: SecurityConfig = {
    allowLocalUnsigned: false,
    minimumSignatures: 2
  };
  
  const keyPair = KeyManager.generateAndStoreKey('test-key', 'Test key');
  const validSignature = SigningService.signDocument(testDocument, keyPair.privateKey, { useEnactDefaults: true });
  const invalidSignature: Signature = {
    signature: 'invalid',
    publicKey: 'invalid',
    algorithm: 'secp256k1',
    timestamp: Date.now()
  };
  
  const documentWithMixedSignatures: EnactDocument = {
    ...testDocument,
    signatures: [validSignature, invalidSignature]
  };
  
  const isValid = SigningService.verifyDocument(
    documentWithMixedSignatures,
    validSignature,
    { useEnactDefaults: true },
    config
  );
  
  expect(isValid).toBe(false);
});

test('Default config values are used when not specified', () => {
  const keyPair = KeyManager.generateAndStoreKey('test-key', 'Test key');
  const signature = SigningService.signDocument(testDocument, keyPair.privateKey, { useEnactDefaults: true });
  
  // Test with undefined config - should use defaults
  const isValid = SigningService.verifyDocument(
    testDocument,
    signature,
    { useEnactDefaults: true },
    undefined
  );
  
  expect(isValid).toBe(true);
});

test('verifyDocument automatically loads config from ~/.enact/security', () => {
  // Create a custom security config file
  const customConfig: SecurityConfig = {
    allowLocalUnsigned: false,
    minimumSignatures: 2
  };
  SecurityConfigManager.saveConfig(customConfig);
  
  const keyPair1 = KeyManager.generateAndStoreKey('test-key-1', 'Test key 1');
  const keyPair2 = KeyManager.generateAndStoreKey('test-key-2', 'Test key 2');
  const signature1 = SigningService.signDocument(testDocument, keyPair1.privateKey, { useEnactDefaults: true });
  const signature2 = SigningService.signDocument(testDocument, keyPair2.privateKey, { useEnactDefaults: true });
  
  const documentWithTwoSignatures: EnactDocument = {
    ...testDocument,
    signatures: [signature1, signature2]
  };
  
  // Should automatically load config and require 2 signatures (passes)
  const isValidWithTwoSigs = SigningService.verifyDocument(
    documentWithTwoSignatures,
    signature1,
    { useEnactDefaults: true }
    // No securityConfig parameter - should auto-load from file
  );
  expect(isValidWithTwoSigs).toBe(true);
  
  const documentWithOneSignature: EnactDocument = {
    ...testDocument,
    signatures: [signature1]
  };
  
  // Should automatically load config and reject 1 signature (fails)
  const isValidWithOneSig = SigningService.verifyDocument(
    documentWithOneSignature,
    signature1,
    { useEnactDefaults: true }
    // No securityConfig parameter - should auto-load from file
  );
  expect(isValidWithOneSig).toBe(false);
});

test('Partial config merges with defaults', () => {
  const partialConfig: SecurityConfig = {
    minimumSignatures: 2
    // allowLocalUnsigned not specified, should use default (true)
  };
  
  const documentWithoutSignatures: EnactDocument = {
    ...testDocument,
    signatures: []
  };
  
  const dummySignature: Signature = {
    signature: '',
    publicKey: '',
    algorithm: 'secp256k1',
    timestamp: Date.now()
  };
  
  // Should pass because allowLocalUnsigned defaults to true
  const isValid = SigningService.verifyDocument(
    documentWithoutSignatures,
    dummySignature,
    { useEnactDefaults: true },
    partialConfig
  );
  
  expect(isValid).toBe(true);
});

test('Can sign and verify only the command field', () => {
  const keyPair = KeyManager.generateAndStoreKey('command-only-key', 'Key for command-only signing');
  
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
  const signature = SigningService.signDocument(documentWithExtraFields, keyPair.privateKey, {
    includeFields: ['command']
  });
  
  // Verify with same field specification
  const isValid = SigningService.verifyDocument(documentWithExtraFields, signature, {
    includeFields: ['command']
  });
  
  expect(isValid).toBe(true);
});

test('Command-only signature allows modification of other fields', () => {
  const keyPair = KeyManager.generateAndStoreKey('command-only-key-2', 'Key for command-only signing');
  
  const originalDocument: EnactDocument = {
    name: "original-tool",
    description: "Original description",
    command: "echo 'hello'",
    enact: "1.0.0"
  };
  
  // Sign only the command field
  const signature = SigningService.signDocument(originalDocument, keyPair.privateKey, {
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

test('Command-only signature fails when command is modified', () => {
  const keyPair = KeyManager.generateAndStoreKey('command-only-key-3', 'Key for command-only signing');
  
  const originalDocument: EnactDocument = {
    name: "test-tool",
    description: "A test tool",
    command: "echo 'original'",
    enact: "1.0.0"
  };
  
  // Sign only the command field
  const signature = SigningService.signDocument(originalDocument, keyPair.privateKey, {
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

test('Command-only signature vs default signature produce different hashes', () => {
  // Generate key for potential future use
  KeyManager.generateAndStoreKey('hash-comparison-key', 'Key for hash comparison');
  
  const document: EnactDocument = {
    name: "test-tool",
    description: "A test tool",
    command: "echo 'test'",
    enact: "1.0.0"
  };
  
  // Get canonical document hash when signing only command
  const commandOnlyCanonical = SigningService.getCanonicalDocument(document, {
    includeFields: ['command']
  });
  
  // Get canonical document hash when using enact defaults
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