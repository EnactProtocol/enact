import { CryptoUtils } from './crypto';
import type { KeyPair } from './types';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface KeyMetadata {
  keyId: string;
  created: string;
  algorithm: string;
  description?: string;
}

export class KeyManager {
  // Storage paths
  private static readonly TRUSTED_KEYS_DIR = path.join(os.homedir(), '.enact', 'trusted-keys');
  private static readonly PRIVATE_KEYS_DIR = path.join(os.homedir(), '.enact', 'private-keys');
  
  // Ensure directories exist
  private static ensureDirectories(): void {
    fs.mkdirSync(this.TRUSTED_KEYS_DIR, { recursive: true, mode: 0o755 });
    fs.mkdirSync(this.PRIVATE_KEYS_DIR, { recursive: true, mode: 0o700 }); // More restrictive
  }

  // File paths
  private static getPublicKeyPath(keyId: string): string {
    return path.join(this.TRUSTED_KEYS_DIR, `${keyId}.pem`);
  }

  private static getPrivateKeyPath(keyId: string): string {
    return path.join(this.PRIVATE_KEYS_DIR, `${keyId}-private.pem`);
  }

  private static getMetadataPath(keyId: string): string {
    return path.join(this.TRUSTED_KEYS_DIR, `${keyId}.meta`);
  }

  static generateAndStoreKey(keyId: string, description?: string): KeyPair {
    this.ensureDirectories();
    
    // Check if key already exists
    if (this.keyExists(keyId)) {
      throw new Error(`Key with ID '${keyId}' already exists`);
    }

    const keyPair = CryptoUtils.generateKeyPair();
    this.storeKey(keyId, keyPair, description);
    return keyPair;
  }

