import { CryptoUtils } from './crypto';
import { FieldSelector, EnactFieldSelector, GenericFieldSelector } from './fieldConfig';
import type { EnactDocument, SigningOptions, Signature, SecurityConfig } from './types';
import { DEFAULT_SECURITY_CONFIG } from './types';
import { KeyManager } from './keyManager';
import { SecurityConfigManager } from './securityConfigManager';

export class SigningService {
  static signDocument(
    document: EnactDocument,
    privateKey: string,
    options: SigningOptions = {}
  ): Signature {
    const { 
      algorithm = 'secp256k1',
      useEnactDefaults = false,
      includeFields,
      excludeFields,
      additionalCriticalFields
    } = options;
    
    // Choose appropriate field selector
    const fieldSelector = useEnactDefaults ? EnactFieldSelector : GenericFieldSelector;
    
    // Create canonical object with specified fields
    const canonicalDocument = fieldSelector.createCanonicalObject(document, {
      includeFields,
      excludeFields,
      additionalCriticalFields
    });
    
    const documentString = JSON.stringify(canonicalDocument);
    const messageHash = CryptoUtils.hash(documentString);
    const signature = CryptoUtils.sign(privateKey, messageHash);
    const publicKey = CryptoUtils.getPublicKeyFromPrivate(privateKey);
    
    return {
      signature,
      publicKey,
      algorithm,
      timestamp: Date.now()
    };
  }

  static verifyDocument(
    document: EnactDocument,
    signature: Signature,
    options: SigningOptions = {},
    securityConfig?: SecurityConfig
  ): boolean {
    const { 
      useEnactDefaults = false,
      includeFields,
      excludeFields,
      additionalCriticalFields
    } = options;
    
    // Load security config from ~/.enact/security if not provided
    const loadedConfig = securityConfig ?? SecurityConfigManager.loadConfig();
    const config = { ...DEFAULT_SECURITY_CONFIG, ...loadedConfig };
    
    // Get signatures from document or use provided signature
    const signatures = document.signatures || [signature];
    
    // Check minimum signatures requirement
    if (signatures.length < (config.minimumSignatures ?? 1)) {
      // If allowLocalUnsigned is true and we have no signatures, allow it
      if (config.allowLocalUnsigned && signatures.length === 0) {
        return true;
      }
      return false;
    }
    
    // Verify each signature
    const fieldSelector = useEnactDefaults ? EnactFieldSelector : GenericFieldSelector;
    
    const canonicalDocument = fieldSelector.createCanonicalObject(document, {
      includeFields,
      excludeFields,
      additionalCriticalFields
    });
    
    const documentString = JSON.stringify(canonicalDocument);
    const messageHash = CryptoUtils.hash(documentString);
    
    // Get all trusted public keys from KeyManager
    const trustedPublicKeys = KeyManager.getAllTrustedPublicKeys();
    
    // All signatures must be valid and from trusted keys
    return signatures.every(sig => {
      // Check if we have a valid public key in the signature
      const hasValidPublicKey = sig.publicKey && 
                               typeof sig.publicKey === 'string' && 
                               sig.publicKey.trim() !== '';
      
      if (hasValidPublicKey && trustedPublicKeys.includes(sig.publicKey)) {
        // Standard case: signature has valid public key that is trusted
        return CryptoUtils.verify(
          sig.publicKey,
          messageHash,
          sig.signature
        );
      } else {
        // Fallback: try verifying against ALL trusted public keys
        // This handles cases where:
        // - signature.publicKey is null/undefined/empty
        // - signature.publicKey is invalid/corrupted
        // - we want to verify against any trusted key
        return trustedPublicKeys.some(trustedKey => {
          try {
            return CryptoUtils.verify(
              trustedKey,
              messageHash,
              sig.signature
            );
          } catch {
            // Continue trying other keys if verification throws an error
            return false;
          }
        });
      }
    });
  }

  static createDocumentHash(
    document: EnactDocument, 
    options: SigningOptions = {}
  ): string {
    const { 
      useEnactDefaults = false,
      includeFields,
      excludeFields,
      additionalCriticalFields
    } = options;
    
    // Choose appropriate field selector
    const fieldSelector = useEnactDefaults ? EnactFieldSelector : GenericFieldSelector;
    
    // Create canonical object
    const canonicalDocument = fieldSelector.createCanonicalObject(document, {
      includeFields,
      excludeFields,
      additionalCriticalFields
    });
    
    const documentString = JSON.stringify(canonicalDocument);
    return CryptoUtils.hash(documentString);
  }

  // New utility methods for field inspection
  static getCanonicalDocument(
    document: EnactDocument,
    options: SigningOptions = {}
  ): Record<string, any> {
    const { 
      useEnactDefaults = false,
      includeFields,
      excludeFields,
      additionalCriticalFields
    } = options;
    
    const fieldSelector = useEnactDefaults ? EnactFieldSelector : GenericFieldSelector;
    
    return fieldSelector.createCanonicalObject(document, {
      includeFields,
      excludeFields,
      additionalCriticalFields
    });
  }

  static getSignedFields(options: SigningOptions = {}): string[] {
    const { useEnactDefaults = false } = options;
    const fieldSelector = useEnactDefaults ? EnactFieldSelector : GenericFieldSelector;
    return fieldSelector.getSecurityCriticalFields();
  }
}