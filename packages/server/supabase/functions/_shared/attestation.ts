/**
 * Shared attestation handling for edge functions
 */

import {
  createdResponse,
} from "../../../src/utils/response.ts";
import { Errors } from "../../../src/utils/errors.ts";

/**
 * Type for the verifyBundle function
 */
export type VerifyBundleFn = (bundle: any, artifactHash: Uint8Array) => Promise<{ verified: boolean }>;

/**
 * Extract auditor identity from Sigstore bundle
 * 
 * The identity is embedded in the X.509 certificate's Subject Alternative Name (SAN)
 * extension. For Fulcio-issued certificates, this contains the OIDC identity (email).
 */
export function extractAuditorFromBundle(bundle: any): string | null {
  try {
    // Get the base64-encoded certificate
    const certBase64 = bundle?.verificationMaterial?.certificate?.rawBytes;
    if (!certBase64) {
      console.error("[Attestations] No certificate found in bundle");
      return null;
    }

    // Decode base64 to binary
    const rawBytes = atob(certBase64);
    
    // Look for email pattern in the certificate
    // The SAN extension contains the email in DER-encoded format
    const emailMatch = rawBytes.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      return emailMatch[0];
    }

    // If no email found, try to find GitHub username pattern
    // GitHub OAuth certificates include the username
    const githubMatch = rawBytes.match(/github\.com[\/\\]([a-zA-Z0-9_-]+)/i);
    if (githubMatch) {
      return `${githubMatch[1]}@github.com`;
    }

    console.error("[Attestations] Could not find identity in certificate");
    return null;
  } catch (error) {
    console.error("[Attestations] Error extracting auditor:", error);
    return null;
  }
}

/**
 * Detect OAuth provider from issuer by examining the certificate
 */
export function detectProviderFromIssuer(bundle: any): string | null {
  try {
    // Get the base64-encoded certificate
    const certBase64 = bundle?.verificationMaterial?.certificate?.rawBytes;
    if (!certBase64) {
      return "unknown";
    }

    // Decode base64 to binary string
    const rawBytes = atob(certBase64);

    // Look for common OIDC issuer patterns in the certificate
    if (rawBytes.includes("github.com") || rawBytes.includes("githubusercontent.com")) {
      return "github";
    }
    if (rawBytes.includes("accounts.google.com") || rawBytes.includes("google.com")) {
      return "google";
    }
    if (rawBytes.includes("microsoftonline.com") || rawBytes.includes("microsoft.com")) {
      return "microsoft";
    }
    if (rawBytes.includes("gitlab.com")) {
      return "gitlab";
    }

    return "unknown";
  } catch (error) {
    console.error("[Attestations] Error detecting provider:", error);
    return "unknown";
  }
}

/**
 * Handle submit attestation
 */
export async function handleSubmitAttestation(
  supabase: any,
  req: Request,
  toolName: string,
  version: string,
  verifyBundle: VerifyBundleFn
): Promise<Response> {
  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Errors.unauthorized();
  }

  // Parse request body
  const body = await req.json();
  const { bundle } = body;

  if (!bundle) {
    return Errors.validation("Missing Sigstore bundle");
  }

  // Get tool version
  const { data: toolVersion, error: versionError } = await supabase
    .from("tool_versions")
    .select(`
      id,
      bundle_hash,
      tools!inner(name)
    `)
    .eq("tools.name", toolName)
    .eq("version", version)
    .single();

  if (versionError || !toolVersion) {
    return Errors.notFound(`Version not found: ${toolName}@${version}`);
  }

  // Verify the Sigstore bundle
  let verificationResult;
  try {
    // Convert bundle hash to Buffer (remove "sha256:" prefix)
    const hashWithoutPrefix = toolVersion.bundle_hash.replace("sha256:", "");
    const artifactHash = new Uint8Array(
      hashWithoutPrefix.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16))
    );

    // Verify using @enactprotocol/trust
    verificationResult = await verifyBundle(bundle, artifactHash);

    if (!verificationResult.verified) {
      return Errors.attestationFailed("Sigstore verification failed", {
        details: verificationResult,
      });
    }
  } catch (error) {
    console.error("[Attestations] Verification error:", error);
    return Errors.attestationFailed(
      `Verification failed: ${(error as Error).message}`
    );
  }

  // Extract auditor identity from bundle
  // The identity is in the certificate's subject alternative name
  const auditor = extractAuditorFromBundle(bundle);
  const auditorProvider = detectProviderFromIssuer(bundle);

  if (!auditor) {
    return Errors.validation("Could not extract auditor identity from bundle");
  }

  // Extract Rekor info
  const rekorLogId = bundle.verificationMaterial?.tlogEntries?.[0]?.logId?.keyId;
  const rekorLogIndex = bundle.verificationMaterial?.tlogEntries?.[0]?.logIndex;

  if (!rekorLogId) {
    return Errors.validation("Missing Rekor log ID in bundle");
  }

  // Check if attestation already exists
  const { data: existing } = await supabase
    .from("attestations")
    .select("id")
    .eq("tool_version_id", toolVersion.id)
    .eq("auditor", auditor)
    .single();

  if (existing) {
    return Errors.conflict(`Attestation already exists for auditor ${auditor}`);
  }

  // Store attestation
  const { data: attestation, error: insertError } = await supabase
    .from("attestations")
    .insert({
      tool_version_id: toolVersion.id,
      auditor,
      auditor_provider: auditorProvider,
      bundle,
      rekor_log_id: rekorLogId,
      rekor_log_index: rekorLogIndex,
      signed_at: new Date().toISOString(),
      verified: verificationResult.verified,
      rekor_verified: true,
      certificate_verified: true,
      signature_verified: true,
      verified_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    console.error("[Attestations] Insert error:", insertError);
    return Errors.internal(insertError.message);
  }

  if (!attestation) {
    console.error("[Attestations] Insert succeeded but no data returned");
    return Errors.internal("Failed to retrieve attestation after insert");
  }

  return createdResponse({
    auditor: attestation.auditor,
    auditor_provider: attestation.auditor_provider,
    signed_at: attestation.signed_at,
    rekor_log_id: attestation.rekor_log_id,
    rekor_log_index: attestation.rekor_log_index,
    verification: {
      verified: attestation.verified,
      verified_at: attestation.verified_at,
      rekor_verified: attestation.rekor_verified,
      certificate_verified: attestation.certificate_verified,
      signature_verified: attestation.signature_verified,
    },
  });
}
