/**
 * OIDC-based keyless signing using Sigstore
 *
 * This module provides keyless signing capabilities using OIDC identity tokens.
 * It integrates with Fulcio for certificate issuance and Rekor for transparency logging.
 *
 * For CI environments (GitHub Actions, GitLab CI, etc.), the sigstore library's
 * native OIDC support is used. For interactive local signing, we use a native
 * OAuth implementation that opens a browser for authentication.
 */

import { type SignOptions, attest, sign } from "@enactprotocol/sigstore";
import { attestWithCosign, isCosignAvailable, signWithCosign } from "./cosign";
import { OAuthIdentityProvider } from "./oauth";
import type {
  SigningOptions as EnactSigningOptions,
  FulcioCertificate,
  OIDCIdentity,
  OIDCProvider,
  SigningResult,
  SigstoreBundle,
} from "./types";

// Re-export SignOptions for external use
export type { SignOptions };

// ============================================================================
// Constants
// ============================================================================

/** Public Sigstore Fulcio URL */
export const FULCIO_PUBLIC_URL = "https://fulcio.sigstore.dev";

/** Public Sigstore Rekor URL */
export const REKOR_PUBLIC_URL = "https://rekor.sigstore.dev";

/** Public Sigstore TSA URL */
export const TSA_PUBLIC_URL = "https://timestamp.sigstore.dev";

/** OIDC issuer URLs for known providers */
export const OIDC_ISSUERS: Record<OIDCProvider, string> = {
  github: "https://token.actions.githubusercontent.com",
  google: "https://accounts.google.com",
  microsoft: "https://login.microsoftonline.com",
  gitlab: "https://gitlab.com",
  custom: "",
};

// ============================================================================
// OIDC Identity Extraction
// ============================================================================

/**
 * Decode a JWT token without verification (for extracting claims)
 */
function decodeJWT(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const payloadPart = parts[1];
  if (!payloadPart) {
    throw new Error("Invalid JWT: missing payload");
  }

  try {
    // Use standard base64 decoding with URL-safe character replacement
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(payload);
  } catch {
    throw new Error("Failed to decode JWT payload");
  }
}

/**
 * Detect OIDC provider from issuer URL
 */
export function detectOIDCProvider(issuer: string): OIDCProvider {
  for (const [provider, url] of Object.entries(OIDC_ISSUERS)) {
    if (url && issuer.startsWith(url)) {
      return provider as OIDCProvider;
    }
  }
  return "custom";
}

/**
 * Extract identity information from an OIDC token
 *
 * @param token - The OIDC identity token
 * @returns Extracted identity information
 */
export function extractOIDCIdentity(token: string): OIDCIdentity {
  const claims = decodeJWT(token);

  const issuer = claims.iss as string;
  const provider = detectOIDCProvider(issuer);

  const identity: OIDCIdentity = {
    provider,
    subject: claims.sub as string,
    issuer,
    claims,
  };

  // Extract email if present
  if (claims.email) {
    identity.email = claims.email as string;
  }

  // Extract GitHub-specific claims
  if (provider === "github") {
    if (claims.repository) {
      identity.workflowRepository = claims.repository as string;
    }
    if (claims.ref) {
      identity.workflowRef = claims.ref as string;
    }
    if (claims.event_name) {
      identity.workflowTrigger = claims.event_name as string;
    }
  }

  return identity;
}

/**
 * Get OIDC token from environment (for CI/CD environments)
 *
 * @param provider - The OIDC provider
 * @returns The OIDC token if available
 */
export function getOIDCTokenFromEnvironment(provider: OIDCProvider): string | undefined {
  switch (provider) {
    case "github":
      // GitHub Actions provides OIDC tokens via ACTIONS_ID_TOKEN_REQUEST_URL
      return process.env.ACTIONS_ID_TOKEN;
    case "gitlab":
      return process.env.CI_JOB_JWT_V2 || process.env.CI_JOB_JWT;
    default:
      return undefined;
  }
}

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * Check if we're running in a CI environment with native OIDC support
 */
function isInCIEnvironment(): boolean {
  // GitHub Actions
  if (process.env.GITHUB_ACTIONS && process.env.ACTIONS_ID_TOKEN_REQUEST_URL) {
    return true;
  }
  // GitLab CI
  if (process.env.GITLAB_CI && (process.env.CI_JOB_JWT_V2 || process.env.CI_JOB_JWT)) {
    return true;
  }
  // Generic CI detection with token
  if (process.env.CI && process.env.SIGSTORE_ID_TOKEN) {
    return true;
  }
  return false;
}

