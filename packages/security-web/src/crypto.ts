import { sha256 } from '@noble/hashes/sha256';
import { secp256k1 } from '@noble/curves/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

export class CryptoUtils {
  static generateKeyPair() {
    const privateKey = secp256k1.utils.randomPrivateKey();
    const publicKey = secp256k1.getPublicKey(privateKey);
    
    return {
      privateKey: bytesToHex(privateKey),
      publicKey: bytesToHex(publicKey)
    };
  }

  static getPublicKeyFromPrivate(privateKeyHex: string): string {
    const privateKey = hexToBytes(privateKeyHex);
    const publicKey = secp256k1.getPublicKey(privateKey);
    return bytesToHex(publicKey);
  }

  static hash(data: string): string {
    return bytesToHex(sha256(data));
  }

  static sign(privateKeyHex: string, messageHash: string): string {
    const privateKey = hexToBytes(privateKeyHex);
    const hash = hexToBytes(messageHash);
    
    const signature = secp256k1.sign(hash, privateKey);
    return signature.toCompactHex();
  }

  static verify(publicKeyHex: string, messageHash: string, signatureHex: string): boolean {
    try {
      const publicKey = hexToBytes(publicKeyHex);
      const hash = hexToBytes(messageHash);
      
      return secp256k1.verify(signatureHex, hash, publicKey);
    } catch {
      return false;
    }
  }

  static pemToHex(pemKey: string, type: 'PUBLIC' | 'PRIVATE'): string {
    const keyType = type === 'PUBLIC' ? 'PUBLIC KEY' : 'PRIVATE KEY';
    const beginMarker = `-----BEGIN ${keyType}-----`;
    const endMarker = `-----END ${keyType}-----`;
    
    // Extract base64 content
    const base64Content = pemKey
      .replace(beginMarker, '')
      .replace(endMarker, '')
      .replace(/\s+/g, '');
    
    // Convert to hex - using browser's atob instead of Buffer
    const binaryString = atob(base64Content);
    const derBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      derBytes[i] = binaryString.charCodeAt(i);
    }
    const derHex = bytesToHex(derBytes);
    
    if (type === 'PUBLIC') {
      // Check if it's our standard DER format with proper prefix
      const standardPrefixIndex = derHex.indexOf('034200');
      if (standardPrefixIndex !== -1) {
        // Standard case: extract the 33-byte public key
        const publicKeyStart = standardPrefixIndex + 6; // Skip to after the bit string indicator
        return derHex.substring(publicKeyStart, publicKeyStart + 66); // 33 bytes = 66 hex chars
      }
      
      // Handle raw 33-byte compressed key (starts with 02 or 03)
      if (derBytes.length === 33 && (derBytes[0] === 0x02 || derBytes[0] === 0x03)) {
        return derHex;
      }
      
      // Handle raw 32-byte key (missing compression prefix) - add 02 prefix
      if (derBytes.length === 32) {
        return '02' + derHex;
      }
      
      // Handle 65-byte uncompressed key (04 prefix) - convert to compressed
      if (derBytes.length === 65 && derBytes[0] === 0x04) {
        // Use only x coordinate and determine y parity for compression
        const x = derHex.substring(2, 66); // Skip 04 prefix, take x coordinate
        const y = derHex.substring(66, 130); // y coordinate
        
        // Determine if y is even (02) or odd (03) for compression
        const yBigInt = BigInt('0x' + y);
        const prefix = yBigInt % 2n === 0n ? '02' : '03';
        
        return prefix + x;
      }
      
      // Fallback: return as-is if it looks like a valid key
      if (derBytes.length >= 32 && derBytes.length <= 65) {
        return derHex;
      }
      
      throw new Error(`Unsupported public key format: ${derBytes.length} bytes`);
    } else {
      // Extract the actual private key from DER structure
      // Look for the 32-byte private key after the DER prefix
      const privateKeyStart = derHex.indexOf('0420') + 4; // Skip to after the octet string indicator
      if (privateKeyStart === 3) { // indexOf returned -1, so +4 = 3
        // Fallback: if no 0420 pattern found, assume it's a raw private key
        if (derBytes.length === 32) {
          return derHex;
        }
        throw new Error(`Could not find private key in DER structure: ${derHex.substring(0, 50)}...`);
      }
      
      const extractedKey = derHex.substring(privateKeyStart, privateKeyStart + 64); // 32 bytes = 64 hex chars
      
      // Validate the extracted key length
      if (extractedKey.length !== 64) {
        throw new Error(`Invalid private key length: expected 64 hex chars, got ${extractedKey.length}`);
      }
      
      return extractedKey;
    }
  }

  static isPemFormat(key: string): boolean {
    return key.includes('-----BEGIN') && key.includes('-----END');
  }

  // PEM conversion utilities
  static hexToPem(hexKey: string, type: 'PUBLIC' | 'PRIVATE'): string {
    let derKey: string;
    
    if (type === 'PUBLIC') {
      // For public keys, we need to add the DER structure
      // secp256k1 public key DER prefix: 3056301006072a8648ce3d020106052b8104000a034200
      const publicKeyBytes = hexToBytes(hexKey);
      
      // Create DER structure for secp256k1 public key
      const derPrefix = '3056301006072a8648ce3d020106052b8104000a034200';
      derKey = derPrefix + hexKey;
    } else {
      // For private keys, we need to add the DER structure
      // secp256k1 private key DER prefix varies, but we'll use a simple EC private key format
      const privateKeyBytes = hexToBytes(hexKey);
      
      // Create DER structure for secp256k1 private key
      const derPrefix = '308184020100301306072a8648ce3d020106082a8648ce3d030107046d306b0201010420';
      const derSuffix = 'a144034200' + CryptoUtils.getPublicKeyFromPrivate(hexKey);
      derKey = derPrefix + hexKey + derSuffix;
    }
    
    // Convert to base64
    const derBytes = hexToBytes(derKey);
    const base64Key = btoa(String.fromCharCode(...derBytes));
    
    // Format as PEM
    const keyType = type === 'PUBLIC' ? 'PUBLIC KEY' : 'PRIVATE KEY';
    const pemLines = base64Key.match(/.{1,64}/g) || [];
    
    return [
      `-----BEGIN ${keyType}-----`,
      ...pemLines,
      `-----END ${keyType}-----`
    ].join('\n');
  }
}