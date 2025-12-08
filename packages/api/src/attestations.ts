/**
 * Attestation management (v2)
 * Functions for managing auditor attestations
 */

import { extractIdentityFromBundle, verifyBundle } from "@enactprotocol/trust";
import type { OIDCIdentity, SigstoreBundle } from "@enactprotocol/trust";
import type { EnactApiClient } from "./client";
import type { Attestation, AttestationResponse, RevokeAttestationResponse } from "./types";
import { emailToProviderIdentity } from "./utils";

/**
 * Verified auditor info with full identity details
 */
export interface VerifiedAuditor {
  /** Email from attestation */
  email: string;
  /** Full identity from verified certificate (may be undefined if not extractable) */
  identity: OIDCIdentity | undefined;
  /** Provider:identity format (e.g., github:keithagroves) */
  providerIdentity: string;
}
/**
 * Attestation list response
 */
export interface AttestationListResponse {
  attestations: Attestation[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Get all attestations for a tool version (v2)
 *
 * @param client - API client instance
 * @param name - Tool name
 * @param version - Tool version
 * @param options - Pagination options
 * @returns List of attestations with pagination info
 *
 * @example
 * ```ts
 * const result = await getAttestations(client, "alice/utils/greeter", "1.2.0", {
 *   limit: 10,
 *   offset: 0
 * });
 * console.log(`Found ${result.total} attestations`);
 * ```
 */
export async function getAttestations(
  client: EnactApiClient,
  name: string,
  version: string,
  options?: {
    limit?: number | undefined;
    offset?: number | undefined;
  }
): Promise<AttestationListResponse> {
  const params = new URLSearchParams();

  if (options?.limit !== undefined) {
    params.set("limit", String(Math.min(options.limit, 100)));
  }

  if (options?.offset !== undefined) {
    params.set("offset", String(options.offset));
  }

  const queryString = params.toString();
  const path = `/tools/${name}/versions/${version}/attestations${queryString ? `?${queryString}` : ""}`;

  const response = await client.get<AttestationListResponse>(path);
  return response.data;
}

/**
 * Submit an attestation for a tool version (v2)
 *
 * The server will verify the Sigstore bundle against the public Sigstore
 * infrastructure (Rekor + Fulcio) before accepting.
 *
 * @param client - API client instance (must be authenticated)
 * @param name - Tool name
 * @param version - Tool version
 * @param sigstoreBundle - Complete Sigstore bundle
 * @returns Attestation response with verification result
 *
 * @example
 * ```ts
 * const result = await submitAttestation(client, "alice/utils/greeter", "1.2.0", {
 *   "$schema": "https://sigstore.dev/bundle/v1",
 *   "mediaType": "application/vnd.dev.sigstore.bundle.v0.3+json",
 *   "verificationMaterial": { ... },
 *   "messageSignature": { ... }
 * });
 *
 * if (result.verification.verified) {
 *   console.log("Attestation verified and recorded!");
 * }
 * ```
 */
export async function submitAttestation(
  client: EnactApiClient,
  name: string,
  version: string,
  sigstoreBundle: Record<string, unknown>
): Promise<{
  auditor: string;
  auditorProvider: string;
  signedAt: Date;
  rekorLogId: string;
  rekorLogIndex?: number | undefined;
  verification: {
    verified: boolean;
    verifiedAt: Date;
    rekorVerified: boolean;
    certificateVerified: boolean;
    signatureVerified: boolean;
  };
}> {
  const response = await client.post<AttestationResponse>(
    `/tools/${name}/versions/${version}/attestations`,
    {
      bundle: sigstoreBundle,
    }
  );

  return {
    auditor: response.data.auditor,
    auditorProvider: response.data.auditor_provider,
    signedAt: new Date(response.data.signed_at),
    rekorLogId: response.data.rekor_log_id,
    rekorLogIndex: response.data.rekor_log_index,
    verification: {
      verified: response.data.verification.verified,
      verifiedAt: new Date(response.data.verification.verified_at),
      rekorVerified: response.data.verification.rekor_verified,
      certificateVerified: response.data.verification.certificate_verified,
      signatureVerified: response.data.verification.signature_verified,
    },
  };
}

/**
 * Revoke an attestation (v2)
 *
 * Only the original auditor can revoke their attestation.
 *
 * @param client - API client instance (must be authenticated)
 * @param name - Tool name
 * @param version - Tool version
 * @param auditorEmail - Email of the auditor (from Sigstore certificate)
 * @returns Revocation confirmation
 *
 * @example
 * ```ts
 * const result = await revokeAttestation(
 *   client,
 *   "alice/utils/greeter",
 *   "1.2.0",
 *   "security@example.com"
 * );
 * console.log(`Revoked at ${result.revokedAt}`);
 * ```
 */
export async function revokeAttestation(
  client: EnactApiClient,
  name: string,
  version: string,
  auditorEmail: string
): Promise<{
  auditor: string;
  revoked: true;
  revokedAt: Date;
}> {
  const encodedEmail = encodeURIComponent(auditorEmail);
  const response = await client.delete<RevokeAttestationResponse>(
    `/tools/${name}/versions/${version}/attestations?auditor=${encodedEmail}`
  );

  return {
    auditor: response.data.auditor,
    revoked: response.data.revoked,
    revokedAt: new Date(response.data.revoked_at),
  };
}

/**
 * Check if a tool version has attestations from specific auditors
 *
 * @param client - API client instance
 * @param name - Tool name
 * @param version - Tool version
 * @param trustedAuditors - List of trusted auditor emails
 * @returns True if at least one trusted auditor has attested
 *
 * @example
 * ```ts
 * const isTrusted = await hasAttestation(
 *   client,
 *   "alice/utils/greeter",
 *   "1.2.0",
 *   ["security@example.com", "bob@github.com"]
 * );
 *
 * if (isTrusted) {
 *   console.log("Tool is trusted!");
 * }
 * ```
 */
export async function hasAttestation(
  client: EnactApiClient,
  name: string,
  version: string,
  trustedAuditors: string[]
): Promise<boolean> {
  const result = await getAttestations(client, name, version);

  return result.attestations.some(
    (attestation) =>
      trustedAuditors.includes(attestation.auditor) && attestation.verification?.verified === true
  );
}

/**
 * Get the full Sigstore bundle for a specific attestation
 *
 * This fetches the complete Sigstore bundle needed for local verification.
 * Never trust the registry's verification status - always verify locally.
 *
 * @param client - API client instance
 * @param name - Tool name
 * @param version - Tool version
 * @param auditor - Auditor email
 * @returns Complete Sigstore bundle
 *
 * @example
 * ```ts
 * const bundle = await getAttestationBundle(
 *   client,
 *   "alice/utils/greeter",
 *   "1.2.0",
 *   "security@example.com"
 * );
 * ```
 */
export async function getAttestationBundle(
  client: EnactApiClient,
  name: string,
  version: string,
  auditor: string
): Promise<SigstoreBundle> {
  const encodedAuditor = encodeURIComponent(auditor);
  const response = await client.get<SigstoreBundle>(
    `/tools/${name}/versions/${version}/trust/attestations/${encodedAuditor}`
  );
  return response.data;
}

/**
 * Verify an attestation locally using Sigstore (never trust registry)
 *
 * This performs cryptographic verification against Rekor transparency log,
 * Fulcio certificate authority, and validates the signature. The registry's
 * verification status is NEVER trusted - we always verify locally.
 *
 * @param client - API client instance
 * @param name - Tool name
 * @param version - Tool version
 * @param attestation - Attestation metadata from registry
 * @param bundleHash - Bundle hash to verify against (sha256:...)
 * @returns True if attestation is cryptographically valid
 *
 * @example
 * ```ts
 * const attestations = await getAttestations(client, "alice/utils/greeter", "1.2.0");
 * const attestation = attestations.attestations[0];
 *
 * const isValid = await verifyAttestationLocally(
 *   client,
 *   "alice/utils/greeter",
 *   "1.2.0",
 *   attestation,
 *   "sha256:abc123..."
 * );
 *
 * if (isValid) {
 *   console.log("Attestation cryptographically verified!");
 * }
 * ```
 */
export async function verifyAttestationLocally(
  client: EnactApiClient,
  name: string,
  version: string,
  attestation: Attestation,
  bundleHash: string
): Promise<boolean> {
  try {
    // Fetch the full Sigstore bundle from registry
    const bundle = await getAttestationBundle(client, name, version, attestation.auditor);

    // Convert bundle hash to Buffer for verification
    const hashWithoutPrefix = bundleHash.replace("sha256:", "");
    const artifactHash = Buffer.from(hashWithoutPrefix, "hex");

    // Verify using @enactprotocol/trust package (checks Rekor, Fulcio, signatures)
    const result = await verifyBundle(bundle, artifactHash, {
      expectedIdentity: {
        subjectAlternativeName: attestation.auditor,
      },
    });

    return result.verified;
  } catch (error) {
    // Verification failed - log error and return false
    console.error(`Attestation verification failed for ${attestation.auditor}:`, error);
    return false;
  }
}

/**
 * Verify all attestations for a tool and return verified auditors
 *
 * This verifies all attestations locally and returns only those that pass
 * cryptographic verification. Never trusts the registry's verification status.
 *
 * @param client - API client instance
 * @param name - Tool name
 * @param version - Tool version
 * @param bundleHash - Bundle hash to verify against
 * @returns Array of verified auditor emails
 *
 * @example
 * ```ts
 * const verifiedAuditors = await verifyAllAttestations(
 *   client,
 *   "alice/utils/greeter",
 *   "1.2.0",
 *   "sha256:abc123..."
 * );
 *
 * console.log(`Verified auditors: ${verifiedAuditors.join(", ")}`);
 * ```
 */
export async function verifyAllAttestations(
  client: EnactApiClient,
  name: string,
  version: string,
  bundleHash: string
): Promise<VerifiedAuditor[]> {
  const { attestations } = await getAttestations(client, name, version);

  // Verify all attestations in parallel
  const verificationResults = await Promise.all(
    attestations.map(async (attestation) => {
      try {
        // Fetch the full Sigstore bundle
        const bundle = await getAttestationBundle(client, name, version, attestation.auditor);

        // Convert bundle hash to Buffer for verification
        const hashWithoutPrefix = bundleHash.replace("sha256:", "");
        const artifactHash = Buffer.from(hashWithoutPrefix, "hex");

        // Verify the bundle
        const result = await verifyBundle(bundle, artifactHash, {
          expectedIdentity: {
            subjectAlternativeName: attestation.auditor,
          },
        });

        if (result.verified) {
          // Extract full identity from the verified bundle
          const identity = extractIdentityFromBundle(bundle);

          // Build provider:identity format using issuer info
          const providerIdentity = emailToProviderIdentity(
            attestation.auditor,
            identity?.issuer,
            identity?.username
          );

          return {
            auditor: attestation.auditor,
            identity,
            providerIdentity,
            isValid: true,
          };
        }
        return { auditor: attestation.auditor, isValid: false };
      } catch {
        return { auditor: attestation.auditor, isValid: false };
      }
    })
  );

  // Return only verified auditors with full identity info
  return verificationResults
    .filter(
      (
        result
      ): result is {
        auditor: string;
        identity: OIDCIdentity | undefined;
        providerIdentity: string;
        isValid: true;
      } => result.isValid
    )
    .map((result) => ({
      email: result.auditor,
      identity: result.identity,
      providerIdentity: result.providerIdentity,
    }));
}

/**
 * Check if a tool has a trusted attestation (with local verification)
 *
 * This checks if at least one attestation exists from a trusted auditor
 * AND verifies it locally. Never trusts the registry's verification status.
 *
 * @param client - API client instance
 * @param name - Tool name
 * @param version - Tool version
 * @param bundleHash - Bundle hash to verify against
 * @param trustedAuditors - List of trusted auditor emails
 * @returns True if at least one trusted auditor's attestation is verified
 *
 * @example
 * ```ts
 * const isTrusted = await hasTrustedAttestation(
 *   client,
 *   "alice/utils/greeter",
 *   "1.2.0",
 *   "sha256:abc123...",
 *   ["security@example.com", "bob@github.com"]
 * );
 *
 * if (isTrusted) {
 *   console.log("Tool is trusted and verified!");
 * } else {
 *   console.log("No trusted attestations found - use 'enact inspect' to review");
 * }
 * ```
 */
export async function hasTrustedAttestation(
  client: EnactApiClient,
  name: string,
  version: string,
  bundleHash: string,
  trustedAuditors: string[]
): Promise<boolean> {
  const verifiedAuditors = await verifyAllAttestations(client, name, version, bundleHash);

  // Check if any verified auditor's providerIdentity matches a trusted auditor
  // providerIdentity is in format "github:username" or "github:email@domain.com"
  return verifiedAuditors.some((auditor) => {
    return trustedAuditors.includes(auditor.providerIdentity);
  });
}