/**
 * Check if we're in an interactive terminal environment
 */
function isInteractiveEnvironment(): boolean {
  return process.stdout.isTTY === true;
}

// ============================================================================
// Signing Functions
// ============================================================================

/**
 * Sign an artifact using keyless (OIDC) signing
 *
 * In CI environments with native OIDC support (GitHub Actions, GitLab CI),
 * uses the sigstore library directly. For interactive local signing,
 * uses native OAuth implementation that opens browser for authentication.
 *
 * @param artifact - The artifact to sign (as a Buffer)
 * @param options - Signing options
 * @returns The signing result including the Sigstore bundle
 *
 * @example
 * ```ts
 * const artifact = Buffer.from(JSON.stringify(manifest));
 * const result = await signArtifact(artifact, {
 *   oidc: { provider: "github" }
 * });
 * console.log(result.bundle);
 * ```
 */
export async function signArtifact(
  artifact: Buffer,
  options: EnactSigningOptions = {}
): Promise<SigningResult> {
  const { fulcioURL, rekorURL, timeout = 30000 } = options;

  // Create sigstore sign options
  const signOptions: SignOptions = {
    fulcioURL: fulcioURL || FULCIO_PUBLIC_URL,
    rekorURL: rekorURL || REKOR_PUBLIC_URL,
    timeout,
  };

  // If we have an explicit OIDC token, use it directly
  if (options.oidc?.token) {
    signOptions.identityToken = options.oidc.token;
  }
  // If we're in a CI environment, sigstore library will handle OIDC
  else if (isInCIEnvironment()) {
    // No additional config needed - sigstore will use CI provider
  }
  // Interactive environment - try native OAuth first, fall back to cosign
  else if (isInteractiveEnvironment()) {
    // Try native OAuth with sigstore-js first
    try {
      const provider = new OAuthIdentityProvider();
      signOptions.identityProvider = provider;

      const bundle = await sign(artifact, signOptions);
      const sigstoreBundle = bundle as unknown as SigstoreBundle;
      const certificate = extractCertificateFromBundle(sigstoreBundle);

      const result: SigningResult = {
        bundle: sigstoreBundle,
        timestamp: new Date(),
      };

      if (certificate) {
        result.certificate = certificate;
      }

      return result;
    } catch (nativeError) {
      // Log the actual error for debugging
      const errorMessage = nativeError instanceof Error ? nativeError.message : String(nativeError);
      const errorStack = nativeError instanceof Error ? nativeError.stack : undefined;

      // Log to stderr for debugging (only if ENACT_DEBUG is set)
      if (process.env.ENACT_DEBUG) {
        console.error("[sigstore-js error]", errorMessage);
        if (errorStack) {
          console.error("[sigstore-js stack]", errorStack);
        }
      }

      // Check if this is a BoringSSL/crypto compatibility issue
      const isCryptoError =
        errorMessage.includes("NO_DEFAULT_DIGEST") || errorMessage.includes("public key routines");

      if (isCryptoError && isCosignAvailable()) {
        // Fall back to cosign CLI
        const result = await signWithCosign(artifact, {
          timeout,
          verbose: false,
        });

        return {
          bundle: result.bundle,
          timestamp: new Date(),
        };
      }

      // If cosign is not available and we hit a crypto error, give helpful message
      if (isCryptoError) {
        throw new Error(
          "Signing failed due to a crypto compatibility issue with Bun's BoringSSL.\n" +
            "Install cosign CLI for local signing: brew install cosign\n" +
            "Or run with Node.js instead of Bun.\n" +
            "See: https://docs.sigstore.dev/cosign/system_config/installation/"
        );
      }

      // Re-throw other errors
      throw nativeError;
    }
  }
  // Non-interactive, non-CI - error
  else {
    throw new Error(
      "No OIDC token available and not in an interactive environment.\n" +
        "Provide an OIDC token via options.oidc.token or run in a CI environment with OIDC support."
    );
  }

  const bundle = await sign(artifact, signOptions);

  // Parse the result
  const sigstoreBundle = bundle as unknown as SigstoreBundle;
  const certificate = extractCertificateFromBundle(sigstoreBundle);

  const result: SigningResult = {
    bundle: sigstoreBundle,
    timestamp: new Date(),
  };

  if (certificate) {
    result.certificate = certificate;
  }

  return result;
}

