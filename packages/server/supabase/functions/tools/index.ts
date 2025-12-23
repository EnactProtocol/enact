/**
 * Tools Edge Function
 * Handles tool CRUD, versioning, downloads, and yank operations
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyBundle } from "../_shared/sigstore.ts";
import type {
  Database,
  Tool,
  ToolVersion,
} from "../../../src/types.ts";
import {
  jsonResponse,
  successResponse,
  createdResponse,
  noContentResponse,
  corsPreflightResponse,
  addCorsHeaders,
} from "../../../src/utils/response.ts";
import {
  Errors,
  ErrorCodes,
} from "../../../src/utils/errors.ts";
import {
  extractNamespace,
  extractShortName,
  isValidToolName,
  isValidVersion,
  parsePaginationParams,
} from "../../../src/utils/validation.ts";
import {
  createStorageClient,
  uploadBundle,
  downloadBundle,
  getBundleKey,
} from "../_shared/storage.ts";
import {
  generateEmbedding,
  createToolEmbeddingText,
  toVectorString,
} from "../_shared/embeddings.ts";
import {
  listTarGzFiles,
  getFileFromTarGz,
} from "../_shared/tar.ts";
import {
  handleSubmitAttestation,
  extractAuditorFromBundle,
  detectProviderFromIssuer,
} from "../_shared/attestation.ts";
import {
  verifyManifestAgainstBundle,
  validateManifest,
  type ChecksumManifest,
} from "../_shared/checksum-manifest.ts";

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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");
    const isDev = Deno.env.get("ENACT_DEV_MODE") === "true";

    // In dev mode, use service role key to bypass RLS for write operations
    const useServiceRole = isDev && supabaseServiceKey;
    const supabaseKey = useServiceRole ? supabaseServiceKey : supabaseAnonKey;

    // Create Supabase client with auth header passed through
    // This allows RLS policies using auth.uid() to work for authenticated users
    const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
      global: {
        headers: useServiceRole ? {} : (authHeader ? { Authorization: authHeader } : {}),
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    // Router
    // GET /tools/search -> search
    if (pathParts[0] === "tools" && pathParts[1] === "search" && req.method === "GET") {
      return addCorsHeaders(await handleSearch(supabase, url));
    }

    // GET /tools/{name}/versions/{version}/download -> download bundle (must be before versions route)
    if (pathParts[pathParts.length - 1] === "download" && req.method === "GET") {
      const version = pathParts[pathParts.length - 2];
      const toolName = pathParts.slice(1, pathParts.length - 3).join("/");
      return addCorsHeaders(await handleDownload(supabase, toolName, version, url));
    }

    // GET /tools/{name}/versions/{version}/files/{path...} -> get file content
    // Must be before /files route
    if (pathParts.includes("files") && pathParts.indexOf("files") < pathParts.length - 1 && req.method === "GET") {
      const filesIndex = pathParts.indexOf("files");
      const version = pathParts[filesIndex - 1];
      const toolName = pathParts.slice(1, filesIndex - 2).join("/");
      const filePath = pathParts.slice(filesIndex + 1).join("/");
      return addCorsHeaders(await handleGetFileContent(supabase, toolName, version, decodeURIComponent(filePath)));
    }

    // GET /tools/{name}/versions/{version}/files -> list files in bundle
    if (pathParts[pathParts.length - 1] === "files" && req.method === "GET") {
      const version = pathParts[pathParts.length - 2];
      const toolName = pathParts.slice(1, pathParts.length - 3).join("/");
      return addCorsHeaders(await handleListFiles(supabase, toolName, version));
    }

    // POST /tools/{name}/versions/{version}/yank -> yank version
    if (pathParts[pathParts.length - 1] === "yank" && req.method === "POST") {
      const version = pathParts[pathParts.length - 2];
      const toolName = pathParts.slice(1, pathParts.length - 3).join("/");
      return addCorsHeaders(await handleYank(supabase, req, toolName, version));
    }

    // POST /tools/{name}/versions/{version}/unyank -> unyank version
    if (pathParts[pathParts.length - 1] === "unyank" && req.method === "POST") {
      const version = pathParts[pathParts.length - 2];
      const toolName = pathParts.slice(1, pathParts.length - 3).join("/");
      return addCorsHeaders(await handleUnyank(supabase, toolName, version));
    }

    // GET /tools/{name}/versions/{version}/attestations -> get attestations
    if (pathParts[pathParts.length - 1] === "attestations" && req.method === "GET") {
      const version = pathParts[pathParts.length - 2];
      const toolName = pathParts.slice(1, pathParts.length - 3).join("/");
      return addCorsHeaders(await handleGetAttestations(supabase, toolName, version, url));
    }

    // POST /tools/{name}/versions/{version}/attestations -> submit attestation
    if (pathParts[pathParts.length - 1] === "attestations" && req.method === "POST") {
      const version = pathParts[pathParts.length - 2];
      const toolName = pathParts.slice(1, pathParts.length - 3).join("/");
      return addCorsHeaders(await handleSubmitAttestation(supabase, req, toolName, version, verifyBundle));
    }

    // GET /tools/{name}/versions/{version}/trust/attestations/{auditor} -> get Sigstore bundle
    if (
      pathParts.includes("trust") &&
      pathParts[pathParts.indexOf("trust") + 1] === "attestations" &&
      pathParts.length > pathParts.indexOf("trust") + 2 &&
      req.method === "GET"
    ) {
      const trustIndex = pathParts.indexOf("trust");
      const auditor = decodeURIComponent(pathParts[trustIndex + 2]);
      const version = pathParts[trustIndex - 1];
      const toolName = pathParts.slice(1, trustIndex - 2).join("/");
      return addCorsHeaders(await handleGetAttestationBundle(supabase, toolName, version, auditor));
    }

    // GET /tools/{name}/versions/{version} -> get version info (must be before generic GET /tools/{name})
    if (pathParts[0] === "tools" && pathParts[pathParts.length - 2] === "versions" && req.method === "GET") {
      const version = pathParts[pathParts.length - 1];
      const toolName = pathParts.slice(1, pathParts.length - 2).join("/");
      return addCorsHeaders(await handleGetVersion(supabase, toolName, version));
    }

    // PATCH /tools/{name}/visibility -> change tool visibility
    if (pathParts[pathParts.length - 1] === "visibility" && req.method === "PATCH") {
      const toolName = pathParts.slice(1, pathParts.length - 1).join("/");
      return addCorsHeaders(await handleChangeVisibility(supabase, req, toolName));
    }

    // GET /tools/users/{username} -> get user profile (BEFORE generic GET /tools/{name})
    if (pathParts[0] === "tools" && pathParts[1] === "users" && pathParts.length === 3 && req.method === "GET") {
      const username = pathParts[2];
      return addCorsHeaders(await handleGetUserProfile(supabase, username));
    }

    // GET /tools/users/{username}/tools -> get user's tools (BEFORE generic GET /tools/{name})
    if (pathParts[0] === "tools" && pathParts[1] === "users" && pathParts.length === 4 && pathParts[3] === "tools" && req.method === "GET") {
      const username = pathParts[2];
      return addCorsHeaders(await handleGetUserTools(supabase, username, url));
    }

    // POST /tools/{name} -> publish tool
    if (pathParts[0] === "tools" && pathParts.length >= 2 && req.method === "POST") {
      const toolName = pathParts.slice(1).join("/");
      return addCorsHeaders(await handlePublish(supabase, req, toolName));
    }

    // GET /tools/{name} -> get tool metadata (generic catch-all for GET)
    if (pathParts[0] === "tools" && pathParts.length >= 2 && req.method === "GET") {
      const toolName = pathParts.slice(1).join("/");
      return addCorsHeaders(await handleGetTool(supabase, toolName, url));
    }

    // DELETE /tools/{name} -> delete tool
    if (pathParts[0] === "tools" && pathParts.length >= 2 && req.method === "DELETE") {
      const toolName = pathParts.slice(1).join("/");
      return addCorsHeaders(await handleDeleteTool(supabase, toolName));
    }

    return addCorsHeaders(Errors.notFound("Endpoint not found"));
  } catch (error) {
    console.error("[Tools] Error:", error);
    return addCorsHeaders(Errors.internal((error as Error).message));
  }
});

/**
 * Handle search - uses hybrid search (text + semantic) when embeddings available
 */
