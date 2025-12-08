/**
 * Trust policy evaluation module
 *
 * This module provides functions for creating and evaluating trust policies
 * that determine whether an artifact should be trusted based on its attestations.
 */

import { ENACT_AUDIT_TYPE, ENACT_TOOL_TYPE, SLSA_PROVENANCE_TYPE } from "./attestation";
import { extractIdentityFromBundle } from "./signing";
import type {
  InTotoStatement,
  OIDCIdentity,
  SigstoreBundle,
  TrustPolicy,
  TrustPolicyResult,
  TrustedIdentityRule,
  VerifiedAttestation,
} from "./types";
import { verifyBundle } from "./verification";

// ============================================================================
// Default Policy
// ============================================================================

/**
 * Default trust policy - requires publisher attestation
 */
export const DEFAULT_TRUST_POLICY: TrustPolicy = {
  name: "default",
  version: "1.0",
  trustedPublishers: [],
  trustedAuditors: [],
  requiredAttestations: [ENACT_TOOL_TYPE],
  minimumSLSALevel: 0,
  allowUnsigned: false,
  cacheResults: true,
};

/**
 * Permissive policy - allows unsigned tools (for development)
 */
export const PERMISSIVE_POLICY: TrustPolicy = {
  name: "permissive",
  version: "1.0",
  trustedPublishers: [],
  trustedAuditors: [],
  requiredAttestations: [],
  minimumSLSALevel: 0,
  allowUnsigned: true,
  cacheResults: false,
};

/**
 * Strict policy - requires publisher + auditor attestations and SLSA level 2+
 */
export const STRICT_POLICY: TrustPolicy = {
  name: "strict",
  version: "1.0",
  trustedPublishers: [],
  trustedAuditors: [],
  requiredAttestations: [ENACT_TOOL_TYPE, ENACT_AUDIT_TYPE],
  minimumSLSALevel: 2,
  allowUnsigned: false,
  cacheResults: true,
};

// ============================================================================
// Policy Creation
// ============================================================================

/**
 * Create a trust policy
 *
 * @param options - Policy options
 * @returns The trust policy
 *
 * @example
 * ```ts
 * const policy = createTrustPolicy({
 *   name: "my-org-policy",
 *   trustedPublishers: [
 *     { name: "My Team", type: "email", pattern: "*@myorg.com" }
 *   ],
 *   minimumSLSALevel: 1
 * });
 * ```
 */
export function createTrustPolicy(options: Partial<TrustPolicy> & { name: string }): TrustPolicy {
  return {
    ...DEFAULT_TRUST_POLICY,
    ...options,
    version: options.version || "1.0",
  };
}

/**
 * Create a trusted identity rule
 *
 * @param name - Rule name
 * @param type - Identity type
 * @param pattern - Pattern to match
 * @param options - Additional options
 * @returns The identity rule
 */
export function createIdentityRule(
  name: string,
  type: TrustedIdentityRule["type"],
  pattern: string,
  options: { issuer?: string; requiredClaims?: Record<string, string | string[]> } = {}
): TrustedIdentityRule {
  const rule: TrustedIdentityRule = {
    name,
    type,
    pattern,
  };

  if (options.issuer) {
    rule.issuer = options.issuer;
  }

  if (options.requiredClaims) {
    rule.requiredClaims = options.requiredClaims;
  }

  return rule;
}

// ============================================================================
// Policy Evaluation
// ============================================================================

/**
 * Evaluate trust policy for a set of attestations
 *
 * @param attestationBundles - Array of Sigstore bundles containing attestations
 * @param policy - The trust policy to evaluate against
 * @returns The trust policy evaluation result
 *
 * @example
 * ```ts
 * const result = await evaluateTrustPolicy(bundles, myPolicy);
 * if (result.trusted) {
 *   console.log(`Trusted at level ${result.trustLevel}`);
 * }
 * ```
 */
