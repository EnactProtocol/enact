/**
 * Attestations Edge Function
 * Handles attestation submission, verification, and revocation
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyBundle } from "https://esm.sh/@enactprotocol/trust@0.1.0/dist/index.js";
import type { Database } from "../../../src/types.ts";
import {
  jsonResponse,
  createdResponse,
  noContentResponse,
  corsPreflightResponse,
  addCorsHeaders,
} from "../../../src/utils/response.ts";
import { Errors } from "../../../src/utils/errors.ts";
import { parsePaginationParams } from "../../../src/utils/validation.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");

    const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    });

    // Router
    // GET /tools/{name}/versions/{version}/attestations -> list attestations
    if (
      pathParts[0] === "tools" &&
      pathParts[pathParts.length - 1] === "attestations" &&
      req.method === "GET"
    ) {
      const version = pathParts[pathParts.length - 2];
      const toolName = pathParts.slice(1, pathParts.length - 3).join("/");
      return addCorsHeaders(await handleGetAttestations(supabase, toolName, version, url));
    }

    // POST /tools/{name}/versions/{version}/attestations -> submit attestation
    if (
      pathParts[0] === "tools" &&
      pathParts[pathParts.length - 1] === "attestations" &&
      req.method === "POST"
    ) {
      const version = pathParts[pathParts.length - 2];
      const toolName = pathParts.slice(1, pathParts.length - 3).join("/");
      return addCorsHeaders(
        await handleSubmitAttestation(supabase, req, toolName, version)
      );
    }

    // DELETE /tools/{name}/versions/{version}/attestations?auditor={email} -> revoke
    if (
      pathParts[0] === "tools" &&
      pathParts[pathParts.length - 1] === "attestations" &&
      req.method === "DELETE"
    ) {
      const version = pathParts[pathParts.length - 2];
      const toolName = pathParts.slice(1, pathParts.length - 3).join("/");
      const auditor = url.searchParams.get("auditor");

      if (!auditor) {
        return addCorsHeaders(Errors.validation("Missing auditor parameter"));
      }

      return addCorsHeaders(
        await handleRevokeAttestation(supabase, toolName, version, auditor)
      );
    }

    // GET /tools/{name}/versions/{version}/trust/attestations/{auditor} -> get bundle
    if (
      pathParts[0] === "tools" &&
      pathParts[pathParts.length - 3] === "trust" &&
      pathParts[pathParts.length - 2] === "attestations" &&
      req.method === "GET"
    ) {
      const auditor = decodeURIComponent(pathParts[pathParts.length - 1]);
      const version = pathParts[pathParts.length - 4];
      const toolName = pathParts.slice(1, pathParts.length - 5).join("/");
      return addCorsHeaders(
        await handleGetAttestationBundle(supabase, toolName, version, auditor)
      );
    }

    return addCorsHeaders(Errors.notFound("Endpoint not found"));
  } catch (error) {
    console.error("[Attestations] Error:", error);
    return addCorsHeaders(Errors.internal((error as Error).message));
  }
});

/**
 * Handle get attestations
 */
async function handleGetAttestations(
  supabase: any,
  toolName: string,
  version: string,
  url: URL
): Promise<Response> {
  const { limit, offset } = parsePaginationParams(url);

  // Get tool version
  const { data: toolVersion, error: versionError } = await supabase
    .from("tool_versions")
    .select(`
      id,
      tools!inner(name)
    `)
    .eq("tools.name", toolName)
    .eq("version", version)
    .single();

  if (versionError || !toolVersion) {
    return Errors.notFound(`Version not found: ${toolName}@${version}`);
  }

  // Get attestations with pagination
  const { data: attestations, error: attError, count } = await supabase
    .from("attestations")
    .select("*", { count: "exact" })
    .eq("tool_version_id", toolVersion.id)
    .eq("revoked", false)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (attError) {
    return Errors.internal(attError.message);
  }

  const results = (attestations ?? []).map((att: any) => ({
    auditor: att.auditor,
    auditor_provider: att.auditor_provider,
    signed_at: att.signed_at,
    rekor_log_id: att.rekor_log_id,
    rekor_log_index: att.rekor_log_index,
    verification: {
      verified: att.verified,
      verified_at: att.verified_at,
      rekor_verified: att.rekor_verified,
      certificate_verified: att.certificate_verified,
      signature_verified: att.signature_verified,
    },
  }));

  return jsonResponse({
    attestations: results,
    total: count ?? 0,
    limit,
    offset,
  });
}

