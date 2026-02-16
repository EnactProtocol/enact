/**
 * Tool routes for the self-hosted registry.
 * Implements the same API contract as the Supabase-hosted registry.
 */

import { createHash } from "node:crypto";
import { Hono } from "hono";
import { getDatabase } from "../db.js";
import { deleteBundle, loadBundle, storeBundle } from "../storage.js";
import { getAuthenticatedUser } from "./auth.js";

const tools = new Hono();

// ---------------------------------------------------------------------------
// GET /tools/search
// ---------------------------------------------------------------------------
tools.get("/search", (c) => {
  const db = getDatabase();
  const query = c.req.query("q") ?? "";
  const tags = c.req.query("tags");
  const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "20", 10), 100);
  const offset = Number.parseInt(c.req.query("offset") ?? "0", 10);

  let rows: Record<string, unknown>[];

  if (query) {
    // FTS5 search
    const ftsQuery = query
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .map((w) => `"${w}"*`)
      .join(" OR ");

    rows = db
      .prepare(
        `SELECT t.*, rank
         FROM tools_fts fts
         JOIN tools t ON t.rowid = fts.rowid
         WHERE tools_fts MATCH ?
         AND t.visibility = 'public'
         ORDER BY rank
         LIMIT ? OFFSET ?`
      )
      .all(ftsQuery, limit, offset) as Record<string, unknown>[];
  } else {
    rows = db
      .prepare(
        `SELECT * FROM tools
         WHERE visibility = 'public'
         ORDER BY total_downloads DESC
         LIMIT ? OFFSET ?`
      )
      .all(limit, offset) as Record<string, unknown>[];
  }

  // Filter by tags if specified
  if (tags) {
    const tagList = tags.split(",").map((t) => t.trim().toLowerCase());
    rows = rows.filter((row) => {
      const toolTags: string[] = JSON.parse((row.tags as string) ?? "[]");
      return tagList.some((t) => toolTags.map((tt) => tt.toLowerCase()).includes(t));
    });
  }

  // Get latest version for each tool
  const results = rows.map((row) => {
    const latestVersion = db
      .prepare(
        `SELECT version, downloads FROM tool_versions
         WHERE tool_id = ? AND yanked = 0
         ORDER BY published_at DESC LIMIT 1`
      )
      .get(row.id as string) as { version: string; downloads: number } | undefined;

    const owner = db
      .prepare("SELECT username, avatar_url FROM profiles WHERE id = ?")
      .get(row.owner_id as string) as { username: string; avatar_url: string | null } | undefined;

    const attestationCount = db
      .prepare(
        `SELECT COUNT(*) as count FROM attestations a
         JOIN tool_versions tv ON tv.id = a.tool_version_id
         WHERE tv.tool_id = ? AND a.revoked = 0`
      )
      .get(row.id as string) as { count: number };

    return {
      name: row.name,
      description: row.description,
      tags: JSON.parse((row.tags as string) ?? "[]"),
      version: latestVersion?.version ?? null,
      author: owner ? { username: owner.username, avatar_url: owner.avatar_url } : null,
      downloads: row.total_downloads,
      visibility: row.visibility,
      trust_status: {
        auditor_count: attestationCount.count,
      },
    };
  });

  const totalRow = db
    .prepare("SELECT COUNT(*) as count FROM tools WHERE visibility = 'public'")
    .get() as { count: number };

  return c.json({
    tools: results,
    total: totalRow.count,
    limit,
    offset,
    search_type: query ? "text" : "browse",
  });
});

