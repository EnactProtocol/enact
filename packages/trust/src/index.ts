/**
 * @enactprotocol/trust
 *
 * Sigstore integration, attestation generation/verification,
 * and trust system for Enact.
 */

export const version = "0.1.0";

// Hash utilities
export { hashContent, hashBuffer, hashFile } from "./hash";

// Checksum manifest (for deterministic signing)
export {
  createChecksumManifest,
  computeManifestHash,
  verifyChecksumManifest,
  verifyManifestAttestation,
  parseChecksumManifest,
  serializeChecksumManifest,
  MANIFEST_VERSION,
} from "./manifest";
export type {
  ChecksumManifest,
  FileChecksum,
  CreateManifestOptions,
  ManifestVerificationResult,
  ManifestAttestationVerificationResult,
} from "./manifest";

// Key management
export { generateKeyPair, isValidPEMKey, getKeyTypeFromPEM } from "./keys";

// Sigstore integration (attestation signing, verification, trust policies)
export * from "./sigstore";

// TypeScript types for hash/key operations
export type {
  HashAlgorithm,
  HashResult,
  FileHashOptions,
  KeyType,
  KeyFormat,
  KeyPair,
  KeyGenerationOptions,
} from "./types";