  static storeKey(keyId: string, keyPair: KeyPair, description?: string): void {
    this.ensureDirectories();

    try {
      // Store public key in PEM format in trusted-keys directory
      const publicKeyPem = CryptoUtils.hexToPem(keyPair.publicKey, 'PUBLIC');
      fs.writeFileSync(
        this.getPublicKeyPath(keyId), 
        publicKeyPem, 
        { mode: 0o644 }
      );

      // Store private key in PEM format in secure location with restrictive permissions
      const privateKeyPem = CryptoUtils.hexToPem(keyPair.privateKey, 'PRIVATE');
      fs.writeFileSync(
        this.getPrivateKeyPath(keyId), 
        privateKeyPem, 
        { mode: 0o600 }
      );

      // Store metadata
      const metadata: KeyMetadata = {
        keyId,
        created: new Date().toISOString(),
        algorithm: 'secp256k1',
        description
      };

      fs.writeFileSync(
        this.getMetadataPath(keyId),
        JSON.stringify(metadata, null, 2),
        { mode: 0o644 }
      );

    } catch (error) {
      // Clean up on error
      this.removeKey(keyId);
      throw new Error(`Failed to store key '${keyId}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static getKey(keyId: string): KeyPair | undefined {
    try {
      const publicKeyPath = this.getPublicKeyPath(keyId);
      const privateKeyPath = this.getPrivateKeyPath(keyId);

      if (!fs.existsSync(publicKeyPath) || !fs.existsSync(privateKeyPath)) {
        return undefined;
      }

      const publicKeyPem = fs.readFileSync(publicKeyPath, 'utf8').trim();
      const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8').trim();

      // Convert PEM back to hex for internal use
      const publicKey = CryptoUtils.pemToHex(publicKeyPem, 'PUBLIC');
      const privateKey = CryptoUtils.pemToHex(privateKeyPem, 'PRIVATE');

      return { privateKey, publicKey };
    } catch (error) {
      console.warn(`Failed to read key '${keyId}': ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }

  static getPublicKey(keyId: string): string | undefined {
    try {
      const publicKeyPath = this.getPublicKeyPath(keyId);
      
      if (!fs.existsSync(publicKeyPath)) {
        return undefined;
      }

      const publicKeyPem = fs.readFileSync(publicKeyPath, 'utf8').trim();
      // Convert PEM back to hex for internal use
      return CryptoUtils.pemToHex(publicKeyPem, 'PUBLIC');
    } catch (error) {
      console.warn(`Failed to read public key '${keyId}': ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }

  static getKeyMetadata(keyId: string): KeyMetadata | undefined {
    try {
      const metadataPath = this.getMetadataPath(keyId);
      
      if (!fs.existsSync(metadataPath)) {
        return undefined;
      }

      const metadataJson = fs.readFileSync(metadataPath, 'utf8');
      return JSON.parse(metadataJson);
    } catch (error) {
      console.warn(`Failed to read metadata for key '${keyId}': ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }

  static keyExists(keyId: string): boolean {
    const publicKeyPath = this.getPublicKeyPath(keyId);
    const privateKeyPath = this.getPrivateKeyPath(keyId);
    return fs.existsSync(publicKeyPath) && fs.existsSync(privateKeyPath);
  }

  static removeKey(keyId: string): boolean {
    try {
      let removed = false;
      
      // Remove public key
      const publicKeyPath = this.getPublicKeyPath(keyId);
      if (fs.existsSync(publicKeyPath)) {
        fs.unlinkSync(publicKeyPath);
        removed = true;
      }

      // Remove private key
      const privateKeyPath = this.getPrivateKeyPath(keyId);
      if (fs.existsSync(privateKeyPath)) {
        fs.unlinkSync(privateKeyPath);
        removed = true;
      }

      // Remove metadata
      const metadataPath = this.getMetadataPath(keyId);
      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
        removed = true;
      }

      return removed;
    } catch (error) {
      console.warn(`Failed to remove key '${keyId}': ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  static listKeys(): string[] {
    try {
      this.ensureDirectories();
      
      const publicFiles = fs.readdirSync(this.TRUSTED_KEYS_DIR)
        .filter(file => file.endsWith('.pem'))
        .map(file => file.replace('.pem', ''));

      // Only return keys that have both public and private key files
      return publicFiles.filter(keyId => this.keyExists(keyId));
    } catch (error) {
      console.warn(`Failed to list keys: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  static listTrustedKeys(): string[] {
    try {
      this.ensureDirectories();
      
      // Return all public keys (including those without private keys)
      return fs.readdirSync(this.TRUSTED_KEYS_DIR)
        .filter(file => file.endsWith('.pem'))
        .map(file => file.replace('.pem', ''));
    } catch (error) {
      console.warn(`Failed to list trusted keys: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  static getAllTrustedPublicKeys(): string[] {
    try {
      this.ensureDirectories();
      
      // Return all public key values from trusted keys directory
      return fs.readdirSync(this.TRUSTED_KEYS_DIR)
        .filter(file => file.endsWith('.pem'))
        .map(file => {
          try {
            const publicKeyPem = fs.readFileSync(path.join(this.TRUSTED_KEYS_DIR, file), 'utf8').trim();
            // Convert PEM back to hex for internal use
            return CryptoUtils.pemToHex(publicKeyPem, 'PUBLIC');
          } catch (error) {
            console.warn(`Failed to read trusted key file ${file}: ${error instanceof Error ? error.message : String(error)}`);
            return null;
          }
        })
        .filter(key => key !== null) as string[];
    } catch (error) {
      console.warn(`Failed to get all trusted public keys: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  static listPrivateKeys(): string[] {
    try {
      this.ensureDirectories();
      
      // Return all private keys (including those without public keys)
      return fs.readdirSync(this.PRIVATE_KEYS_DIR)
        .filter(file => file.endsWith('-private.pem'))
        .map(file => file.replace('-private.pem', ''));
    } catch (error) {
      console.warn(`Failed to list private keys: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  static getAllPrivateKeys(): CryptoUtils.PrivateKey[] {
    try {
      this.ensureDirectories();
      
      // Return all private key values from private keys directory
      return fs.readdirSync(this.PRIVATE_KEYS_DIR)
        .filter(file => file.endsWith('.pem'))
        .map(file => {
          try {
            const privatekey: CryptoUtils.PrivateKey = {
              fileName: file,
              key: "",
            };
            //
            const privateKeyPem = fs.readFileSync(path.join(this.PRIVATE_KEYS_DIR, file), 'utf8').trim();
            // Convert PEM back to hex for internal use
            privatekey.key = CryptoUtils.pemToHex(privateKeyPem, 'PRIVATE');
            return privatekey;
          } catch (error) {
            console.warn(`Failed to read private key file ${file}: ${error instanceof Error ? error.message : String(error)}`);
            return null;
          }
        })
        .filter(key => key !== null) as CryptoUtils.PrivateKey[];
    } catch (error) {
      console.warn(`Failed to get all private keys: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  static exportKey(keyId: string): KeyPair | undefined {
    return this.getKey(keyId);
  }

  static importKey(keyId: string, privateKey: string, description?: string): KeyPair {
    const publicKey = CryptoUtils.getPublicKeyFromPrivate(privateKey);
    const keyPair = { privateKey, publicKey };
    this.storeKey(keyId, keyPair, description);
    return keyPair;
  }

  static importPublicKey(keyId: string, publicKey: string, description?: string): void {
    this.ensureDirectories();

    if (this.getPublicKey(keyId)) {
      throw new Error(`Public key with ID '${keyId}' already exists`);
    }

    try {
      // Store public key in PEM format
      const publicKeyPem = CryptoUtils.hexToPem(publicKey, 'PUBLIC');
      fs.writeFileSync(
        this.getPublicKeyPath(keyId), 
        publicKeyPem, 
        { mode: 0o644 }
      );

      // Store metadata
      const metadata: KeyMetadata = {
        keyId,
        created: new Date().toISOString(),
        algorithm: 'secp256k1',
        description: description || 'Imported public key'
      };

      fs.writeFileSync(
        this.getMetadataPath(keyId),
        JSON.stringify(metadata, null, 2),
        { mode: 0o644 }
      );

    } catch (error) {
      // Clean up on error
      try {
        fs.unlinkSync(this.getPublicKeyPath(keyId));
        fs.unlinkSync(this.getMetadataPath(keyId));
      } catch {}
      throw new Error(`Failed to import public key '${keyId}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Get storage paths for debugging/info
  static getStoragePaths() {
    return {
      trustedKeys: this.TRUSTED_KEYS_DIR,
      privateKeys: this.PRIVATE_KEYS_DIR
    };
  }

  // Backup/export functionality
  static exportKeyToFile(keyId: string, outputPath: string, includePrivateKey: boolean = false): void {
    const keyPair = this.getKey(keyId);
    const metadata = this.getKeyMetadata(keyId);
    
    if (!keyPair) {
      throw new Error(`Key '${keyId}' not found`);
    }

    const exportData = {
      metadata,
      publicKey: keyPair.publicKey,
      ...(includePrivateKey && { privateKey: keyPair.privateKey })
    };

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), { mode: 0o600 });
  }
}