async function handleSearch(supabase: any, url: URL): Promise<Response> {
  const query = url.searchParams.get("q") ?? "";
  const { limit, offset } = parsePaginationParams(url);
  const useSemanticSearch = url.searchParams.get("semantic") !== "false";

  // Parse threshold parameter (default: 0.1, range: 0.0-1.0)
  const thresholdParam = url.searchParams.get("threshold");
  const threshold = thresholdParam
    ? Math.max(0, Math.min(1, Number.parseFloat(thresholdParam)))
    : 0.1;

  // Try semantic search if query is provided and OpenAI is configured
  if (query && useSemanticSearch && Deno.env.get("OPENAI_API_KEY")) {
    try {
      // Generate embedding for the search query
      const queryEmbedding = await generateEmbedding(query);
      const embeddingStr = toVectorString(queryEmbedding);

      // Use the hybrid search function for best results
      const { data: semanticResults, error: semanticError } = await supabase
        .rpc("search_tools_hybrid", {
          query_text: query,
          query_embedding: embeddingStr,
          text_weight: 0.3,
          semantic_weight: 0.7,
          match_count: limit + offset,
          match_threshold: threshold,
        });

      if (semanticError) {
        console.warn(`[Search] Semantic search RPC error: ${semanticError.message}`);
      }

      if (!semanticError && semanticResults && semanticResults.length > 0) {
        // Paginate results
        const paginatedResults = semanticResults.slice(offset, offset + limit);

        // Fetch version info for each tool
        const toolIds = paginatedResults.map((t: any) => t.id);
        const { data: versions } = await supabase
          .from("tool_versions")
          .select("tool_id, version, yanked")
          .in("tool_id", toolIds);

        // Group versions by tool and find highest non-yanked version
        const versionMap = new Map<string, string>();
        const toolVersions = new Map<string, Array<{ version: string; yanked: boolean }>>();
        for (const v of versions ?? []) {
          if (!toolVersions.has(v.tool_id)) {
            toolVersions.set(v.tool_id, []);
          }
          toolVersions.get(v.tool_id)!.push({ version: v.version, yanked: v.yanked });
        }
        // Sort each tool's versions by semver and pick highest non-yanked
        for (const [toolId, vers] of toolVersions) {
          vers.sort((a, b) => {
            const [aMaj = 0, aMin = 0, aPat = 0] = a.version.split('.').map(Number);
            const [bMaj = 0, bMin = 0, bPat = 0] = b.version.split('.').map(Number);
            if (bMaj !== aMaj) return bMaj - aMaj;
            if (bMin !== aMin) return bMin - aMin;
            return bPat - aPat;
          });
          const latest = vers.find(v => !v.yanked) ?? vers[0];
          if (latest) versionMap.set(toolId, latest.version);
        }

        const results = paginatedResults.map((tool: any) => ({
          name: tool.name,
          description: tool.description,
          tags: tool.tags ?? [],
          version: versionMap.get(tool.id) ?? "0.0.0",
          author: {
            username: extractNamespace(tool.name),
            avatar_url: null,
          },
          downloads: tool.total_downloads,
          score: tool.combined_score,
        }));

        console.log(`[Search] Semantic search found ${semanticResults.length} results for "${query}"`);

        return jsonResponse({
          tools: results,
          total: semanticResults.length,
          limit,
          offset,
          search_type: "hybrid",
        });
      } else if (!semanticError) {
        console.log(`[Search] Semantic search returned 0 results for "${query}" (tools may not have embeddings)`);
      }
    } catch (embeddingError) {
      console.warn(`[Search] Semantic search failed, falling back to text: ${embeddingError}`);
    }
  }

  // Fallback to text-based search (ILIKE)
  // Only search public tools - private and unlisted tools are not searchable
  const { data: tools, error, count } = await supabase
    .from("tools")
    .select("*, tool_versions!inner(*)", { count: "exact" })
    .eq("visibility", "public")
    .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
    .order("total_downloads", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return Errors.internal(error.message);
  }

  const results = (tools ?? []).map((tool: any) => {
    // Sort versions by semver descending and find highest non-yanked
    const sortedVersions = [...(tool.tool_versions ?? [])].sort((a: any, b: any) => {
      const [aMaj = 0, aMin = 0, aPat = 0] = a.version.split('.').map(Number);
      const [bMaj = 0, bMin = 0, bPat = 0] = b.version.split('.').map(Number);
      if (bMaj !== aMaj) return bMaj - aMaj;
      if (bMin !== aMin) return bMin - aMin;
      return bPat - aPat;
    });
    const latestVersion = sortedVersions.find((v: any) => !v.yanked)?.version
      ?? sortedVersions[0]?.version
      ?? "0.0.0";

    return {
      name: tool.name,
      description: tool.description,
      tags: tool.tags ?? [],
      version: latestVersion,
      author: {
        username: extractNamespace(tool.name),
        avatar_url: null,
      },
      downloads: tool.total_downloads,
    };
  });

  return jsonResponse({
    tools: results,
    total: count ?? 0,
    limit,
    offset,
    search_type: "text",
  });
}

