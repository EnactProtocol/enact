/**
 * Authentication routes for self-hosted registry.
 *
 * Self-hosted registries use simple API-key auth:
 *   - If ENACT_REGISTRY_API_KEY is set, publish/yank/delete require it.
 *   - If not set, the registry runs in open mode (suitable for private networks).
 *   - A default admin profile is created on first start.
 */

import { Hono } from "hono";
import { getDatabase } from "../db.js";

const auth = new Hono();

/**
 * Middleware: extract user from Bearer token (API key).
 * Attaches userId to context if authenticated.
 */
export function getAuthenticatedUser(
  authHeader: string | undefined,
  apiKey: string | undefined
): string | null {
  if (!apiKey) {
    // Open mode — return default admin profile
    return getOrCreateAdminProfile();
  }

  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");
  if (token !== apiKey) return null;

  return getOrCreateAdminProfile();
}

function getOrCreateAdminProfile(): string {
  const db = getDatabase();

  const existing = db.prepare("SELECT id FROM profiles WHERE username = ?").get("admin") as
    | { id: string }
    | undefined;

  if (existing) return existing.id;

  const id = randomId();
  db.prepare("INSERT INTO profiles (id, username, display_name) VALUES (?, ?, ?)").run(
    id,
    "admin",
    "Registry Admin"
  );
  return id;
}

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// GET /auth/me
auth.get("/me", (c) => {
  const apiKey = process.env.ENACT_REGISTRY_API_KEY;
  const userId = getAuthenticatedUser(c.req.header("Authorization"), apiKey);

  if (!userId) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid API key" } }, 401);
  }

  const db = getDatabase();
  const profile = db.prepare("SELECT * FROM profiles WHERE id = ?").get(userId) as Record<
    string,
    unknown
  >;

  return c.json({
    id: profile.id,
    username: profile.username,
    email: null,
    namespaces: [profile.username],
    created_at: profile.created_at,
  });
});

export { auth };
