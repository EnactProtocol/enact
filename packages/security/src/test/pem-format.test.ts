import { test, expect } from 'bun:test';
import { CryptoUtils } from '../crypto';

test('PEM conversion utilities work correctly', () => {
  // Generate a test key pair
  const keyPair = CryptoUtils.generateKeyPair();
  
  // Convert to PEM format
  const publicKeyPem = CryptoUtils.hexToPem(keyPair.publicKey, 'PUBLIC');
  const privateKeyPem = CryptoUtils.hexToPem(keyPair.privateKey, 'PRIVATE');
  
  // Verify PEM format structure
  expect(publicKeyPem).toContain('-----BEGIN PUBLIC KEY-----');
  expect(publicKeyPem).toContain('-----END PUBLIC KEY-----');
  expect(privateKeyPem).toContain('-----BEGIN PRIVATE KEY-----');
  expect(privateKeyPem).toContain('-----END PRIVATE KEY-----');
  
  // Convert back to hex
  const publicKeyHex = CryptoUtils.pemToHex(publicKeyPem, 'PUBLIC');
  const privateKeyHex = CryptoUtils.pemToHex(privateKeyPem, 'PRIVATE');
  
  // Verify round-trip conversion
  expect(publicKeyHex).toBe(keyPair.publicKey);
  expect(privateKeyHex).toBe(keyPair.privateKey);
});

test('PEM format detection works correctly', () => {
  const keyPair = CryptoUtils.generateKeyPair();
  const publicKeyPem = CryptoUtils.hexToPem(keyPair.publicKey, 'PUBLIC');
  
  // Test PEM detection
  expect(CryptoUtils.isPemFormat(publicKeyPem)).toBe(true);
  expect(CryptoUtils.isPemFormat(keyPair.publicKey)).toBe(false);
  expect(CryptoUtils.isPemFormat('random string')).toBe(false);
});

test('PEM keys are properly formatted for OpenSSL compatibility', () => {
  const keyPair = CryptoUtils.generateKeyPair();
  const publicKeyPem = CryptoUtils.hexToPem(keyPair.publicKey, 'PUBLIC');
  const privateKeyPem = CryptoUtils.hexToPem(keyPair.privateKey, 'PRIVATE');
  
  // Check base64 content is properly line-wrapped (64 chars per line)
  const publicLines = publicKeyPem.split('\n');
  const privateLines = privateKeyPem.split('\n');
  
  // Remove BEGIN/END lines and check content lines
  const publicContentLines = publicLines.slice(1, -1);
  const privateContentLines = privateLines.slice(1, -1);
  
  // All content lines except possibly the last should be 64 characters
  publicContentLines.slice(0, -1).forEach(line => {
    expect(line.length).toBe(64);
  });
  
  privateContentLines.slice(0, -1).forEach(line => {
    expect(line.length).toBe(64);
  });
  
  // Last line should be <= 64 characters
  if (publicContentLines.length > 0) {
    expect(publicContentLines[publicContentLines.length - 1].length).toBeLessThanOrEqual(64);
  }
  
  if (privateContentLines.length > 0) {
    expect(privateContentLines[privateContentLines.length - 1].length).toBeLessThanOrEqual(64);
  }
});

test('Crypto operations still work with PEM conversion', () => {
  const keyPair = CryptoUtils.generateKeyPair();
  const message = "test message";
  const messageHash = CryptoUtils.hash(message);
  
  // Convert to PEM and back
  const publicKeyPem = CryptoUtils.hexToPem(keyPair.publicKey, 'PUBLIC');
  const privateKeyPem = CryptoUtils.hexToPem(keyPair.privateKey, 'PRIVATE');
  
  const publicKeyRestored = CryptoUtils.pemToHex(publicKeyPem, 'PUBLIC');
  const privateKeyRestored = CryptoUtils.pemToHex(privateKeyPem, 'PRIVATE');
  
  // Sign with original key
  const signature1 = CryptoUtils.sign(keyPair.privateKey, messageHash);
  
  // Sign with restored key
  const signature2 = CryptoUtils.sign(privateKeyRestored, messageHash);
  
  // Verify with original public key
  expect(CryptoUtils.verify(keyPair.publicKey, messageHash, signature1)).toBe(true);
  expect(CryptoUtils.verify(keyPair.publicKey, messageHash, signature2)).toBe(true);
  
  // Verify with restored public key
  expect(CryptoUtils.verify(publicKeyRestored, messageHash, signature1)).toBe(true);
  expect(CryptoUtils.verify(publicKeyRestored, messageHash, signature2)).toBe(true);
});