/**
 * Handle publish
 */
async function handlePublish(
  supabase: any,
  req: Request,
  toolName: string
): Promise<Response> {
  // Validate tool name
  if (!isValidToolName(toolName)) {
    return Errors.validation("Invalid tool name format");
  }

  // Parse multipart form data
  const formData = await req.formData();
  const manifestStr = formData.get("manifest") as string;
  const bundleFile = formData.get("bundle") as File;
  const rawManifest = formData.get("raw_manifest") as string | null;
  const visibility = formData.get("visibility") as string | null;
  
  // Optional pre-signed attestation fields
  const checksumManifestStr = formData.get("checksum_manifest") as string | null;
  const sigstoreBundleStr = formData.get("sigstore_bundle") as string | null;

  if (!manifestStr || !bundleFile) {
    return Errors.validation("Missing manifest or bundle");
  }

  // Validate visibility value
  const validVisibilities = ["public", "private", "unlisted"];
  const toolVisibility = visibility && validVisibilities.includes(visibility) ? visibility : "public";

  const manifest = JSON.parse(manifestStr);
  const version = manifest.version;

  if (!isValidVersion(version)) {
    return Errors.validation("Invalid version format");
  }

  // Check bundle size (50MB limit)
  const MAX_BUNDLE_SIZE = 50 * 1024 * 1024;
  if (bundleFile.size > MAX_BUNDLE_SIZE) {
    return Errors.bundleTooLarge(bundleFile.size, MAX_BUNDLE_SIZE);
  }

  // Development mode: allow unauthenticated publishing for local testing
  const isDev = Deno.env.get("ENACT_DEV_MODE") === "true";
  
  let userId: string;
  let username: string;

  if (isDev) {
    // In dev mode, look up user by namespace or create a dev user
    const namespace = extractNamespace(toolName);
    
    // Try to find user by username
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("username", namespace)
      .single();
    
    if (profile) {
      userId = profile.id;
      username = profile.username;
    } else {
      // Use a fixed dev UUID if no matching user found
      userId = "00000000-0000-0000-0000-000000000000";
      username = namespace;
    }
    console.log(`[Dev Mode] Publishing as user: ${username} (${userId})`);
  } else {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Errors.unauthorized();
    }
    userId = user.id;

    // Get user's profile to verify namespace
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return Errors.internal("Could not retrieve user profile");
    }
    username = profile.username;
  }

  const namespace = extractNamespace(toolName);
  const shortName = extractShortName(toolName);

  // Enforce namespace ownership - users can only publish under their username (skip in dev mode)
  if (!isDev && namespace !== username) {
    return Errors.namespaceMismatch(namespace, username);
  }

  // Get or create tool
  let { data: tool, error: toolError } = await supabase
    .from("tools")
    .select("*")
    .eq("owner_id", userId)
    .eq("short_name", shortName)
    .single();

  if (toolError && toolError.code !== "PGRST116") {
    return Errors.internal(toolError.message);
  }

  if (!tool) {
    // Generate embedding for semantic search
    let embedding: number[] | null = null;
    try {
      const embeddingText = createToolEmbeddingText({
        name: toolName,
        description: manifest.description,
        tags: manifest.tags,
      });
      embedding = await generateEmbedding(embeddingText);
      console.log(`[Publish] Generated embedding for ${toolName}`);
    } catch (embeddingError) {
      // Log but don't fail - embeddings are optional
      console.warn(`[Publish] Failed to generate embedding: ${embeddingError}`);
    }

    const insertData: any = {
      owner_id: userId,
      name: toolName,
      short_name: shortName,
      description: manifest.description,
      license: manifest.license,
      tags: manifest.tags ?? [],
      visibility: toolVisibility,
    };

    // Add embedding if generated
    if (embedding) {
      insertData.embedding = toVectorString(embedding);
    }

    const { data: newTool, error: createError } = await supabase
      .from("tools")
      .insert(insertData)
      .select()
      .single();

    if (createError) {
      return Errors.internal(createError.message);
    }

    tool = newTool;
  } else {
    // Update existing tool with new description/tags and regenerate embedding
    let embedding: number[] | null = null;
    try {
      const embeddingText = createToolEmbeddingText({
        name: toolName,
        description: manifest.description,
        tags: manifest.tags,
      });
      embedding = await generateEmbedding(embeddingText);
      console.log(`[Publish] Regenerated embedding for ${toolName}`);
    } catch (embeddingError) {
      console.warn(`[Publish] Failed to regenerate embedding: ${embeddingError}`);
    }

    const updateData: any = {
      description: manifest.description,
      license: manifest.license,
      tags: manifest.tags ?? [],
      visibility: toolVisibility,
    };

    if (embedding) {
      updateData.embedding = toVectorString(embedding);
    }

    await supabase
      .from("tools")
      .update(updateData)
      .eq("id", tool.id);
  }

  // Check if version exists
  const { data: existingVersion } = await supabase
    .from("tool_versions")
    .select("id")
    .eq("tool_id", tool.id)
    .eq("version", version)
    .single();

  if (existingVersion) {
    return Errors.conflict(`Version ${version} already exists`);
  }

  // Upload bundle
  const storage = createStorageClient();
  const bundleData = await bundleFile.arrayBuffer();
  const { path, hash, size } = await uploadBundle(
    storage,
    toolName,
    version,
    bundleData
  );

  // Create version
  const { data: toolVersion, error: versionError } = await supabase
    .from("tool_versions")
    .insert({
      tool_id: tool.id,
      version,
      manifest,
      raw_manifest: rawManifest,
      bundle_hash: hash,
      bundle_size: size,
      bundle_path: path,
      published_by: userId,
    })
    .select()
    .single();

  if (versionError) {
    return Errors.internal(versionError.message);
  }

  // Handle pre-signed attestation if provided
  let attestationResult = null;
  if (checksumManifestStr && sigstoreBundleStr) {
    try {
      const checksumManifest = JSON.parse(checksumManifestStr) as ChecksumManifest;
      const sigstoreBundle = JSON.parse(sigstoreBundleStr);

      console.log(`[Publish] Processing pre-signed attestation for ${toolName}@${version}`);

      // Validate manifest structure and metadata
      const structureValidation = validateManifest(checksumManifest, toolName, version);
      if (!structureValidation.valid) {
        console.error(`[Publish] Manifest validation failed:`, structureValidation.errors);
        // Don't fail the publish, just skip attestation
        console.warn(`[Publish] Skipping attestation due to manifest validation errors`);
      } else {
        // Verify manifest against bundle contents
        const manifestVerification = await verifyManifestAgainstBundle(checksumManifest, bundleData);
        
        if (!manifestVerification.valid) {
          console.error(`[Publish] Manifest verification failed:`, manifestVerification.errors);
          console.warn(`[Publish] Skipping attestation due to manifest verification errors`);
        } else {
          console.log(`[Publish] Manifest verified against bundle contents`);

          // Verify the Sigstore bundle against the manifest hash
          const manifestHash = checksumManifest.manifestHash.digest;
          const hashBytes = new Uint8Array(
            manifestHash.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16))
          );

          const sigstoreResult = await verifyBundle(sigstoreBundle, hashBytes);
          
          if (!sigstoreResult.verified) {
            console.error(`[Publish] Sigstore verification failed:`, sigstoreResult);
            console.warn(`[Publish] Skipping attestation due to Sigstore verification failure`);
          } else {
            console.log(`[Publish] Sigstore bundle verified`);

            // Extract auditor identity
            const auditor = extractAuditorFromBundle(sigstoreBundle);
            const auditorProvider = detectProviderFromIssuer(sigstoreBundle);

            if (!auditor) {
              console.warn(`[Publish] Could not extract auditor identity, skipping attestation`);
            } else {
              // Extract Rekor info
              const rekorLogId = sigstoreBundle.verificationMaterial?.tlogEntries?.[0]?.logId?.keyId;
              const rekorLogIndex = sigstoreBundle.verificationMaterial?.tlogEntries?.[0]?.logIndex;

              // Store attestation
              const { data: attestation, error: attestationError } = await supabase
                .from("attestations")
                .insert({
                  tool_version_id: toolVersion.id,
                  auditor,
                  auditor_provider: auditorProvider,
                  bundle: sigstoreBundle,
                  rekor_log_id: rekorLogId,
                  rekor_log_index: rekorLogIndex,
                  signed_at: new Date().toISOString(),
                  verified: true,
                  rekor_verified: true,
                  certificate_verified: true,
                  signature_verified: true,
                  verified_at: new Date().toISOString(),
                  // Store manifest-specific data
                  checksum_manifest: checksumManifest,
                })
                .select()
                .single();

              if (attestationError) {
                console.error(`[Publish] Failed to store attestation:`, attestationError);
              } else {
                console.log(`[Publish] Attestation stored for auditor: ${auditor}`);
                attestationResult = {
                  auditor,
                  auditor_provider: auditorProvider,
                  verified: true,
                };
              }
            }
          }
        }
      }
    } catch (attestationError) {
      console.error(`[Publish] Error processing attestation:`, attestationError);
      // Don't fail the publish, just log the error
    }
  }

  return createdResponse({
    name: toolName,
    version,
    published_at: toolVersion.published_at,
    bundle_hash: hash,
    attestation: attestationResult,
  });
}