/**
 * Handle submit attestation
 */
async function handleSubmitAttestation(
  supabase: any,
  req: Request,
  toolName: string,
  version: string
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
      hashWithoutPrefix.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
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

/**
 * Handle revoke attestation
 */
async function handleRevokeAttestation(
  supabase: any,
  toolName: string,
  version: string,
  auditorEmail: string
): Promise<Response> {
  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Errors.unauthorized();
  }

  // Verify the user is the auditor
  const userEmail = user.email;
  if (userEmail !== auditorEmail) {
    return Errors.forbidden("Only the auditor can revoke their attestation");
  }

  // Get tool version
  const { data: toolVersion, error: versionError } = await supabase
    .from("tool_versions")
    .select(`
      id,
      tools!inner(name)
    `)
    .eq("tools.name", toolName)
    .eq("version", version)
    .single();

  if (versionError || !toolVersion) {
    return Errors.notFound(`Version not found: ${toolName}@${version}`);
  }

  // Update attestation
  const { error: updateError } = await supabase
    .from("attestations")
    .update({
      revoked: true,
      revoked_at: new Date().toISOString(),
    })
    .eq("tool_version_id", toolVersion.id)
    .eq("auditor", auditorEmail)
    .eq("revoked", false);

  if (updateError) {
    return Errors.internal(updateError.message);
  }

  return jsonResponse({
    auditor: auditorEmail,
    revoked: true,
    revoked_at: new Date().toISOString(),
  });
}

/**
 * Handle get attestation bundle
 */
async function handleGetAttestationBundle(
  supabase: any,
  toolName: string,
  version: string,
  auditor: string
): Promise<Response> {
  // Get attestation with bundle
  const { data: attestation, error } = await supabase
    .from("attestations")
    .select(`
      bundle,
      tool_versions!inner(
        version,
        tools!inner(name)
      )
    `)
    .eq("tool_versions.tools.name", toolName)
    .eq("tool_versions.version", version)
    .eq("auditor", auditor)
    .eq("revoked", false)
    .single();

  if (error || !attestation) {
    return Errors.notFound(
      `Attestation not found for ${toolName}@${version} by ${auditor}`
    );
  }

  return jsonResponse(attestation.bundle);
}

/**
 * Extract auditor identity from Sigstore bundle
 */
function extractAuditorFromBundle(bundle: any): string | null {
  try {
    // The identity is in the certificate's SAN (Subject Alternative Name)
    const cert = bundle.verificationMaterial?.certificate?.rawBytes;
    if (!cert) {
      return null;
    }

    // For now, we'll look for the SAN extension in the certificate
    // In production, this would use proper certificate parsing
    // The SAN typically contains the email or URI

    // Try to get from Fulcio-specific extensions
    const extensions = bundle.verificationMaterial?.certificate?.extensions;
    if (extensions) {
      // Look for the Fulcio SAN extension
      for (const ext of extensions) {
        if (ext.critical === false && ext.value) {
          // This is a simplified extraction - in production use proper ASN.1 parsing
          return ext.value;
        }
      }
    }

    // Fallback: try to extract from messageSignature
    const signature = bundle.messageSignature?.messageDigest;
    if (signature?.algorithm === "SHA2_256") {
      // The identity might be in the signature metadata
      return null; // Will need proper implementation
    }

    return null;
  } catch (error) {
    console.error("[Attestations] Error extracting auditor:", error);
    return null;
  }
}

/**
 * Detect OAuth provider from issuer
 */
function detectProviderFromIssuer(bundle: any): string | null {
  try {
    const issuer = bundle.verificationMaterial?.certificate?.issuer;
    if (!issuer) {
      return null;
    }

    const issuerStr = issuer.toLowerCase();

    if (issuerStr.includes("github")) {
      return "github";
    }
    if (issuerStr.includes("google") || issuerStr.includes("accounts.google")) {
      return "google";
    }
    if (issuerStr.includes("microsoft") || issuerStr.includes("login.microsoftonline")) {
      return "microsoft";
    }
    if (issuerStr.includes("gitlab")) {
      return "gitlab";
    }

    return "unknown";
  } catch (error) {
    console.error("[Attestations] Error detecting provider:", error);
    return null;
  }
}
