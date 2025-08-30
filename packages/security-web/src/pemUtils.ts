import { CryptoUtils } from './crypto';

export interface KeyPair {
  privateKey: string; // hex
  publicKey: string;  // hex
}

export interface StoredKeyPair {
  id: string;
  name: string;
  privateKeyPem: string;
  publicKeyPem: string;
  createdAt: string;
  isActive: boolean;
  purpose?: string;
}

export class PemUtils {
  
  /**
   * Generate a new key pair and return as PEM format
   */
  static generateKeyPairAsPem(): { privateKeyPem: string; publicKeyPem: string; keyPair: KeyPair } {
    const keyPair = CryptoUtils.generateKeyPair();
    
    const privateKeyPem = CryptoUtils.hexToPem(keyPair.privateKey, 'PRIVATE');
    const publicKeyPem = CryptoUtils.hexToPem(keyPair.publicKey, 'PUBLIC');
    
    return {
      privateKeyPem,
      publicKeyPem,
      keyPair
    };
  }

  /**
   * Convert hex key pair to PEM format
   */
  static keyPairToPem(keyPair: KeyPair): { privateKeyPem: string; publicKeyPem: string } {
    const privateKeyPem = CryptoUtils.hexToPem(keyPair.privateKey, 'PRIVATE');
    const publicKeyPem = CryptoUtils.hexToPem(keyPair.publicKey, 'PUBLIC');
    
    return { privateKeyPem, publicKeyPem };
  }

  /**
   * Convert PEM key pair back to hex format
   */
  static pemToKeyPair(privateKeyPem: string, publicKeyPem?: string): KeyPair {
    const privateKey = CryptoUtils.pemToHex(privateKeyPem, 'PRIVATE');
    
    let publicKey: string;
    if (publicKeyPem) {
      publicKey = CryptoUtils.pemToHex(publicKeyPem, 'PUBLIC');
    } else {
      // Derive public key from private key
      publicKey = CryptoUtils.getPublicKeyFromPrivate(privateKey);
    }
    
    return { privateKey, publicKey };
  }