/**
 * Handle change visibility
 */
async function handleChangeVisibility(
  supabase: any,
  req: Request,
  toolName: string
): Promise<Response> {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Errors.unauthorized();
  }

  // Parse request body
  const body = await req.json();
  const visibility = body.visibility;

  // Validate visibility value
  const validVisibilities = ["public", "private", "unlisted"];
  if (!visibility || !validVisibilities.includes(visibility)) {
    return Errors.validation(`Invalid visibility. Must be one of: ${validVisibilities.join(", ")}`);
  }

  // Get the tool and verify ownership
  const { data: tool, error: toolError } = await supabase
    .from("tools")
    .select("id, owner_id")
    .eq("name", toolName)
    .single();

  if (toolError || !tool) {
    return Errors.notFound(`Tool not found: ${toolName}`);
  }

  // Verify ownership
  if (tool.owner_id !== user.id) {
    return Errors.unauthorized("You do not own this tool");
  }

  // Update visibility
  const { error: updateError } = await supabase
    .from("tools")
    .update({ visibility })
    .eq("id", tool.id);

  if (updateError) {
    return Errors.internal(updateError.message);
  }

  return successResponse({
    name: toolName,
    visibility,
    updated: true,
  });
}

/**
 * Handle get tool
 */
async function handleGetTool(
  supabase: any,
  toolName: string,
  url: URL
): Promise<Response> {
  // Debug: Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  console.log(`[Tools] handleGetTool - User: ${user?.id ?? 'anonymous'}, Tool: ${toolName}`);

  const { data: tool, error } = await supabase
    .from("tools")
    .select(`
      *,
      tool_versions(*)
    `)
    .eq("name", toolName)
    .single();

  if (error) {
    console.error(`[Tools] Error fetching tool ${toolName}:`, error);
    return Errors.notFound(`Tool not found: ${toolName}`);
  }

  if (!tool) {
    return Errors.notFound(`Tool not found: ${toolName}`);
  }

  console.log(`[Tools] Found tool ${toolName}, visibility: ${tool.visibility}, versions count: ${tool.tool_versions?.length ?? 0}`);

  const versions = (tool.tool_versions ?? []).map((v: any) => ({
    version: v.version,
    published_at: v.published_at,
    downloads: v.downloads,
    bundle_hash: v.bundle_hash,
    yanked: v.yanked,
  }));

  // Sort versions by semver descending
  versions.sort((a: any, b: any) => {
    const [aMaj = 0, aMin = 0, aPat = 0] = a.version.split('.').map(Number);
    const [bMaj = 0, bMin = 0, bPat = 0] = b.version.split('.').map(Number);
    if (bMaj !== aMaj) return bMaj - aMaj;
    if (bMin !== aMin) return bMin - aMin;
    return bPat - aPat;
  });

  // Latest version is the highest non-yanked version, or highest overall if all yanked
  const latestNonYanked = versions.find((v: any) => !v.yanked);
  const latestVersion = latestNonYanked?.version ?? versions[0]?.version ?? "0.0.0";

  return jsonResponse({
    name: tool.name,
    description: tool.description,
    tags: tool.tags ?? [],
    license: tool.license,
    author: {
      username: extractNamespace(tool.name),
      avatar_url: null,
    },
    repository: tool.repository_url,
    visibility: tool.visibility ?? "public",
    created_at: tool.created_at,
    updated_at: tool.updated_at,
    latest_version: latestVersion,
    versions,
    versions_total: versions.length,
    total_downloads: tool.total_downloads,
  });
}

