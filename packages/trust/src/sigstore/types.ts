/**
 * Sigstore-related type definitions for attestation and verification
 */

// Import the actual sigstore bundle type (exported as Bundle from sigstore)
import type { Bundle } from "@enactprotocol/sigstore";

// Re-export for use - sigstore exports SerializedBundle as Bundle
export type SigstoreBundle = Bundle;

// ============================================================================
// OIDC Identity Types
// ============================================================================

/**
 * Supported OIDC providers for keyless signing
 */
export type OIDCProvider = "github" | "google" | "microsoft" | "gitlab" | "custom";

/**
 * OIDC identity information extracted from tokens
 */
export interface OIDCIdentity {
  /** OIDC provider that issued the token */
  provider: OIDCProvider;
  /** Subject identifier (e.g., email or user ID) */
  subject: string;
  /** Issuer URL */
  issuer: string;
  /** Email address if available */
  email?: string;
  /** Username for the provider (e.g., GitHub username) */
  username?: string;
  /** GitHub-specific: workflow repository */
  workflowRepository?: string;
  /** GitHub-specific: workflow ref (branch/tag) */
  workflowRef?: string;
  /** GitHub-specific: workflow trigger event */
  workflowTrigger?: string;
  /** Raw OIDC token claims */
  claims?: Record<string, unknown>;
}

/**
 * Options for OIDC authentication
 */
export interface OIDCOptions {
  /** OIDC provider to use */
  provider: OIDCProvider;
  /** Custom issuer URL (for custom provider) */
  issuerURL?: string;
  /** Client ID for OIDC flow */
  clientId?: string;
  /** Redirect URI for OAuth flow */
  redirectUri?: string;
  /** Pre-obtained OIDC token (for CI/CD environments) */
  token?: string;
}

// ============================================================================
// Fulcio Certificate Types
// ============================================================================

/**
 * Fulcio certificate information
 */
export interface FulcioCertificate {
  /** PEM-encoded certificate chain */
  certificateChain: string[];
  /** Certificate serial number */
  serialNumber: string;
  /** Certificate not before time */
  notBefore: Date;
  /** Certificate not after time */
  notAfter: Date;
  /** Subject common name */
  subject: string;
  /** Certificate issuer */
  issuer: string;
  /** OIDC identity embedded in certificate */
  identity: OIDCIdentity;
  /** Raw certificate bytes (DER encoded) */
  raw?: Uint8Array;
}

/**
 * Options for requesting a Fulcio certificate
 */
export interface FulcioCertificateOptions {
  /** Fulcio server URL (default: public Fulcio instance) */
  fulcioURL?: string;
  /** OIDC identity token */
  identityToken: string;
  /** Public key to certify */
  publicKey: string;
  /** Proof of possession signature */
  proofOfPossession: string;
}

// ============================================================================
// Rekor Transparency Log Types
// ============================================================================

/**
 * Rekor transparency log entry
 */
export interface RekorEntry {
  /** Log entry UUID */
  uuid: string;
  /** Log entry index */
  logIndex: number;
  /** Integrated time (Unix timestamp) */
  integratedTime: number;
  /** Log ID */
  logID: string;
  /** Entry body (base64 encoded) */
  body: string;
  /** Signed Entry Timestamp (SET) */
  signedEntryTimestamp: string;
  /** Inclusion proof */
  inclusionProof?: RekorInclusionProof;
}

/**
 * Inclusion proof for a Rekor entry
 */
export interface RekorInclusionProof {
  /** Log index */
  logIndex: number;
  /** Root hash of the tree at the time of inclusion */
  rootHash: string;
  /** Tree size at time of inclusion */
  treeSize: number;
  /** Hashes for the inclusion proof */
  hashes: string[];
}

/**
 * Options for creating a Rekor entry
 */
export interface RekorEntryOptions {
  /** Rekor server URL (default: public Rekor instance) */
  rekorURL?: string;
  /** Artifact hash */
  artifactHash: string;
  /** Signature over the artifact */
  signature: string;
  /** Signing certificate */
  certificate: string;
}

