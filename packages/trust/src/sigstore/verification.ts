/**
 * Sigstore verification module
 *
 * This module provides verification capabilities for Sigstore bundles and attestations.
 * It verifies signatures, certificates, and transparency log entries.
 *
 * NOTE: This implementation bypasses TUF (The Update Framework) and uses bundled trusted
 * roots directly. This is necessary for Bun compatibility because TUF verification fails
 * with BoringSSL's stricter signature algorithm requirements.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { bundleFromJSON } from "@sigstore/bundle";
import { TrustedRoot } from "@sigstore/protobuf-specs";
import { Verifier, toSignedEntity, toTrustMaterial } from "@sigstore/verify";
import { extractIdentityFromBundle } from "./signing";
import type {
  ExpectedIdentity,
  OIDCIdentity,
  SigstoreBundle,
  VerificationDetails,
  VerificationOptions,
  VerificationResult,
} from "./types";

// ============================================================================
// Constants
// ============================================================================

/**
 * Get the path to bundled TUF seeds
 * We need to navigate from the @sigstore/tuf main entry point to find seeds.json
 */
function getTufSeedsPath(): string {
  // The package.json main points to dist/index.js, but seeds.json is at package root
  const tufPkgPath = require.resolve("@sigstore/tuf/package.json");
  return path.join(path.dirname(tufPkgPath), "seeds.json");
}

// ============================================================================
// Trusted Root Management
// ============================================================================

/**
 * Load the trusted root from bundled TUF seeds
 * This bypasses TUF's online verification which fails with BoringSSL
 */
async function loadTrustedRoot(): Promise<ReturnType<typeof TrustedRoot.fromJSON>> {
  const seedsPath = getTufSeedsPath();
  const seeds = JSON.parse(fs.readFileSync(seedsPath, "utf8"));
  const seedData = seeds["https://tuf-repo-cdn.sigstore.dev"];
  const trustedRootB64 = seedData.targets["trusted_root.json"];
  const trustedRootJson = JSON.parse(Buffer.from(trustedRootB64, "base64").toString());
  return TrustedRoot.fromJSON(trustedRootJson);
}

/**
 * Create trust material from the bundled trusted root
 */
async function createTrustMaterial() {
  const trustedRoot = await loadTrustedRoot();
  return toTrustMaterial(trustedRoot);
}

// ============================================================================
// Verification Functions
// ============================================================================

/**
 * Verify a Sigstore bundle
 *
 * @param bundle - The Sigstore bundle to verify
 * @param artifact - Optional artifact data (for message signature bundles)
 * @param options - Verification options
 * @returns Verification result with detailed checks
 *
 * @example
 * ```ts
 * const result = await verifyBundle(bundle, artifact, {
 *   expectedIdentity: {
 *     subjectAlternativeName: "user@example.com",
 *     issuer: "https://accounts.google.com"
 *   }
 * });
 * if (result.verified) {
 *   console.log("Bundle verified successfully");
 * }
 * ```
 */
export async function verifyBundle(
  bundle: SigstoreBundle,
  artifact?: Buffer,
  options: VerificationOptions = {}
): Promise<VerificationResult> {
  const details: VerificationDetails = {
    signatureValid: false,
    certificateValid: false,
    certificateWithinValidity: false,
    rekorEntryValid: false,
    inclusionProofValid: false,
    errors: [],
  };

  try {
    // Create trust material from bundled roots
    const trustMaterial = await createTrustMaterial();

    // Create verifier
    const verifier = new Verifier(trustMaterial);

    // Convert bundle to proper format
    const parsedBundle = bundleFromJSON(bundle);
    const signedEntity = toSignedEntity(parsedBundle, artifact);

    // Perform verification
    verifier.verify(signedEntity);

    // If we get here, verification passed
    details.signatureValid = true;
    details.certificateValid = true;
    details.certificateWithinValidity = true;
    details.rekorEntryValid = true;
    details.inclusionProofValid = true;

    // Extract identity from bundle
    const identity = extractIdentityFromBundle(bundle);

    // Check identity if expected identity is provided
    if (options.expectedIdentity) {
      details.identityMatches = matchesExpectedIdentity(identity, options.expectedIdentity);
      if (!details.identityMatches) {
        details.errors.push("Identity does not match expected values");
        const result: VerificationResult = {
          verified: false,
          error: "Identity mismatch",
          details,
        };
        if (identity) result.identity = identity;
        const timestamp = extractTimestampFromBundle(bundle);
        if (timestamp) result.timestamp = timestamp;
        return result;
      }
    }

    const result: VerificationResult = {
      verified: true,
      details,
    };
    if (identity) result.identity = identity;
    const timestamp = extractTimestampFromBundle(bundle);
    if (timestamp) result.timestamp = timestamp;
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    details.errors.push(errorMessage);

    // Try to determine which check failed based on error message
    categorizeVerificationError(errorMessage, details);

    return {
      verified: false,
      error: errorMessage,
      details,
    };
  }
}