/**
 * Handle get version
 */
async function handleGetVersion(
  supabase: any,
  toolName: string,
  version: string
): Promise<Response> {
  const { data, error } = await supabase
    .from("tool_versions")
    .select(`
      *,
      tools!inner(*),
      attestations(*)
    `)
    .eq("tools.name", toolName)
    .eq("version", version)
    .single();

  if (error || !data) {
    return Errors.notFound(`Version not found: ${toolName}@${version}`);
  }

  return jsonResponse({
    name: toolName,
    version: data.version,
    description: data.manifest.description,
    license: data.manifest.license,
    yanked: data.yanked,
    yank_reason: data.yank_reason,
    yank_replacement: data.yank_replacement,
    yanked_at: data.yanked_at,
    manifest: data.manifest,
    rawManifest: data.raw_manifest,
    bundle: {
      hash: data.bundle_hash,
      size: data.bundle_size,
      download_url: `/tools/${toolName}/versions/${version}/download`,
    },
    attestations: (data.attestations ?? []).map((a: any) => ({
      auditor: a.auditor,
      auditor_provider: a.auditor_provider,
      signed_at: a.signed_at,
      rekor_log_id: a.rekor_log_id,
      verification: {
        verified: a.verified,
      },
    })),
    published_by: {
      username: extractNamespace(toolName),
      avatar_url: null,
    },
    published_at: data.published_at,
    downloads: data.downloads,
  });
}

