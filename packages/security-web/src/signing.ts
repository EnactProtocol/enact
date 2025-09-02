import { CryptoUtils } from './crypto';
import { FieldSelector, EnactFieldSelector, GenericFieldSelector } from './fieldConfig';
import type { EnactDocument, SigningOptions, Signature } from './types';

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
    options: SigningOptions = {}
  ): boolean {
    const { 
      useEnactDefaults = false,
      includeFields,
      excludeFields,
      additionalCriticalFields
    } = options;
    
    // Choose appropriate field selector
    const fieldSelector = useEnactDefaults ? EnactFieldSelector : GenericFieldSelector;
    
    // Create canonical object with same field selection as signing
    const canonicalDocument = fieldSelector.createCanonicalObject(document, {
      includeFields,
      excludeFields,
      additionalCriticalFields
    });
    
    const documentString = JSON.stringify(canonicalDocument);
    const messageHash = CryptoUtils.hash(documentString);
    
    return CryptoUtils.verify(
      signature.publicKey,
      messageHash,
      signature.signature
    );
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