/**
 * Sign an in-toto attestation using keyless signing
 *
 * In CI environments with native OIDC support, uses the sigstore library.
 * For interactive local signing, uses native OAuth with browser authentication.
 *
 * @param attestation - The attestation to sign (in-toto statement)
 * @param options - Signing options
 * @returns The signing result including the Sigstore bundle
 *
 * @example
 * ```ts
 * const statement = {
 *   _type: "https://in-toto.io/Statement/v1",
 *   subject: [{ name: "tool.yaml", digest: { sha256: "abc123..." } }],
 *   predicateType: "https://slsa.dev/provenance/v1",
 *   predicate: { ... }
 * };
 * const result = await signAttestation(statement, { oidc: { provider: "github" } });
 * ```
 */
export async function signAttestation(
  attestation: Record<string, unknown>,
  options: EnactSigningOptions = {}
): Promise<SigningResult> {
  const { fulcioURL, rekorURL, timeout = 30000 } = options;

  // Serialize attestation
  const payload = Buffer.from(JSON.stringify(attestation));

  // Create sigstore attest options
  const attestOptions: SignOptions = {
    fulcioURL: fulcioURL || FULCIO_PUBLIC_URL,
    rekorURL: rekorURL || REKOR_PUBLIC_URL,
    timeout,
  };

  // If we have an explicit OIDC token, use it directly
  if (options.oidc?.token) {
    attestOptions.identityToken = options.oidc.token;
  }
  // If we're in a CI environment, sigstore library will handle OIDC
  else if (isInCIEnvironment()) {
    // No additional config needed - sigstore will use CI provider
  }
  // Interactive environment - try native OAuth first, fall back to cosign
  else if (isInteractiveEnvironment()) {
    // Try native OAuth with sigstore-js first
    try {
      const provider = new OAuthIdentityProvider();
      attestOptions.identityProvider = provider;

      const bundle = await attest(payload, "application/vnd.in-toto+json", attestOptions);
      const sigstoreBundle = bundle as unknown as SigstoreBundle;
      const certificate = extractCertificateFromBundle(sigstoreBundle);

      const result: SigningResult = {
        bundle: sigstoreBundle,
        timestamp: new Date(),
      };

      if (certificate) {
        result.certificate = certificate;
      }

      return result;
    } catch (nativeError) {
      // Log the actual error for debugging
      const errorMessage = nativeError instanceof Error ? nativeError.message : String(nativeError);
      const errorStack = nativeError instanceof Error ? nativeError.stack : undefined;

      // Log to stderr for debugging (only if ENACT_DEBUG is set)
      if (process.env.ENACT_DEBUG) {
        console.error("[sigstore-js error]", errorMessage);
        if (errorStack) {
          console.error("[sigstore-js stack]", errorStack);
        }
      }

      // Check if this is a BoringSSL/crypto compatibility issue
      const isCryptoError =
        errorMessage.includes("NO_DEFAULT_DIGEST") || errorMessage.includes("public key routines");

      if (isCryptoError && isCosignAvailable()) {
        // Fall back to cosign CLI
        const result = await attestWithCosign(attestation, {
          timeout,
          verbose: false,
        });

        return {
          bundle: result.bundle,
          timestamp: new Date(),
        };
      }

      // If cosign is not available and we hit a crypto error, give helpful message
      if (isCryptoError) {
        throw new Error(
          "Signing failed due to a crypto compatibility issue with Bun's BoringSSL.\n" +
            "Install cosign CLI for local signing: brew install cosign\n" +
            "Or run with Node.js instead of Bun.\n" +
            "See: https://docs.sigstore.dev/cosign/system_config/installation/"
        );
      }

      // Re-throw other errors
      throw nativeError;
    }
  }
  // Non-interactive, non-CI - error
  else {
    throw new Error(
      "No OIDC token available and not in an interactive environment.\n" +
        "Provide an OIDC token via options.oidc.token or run in a CI environment with OIDC support."
    );
  }

  const bundle = await attest(payload, "application/vnd.in-toto+json", attestOptions);

  // Parse the result
  const sigstoreBundle = bundle as unknown as SigstoreBundle;
  const certificate = extractCertificateFromBundle(sigstoreBundle);

  const result: SigningResult = {
    bundle: sigstoreBundle,
    timestamp: new Date(),
  };

  if (certificate) {
    result.certificate = certificate;
  }

  return result;
}