/**
 * Handle download
 */
async function handleDownload(
  supabase: any,
  toolName: string,
  version: string,
  url: URL
): Promise<Response> {
  // Get version info
  const { data, error } = await supabase
    .from("tool_versions")
    .select(`
      *,
      tools!inner(*)
    `)
    .eq("tools.name", toolName)
    .eq("version", version)
    .single();

  if (error || !data) {
    return Errors.notFound(`Version not found: ${toolName}@${version}`);
  }

  // Check if yanked
  if (data.yanked && !url.searchParams.has("acknowledge_yanked")) {
    return Errors.versionYanked(
      `Version ${version} has been yanked`,
      data.yank_reason,
      data.yank_replacement
    );
  }

  // Log download (async, don't wait)
  supabase.from("download_logs").insert({
    tool_version_id: data.id,
    ip_hash: null, // Could hash IP for privacy
    user_agent: null,
  });

  // In production, redirect to R2/S3 signed URL
  const storage = createStorageClient();
  const bundleData = await downloadBundle(storage, toolName, version);

  return new Response(bundleData, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${toolName.replace(/\//g, "-")}-${version}.tar.gz"`,
      "ETag": `"${data.bundle_hash}"`,
      "X-Bundle-Hash": data.bundle_hash,
    },
  });
}

/**
 * Handle list files in a tool bundle
 */
async function handleListFiles(
  supabase: any,
  toolName: string,
  version: string
): Promise<Response> {
  // Debug: Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  console.log(`[Tools] handleListFiles - User: ${user?.id ?? 'anonymous'}, Tool: ${toolName}@${version}`);

  // Get version info
  const { data, error } = await supabase
    .from("tool_versions")
    .select(`
      *,
      tools!inner(*)
    `)
    .eq("tools.name", toolName)
    .eq("version", version)
    .single();

  if (error) {
    console.error(`[Tools] Error fetching version for ${toolName}@${version}:`, error);
    // If it's an RLS error for private tools, give a more helpful message
    if (error.code === "PGRST116") {
      return Errors.notFound(`Version not found: ${toolName}@${version}. If this is a private tool, make sure you're logged in as the owner.`);
    }
    return Errors.notFound(`Version not found: ${toolName}@${version}`);
  }

  if (!data) {
    return Errors.notFound(`Version not found: ${toolName}@${version}`);
  }

  try {
    // Download bundle from storage
    const storage = createStorageClient();
    const bundleData = await downloadBundle(storage, toolName, version);

    // List files in the tar.gz
    const entries = await listTarGzFiles(bundleData);

    // Filter out macOS metadata files (AppleDouble files starting with ._)
    // and other hidden/system files
    const filteredEntries = entries.filter(entry => {
      const fileName = entry.name.split('/').pop() || entry.name;
      // Skip AppleDouble files, .DS_Store, and other hidden files
      if (fileName.startsWith('._') || fileName === '.DS_Store' || fileName === '__MACOSX') {
        return false;
      }
      // Skip __MACOSX directory contents
      if (entry.name.includes('__MACOSX/')) {
        return false;
      }
      return true;
    });

    // Format response
    const files = filteredEntries.map(entry => ({
      path: entry.name,
      size: entry.size,
      type: entry.type,
    }));

    return jsonResponse({
      files,
      total: files.length,
    });
  } catch (err) {
    console.error("[Tools] Error listing files:", err);
    return Errors.internal(`Failed to list files: ${(err as Error).message}`);
  }
}