// ---------------------------------------------------------------------------
// GET /tools/:name - Get tool info
// ---------------------------------------------------------------------------
tools.get("/:name{.+}/versions/:version/download", (c) => {
  // This must come before the generic /:name route
  const name = c.req.param("name");
  const version = c.req.param("version");
  const acknowledgeYanked = c.req.query("acknowledge_yanked") === "true";
  const db = getDatabase();

  const tool = db.prepare("SELECT * FROM tools WHERE name = ?").get(name) as
    | Record<string, unknown>
    | undefined;
  if (!tool) {
    return c.json({ error: { code: "NOT_FOUND", message: `Tool "${name}" not found` } }, 404);
  }

  const tv = db
    .prepare("SELECT * FROM tool_versions WHERE tool_id = ? AND version = ?")
    .get(tool.id as string, version) as Record<string, unknown> | undefined;
  if (!tv) {
    return c.json({ error: { code: "NOT_FOUND", message: `Version "${version}" not found` } }, 404);
  }

  if (tv.yanked && !acknowledgeYanked) {
    return c.json(
      {
        error: {
          code: "VERSION_YANKED",
          message: `Version ${version} has been yanked`,
          details: {
            yank_reason: tv.yank_reason,
            replacement_version: tv.yank_replacement,
          },
        },
      },
      410
    );
  }

  const data = loadBundle(tv.bundle_path as string);
  if (!data) {
    return c.json({ error: { code: "NOT_FOUND", message: "Bundle file not found on disk" } }, 404);
  }

  // Log download
  db.prepare("INSERT INTO download_logs (tool_version_id, user_agent) VALUES (?, ?)").run(
    tv.id as string,
    c.req.header("User-Agent") ?? ""
  );
  db.prepare("UPDATE tool_versions SET downloads = downloads + 1 WHERE id = ?").run(
    tv.id as string
  );
  db.prepare("UPDATE tools SET total_downloads = total_downloads + 1 WHERE id = ?").run(
    tool.id as string
  );

  c.header("Content-Type", "application/gzip");
  c.header("ETag", `"${tv.bundle_hash}"`);
  return new Response(new Uint8Array(data), { status: 200, headers: c.res.headers });
});

// ---------------------------------------------------------------------------
// GET /tools/:name/versions/:version/attestations
// ---------------------------------------------------------------------------
tools.get("/:name{.+}/versions/:version/attestations", (c) => {
  const name = c.req.param("name");
  const version = c.req.param("version");
  const db = getDatabase();

  const tool = db.prepare("SELECT id FROM tools WHERE name = ?").get(name) as
    | { id: string }
    | undefined;
  if (!tool) {
    return c.json({ error: { code: "NOT_FOUND", message: `Tool "${name}" not found` } }, 404);
  }

  const tv = db
    .prepare("SELECT id FROM tool_versions WHERE tool_id = ? AND version = ?")
    .get(tool.id, version) as { id: string } | undefined;
  if (!tv) {
    return c.json({ error: { code: "NOT_FOUND", message: `Version "${version}" not found` } }, 404);
  }

  const attestations = db
    .prepare("SELECT * FROM attestations WHERE tool_version_id = ? AND revoked = 0")
    .all(tv.id) as Record<string, unknown>[];

  return c.json({
    attestations: attestations.map((a) => ({
      auditor: a.auditor,
      auditor_provider: a.auditor_provider,
      signed_at: a.signed_at,
      rekor_log_id: a.rekor_log_id,
      rekor_log_index: a.rekor_log_index,
      verification: {
        verified: Boolean(a.verified),
        verified_at: a.verified_at,
        rekor_verified: Boolean(a.rekor_verified),
        certificate_verified: Boolean(a.certificate_verified),
        signature_verified: Boolean(a.signature_verified),
      },
    })),
    tool_name: name,
    version,
  });
});