export async function evaluateTrustPolicy(
  attestationBundles: SigstoreBundle[],
  policy: TrustPolicy
): Promise<TrustPolicyResult> {
  const result: TrustPolicyResult = {
    trusted: false,
    trustLevel: 0,
    matchedAuditors: [],
    details: {
      attestations: [],
      violations: [],
      warnings: [],
    },
  };

  // If no attestations and unsigned allowed, trust with level 0
  if (attestationBundles.length === 0) {
    if (policy.allowUnsigned) {
      result.trusted = true;
      result.details.warnings.push("No attestations found - trusting unsigned artifact");
      return result;
    }

    result.details.violations.push("No attestations found and policy requires signed artifacts");
    return result;
  }

  // Verify all attestation bundles and extract information
  const verifiedAttestations: VerifiedAttestation[] = [];

  for (const bundle of attestationBundles) {
    try {
      const verificationResult = await verifyBundle(bundle);

      if (!verificationResult.verified) {
        result.details.violations.push(
          `Attestation verification failed: ${verificationResult.error}`
        );
        continue;
      }

      // Extract attestation from DSSE envelope
      const attestation = extractAttestationFromBundle(bundle);
      if (!attestation) {
        result.details.warnings.push("Could not extract attestation from bundle");
        continue;
      }

      const identity = extractIdentityFromBundle(bundle);
      if (!identity) {
        result.details.warnings.push("Could not extract identity from bundle");
        continue;
      }

      verifiedAttestations.push({
        type: attestation.predicateType,
        predicateType: attestation.predicateType,
        signer: identity,
        verifiedAt: new Date(),
        attestation,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.details.violations.push(`Attestation verification error: ${message}`);
    }
  }

  result.details.attestations = verifiedAttestations;

  // Check required attestation types
  if (policy.requiredAttestations && policy.requiredAttestations.length > 0) {
    const foundTypes = new Set(verifiedAttestations.map((a) => a.predicateType));

    for (const required of policy.requiredAttestations) {
      if (!foundTypes.has(required)) {
        result.details.violations.push(`Required attestation type not found: ${required}`);
      }
    }
  }

  // Find matching publisher
  const publisherAttestation = verifiedAttestations.find(
    (a) => a.predicateType === ENACT_TOOL_TYPE
  );

  if (publisherAttestation) {
    const matchedPublisher = findMatchingRule(
      publisherAttestation.signer,
      policy.trustedPublishers
    );

    if (matchedPublisher) {
      result.matchedPublisher = matchedPublisher;
      result.trustLevel = Math.max(result.trustLevel, 1) as 0 | 1 | 2 | 3 | 4;
    } else if (policy.trustedPublishers.length > 0) {
      result.details.violations.push(
        "Publisher identity does not match any trusted publisher rule"
      );
    }
  }

  // Find matching auditors
  const auditorAttestations = verifiedAttestations.filter(
    (a) => a.predicateType === ENACT_AUDIT_TYPE
  );

  for (const auditorAttestation of auditorAttestations) {
    const matchedAuditor = findMatchingRule(auditorAttestation.signer, policy.trustedAuditors);

    if (matchedAuditor) {
      result.matchedAuditors.push(matchedAuditor);
      result.trustLevel = Math.max(result.trustLevel, 2) as 0 | 1 | 2 | 3 | 4;
    }
  }

  // Check SLSA provenance for higher trust levels
  const provenanceAttestation = verifiedAttestations.find(
    (a) => a.predicateType === SLSA_PROVENANCE_TYPE
  );

  if (provenanceAttestation) {
    const slsaLevel = determineSLSALevel(provenanceAttestation.attestation);
    result.trustLevel = Math.max(result.trustLevel, slsaLevel) as 0 | 1 | 2 | 3 | 4;
  }

  // Check minimum SLSA level
  if (policy.minimumSLSALevel && result.trustLevel < policy.minimumSLSALevel) {
    result.details.violations.push(
      `Trust level ${result.trustLevel} is below minimum required ${policy.minimumSLSALevel}`
    );
  }

  // Determine final trust status
  result.trusted = result.details.violations.length === 0;

  return result;
}

/**
 * Quick check if an artifact should be trusted
 *
 * @param attestationBundles - Array of Sigstore bundles
 * @param policy - Trust policy (defaults to DEFAULT_TRUST_POLICY)
 * @returns True if artifact is trusted
 */
export async function isTrusted(
  attestationBundles: SigstoreBundle[],
  policy: TrustPolicy = DEFAULT_TRUST_POLICY
): Promise<boolean> {
  const result = await evaluateTrustPolicy(attestationBundles, policy);
  return result.trusted;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find a matching identity rule for the given identity
 */
function findMatchingRule(
  identity: OIDCIdentity,
  rules: TrustedIdentityRule[]
): TrustedIdentityRule | undefined {
  for (const rule of rules) {
    if (matchesIdentityRule(identity, rule)) {
      return rule;
    }
  }
  return undefined;
}

/**
 * Check if an identity matches a rule
 */
function matchesIdentityRule(identity: OIDCIdentity, rule: TrustedIdentityRule): boolean {
  // Check issuer first if specified
  if (rule.issuer && identity.issuer !== rule.issuer) {
    return false;
  }

  // Match based on rule type
  switch (rule.type) {
    case "email":
      return matchesPattern(identity.email || "", rule.pattern);

    case "github-workflow":
      return matchesPattern(identity.workflowRepository || "", rule.pattern);

    case "gitlab-pipeline":
      // GitLab uses subject for pipeline identity
      return matchesPattern(identity.subject, rule.pattern);

    case "uri":
      return matchesPattern(identity.subject, rule.pattern);

    default:
      return false;
  }
}

/**
 * Match a value against a glob-like pattern
 * Supports * for any characters and ? for single character
 */
function matchesPattern(value: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape regex special chars
    .replace(/\*/g, ".*") // * matches any characters
    .replace(/\?/g, "."); // ? matches single character

  const regex = new RegExp(`^${regexPattern}$`, "i");
  return regex.test(value);
}

/**
 * Extract in-toto statement from a Sigstore bundle
 */
function extractAttestationFromBundle(bundle: SigstoreBundle): InTotoStatement | undefined {
  if (!bundle.dsseEnvelope?.payload) {
    return undefined;
  }

  try {
    const payloadJson = Buffer.from(bundle.dsseEnvelope.payload, "base64").toString("utf8");
    return JSON.parse(payloadJson) as InTotoStatement;
  } catch {
    return undefined;
  }
}

/**
 * Determine SLSA level from provenance attestation
 */
function determineSLSALevel(attestation: InTotoStatement): 0 | 1 | 2 | 3 | 4 {
  if (attestation.predicateType !== SLSA_PROVENANCE_TYPE) {
    return 0;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Predicate structure varies
  const predicate = attestation.predicate as any;

  // SLSA Level 1: Provenance exists
  if (!predicate?.buildDefinition || !predicate?.runDetails) {
    return 0;
  }

  let level: 0 | 1 | 2 | 3 | 4 = 1;

  // SLSA Level 2: Hosted build platform
  if (predicate.runDetails?.builder?.id) {
    level = 2;
  }

  // SLSA Level 3: Hardened builds (check for specific builder features)
  if (
    predicate.buildDefinition?.internalParameters &&
    predicate.buildDefinition?.resolvedDependencies
  ) {
    level = 3;
  }

  // SLSA Level 4: Would require additional verification of builder security
  // This is simplified - real implementation would check builder attestations

  return level;
}

// ============================================================================
// Policy Serialization
// ============================================================================

/**
 * Serialize a trust policy to JSON
 */
export function serializeTrustPolicy(policy: TrustPolicy): string {
  return JSON.stringify(policy, null, 2);
}

/**
 * Deserialize a trust policy from JSON
 */
export function deserializeTrustPolicy(json: string): TrustPolicy {
  const parsed = JSON.parse(json);

  // Validate required fields
  if (!parsed.name || typeof parsed.name !== "string") {
    throw new Error("Invalid trust policy: missing or invalid name");
  }

  if (!Array.isArray(parsed.trustedPublishers)) {
    throw new Error("Invalid trust policy: trustedPublishers must be an array");
  }

  if (!Array.isArray(parsed.trustedAuditors)) {
    throw new Error("Invalid trust policy: trustedAuditors must be an array");
  }

  return {
    ...DEFAULT_TRUST_POLICY,
    ...parsed,
  };
}