// ============================================================================
// Certificate Extraction
// ============================================================================

/**
 * Extract the signer email from a certificate's raw bytes
 * Uses simple regex matching on the DER-encoded certificate
 */
function extractEmailFromCertificate(rawBytes: Buffer): string | undefined {
  try {
    const certStr = rawBytes.toString("latin1");
    // Look for email pattern in the SAN extension
    const emailMatch = certStr.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/);
    return emailMatch?.[0];
  } catch {
    return undefined;
  }
}

/**
 * Extract GitHub username from certificate extensions
 * GitHub OAuth includes the username in the certificate
 */
function extractGitHubUsernameFromCertificate(rawBytes: Buffer): string | undefined {
  try {
    const certStr = rawBytes.toString("latin1");
    // GitHub username is stored in a custom extension
    // Look for pattern like "login" followed by the username
    // The OID 1.3.6.1.4.1.57264.1.8 contains GitHub username
    // For now, try to find it via common patterns

    // Try to find GitHub user ID pattern (numeric)
    // biome-ignore lint/suspicious/noControlCharactersInRegex: We need to match control chars in cert strings
    const userIdMatch = certStr.match(/github\.com[^\x00-\x1f]*?(\d{5,10})/i);
    if (userIdMatch) {
      // We found a user ID but need the username
      // This would require an API call, which we handle elsewhere
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract the OIDC issuer from a certificate's raw bytes
 * Looks for common issuer URLs in the certificate extensions
 */
function extractIssuerFromCertificate(rawBytes: Buffer): string | undefined {
  try {
    const certStr = rawBytes.toString("latin1");
    // Look for common OIDC issuer patterns
    const issuerPatterns = [
      /https:\/\/accounts\.google\.com/,
      /https:\/\/github\.com\/login\/oauth/,
      /https:\/\/token\.actions\.githubusercontent\.com/,
      /https:\/\/gitlab\.com/,
      /https:\/\/login\.microsoftonline\.com\/[\w-]+\/v2\.0/,
    ];

    for (const pattern of issuerPatterns) {
      const match = certStr.match(pattern);
      if (match) {
        return match[0];
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract certificate information from a Sigstore bundle
 */
export function extractCertificateFromBundle(
  bundle: SigstoreBundle
): FulcioCertificate | undefined {
  if (!bundle.verificationMaterial?.certificate?.rawBytes) {
    return undefined;
  }

  const rawBytes = Buffer.from(bundle.verificationMaterial.certificate.rawBytes, "base64");

  // Extract email and issuer from certificate
  const email = extractEmailFromCertificate(rawBytes);
  const issuer = extractIssuerFromCertificate(rawBytes);

  // Try to extract GitHub username (if GitHub OAuth)
  const username = extractGitHubUsernameFromCertificate(rawBytes);

  // Parse certificate (simplified - in production would use a proper X.509 parser)
  const pem = `-----BEGIN CERTIFICATE-----\n${rawBytes
    .toString("base64")
    .match(/.{1,64}/g)
    ?.join("\n")}\n-----END CERTIFICATE-----`;

  // Build identity object, only including email if present
  const identity: OIDCIdentity = {
    provider: issuer?.includes("google")
      ? "google"
      : issuer?.includes("github")
        ? "github"
        : issuer?.includes("gitlab")
          ? "gitlab"
          : issuer?.includes("microsoft")
            ? "microsoft"
            : "custom",
    subject: email || "unknown",
    issuer: issuer || "https://fulcio.sigstore.dev",
  };
  if (email) {
    identity.email = email;
  }
  if (username) {
    identity.username = username;
  }

  return {
    certificateChain: [pem],
    serialNumber: "unknown", // Would need X.509 parsing
    notBefore: new Date(),
    notAfter: new Date(Date.now() + 10 * 60 * 1000), // Fulcio certs are valid for 10 minutes
    subject: email || "unknown",
    issuer: "sigstore",
    identity,
    raw: rawBytes,
  };
}

/**
 * Extract identity from a signing certificate in a bundle
 *
 * @param bundle - The Sigstore bundle
 * @returns The OIDC identity if it can be extracted
 */
export function extractIdentityFromBundle(bundle: SigstoreBundle): OIDCIdentity | undefined {
  // Parse the X.509 certificate and extract identity from SAN extension
  const certificate = extractCertificateFromBundle(bundle);
  return certificate?.identity;
}