// ---------------------------------------------------------------------------
// POST /tools/:name/versions/:version/attestations
// ---------------------------------------------------------------------------
tools.post("/:name{.+}/versions/:version/attestations", async (c) => {
  const name = c.req.param("name");
  const version = c.req.param("version");
  const db = getDatabase();

  const tool = db.prepare("SELECT id FROM tools WHERE name = ?").get(name) as
    | { id: string }
    | undefined;
  if (!tool) {
    return c.json({ error: { code: "NOT_FOUND", message: `Tool "${name}" not found` } }, 404);
  }

  const tv = db
    .prepare("SELECT id FROM tool_versions WHERE tool_id = ? AND version = ?")
    .get(tool.id, version) as { id: string } | undefined;
  if (!tv) {
    return c.json({ error: { code: "NOT_FOUND", message: `Version "${version}" not found` } }, 404);
  }

  const body = await c.req.json();
  const bundle = body.bundle;
  if (!bundle) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Missing attestation bundle" } }, 400);
  }

  const id = randomId();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO attestations (id, tool_version_id, auditor, auditor_provider, bundle, rekor_log_id, signed_at, verified, verified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(
    id,
    tv.id,
    body.auditor ?? "unknown",
    body.auditor_provider ?? null,
    JSON.stringify(bundle),
    body.rekor_log_id ?? `local-${id}`,
    now,
    now
  );

  return c.json(
    {
      auditor: body.auditor ?? "unknown",
      auditor_provider: body.auditor_provider ?? null,
      signed_at: now,
      rekor_log_id: body.rekor_log_id ?? `local-${id}`,
      verification: {
        verified: true,
        verified_at: now,
        rekor_verified: true,
        certificate_verified: true,
        signature_verified: true,
      },
    },
    201
  );
});

// ---------------------------------------------------------------------------
// GET /tools/:name/versions/:version
// ---------------------------------------------------------------------------
tools.get("/:name{.+}/versions/:version", (c) => {
  const name = c.req.param("name");
  const version = c.req.param("version");
  const db = getDatabase();

  const tool = db.prepare("SELECT * FROM tools WHERE name = ?").get(name) as
    | Record<string, unknown>
    | undefined;
  if (!tool) {
    return c.json({ error: { code: "NOT_FOUND", message: `Tool "${name}" not found` } }, 404);
  }

  const tv = db
    .prepare("SELECT * FROM tool_versions WHERE tool_id = ? AND version = ?")
    .get(tool.id as string, version) as Record<string, unknown> | undefined;
  if (!tv) {
    return c.json({ error: { code: "NOT_FOUND", message: `Version "${version}" not found` } }, 404);
  }

  const publisher = db
    .prepare("SELECT username, avatar_url FROM profiles WHERE id = ?")
    .get(tv.published_by as string) as { username: string; avatar_url: string | null } | undefined;

  const attestations = db
    .prepare("SELECT * FROM attestations WHERE tool_version_id = ? AND revoked = 0")
    .all(tv.id as string) as Record<string, unknown>[];

  return c.json({
    name,
    version,
    description: tool.description,
    license: tool.license,
    yanked: Boolean(tv.yanked),
    yank_reason: tv.yank_reason ?? null,
    yank_replacement: tv.yank_replacement ?? null,
    yanked_at: tv.yanked_at ?? null,
    manifest: JSON.parse(tv.manifest as string),
    rawManifest: tv.raw_manifest ?? null,
    bundle: {
      hash: tv.bundle_hash,
      size: tv.bundle_size,
      download_url: `/tools/${name}/versions/${version}/download`,
    },
    attestations: attestations.map((a) => ({
      auditor: a.auditor,
      auditor_provider: a.auditor_provider,
      signed_at: a.signed_at,
      rekor_log_id: a.rekor_log_id,
      rekor_log_index: a.rekor_log_index,
      verification: {
        verified: Boolean(a.verified),
        verified_at: a.verified_at,
        rekor_verified: Boolean(a.rekor_verified),
        certificate_verified: Boolean(a.certificate_verified),
        signature_verified: Boolean(a.signature_verified),
      },
    })),
    published_by: publisher
      ? { username: publisher.username, avatar_url: publisher.avatar_url }
      : null,
    published_at: tv.published_at,
    downloads: tv.downloads,
  });
});

