/**
 * Organization routes for the self-hosted registry.
 * Manages org creation, membership, and listing.
 */

import { Hono } from "hono";
import { getDatabase } from "../db.js";
import { getAuthenticatedUser } from "./auth.js";

const orgs = new Hono();

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function requireAuth(c: any): string | null {
  const apiKey = process.env.ENACT_REGISTRY_API_KEY;
  const userId = getAuthenticatedUser(c.req.header("Authorization"), apiKey);
  if (!userId && apiKey) {
    return null;
  }
  return userId ?? getAuthenticatedUser(undefined, undefined);
}

// ---------------------------------------------------------------------------
// POST /orgs - Create organization
// ---------------------------------------------------------------------------
orgs.post("/", async (c) => {
  const userId = requireAuth(c);
  if (!userId) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
  }

  const body = await c.req.json();
  const name = body.name?.toLowerCase()?.trim();

  if (!name || !/^[a-z0-9_-]+$/.test(name)) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Organization name must contain only lowercase letters, numbers, hyphens, and underscores.",
        },
      },
      422
    );
  }

  const db = getDatabase();

  // Check for collision with existing username
  const existingUser = db.prepare("SELECT id FROM profiles WHERE username = ?").get(name) as
    | { id: string }
    | undefined;
  if (existingUser) {
    return c.json(
      {
        error: {
          code: "CONFLICT",
          message: `Name "${name}" is already taken by a user.`,
        },
      },
      409
    );
  }

  // Check for existing org
  const existingOrg = db.prepare("SELECT id FROM organizations WHERE name = ?").get(name) as
    | { id: string }
    | undefined;
  if (existingOrg) {
    return c.json(
      {
        error: {
          code: "CONFLICT",
          message: `Organization "${name}" already exists.`,
        },
      },
      409
    );
  }

  const orgId = randomId();
  const now = new Date().toISOString();

  db.prepare(
    "INSERT INTO organizations (id, name, display_name, description, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(orgId, name, body.display_name ?? null, body.description ?? null, userId, now);

  // Add creator as owner
  db.prepare(
    "INSERT INTO org_members (org_id, user_id, role, added_at, added_by) VALUES (?, ?, 'owner', ?, ?)"
  ).run(orgId, userId, now, userId);

  return c.json(
    {
      id: orgId,
      name,
      display_name: body.display_name ?? null,
      description: body.description ?? null,
      created_by: userId,
      created_at: now,
      member_count: 1,
      tool_count: 0,
    },
    201
  );
});

// ---------------------------------------------------------------------------
// GET /orgs/:name - Get organization info
// ---------------------------------------------------------------------------
orgs.get("/:name", (c) => {
  const name = c.req.param("name");
  const db = getDatabase();

  const org = db.prepare("SELECT * FROM organizations WHERE name = ?").get(name) as
    | Record<string, unknown>
    | undefined;
  if (!org) {
    return c.json(
      { error: { code: "NOT_FOUND", message: `Organization "${name}" not found` } },
      404
    );
  }

  const memberCount = db
    .prepare("SELECT COUNT(*) as count FROM org_members WHERE org_id = ?")
    .get(org.id as string) as { count: number };

  const toolCount = db
    .prepare("SELECT COUNT(*) as count FROM tools WHERE org_id = ?")
    .get(org.id as string) as { count: number };

  return c.json({
    id: org.id,
    name: org.name,
    display_name: org.display_name,
    description: org.description,
    avatar_url: org.avatar_url,
    created_by: org.created_by,
    created_at: org.created_at,
    member_count: memberCount.count,
    tool_count: toolCount.count,
  });
});

// ---------------------------------------------------------------------------
// GET /orgs/:name/members - List members
// ---------------------------------------------------------------------------
orgs.get("/:name/members", (c) => {
  const name = c.req.param("name");
  const db = getDatabase();

  const org = db.prepare("SELECT id FROM organizations WHERE name = ?").get(name) as
    | { id: string }
    | undefined;
  if (!org) {
    return c.json(
      { error: { code: "NOT_FOUND", message: `Organization "${name}" not found` } },
      404
    );
  }

  const members = db
    .prepare(
      `SELECT om.user_id, om.role, om.added_at, om.added_by, p.username, p.display_name, p.avatar_url
       FROM org_members om
       JOIN profiles p ON p.id = om.user_id
       WHERE om.org_id = ?
       ORDER BY om.added_at ASC`
    )
    .all(org.id) as Record<string, unknown>[];

  return c.json({
    members: members.map((m) => ({
      user_id: m.user_id,
      username: m.username,
      display_name: m.display_name,
      avatar_url: m.avatar_url,
      role: m.role,
      added_at: m.added_at,
    })),
  });
});

// ---------------------------------------------------------------------------
// GET /orgs/:name/tools - List org tools
// ---------------------------------------------------------------------------
orgs.get("/:name/tools", (c) => {
  const name = c.req.param("name");
  const db = getDatabase();

  const org = db.prepare("SELECT id FROM organizations WHERE name = ?").get(name) as
    | { id: string }
    | undefined;
  if (!org) {
    return c.json(
      { error: { code: "NOT_FOUND", message: `Organization "${name}" not found` } },
      404
    );
  }

  const tools = db
    .prepare(
      `SELECT t.*, tv.version as latest_version
       FROM tools t
       LEFT JOIN tool_versions tv ON tv.tool_id = t.id AND tv.yanked = 0
       WHERE t.org_id = ? AND t.visibility = 'public'
       GROUP BY t.id
       ORDER BY t.total_downloads DESC`
    )
    .all(org.id) as Record<string, unknown>[];

  return c.json({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      tags: JSON.parse((t.tags as string) ?? "[]"),
      version: t.latest_version ?? null,
      downloads: t.total_downloads,
      visibility: t.visibility,
    })),
  });
});