/**
 * Handle get file content from a tool bundle
 */
async function handleGetFileContent(
  supabase: any,
  toolName: string,
  version: string,
  filePath: string
): Promise<Response> {
  // Debug: Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  console.log(`[Tools] handleGetFileContent - User: ${user?.id ?? 'anonymous'}, Tool: ${toolName}@${version}, File: ${filePath}`);

  // Get version info
  const { data, error } = await supabase
    .from("tool_versions")
    .select(`
      *,
      tools!inner(*)
    `)
    .eq("tools.name", toolName)
    .eq("version", version)
    .single();

  if (error) {
    console.error(`[Tools] Error fetching version for file content ${toolName}@${version}:`, error);
    if (error.code === "PGRST116") {
      return Errors.notFound(`Version not found: ${toolName}@${version}. If this is a private tool, make sure you're logged in as the owner.`);
    }
    return Errors.notFound(`Version not found: ${toolName}@${version}`);
  }

  if (!data) {
    return Errors.notFound(`Version not found: ${toolName}@${version}`);
  }

  try {
    // Download bundle from storage
    const storage = createStorageClient();
    const bundleData = await downloadBundle(storage, toolName, version);

    // Get file from the tar.gz
    const entry = await getFileFromTarGz(bundleData, filePath);

    if (!entry || !entry.content) {
      return Errors.notFound(`File not found: ${filePath}`);
    }

    // Determine if content should be base64 encoded (binary files)
    const isBinary = isBinaryFile(filePath, entry.content);
    
    let content: string;
    let encoding: 'utf-8' | 'base64';

    if (isBinary) {
      // Base64 encode binary files
      content = btoa(String.fromCharCode(...entry.content));
      encoding = 'base64';
    } else {
      // Return text files as UTF-8
      content = new TextDecoder().decode(entry.content);
      encoding = 'utf-8';
    }

    return jsonResponse({
      path: entry.name,
      content,
      size: entry.size,
      encoding,
    });
  } catch (err) {
    console.error("[Tools] Error getting file content:", err);
    return Errors.internal(`Failed to get file: ${(err as Error).message}`);
  }
}

/**
 * Check if a file is binary based on extension and content
 */
function isBinaryFile(filePath: string, content: Uint8Array): boolean {
  // Check extension first
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const textExtensions = [
    'txt', 'md', 'py', 'js', 'ts', 'jsx', 'tsx', 'json', 'yaml', 'yml',
    'html', 'css', 'scss', 'less', 'sh', 'bash', 'zsh', 'fish',
    'toml', 'ini', 'cfg', 'conf', 'xml', 'svg', 'sql', 'graphql',
    'dockerfile', 'makefile', 'gitignore', 'env', 'lock', 'sum',
  ];
  
  const filename = filePath.split('/').pop()?.toLowerCase() || '';
  if (filename === 'dockerfile' || filename === 'makefile' || filename.startsWith('.')) {
    // Common text files without extensions
    if (!filename.endsWith('.png') && !filename.endsWith('.jpg') && !filename.endsWith('.gif')) {
      return false;
    }
  }
  
  if (textExtensions.includes(ext)) {
    return false;
  }

  // Check for null bytes in first 8KB (indicates binary)
  const sample = content.slice(0, 8192);
  for (const byte of sample) {
    if (byte === 0) {
      return true;
    }
  }

  return false;
}

/**
 * Handle get attestation bundle (Sigstore bundle for local verification)
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
 * Handle get attestations for a tool version
 */
async function handleGetAttestations(
  supabase: any,
  toolName: string,
  version: string,
  url: URL
): Promise<Response> {
  // Get version info first
  const { data: versionData, error: versionError } = await supabase
    .from("tool_versions")
    .select(`
      id,
      version,
      bundle_hash,
      tools!inner(name)
    `)
    .eq("tools.name", toolName)
    .eq("version", version)
    .single();

  if (versionError || !versionData) {
    return Errors.notFound(`Version not found: ${toolName}@${version}`);
  }

  // Fetch attestations for this version
  const { data: attestations, error: attError } = await supabase
    .from("attestations")
    .select("*")
    .eq("tool_version_id", versionData.id)
    .order("signed_at", { ascending: false });

  if (attError) {
    return Errors.internal(attError.message);
  }

  // Format response
  const formattedAttestations = (attestations || []).map((att: any) => ({
    auditor: att.auditor,
    auditor_provider: att.auditor_provider,
    signed_at: att.signed_at,
    rekor_log_id: att.rekor_log_id,
    rekor_log_index: att.rekor_log_index,
    verification: {
      verified: att.verified,
      rekor_verified: att.rekor_verified,
      certificate_verified: att.certificate_verified,
    },
  }));

  return jsonResponse({
    tool: toolName,
    version: version,
    bundle_hash: versionData.bundle_hash,
    attestations: formattedAttestations,
    total: formattedAttestations.length,
  });
}