// ============================================================================
// Attestation Types (in-toto / SLSA)
// ============================================================================

/**
 * in-toto Statement (attestation envelope)
 * @see https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md
 */
export interface InTotoStatement<T = unknown> {
  /** Statement type identifier */
  _type: "https://in-toto.io/Statement/v1";
  /** Subjects (artifacts) this attestation covers */
  subject: InTotoSubject[];
  /** Predicate type URI */
  predicateType: string;
  /** Predicate content */
  predicate: T;
}

/**
 * Subject of an in-toto statement
 */
export interface InTotoSubject {
  /** Subject name (e.g., file path or artifact identifier) */
  name: string;
  /** Digest of the subject in various algorithms */
  digest: {
    sha256?: string;
    sha512?: string;
    [algorithm: string]: string | undefined;
  };
}

/**
 * SLSA Provenance predicate v1.0
 * @see https://slsa.dev/spec/v1.0/provenance
 */
export interface SLSAProvenancePredicate {
  /** Build definition */
  buildDefinition: {
    /** Build type URI */
    buildType: string;
    /** External parameters */
    externalParameters: Record<string, unknown>;
    /** Internal parameters */
    internalParameters?: Record<string, unknown>;
    /** Resolved dependencies */
    resolvedDependencies?: SLSAResourceDescriptor[];
  };
  /** Run details */
  runDetails: {
    /** Builder information */
    builder: {
      /** Builder ID */
      id: string;
      /** Builder dependencies */
      builderDependencies?: SLSAResourceDescriptor[];
      /** Builder version */
      version?: Record<string, string>;
    };
    /** Build metadata */
    metadata?: {
      /** Invocation ID */
      invocationId?: string;
      /** Start time */
      startedOn?: string;
      /** End time */
      finishedOn?: string;
    };
    /** Byproducts of the build */
    byproducts?: SLSAResourceDescriptor[];
  };
}

/**
 * SLSA Resource Descriptor
 */
export interface SLSAResourceDescriptor {
  /** Resource URI */
  uri?: string;
  /** Resource digest */
  digest?: {
    sha256?: string;
    sha512?: string;
    [algorithm: string]: string | undefined;
  };
  /** Resource name */
  name?: string;
  /** Download location */
  downloadLocation?: string;
  /** Media type */
  mediaType?: string;
  /** Content (for inline resources) */
  content?: string;
  /** Annotations */
  annotations?: Record<string, unknown>;
}

// ============================================================================
// Sigstore Bundle Types
// ============================================================================

// Note: SigstoreBundle is imported from sigstore and re-exported at the top of this file.
// The following interface provides additional type information for transparency log entries
// that we may extract from bundles for our own processing.

/**
 * Transparency log entry in bundle format (for reference/extraction)
 */
export interface TransparencyLogEntry {
  /** Log index */
  logIndex: string;
  /** Log ID */
  logId: {
    keyId: string; // base64
  };
  /** Entry kind and version */
  kindVersion: {
    kind: "hashedrekord" | "intoto" | "dsse";
    version: string;
  };
  /** Integrated time (Unix timestamp) */
  integratedTime: string;
  /** Inclusion promise */
  inclusionPromise?: {
    signedEntryTimestamp: string; // base64
  };
  /** Inclusion proof */
  inclusionProof?: {
    logIndex: string;
    rootHash: string; // base64
    treeSize: string;
    hashes: string[]; // base64
    checkpoint: {
      envelope: string;
    };
  };
  /** Canonicalized body */
  canonicalizedBody: string; // base64
}

// ============================================================================
// Signing and Verification Types
// ============================================================================

/**
 * Options for signing an artifact
 */