// ---------------------------------------------------------------------------
// POST /orgs/:name/members - Add member
// ---------------------------------------------------------------------------
orgs.post("/:name/members", async (c) => {
  const userId = requireAuth(c);
  if (!userId) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
  }

  const name = c.req.param("name");
  const body = await c.req.json();
  const db = getDatabase();

  const org = db.prepare("SELECT id FROM organizations WHERE name = ?").get(name) as
    | { id: string }
    | undefined;
  if (!org) {
    return c.json(
      { error: { code: "NOT_FOUND", message: `Organization "${name}" not found` } },
      404
    );
  }

  // Check requester is owner or admin
  const requesterRole = db
    .prepare("SELECT role FROM org_members WHERE org_id = ? AND user_id = ?")
    .get(org.id, userId) as { role: string } | undefined;
  if (!requesterRole || (requesterRole.role !== "owner" && requesterRole.role !== "admin")) {
    return c.json(
      {
        error: { code: "ORG_PERMISSION_DENIED", message: "Only owners and admins can add members" },
      },
      403
    );
  }

  // Find user by username
  const targetUser = db.prepare("SELECT id FROM profiles WHERE username = ?").get(body.username) as
    | { id: string }
    | undefined;
  if (!targetUser) {
    return c.json(
      { error: { code: "NOT_FOUND", message: `User "${body.username}" not found` } },
      404
    );
  }

  // Check not already a member
  const existing = db
    .prepare("SELECT role FROM org_members WHERE org_id = ? AND user_id = ?")
    .get(org.id, targetUser.id) as { role: string } | undefined;
  if (existing) {
    return c.json(
      { error: { code: "CONFLICT", message: `User "${body.username}" is already a member` } },
      409
    );
  }

  const role = body.role ?? "member";
  if (!["owner", "admin", "member"].includes(role)) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Role must be owner, admin, or member" } },
      422
    );
  }

  db.prepare(
    "INSERT INTO org_members (org_id, user_id, role, added_at, added_by) VALUES (?, ?, ?, ?, ?)"
  ).run(org.id, targetUser.id, role, new Date().toISOString(), userId);

  return c.json({ username: body.username, role, org: name }, 201);
});

// ---------------------------------------------------------------------------
// DELETE /orgs/:name/members/:username - Remove member
// ---------------------------------------------------------------------------
orgs.delete("/:name/members/:username", (c) => {
  const userId = requireAuth(c);
  if (!userId) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
  }

  const name = c.req.param("name");
  const targetUsername = c.req.param("username");
  const db = getDatabase();

  const org = db.prepare("SELECT id FROM organizations WHERE name = ?").get(name) as
    | { id: string }
    | undefined;
  if (!org) {
    return c.json(
      { error: { code: "NOT_FOUND", message: `Organization "${name}" not found` } },
      404
    );
  }

  const targetUser = db.prepare("SELECT id FROM profiles WHERE username = ?").get(targetUsername) as
    | { id: string }
    | undefined;
  if (!targetUser) {
    return c.json(
      { error: { code: "NOT_FOUND", message: `User "${targetUsername}" not found` } },
      404
    );
  }

  // Check permission: must be owner, or removing self
  const requesterRole = db
    .prepare("SELECT role FROM org_members WHERE org_id = ? AND user_id = ?")
    .get(org.id, userId) as { role: string } | undefined;

  const isSelf = targetUser.id === userId;
  if (!isSelf && (!requesterRole || requesterRole.role !== "owner")) {
    return c.json(
      { error: { code: "ORG_PERMISSION_DENIED", message: "Only owners can remove other members" } },
      403
    );
  }

  db.prepare("DELETE FROM org_members WHERE org_id = ? AND user_id = ?").run(org.id, targetUser.id);

  return c.json({ removed: targetUsername, org: name });
});

// ---------------------------------------------------------------------------
// PATCH /orgs/:name/members/:username - Update role
// ---------------------------------------------------------------------------
orgs.patch("/:name/members/:username", async (c) => {
  const userId = requireAuth(c);
  if (!userId) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
  }

  const name = c.req.param("name");
  const targetUsername = c.req.param("username");
  const body = await c.req.json();
  const db = getDatabase();

  const org = db.prepare("SELECT id FROM organizations WHERE name = ?").get(name) as
    | { id: string }
    | undefined;
  if (!org) {
    return c.json(
      { error: { code: "NOT_FOUND", message: `Organization "${name}" not found` } },
      404
    );
  }

  // Only owners can change roles
  const requesterRole = db
    .prepare("SELECT role FROM org_members WHERE org_id = ? AND user_id = ?")
    .get(org.id, userId) as { role: string } | undefined;
  if (!requesterRole || requesterRole.role !== "owner") {
    return c.json(
      { error: { code: "ORG_PERMISSION_DENIED", message: "Only owners can change member roles" } },
      403
    );
  }

  const targetUser = db.prepare("SELECT id FROM profiles WHERE username = ?").get(targetUsername) as
    | { id: string }
    | undefined;
  if (!targetUser) {
    return c.json(
      { error: { code: "NOT_FOUND", message: `User "${targetUsername}" not found` } },
      404
    );
  }

  const role = body.role;
  if (!role || !["owner", "admin", "member"].includes(role)) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Role must be owner, admin, or member" } },
      422
    );
  }

  db.prepare("UPDATE org_members SET role = ? WHERE org_id = ? AND user_id = ?").run(
    role,
    org.id,
    targetUser.id
  );

  return c.json({ username: targetUsername, role, org: name });
});

export { orgs };