  /**
   * Download a PEM file to the user's computer
   */
  static downloadPemFile(content: string, filename: string, keyType: 'private' | 'public' = 'public'): void {
    // Ensure proper PEM format
    if (!content.includes('-----BEGIN') || !content.includes('-----END')) {
      throw new Error('Invalid PEM format');
    }
    
    const blob = new Blob([content], { 
      type: keyType === 'private' ? 'application/x-pem-file' : 'application/x-pem-file' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.pem') ? filename : `${filename}.pem`;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }

  /**
   * Download private key as PEM file
   */
  static downloadPrivateKeyPem(privateKeyHex: string, filename: string): void {
    const privateKeyPem = CryptoUtils.hexToPem(privateKeyHex, 'PRIVATE');
    this.downloadPemFile(privateKeyPem, `${filename}-private-key`, 'private');
  }

  /**
   * Download public key as PEM file
   */
  static downloadPublicKeyPem(publicKeyHex: string, filename: string): void {
    const publicKeyPem = CryptoUtils.hexToPem(publicKeyHex, 'PUBLIC');
    this.downloadPemFile(publicKeyPem, `${filename}-public-key`, 'public');
  }

  /**
   * Download both keys as separate PEM files
   */
  static downloadKeyPairPems(keyPair: KeyPair, filename: string): void {
    this.downloadPrivateKeyPem(keyPair.privateKey, filename);
    
    // Small delay to prevent browser download blocking
    setTimeout(() => {
      this.downloadPublicKeyPem(keyPair.publicKey, filename);
    }, 100);
  }

  /**
   * Store key pair in localStorage with proper PEM format
   */
  static storeKeyPairInLocalStorage(
    userId: string, 
    keyData: {
      id?: string;
      name: string;
      keyPair: KeyPair;
      purpose?: string;
      isActive?: boolean;
    }
  ): StoredKeyPair {
    const { privateKeyPem, publicKeyPem } = this.keyPairToPem(keyData.keyPair);
    
    const storedKey: StoredKeyPair = {
      id: keyData.id || crypto.randomUUID(),
      name: keyData.name,
      privateKeyPem,
      publicKeyPem,
      createdAt: new Date().toISOString(),
      isActive: keyData.isActive ?? false,
      purpose: keyData.purpose
    };
    
    // Get existing keys
    const existingKeys = this.getStoredKeyPairs(userId);
    
    // Add new key
    const updatedKeys = [...existingKeys, storedKey];
    
    // Store back to localStorage
    localStorage.setItem(`enact_pem_keys_${userId}`, JSON.stringify(updatedKeys));
    
    return storedKey;
  }

  /**
   * Get all stored key pairs from localStorage
   */
  static getStoredKeyPairs(userId: string): StoredKeyPair[] {
    const keysJson = localStorage.getItem(`enact_pem_keys_${userId}`);
    return keysJson ? JSON.parse(keysJson) : [];
  }

  /**
   * Get a specific stored key pair by ID
   */
  static getStoredKeyPair(userId: string, keyId: string): StoredKeyPair | undefined {
    const keys = this.getStoredKeyPairs(userId);
    return keys.find(key => key.id === keyId);
  }

  /**
   * Get the active key pair
   */
  static getActiveKeyPair(userId: string): StoredKeyPair | undefined {
    const keys = this.getStoredKeyPairs(userId);
    return keys.find(key => key.isActive);
  }

  /**
   * Update a stored key pair
   */
  static updateStoredKeyPair(userId: string, keyId: string, updates: Partial<StoredKeyPair>): boolean {
    const keys = this.getStoredKeyPairs(userId);
    const keyIndex = keys.findIndex(key => key.id === keyId);
    
    if (keyIndex === -1) return false;
    
    keys[keyIndex] = { ...keys[keyIndex], ...updates };
    localStorage.setItem(`enact_pem_keys_${userId}`, JSON.stringify(keys));
    
    return true;
  }

  /**
   * Set a key as active (and make others inactive)
   */
  static setActiveKey(userId: string, keyId: string): boolean {
    const keys = this.getStoredKeyPairs(userId);
    let found = false;
    
    // Set all keys to inactive, except the target key
    const updatedKeys = keys.map(key => {
      if (key.id === keyId) {
        found = true;
        return { ...key, isActive: true };
      } else {
        return { ...key, isActive: false };
      }
    });
    
    if (!found) return false;
    
    localStorage.setItem(`enact_pem_keys_${userId}`, JSON.stringify(updatedKeys));
    return true;
  }

  /**
   * Delete a stored key pair
   */
  static deleteStoredKeyPair(userId: string, keyId: string): boolean {
    const keys = this.getStoredKeyPairs(userId);
    const filteredKeys = keys.filter(key => key.id !== keyId);
    
    if (filteredKeys.length === keys.length) return false; // Key not found
    
    localStorage.setItem(`enact_pem_keys_${userId}`, JSON.stringify(filteredKeys));
    return true;
  }

  /**
   * Extract hex keys from stored PEM format for signing
   */
  static getHexKeysFromStored(storedKey: StoredKeyPair): KeyPair {
    return this.pemToKeyPair(storedKey.privateKeyPem, storedKey.publicKeyPem);
  }

  /**
   * Import key pair from PEM strings
   */
  static importKeyPairFromPem(
    userId: string,
    name: string,
    privateKeyPem: string,
    publicKeyPem?: string,
    purpose?: string
  ): StoredKeyPair {
    // Validate PEM format
    if (!CryptoUtils.isPemFormat(privateKeyPem)) {
      throw new Error('Invalid private key PEM format');
    }
    
    if (publicKeyPem && !CryptoUtils.isPemFormat(publicKeyPem)) {
      throw new Error('Invalid public key PEM format');
    }
    
    // Convert to hex to validate
    const keyPair = this.pemToKeyPair(privateKeyPem, publicKeyPem);
    
    const storedKey: StoredKeyPair = {
      id: crypto.randomUUID(),
      name,
      privateKeyPem,
      publicKeyPem: publicKeyPem || CryptoUtils.hexToPem(keyPair.publicKey, 'PUBLIC'),
      createdAt: new Date().toISOString(),
      isActive: false,
      purpose
    };
    
    // Get existing keys and add new one
    const existingKeys = this.getStoredKeyPairs(userId);
    const updatedKeys = [...existingKeys, storedKey];
    
    localStorage.setItem(`enact_pem_keys_${userId}`, JSON.stringify(updatedKeys));
    
    return storedKey;
  }

  /**
   * Export all keys as a JSON file for backup
   */
  static exportAllKeys(userId: string, includePrivateKeys: boolean = false): void {
    const keys = this.getStoredKeyPairs(userId);
    
    const exportData = {
      exportedAt: new Date().toISOString(),
      userId,
      keys: keys.map(key => ({
        id: key.id,
        name: key.name,
        publicKeyPem: key.publicKeyPem,
        ...(includePrivateKeys && { privateKeyPem: key.privateKeyPem }),
        createdAt: key.createdAt,
        purpose: key.purpose,
        isActive: key.isActive
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enact-keys-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }

  /**
   * Clear all stored keys (with confirmation)
   */
  static clearAllKeys(userId: string): boolean {
    localStorage.removeItem(`enact_pem_keys_${userId}`);
    return true;
  }

  /**
   * Validate that a PEM key pair is valid for signing
   */
  static validateKeyPair(privateKeyPem: string, publicKeyPem?: string): { isValid: boolean; error?: string } {
    try {
      const keyPair = this.pemToKeyPair(privateKeyPem, publicKeyPem);
      
      // Test signing and verification
      const testMessage = 'test-message-for-validation';
      const messageHash = CryptoUtils.hash(testMessage);
      const signature = CryptoUtils.sign(keyPair.privateKey, messageHash);
      const isValid = CryptoUtils.verify(keyPair.publicKey, messageHash, signature);
      
      if (!isValid) {
        return { isValid: false, error: 'Key pair failed validation test' };
      }
      
      return { isValid: true };
    } catch (error) {
      return { 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Unknown validation error' 
      };
    }
  }
}