export interface SigningOptions {
  /** OIDC options for keyless signing */
  oidc?: OIDCOptions;
  /** Use public Sigstore infrastructure (default: true) */
  usePublicInstance?: boolean;
  /** Custom Fulcio URL */
  fulcioURL?: string;
  /** Custom Rekor URL */
  rekorURL?: string;
  /** Custom TSA (Timestamp Authority) URL */
  tsaURL?: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Result of a signing operation
 */
export interface SigningResult {
  /** The signed bundle */
  bundle: SigstoreBundle;
  /** Signing certificate (if keyless signing used) */
  certificate?: FulcioCertificate;
  /** Rekor log entry */
  rekorEntry?: RekorEntry;
  /** Timestamp of signing */
  timestamp: Date;
}

/**
 * Options for verifying an artifact
 */
export interface VerificationOptions {
  /** Trust root to use (default: public Sigstore TUF root) */
  trustRoot?: TrustRoot;
  /** Expected identity to verify against */
  expectedIdentity?: ExpectedIdentity;
  /** Use public Sigstore infrastructure (default: true) */
  usePublicInstance?: boolean;
  /** Verify certificate transparency (default: true) */
  verifyCertificateTransparency?: boolean;
  /** Verify timestamp (default: true) */
  verifyTimestamp?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Expected identity for verification
 */
export interface ExpectedIdentity {
  /** Expected certificate subject (email or URI) */
  subjectAlternativeName?: string;
  /** Expected OIDC issuer */
  issuer?: string;
  /** Expected GitHub workflow repository */
  workflowRepository?: string;
  /** Expected GitHub workflow ref */
  workflowRef?: string;
}

/**
 * Result of a verification operation
 */
export interface VerificationResult {
  /** Whether verification succeeded */
  verified: boolean;
  /** Error message if verification failed */
  error?: string;
  /** Details about verification checks */
  details: VerificationDetails;
  /** Extracted identity from certificate */
  identity?: OIDCIdentity;
  /** Timestamp of artifact creation (from Rekor) */
  timestamp?: Date;
}

/**
 * Detailed verification check results
 */
export interface VerificationDetails {
  /** Signature verification passed */
  signatureValid: boolean;
  /** Certificate chain valid */
  certificateValid: boolean;
  /** Certificate within validity period (at signing time) */
  certificateWithinValidity: boolean;
  /** Rekor entry found and valid */
  rekorEntryValid: boolean;
  /** Inclusion proof verified */
  inclusionProofValid: boolean;
  /** Identity matches expected (if specified) */
  identityMatches?: boolean;
  /** Individual check errors */
  errors: string[];
}

// ============================================================================
// Trust Root Types
// ============================================================================

/**
 * Trust root for Sigstore verification
 */
export interface TrustRoot {
  /** Trusted certificate authorities (for Fulcio) */
  certificateAuthorities: CertificateAuthority[];
  /** Trusted transparency logs (for Rekor) */
  transparencyLogs: TransparencyLog[];
  /** Timestamp authorities */
  timestampAuthorities?: TimestampAuthority[];
}

/**
 * Certificate authority configuration
 */
export interface CertificateAuthority {
  /** CA subject */
  subject: {
    organization?: string;
    commonName?: string;
  };
  /** Root certificate (PEM or DER) */
  rootCertificate: string;
  /** Certificate chain (if intermediate CAs) */
  certificateChain?: string[];
  /** Validity period */
  validFor: {
    start: Date;
    end?: Date;
  };
}

/**
 * Transparency log configuration
 */
export interface TransparencyLog {
  /** Log ID */
  logId: string;
  /** Log public key */
  publicKey: string;
  /** Log URL */
  baseUrl: string;
  /** Hash algorithm used */
  hashAlgorithm: "sha256" | "sha384" | "sha512";
  /** Validity period */
  validFor: {
    start: Date;
    end?: Date;
  };
}

/**
 * Timestamp authority configuration
 */
export interface TimestampAuthority {
  /** TSA subject */
  subject: {
    organization?: string;
    commonName?: string;
  };
  /** TSA certificate chain */
  certificateChain: string[];
  /** Validity period */
  validFor: {
    start: Date;
    end?: Date;
  };
}

// ============================================================================
// Trust Policy Types
// ============================================================================

/**
 * Trust policy for evaluating attestations
 */
export interface TrustPolicy {
  /** Policy name */
  name: string;
  /** Policy version */
  version: string;
  /** Trusted publishers (by identity) */
  trustedPublishers: TrustedIdentityRule[];
  /** Trusted auditors (can vouch for tools) */
  trustedAuditors: TrustedIdentityRule[];
  /** Required attestation types */
  requiredAttestations?: string[];
  /** Minimum SLSA level required */
  minimumSLSALevel?: 0 | 1 | 2 | 3 | 4;
  /** Allow unsigned tools (default: false) */
  allowUnsigned?: boolean;
  /** Cache verification results */
  cacheResults?: boolean;
}

/**
 * Rule for matching trusted identities
 */
export interface TrustedIdentityRule {
  /** Rule name/description */
  name: string;
  /** Identity type */
  type: "email" | "github-workflow" | "gitlab-pipeline" | "uri";
  /** Pattern to match (supports glob) */
  pattern: string;
  /** Expected OIDC issuer */
  issuer?: string;
  /** Required claims */
  requiredClaims?: Record<string, string | string[]>;
}

/**
 * Result of trust policy evaluation
 */
export interface TrustPolicyResult {
  /** Whether the artifact is trusted */
  trusted: boolean;
  /** Trust level (0 = unsigned, 1-4 = SLSA levels) */
  trustLevel: 0 | 1 | 2 | 3 | 4;
  /** Matched publisher rule (if any) */
  matchedPublisher?: TrustedIdentityRule;
  /** Matched auditor rules (if any) */
  matchedAuditors: TrustedIdentityRule[];
  /** Policy evaluation details */
  details: {
    /** All verified attestations */
    attestations: VerifiedAttestation[];
    /** Policy violations */
    violations: string[];
    /** Warnings */
    warnings: string[];
  };
}

/**
 * A verified attestation with metadata
 */
export interface VerifiedAttestation {
  /** Attestation type */
  type: string;
  /** Predicate type */
  predicateType: string;
  /** Signer identity */
  signer: OIDCIdentity;
  /** Verification timestamp */
  verifiedAt: Date;
  /** Full attestation content */
  attestation: InTotoStatement;
}

// ============================================================================
// Enact-specific Types
// ============================================================================

/**
 * Enact tool attestation predicate
 */
export interface EnactToolPredicate {
  /** Enact-specific predicate type */
  type: "https://enact.tools/attestation/tool/v1";
  /** Tool metadata */
  tool: {
    /** Tool name */
    name: string;
    /** Tool version */
    version: string;
    /** Tool publisher */
    publisher: string;
    /** Tool description */
    description?: string;
    /** Tool repository */
    repository?: string;
  };
  /** Build information */
  build?: {
    /** Build timestamp */
    timestamp: string;
    /** Build environment */
    environment?: Record<string, string>;
    /** Source commit */
    sourceCommit?: string;
  };
  /** Security audit information */
  audit?: {
    /** Auditor identity */
    auditor: string;
    /** Audit timestamp */
    timestamp: string;
    /** Audit result */
    result: "passed" | "passed-with-warnings" | "failed";
    /** Audit notes */
    notes?: string;
  };
}

/**
 * Enact attestation bundle (tool manifest + attestations)
 */
export interface EnactAttestationBundle {
  /** Bundle format version */
  version: "1.0";
  /** Tool manifest hash */
  manifestHash: {
    algorithm: "sha256";
    digest: string;
  };
  /** Publisher attestation (required) */
  publisherAttestation: SigstoreBundle;
  /** Auditor attestations (optional) */
  auditorAttestations?: SigstoreBundle[];
  /** Provenance attestation (optional) */
  provenanceAttestation?: SigstoreBundle;
}
