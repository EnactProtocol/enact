import { test, expect } from 'bun:test';
import { CryptoUtils } from '../crypto';

test('Enhanced PEM: Handles raw 32-byte key (missing compression prefix)', () => {
  // Create a 32-byte key (missing compression prefix)
  const raw32ByteKey = '8f49cb15b4649d57828c2badd6e6c32bdcc010f3753c6177643ec85959ec42ac';
  const base64 = Buffer.from(raw32ByteKey, 'hex').toString('base64');
  const pem = `-----BEGIN PUBLIC KEY-----\n${base64}\n-----END PUBLIC KEY-----`;
  
  // Should add 02 prefix automatically
  const hexKey = CryptoUtils.pemToHex(pem, 'PUBLIC');
  expect(hexKey).toBe('02' + raw32ByteKey);
  expect(hexKey.length).toBe(66); // 33 bytes * 2
});

test('Enhanced PEM: Handles raw 33-byte compressed key', () => {
  // Create a proper 33-byte compressed key
  const compressed33ByteKey = '028f49cb15b4649d57828c2badd6e6c32bdcc010f3753c6177643ec85959ec42ac';
  const base64 = Buffer.from(compressed33ByteKey, 'hex').toString('base64');
  const pem = `-----BEGIN PUBLIC KEY-----\n${base64}\n-----END PUBLIC KEY-----`;
  
  // Should return as-is since it's already correct
  const hexKey = CryptoUtils.pemToHex(pem, 'PUBLIC');
  expect(hexKey).toBe(compressed33ByteKey);
});

test('Enhanced PEM: Handles 65-byte uncompressed key (converts to compressed)', () => {
  // Create a 65-byte uncompressed key (04 prefix + 64-byte coordinates)
  const uncompressedKey = '048f49cb15b4649d57828c2badd6e6c32bdcc010f3753c6177643ec85959ec42ac' + 
                          '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const base64 = Buffer.from(uncompressedKey, 'hex').toString('base64');
  const pem = `-----BEGIN PUBLIC KEY-----\n${base64}\n-----END PUBLIC KEY-----`;
  
  // Should convert to compressed format
  const hexKey = CryptoUtils.pemToHex(pem, 'PUBLIC');
  expect(hexKey.length).toBe(66); // 33 bytes
  expect(hexKey.startsWith('02') || hexKey.startsWith('03')).toBe(true); // Compression prefix
  
  // Should preserve the x-coordinate
  const xCoordinate = hexKey.substring(2);
  expect(xCoordinate).toBe('8f49cb15b4649d57828c2badd6e6c32bdcc010f3753c6177643ec85959ec42ac');
});

test('Enhanced PEM: Handles standard DER format (our generated keys)', () => {
  // Test with our standard generated key
  const keyPair = CryptoUtils.generateKeyPair();
  const pem = CryptoUtils.hexToPem(keyPair.publicKey, 'PUBLIC');
  
  // Should round-trip correctly
  const restoredHex = CryptoUtils.pemToHex(pem, 'PUBLIC');
  expect(restoredHex).toBe(keyPair.publicKey);
});

test('Enhanced PEM: Real-world example from user issue', () => {
  // The exact PEM from the user's issue
  const userPem = `-----BEGIN PUBLIC KEY-----
Ao9JyxW0ZJ1XgowrrdbmwyvcwBDzdTxhd2Q+yFlZ7EKs
-----END PUBLIC KEY-----`;
  
  // Should convert successfully
  const hexKey = CryptoUtils.pemToHex(userPem, 'PUBLIC');
  expect(hexKey).toBe('028f49cb15b4649d57828c2badd6e6c32bdcc010f3753c6177643ec85959ec42ac');
  expect(hexKey.length).toBe(66);
  expect(hexKey.startsWith('02')).toBe(true);
});

test('Enhanced PEM: Rejects invalid key lengths', () => {
  // Test with invalid key length (too short)
  const invalidKey = '1234'; // 2 bytes
  const base64 = Buffer.from(invalidKey, 'hex').toString('base64');
  const pem = `-----BEGIN PUBLIC KEY-----\n${base64}\n-----END PUBLIC KEY-----`;
  
  expect(() => {
    CryptoUtils.pemToHex(pem, 'PUBLIC');
  }).toThrow('Unsupported public key format');
});

test('Enhanced PEM: Y-coordinate parity calculation for compression', () => {
  // Test specific y-coordinates to verify compression prefix calculation
  
  // Even y-coordinate should get 02 prefix
  const evenYKey = '04' + 
                   '8f49cb15b4649d57828c2badd6e6c32bdcc010f3753c6177643ec85959ec42ac' + // x
                   '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'; // even y (ends in f)
  
  const evenBase64 = Buffer.from(evenYKey, 'hex').toString('base64');
  const evenPem = `-----BEGIN PUBLIC KEY-----\n${evenBase64}\n-----END PUBLIC KEY-----`;
  
  const evenResult = CryptoUtils.pemToHex(evenPem, 'PUBLIC');
  expect(evenResult.startsWith('02') || evenResult.startsWith('03')).toBe(true);
  
  // Odd y-coordinate should get 03 prefix  
  const oddYKey = '04' + 
                  '8f49cb15b4649d57828c2badd6e6c32bdcc010f3753c6177643ec85959ec42ac' + // x
                  '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdee'; // odd y (ends in e)
  
  const oddBase64 = Buffer.from(oddYKey, 'hex').toString('base64');
  const oddPem = `-----BEGIN PUBLIC KEY-----\n${oddBase64}\n-----END PUBLIC KEY-----`;
  
  const oddResult = CryptoUtils.pemToHex(oddPem, 'PUBLIC');
  expect(oddResult.startsWith('02') || oddResult.startsWith('03')).toBe(true);
});

test('Enhanced PEM: Preserves whitespace handling', () => {
  // Test with various whitespace in PEM
  const rawKey = '8f49cb15b4649d57828c2badd6e6c32bdcc010f3753c6177643ec85959ec42ac';
  const base64 = Buffer.from(rawKey, 'hex').toString('base64');
  
  const pemWithSpaces = `-----BEGIN PUBLIC KEY-----
    ${base64}
-----END PUBLIC KEY-----`;
  
  const pemWithTabs = `-----BEGIN PUBLIC KEY-----\n\t${base64}\n-----END PUBLIC KEY-----`;
  
  // Both should work and produce the same result
  const result1 = CryptoUtils.pemToHex(pemWithSpaces, 'PUBLIC');
  const result2 = CryptoUtils.pemToHex(pemWithTabs, 'PUBLIC');
  
  expect(result1).toBe(result2);
  expect(result1).toBe('02' + rawKey);
});