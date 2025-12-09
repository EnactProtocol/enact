/**
 * Attestations Edge Function
 * Handles attestation submission, verification, and revocation
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyBundle } from "../_shared/sigstore.ts";
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
import {
  handleSubmitAttestation,
  extractAuditorFromBundle,
  detectProviderFromIssuer,
} from "../_shared/attestation.ts";

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
        await handleSubmitAttestation(supabase, req, toolName, version, verifyBundle)
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