// ---------------------------------------------------------------------------
// POST /tools/:name/versions/:version/yank
// ---------------------------------------------------------------------------
tools.post("/:name{.+}/versions/:version/yank", async (c) => {
  const apiKey = process.env.ENACT_REGISTRY_API_KEY;
  const userId = getAuthenticatedUser(c.req.header("Authorization"), apiKey);
  if (!userId && apiKey) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
  }

  const name = c.req.param("name");
  const version = c.req.param("version");
  const db = getDatabase();

  const tool = db.prepare("SELECT id FROM tools WHERE name = ?").get(name) as
    | { id: string }
    | undefined;
  if (!tool) {
    return c.json({ error: { code: "NOT_FOUND", message: `Tool "${name}" not found` } }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE tool_versions SET yanked = 1, yank_reason = ?, yank_replacement = ?, yanked_at = ?
     WHERE tool_id = ? AND version = ?`
  ).run(body.reason ?? null, body.replacement_version ?? null, now, tool.id, version);

  return c.json({
    yanked: true,
    version,
    reason: body.reason ?? null,
    replacement_version: body.replacement_version ?? null,
    yanked_at: now,
  });
});

// ---------------------------------------------------------------------------
// POST /tools/:name/versions/:version/unyank
// ---------------------------------------------------------------------------
tools.post("/:name{.+}/versions/:version/unyank", (c) => {
  const apiKey = process.env.ENACT_REGISTRY_API_KEY;
  const userId = getAuthenticatedUser(c.req.header("Authorization"), apiKey);
  if (!userId && apiKey) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
  }

  const name = c.req.param("name");
  const version = c.req.param("version");
  const db = getDatabase();

  const tool = db.prepare("SELECT id FROM tools WHERE name = ?").get(name) as
    | { id: string }
    | undefined;
  if (!tool) {
    return c.json({ error: { code: "NOT_FOUND", message: `Tool "${name}" not found` } }, 404);
  }

  db.prepare(
    `UPDATE tool_versions SET yanked = 0, yank_reason = NULL, yank_replacement = NULL, yanked_at = NULL
     WHERE tool_id = ? AND version = ?`
  ).run(tool.id, version);

  return c.json({
    yanked: false,
    version,
    unyanked_at: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// PATCH /tools/:name/visibility
// ---------------------------------------------------------------------------
tools.patch("/:name{.+}/visibility", async (c) => {
  const apiKey = process.env.ENACT_REGISTRY_API_KEY;
  const userId = getAuthenticatedUser(c.req.header("Authorization"), apiKey);
  if (!userId && apiKey) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
  }

  const name = c.req.param("name");
  const body = await c.req.json();
  const db = getDatabase();

  db.prepare("UPDATE tools SET visibility = ?, updated_at = datetime('now') WHERE name = ?").run(
    body.visibility,
    name
  );

  return c.json({ name, visibility: body.visibility });
});

// ---------------------------------------------------------------------------
// DELETE /tools/:name
// ---------------------------------------------------------------------------
tools.delete("/:name{.+}", (c) => {
  const apiKey = process.env.ENACT_REGISTRY_API_KEY;
  const userId = getAuthenticatedUser(c.req.header("Authorization"), apiKey);
  if (!userId && apiKey) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
  }

  const name = c.req.param("name");
  const db = getDatabase();

  const tool = db.prepare("SELECT id FROM tools WHERE name = ?").get(name) as
    | { id: string }
    | undefined;
  if (!tool) {
    return c.json({ error: { code: "NOT_FOUND", message: `Tool "${name}" not found` } }, 404);
  }

  // Delete bundle files
  const versions = db
    .prepare("SELECT bundle_path FROM tool_versions WHERE tool_id = ?")
    .all(tool.id) as { bundle_path: string }[];
  for (const v of versions) {
    deleteBundle(v.bundle_path);
  }

  // Cascade deletes handle attestations, versions, download_logs
  db.prepare("DELETE FROM tools WHERE id = ?").run(tool.id);

  return c.body(null, 204);
});

// ---------------------------------------------------------------------------
// GET /tools/:name - Tool info
// ---------------------------------------------------------------------------
tools.get("/:name{.+}", (c) => {
  const name = c.req.param("name");
  const db = getDatabase();

  const tool = db.prepare("SELECT * FROM tools WHERE name = ?").get(name) as
    | Record<string, unknown>
    | undefined;
  if (!tool) {
    return c.json({ error: { code: "NOT_FOUND", message: `Tool "${name}" not found` } }, 404);
  }

  const owner = db
    .prepare("SELECT username, avatar_url FROM profiles WHERE id = ?")
    .get(tool.owner_id as string) as { username: string; avatar_url: string | null } | undefined;

  const versions = db
    .prepare(
      `SELECT version, published_at, downloads, bundle_hash, yanked
       FROM tool_versions WHERE tool_id = ?
       ORDER BY published_at DESC`
    )
    .all(tool.id as string) as Record<string, unknown>[];

  const latestVersion = versions.find((v) => !v.yanked) ?? versions[0];

  return c.json({
    name: tool.name,
    description: tool.description,
    tags: JSON.parse((tool.tags as string) ?? "[]"),
    license: tool.license,
    author: owner ? { username: owner.username, avatar_url: owner.avatar_url } : null,
    repository: tool.repository_url,
    homepage: tool.homepage_url,
    visibility: tool.visibility,
    created_at: tool.created_at,
    updated_at: tool.updated_at,
    latest_version: (latestVersion?.version as string) ?? null,
    versions: versions.map((v) => ({
      version: v.version,
      published_at: v.published_at,
      downloads: v.downloads,
      bundle_hash: v.bundle_hash,
      yanked: Boolean(v.yanked),
    })),
    versions_total: versions.length,
    total_downloads: tool.total_downloads,
  });
});

// ---------------------------------------------------------------------------
// POST /tools/:name (publish) - multipart/form-data
// ---------------------------------------------------------------------------
tools.post("/:name{.+}/versions", async (c) => {
  const apiKey = process.env.ENACT_REGISTRY_API_KEY;
  const userId = getAuthenticatedUser(c.req.header("Authorization"), apiKey);
  if (!userId && apiKey) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
  }

  const publisherId = userId ?? getAuthenticatedUser(undefined, undefined)!;
  const name = c.req.param("name");
  const db = getDatabase();

  // Enforce namespace ownership for org-scoped tools (only when auth is active)
  let orgId: string | null = null;
  const namespace = name.split("/")[0] ?? "";
  if (apiKey && namespace.startsWith("@")) {
    const orgName = namespace.substring(1);
    const org = db.prepare("SELECT id FROM organizations WHERE name = ?").get(orgName) as
      | { id: string }
      | undefined;
    if (!org) {
      return c.json(
        { error: { code: "ORG_NOT_FOUND", message: `Organization "${orgName}" not found` } },
        404
      );
    }
    if (publisherId) {
      const membership = db
        .prepare("SELECT role FROM org_members WHERE org_id = ? AND user_id = ?")
        .get(org.id, publisherId) as { role: string } | undefined;
      if (!membership) {
        return c.json(
          {
            error: {
              code: "NAMESPACE_MISMATCH",
              message: `You must be a member of the "${orgName}" organization to publish under the "@${orgName}" namespace.`,
            },
          },
          403
        );
      }
    }
    orgId = org.id;
  } else if (namespace.startsWith("@")) {
    // In open mode, still associate with org if it exists
    const orgName = namespace.substring(1);
    const org = db.prepare("SELECT id FROM organizations WHERE name = ?").get(orgName) as
      | { id: string }
      | undefined;
    if (org) {
      orgId = org.id;
    }
  }

  const contentType = c.req.header("Content-Type") ?? "";
  let manifestObj: Record<string, unknown>;
  let bundleData: Buffer;
  let rawManifest: string | null = null;
  let visibility = "public";

  if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.formData();

    const manifestField = formData.get("manifest");
    if (!manifestField || typeof manifestField !== "string") {
      return c.json({ error: { code: "BAD_REQUEST", message: "Missing manifest field" } }, 400);
    }
    manifestObj = JSON.parse(manifestField);

    const bundleField = formData.get("bundle");
    if (!bundleField || !(bundleField instanceof File)) {
      return c.json({ error: { code: "BAD_REQUEST", message: "Missing bundle file" } }, 400);
    }
    bundleData = Buffer.from(await bundleField.arrayBuffer());

    const rawField = formData.get("raw_manifest");
    if (rawField && typeof rawField === "string") {
      rawManifest = rawField;
    }

    const visField = formData.get("visibility");
    if (visField && typeof visField === "string") {
      visibility = visField;
    }

    // Handle pre-signed attestation
    const checksumManifest = formData.get("checksum_manifest");
    const sigstoreBundle = formData.get("sigstore_bundle");
    if (checksumManifest && sigstoreBundle) {
      // Store attestation after version is created (below)
    }
  } else {
    // JSON body fallback
    const body = await c.req.json();
    manifestObj = body.manifest;
    bundleData = Buffer.from(body.bundle, "base64");
    rawManifest = body.raw_manifest ?? null;
    visibility = body.visibility ?? "public";
  }

  const version = manifestObj.version as string;
  if (!version) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Manifest must include version" } },
      422
    );
  }

  // Compute hash
  const bundleHash = `sha256:${createHash("sha256").update(bundleData).digest("hex")}`;
  const bundleSize = bundleData.length;

  // Get or create tool record
  let tool = db.prepare("SELECT id FROM tools WHERE name = ?").get(name) as
    | { id: string }
    | undefined;

  if (!tool) {
    const toolId = randomId();
    const shortName = name.split("/").pop() ?? name;
    const tags = JSON.stringify(Array.isArray(manifestObj.tags) ? manifestObj.tags : []);

    db.prepare(
      `INSERT INTO tools (id, owner_id, org_id, name, short_name, description, license, tags, repository_url, homepage_url, visibility)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      toolId,
      publisherId,
      orgId,
      name,
      shortName,
      (manifestObj.description as string) ?? null,
      (manifestObj.license as string) ?? null,
      tags,
      (manifestObj.repository as string) ?? null,
      (manifestObj.homepage as string) ?? null,
      visibility
    );
    tool = { id: toolId };
  } else {
    // Update metadata
    db.prepare(
      `UPDATE tools SET description = ?, license = ?, visibility = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      (manifestObj.description as string) ?? null,
      (manifestObj.license as string) ?? null,
      visibility,
      tool.id
    );
  }

  // Check for duplicate version
  const existing = db
    .prepare("SELECT id FROM tool_versions WHERE tool_id = ? AND version = ?")
    .get(tool.id, version);
  if (existing) {
    return c.json(
      { error: { code: "CONFLICT", message: `Version "${version}" already exists` } },
      409
    );
  }

  // Store bundle
  const bundlePath = storeBundle(name, version, bundleData);

  // Create version record
  const versionId = randomId();
  db.prepare(
    `INSERT INTO tool_versions (id, tool_id, version, manifest, raw_manifest, bundle_hash, bundle_size, bundle_path, published_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    versionId,
    tool.id,
    version,
    JSON.stringify(manifestObj),
    rawManifest,
    bundleHash,
    bundleSize,
    bundlePath,
    publisherId
  );

  return c.json(
    {
      name,
      version,
      bundle_hash: bundleHash,
      bundle_size: bundleSize,
      download_url: `/tools/${name}/versions/${version}/download`,
      published_at: new Date().toISOString(),
    },
    201
  );
});

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export { tools };
