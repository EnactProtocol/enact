import { test, expect } from "bun:test";
import { CryptoUtils } from '../crypto';
import { SigningService } from '../signing';

test("Web PEM conversion should work consistently", () => {
  // Generate a key pair
  const keyPair = CryptoUtils.generateKeyPair();
  
  // Create mock PEM format (since web doesn't have hexToPem)
  // We'll simulate what a proper PEM would look like
  const mockPrivateKeyPem = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg${btoa(keyPair.privateKey)}
-----END PRIVATE KEY-----`;
  
  const mockPublicKeyPem = `-----BEGIN PUBLIC KEY-----
MFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAE${btoa(keyPair.publicKey)}
-----END PUBLIC KEY-----`;
  
  // Test that isPemFormat works
  expect(CryptoUtils.isPemFormat(mockPrivateKeyPem)).toBe(true);
  expect(CryptoUtils.isPemFormat(mockPublicKeyPem)).toBe(true);
  expect(CryptoUtils.isPemFormat(keyPair.privateKey)).toBe(false);
});

test("Web manual PEM parsing should differ from proper parsing", () => {
  // Create a simple PEM-like structure with known content
  const testString = "1234567890abcdef".repeat(4); // Test string (not hex)
  const testBase64 = btoa(testString);
  const testPem = `-----BEGIN PRIVATE KEY-----
${testBase64}
-----END PRIVATE KEY-----`;
  
  // Manual parsing (what user was doing)
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = testPem.substring(pemHeader.length, testPem.length - pemFooter.length).replace(/\s/g, '');
  const manualResult = Array.from(atob(pemContents), c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  
  // The manual result should be the hex representation of the original string
  const expectedHex = Array.from(testString, c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  expect(manualResult).toBe(expectedHex);
  
  // Note: We can't test proper PEM parsing here since this isn't a real DER-encoded key
  // But this demonstrates the manual parsing method
});

test("Tool signing workflow with web crypto should work", () => {
  // Generate a key pair
  const keyPair = CryptoUtils.generateKeyPair();
  
  // Create a tool document matching the user's structure
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
  
  // Sign the document with only command field
  const signature = SigningService.signDocument(toolDocument, keyPair.privateKey, {
    includeFields: ['command']
  });
  
  // Verify the signature
  const isValid = SigningService.verifyDocument(toolDocument, signature, {
    includeFields: ['command']
  });
  
  expect(isValid).toBe(true);
  expect(signature.publicKey).toBe(keyPair.publicKey);
  expect(signature.algorithm).toBe('secp256k1');
});

test("Command-only signature should be minimal and focused", () => {
  const keyPair = CryptoUtils.generateKeyPair();
  
  const toolDocument = {
    name: 'kgroves88/tool/example',
    description: 'This tool does stuff.',
    command: 'echo "This tool works"',
    version: '1.0.0',
    extraField: 'should not be included'
  };
  
  // Sign with only command field
  const signature = SigningService.signDocument(toolDocument, keyPair.privateKey, {
    includeFields: ['command']
  });
  
  // Create a document with only the command field
  const minimalDocument = { command: 'echo "This tool works"' };
  
  // Should verify against the minimal document too
  const isValidMinimal = SigningService.verifyDocument(minimalDocument, signature, {
    includeFields: ['command']
  });
  
  expect(isValidMinimal).toBe(true);
});

test("Different field selections should produce different signatures", () => {
  const keyPair = CryptoUtils.generateKeyPair();
  
  const toolDocument = {
    name: 'kgroves88/tool/example',
    command: 'echo "This tool works"',
    version: '1.0.0'
  };
  
  // Sign with different field combinations
  const commandOnlySignature = SigningService.signDocument(toolDocument, keyPair.privateKey, {
    includeFields: ['command']
  });
  
  const nameCommandSignature = SigningService.signDocument(toolDocument, keyPair.privateKey, {
    includeFields: ['name', 'command']
  });
  
  const allFieldsSignature = SigningService.signDocument(toolDocument, keyPair.privateKey, {
    includeFields: ['name', 'command', 'version']
  });
  
  // All signatures should be different
  expect(commandOnlySignature.signature).not.toBe(nameCommandSignature.signature);
  expect(commandOnlySignature.signature).not.toBe(allFieldsSignature.signature);
  expect(nameCommandSignature.signature).not.toBe(allFieldsSignature.signature);
  
  // But all should have the same public key
  expect(commandOnlySignature.publicKey).toBe(keyPair.publicKey);
  expect(nameCommandSignature.publicKey).toBe(keyPair.publicKey);
  expect(allFieldsSignature.publicKey).toBe(keyPair.publicKey);
});