/**
 * Create a reusable verifier for multiple verifications
 *
 * @param options - Verification options
 * @returns A verifier object that can verify multiple bundles
 *
 * @example
 * ```ts
 * const verifier = await createBundleVerifier({
 *   expectedIdentity: { issuer: "https://accounts.google.com" }
 * });
 *
 * // Verify multiple bundles efficiently
 * for (const bundle of bundles) {
 *   verifier.verify(bundle);
 * }
 * ```
 */
export async function createBundleVerifier(options: VerificationOptions = {}) {
  // Create trust material once and reuse
  const trustMaterial = await createTrustMaterial();
  const verifier = new Verifier(trustMaterial);

  return {
    /**
     * Verify a bundle using the cached verifier
     */
    verify: async (bundle: SigstoreBundle, artifact?: Buffer): Promise<VerificationResult> => {
      const details: VerificationDetails = {
        signatureValid: false,
        certificateValid: false,
        certificateWithinValidity: false,
        rekorEntryValid: false,
        inclusionProofValid: false,
        errors: [],
      };

      try {
        // Convert bundle to proper format
        const parsedBundle = bundleFromJSON(bundle);
        const signedEntity = toSignedEntity(parsedBundle, artifact);

        // Perform verification
        verifier.verify(signedEntity);

        details.signatureValid = true;
        details.certificateValid = true;
        details.certificateWithinValidity = true;
        details.rekorEntryValid = true;
        details.inclusionProofValid = true;

        const identity = extractIdentityFromBundle(bundle);

        if (options.expectedIdentity) {
          details.identityMatches = matchesExpectedIdentity(identity, options.expectedIdentity);
          if (!details.identityMatches) {
            details.errors.push("Identity does not match expected values");
            const result: VerificationResult = {
              verified: false,
              error: "Identity mismatch",
              details,
            };
            if (identity) result.identity = identity;
            const timestamp = extractTimestampFromBundle(bundle);
            if (timestamp) result.timestamp = timestamp;
            return result;
          }
        }

        const result: VerificationResult = {
          verified: true,
          details,
        };
        if (identity) result.identity = identity;
        const timestamp = extractTimestampFromBundle(bundle);
        if (timestamp) result.timestamp = timestamp;
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        details.errors.push(errorMessage);
        categorizeVerificationError(errorMessage, details);

        return {
          verified: false,
          error: errorMessage,
          details,
        };
      }
    },
  };
}

/**
 * Quick verification check - returns boolean only
 *
 * @param bundle - The Sigstore bundle to verify
 * @param artifact - Optional artifact data
 * @returns True if verification passes, false otherwise
 */
export async function isVerified(bundle: SigstoreBundle, artifact?: Buffer): Promise<boolean> {
  try {
    const trustMaterial = await createTrustMaterial();
    const verifier = new Verifier(trustMaterial);
    const parsedBundle = bundleFromJSON(bundle);
    const signedEntity = toSignedEntity(parsedBundle, artifact);
    verifier.verify(signedEntity);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if an identity matches expected values
 */
function matchesExpectedIdentity(
  identity: OIDCIdentity | undefined,
  expected: ExpectedIdentity
): boolean {
  if (!identity) {
    return false;
  }

  // Check issuer
  if (expected.issuer && identity.issuer !== expected.issuer) {
    return false;
  }

  // Check subject alternative name (could be email or URI)
  if (expected.subjectAlternativeName) {
    const san = expected.subjectAlternativeName;
    if (identity.email !== san && identity.subject !== san) {
      return false;
    }
  }

  // Check GitHub workflow repository
  if (expected.workflowRepository && identity.workflowRepository !== expected.workflowRepository) {
    return false;
  }

  // Check GitHub workflow ref
  if (expected.workflowRef && identity.workflowRef !== expected.workflowRef) {
    return false;
  }

  return true;
}

/**
 * Extract timestamp from a Sigstore bundle
 */
function extractTimestampFromBundle(bundle: SigstoreBundle): Date | undefined {
  // Try to get timestamp from transparency log entry
  const tlogEntry = bundle.verificationMaterial?.tlogEntries?.[0];
  if (tlogEntry?.integratedTime) {
    const timestamp = Number.parseInt(tlogEntry.integratedTime, 10);
    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp * 1000);
    }
  }

  return undefined;
}

/**
 * Categorize a verification error to update details
 */
function categorizeVerificationError(errorMessage: string, details: VerificationDetails): void {
  const lowerError = errorMessage.toLowerCase();

  if (lowerError.includes("signature")) {
    details.signatureValid = false;
  } else if (lowerError.includes("certificate") && lowerError.includes("expired")) {
    details.certificateWithinValidity = false;
  } else if (lowerError.includes("certificate")) {
    details.certificateValid = false;
  } else if (lowerError.includes("rekor") || lowerError.includes("transparency")) {
    details.rekorEntryValid = false;
  } else if (lowerError.includes("inclusion") || lowerError.includes("proof")) {
    details.inclusionProofValid = false;
  }
}