/**
 * Handle yank
 */
async function handleYank(
  supabase: any,
  req: Request,
  toolName: string,
  version: string
): Promise<Response> {
  const body = await req.json();
  const { reason, replacement_version } = body;

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Errors.unauthorized();
  }

  // Update version
  const { error } = await supabase
    .from("tool_versions")
    .update({
      yanked: true,
      yank_reason: reason,
      yank_replacement: replacement_version,
      yanked_at: new Date().toISOString(),
    })
    .eq("version", version)
    .match({ "tools.name": toolName, "tools.owner_id": user.id });

  if (error) {
    return Errors.internal(error.message);
  }

  return jsonResponse({
    yanked: true,
    version,
    reason,
    replacement_version,
    yanked_at: new Date().toISOString(),
  });
}

/**
 * Handle unyank
 */
async function handleUnyank(
  supabase: any,
  toolName: string,
  version: string
): Promise<Response> {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Errors.unauthorized();
  }

  // Update version
  const { error } = await supabase
    .from("tool_versions")
    .update({
      yanked: false,
      yank_reason: null,
      yank_replacement: null,
      yanked_at: null,
    })
    .eq("version", version)
    .match({ "tools.name": toolName, "tools.owner_id": user.id });

  if (error) {
    return Errors.internal(error.message);
  }

  return jsonResponse({
    yanked: false,
    version,
    unyanked_at: new Date().toISOString(),
  });
}

/**
 * Handle delete tool
 */
async function handleDeleteTool(
  supabase: any,
  toolName: string
): Promise<Response> {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Errors.unauthorized();
  }

  // Delete tool (cascade will delete versions)
  const { error } = await supabase
    .from("tools")
    .delete()
    .eq("name", toolName)
    .eq("owner_id", user.id);

  if (error) {
    return Errors.internal(error.message);
  }

  return noContentResponse();
}

/**
 * Handle get user profile
 */
async function handleGetUserProfile(
  supabase: any,
  username: string
): Promise<Response> {
  // Fetch profile by username
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, created_at")
    .eq("username", username.toLowerCase())
    .single();

  if (error || !profile) {
    return Errors.notFound(`User "${username}" not found`);
  }

  // Count public tools for this user
  const { count: toolCount } = await supabase
    .from("tools")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", profile.id)
    .eq("visibility", "public");

  return jsonResponse({
    username: profile.username,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    created_at: profile.created_at,
    public_tool_count: toolCount || 0,
  });
}

/**
 * Handle get user's tools
 */
async function handleGetUserTools(
  supabase: any,
  username: string,
  url: URL
): Promise<Response> {
  const { limit, offset } = parsePaginationParams(url);
  const includePrivate = url.searchParams.get("include_private") === "true";

  // Get current user to check if they're viewing their own profile
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch profile by username
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("username", username.toLowerCase())
    .single();

  if (profileError || !profile) {
    return Errors.notFound(`User "${username}" not found`);
  }

  // Check if current user is viewing their own profile
  const isOwnProfile = user?.id === profile.id;

  // Build query for tools
  let query = supabase
    .from("tools")
    .select(`
      id,
      name,
      description,
      tags,
      license,
      visibility,
      created_at,
      updated_at
    `)
    .eq("owner_id", profile.id)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Only show private tools if viewing own profile and requested
  if (isOwnProfile && includePrivate) {
    // Show all tools (public, private, unlisted)
  } else {
    // Only show public tools
    query = query.eq("visibility", "public");
  }

  const { data: tools, error: toolsError, count } = await query;

  if (toolsError) {
    return Errors.internal(toolsError.message);
  }

  // Fetch latest version for each tool
  const toolIds = tools?.map((t: any) => t.id) || [];
  const { data: versions } = await supabase
    .from("tool_versions")
    .select("tool_id, version, downloads, published_at, yanked")
    .in("tool_id", toolIds);

  // Build version map - find latest non-yanked version per tool
  const versionMap = new Map<string, { version: string; downloads: number; published_at: string }>();
  const downloadMap = new Map<string, number>();
  
  for (const v of versions || []) {
    // Track total downloads
    downloadMap.set(v.tool_id, (downloadMap.get(v.tool_id) || 0) + v.downloads);
    
    // Find latest non-yanked version
    if (!v.yanked) {
      const existing = versionMap.get(v.tool_id);
      if (!existing || v.published_at > existing.published_at) {
        versionMap.set(v.tool_id, {
          version: v.version,
          downloads: v.downloads,
          published_at: v.published_at,
        });
      }
    }
  }

  // Format response
  const formattedTools = tools?.map((tool: any) => {
    const latestVersion = versionMap.get(tool.id);
    return {
      name: tool.name,
      description: tool.description,
      tags: tool.tags || [],
      license: tool.license,
      visibility: tool.visibility,
      version: latestVersion?.version || "0.0.0",
      downloads: downloadMap.get(tool.id) || 0,
      created_at: tool.created_at,
      updated_at: tool.updated_at,
    };
  }) || [];

  return jsonResponse({
    tools: formattedTools,
    total: count || formattedTools.length,
    limit,
    offset,
    is_own_profile: isOwnProfile,
  });
}
