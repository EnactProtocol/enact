/**
 * Sigstore integration for Enact
 *
 * This module provides Sigstore-based attestation signing and verification
 * capabilities for the Enact tool ecosystem.
 */

// Types
export type {
  // OIDC types
  OIDCProvider,
  OIDCIdentity,
  OIDCOptions,
  // Certificate types
  FulcioCertificate,
  FulcioCertificateOptions,
  // Rekor types
  RekorEntry,
  RekorInclusionProof,
  RekorEntryOptions,
  // Attestation types
  InTotoStatement,
  InTotoSubject,
  SLSAProvenancePredicate,
  SLSAResourceDescriptor,
  // Bundle types
  SigstoreBundle,
  TransparencyLogEntry,
  // Signing/verification types
  SigningOptions,
  SigningResult,
  VerificationOptions,
  VerificationResult,
  VerificationDetails,
  ExpectedIdentity,
  // Trust types
  TrustRoot,
  CertificateAuthority,
  TransparencyLog,
  TimestampAuthority,
  TrustPolicy,
  TrustedIdentityRule,
  TrustPolicyResult,
  VerifiedAttestation,
  // Enact-specific types
  EnactToolPredicate,
  EnactAttestationBundle,
} from "./types";

// Signing
export {
  signArtifact,
  signAttestation,
  extractOIDCIdentity,
  extractCertificateFromBundle,
  extractIdentityFromBundle,
  detectOIDCProvider,
  getOIDCTokenFromEnvironment,
  FULCIO_PUBLIC_URL,
  REKOR_PUBLIC_URL,
  TSA_PUBLIC_URL,
  OIDC_ISSUERS,
} from "./signing";

// OAuth Identity Provider (for interactive signing)
export {
  OAuthIdentityProvider,
  CallbackServer,
  OAuthClient,
  initializeOAuthClient,
  SIGSTORE_OAUTH_ISSUER,
  SIGSTORE_CLIENT_ID,
} from "./oauth";
export type {
  OAuthIdentityProviderOptions,
  IdentityProvider,
} from "./oauth";

// Cosign CLI integration (fallback for interactive signing)
export {
  isCosignAvailable,
  getCosignVersion,
  signWithCosign,
  attestWithCosign,
  verifyWithCosign,
  verifyAttestationWithCosign,
} from "./cosign";
export type { CosignSignOptions, CosignSignResult } from "./cosign";

// Verification
export {
  verifyBundle,
  createBundleVerifier,
  isVerified,
} from "./verification";

// Attestation creation
export {
  createSubjectFromContent,
  createSubjectFromFile,
  createSubjectWithMultipleDigests,
  createStatement,
  createSLSAProvenance,
  createSLSAProvenanceStatement,
  createEnactToolPredicate,
  createEnactToolStatement,
  createEnactAuditPredicate,
  createEnactAuditStatement,
  createResourceDescriptorFromFile,
  createResourceDescriptorFromContent,
  // Constants
  ENACT_BASE_URL,
  INTOTO_STATEMENT_TYPE,
  SLSA_PROVENANCE_TYPE,
  ENACT_TOOL_TYPE,
  ENACT_AUDIT_TYPE,
  ENACT_BUILD_TYPE,
} from "./attestation";

// Trust policy
export {
  createTrustPolicy,
  createIdentityRule,
  evaluateTrustPolicy,
  isTrusted,
  serializeTrustPolicy,
  deserializeTrustPolicy,
  DEFAULT_TRUST_POLICY,
  PERMISSIVE_POLICY,
  STRICT_POLICY,
} from "./policy";

// Re-export attestation option types
export type {
  SLSAProvenanceOptions,
  EnactToolAttestationOptions,
  EnactAuditAttestationOptions,
  EnactAuditPredicate,
} from "./attestation";
