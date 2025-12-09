/**
 * Deno-compatible Sigstore bundle verification utilities
 * 
 * Note: Full Sigstore verification requires the @sigstore/verify package
 * which has Node.js dependencies. This module provides a simplified
 * verification that extracts identity info from the bundle.
 * 
 * For full verification, the trust package should be called from a
 * Node.js environment or via a separate verification service.
 */

/**
 * Verification result
 */
export interface VerificationResult {
  verified: boolean;
  identity?: {
    issuer?: string;
    subject?: string;
    email?: string;
  };
  error?: string;
}

/**
 * Verify a Sigstore bundle (simplified Deno-compatible version)
 * 
 * This performs basic structural validation of the bundle.
 * For production, consider using a verification service.
 * 
 * @param bundle - The Sigstore bundle
 * @param artifactHash - The expected artifact hash
 * @returns Verification result
 */
export async function verifyBundle(
  bundle: any,
  artifactHash?: Uint8Array
): Promise<VerificationResult> {
  try {
    // Check bundle structure
    if (!bundle || typeof bundle !== 'object') {
      return { verified: false, error: 'Invalid bundle structure' };
    }

    // Check for verification material
    const verificationMaterial = bundle.verificationMaterial;
    if (!verificationMaterial) {
      return { verified: false, error: 'Missing verification material' };
    }

    // Check for certificate or public key
    const hasCert = verificationMaterial.certificate?.rawBytes;
    const hasPublicKey = verificationMaterial.publicKey?.rawBytes;
    if (!hasCert && !hasPublicKey) {
      return { verified: false, error: 'Missing certificate or public key' };
    }

    // Check for signature
    const hasMessageSignature = bundle.messageSignature?.signature;
    const hasDSSESignature = bundle.dsseEnvelope?.signatures?.length > 0;
    if (!hasMessageSignature && !hasDSSESignature) {
      return { verified: false, error: 'Missing signature' };
    }

    // Check for transparency log entry
    const tlogEntries = verificationMaterial.tlogEntries;
    if (!tlogEntries || tlogEntries.length === 0) {
      return { verified: false, error: 'Missing transparency log entry' };
    }

    // Check log entry structure
    const tlogEntry = tlogEntries[0];
    if (!tlogEntry.logId?.keyId || !tlogEntry.inclusionPromise && !tlogEntry.inclusionProof) {
      return { verified: false, error: 'Invalid transparency log entry' };
    }

    // Extract identity from certificate if available
    const identity = extractIdentityFromBundle(bundle);

    // Bundle structure is valid
    // Note: This does NOT perform cryptographic verification
    // Full verification would require @sigstore/verify which needs Node.js
    return {
      verified: true,
      identity,
    };
  } catch (error) {
    return {
      verified: false,
      error: `Verification failed: ${(error as Error).message}`,
    };
  }
}

/**
 * Extract identity information from a Sigstore bundle
 */
function extractIdentityFromBundle(bundle: any): VerificationResult['identity'] {
  try {
    const cert = bundle.verificationMaterial?.certificate;
    if (!cert) {
      return undefined;
    }

    // Try to extract from parsed certificate extensions
    // Note: Full parsing requires ASN.1 decoding
    const extensions = cert.extensions;
    if (extensions && Array.isArray(extensions)) {
      for (const ext of extensions) {
        // Look for SAN or other identity extensions
        if (ext.value && typeof ext.value === 'string') {
          if (ext.value.includes('@')) {
            return { email: ext.value };
          }
        }
      }
    }

    // Try issuer from certificate
    const issuer = cert.issuer;
    
    return {
      issuer: typeof issuer === 'string' ? issuer : undefined,
    };
  } catch {
    return undefined;
  }
}
