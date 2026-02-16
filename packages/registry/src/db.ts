/**
 * SQLite database for the self-hosted Enact registry.
 * Uses Bun's built-in SQLite driver (bun:sqlite).
 */

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  api_key TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT,
  description TEXT,
  avatar_url TEXT,
  created_by TEXT NOT NULL REFERENCES profiles(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS org_members (
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  added_at TEXT DEFAULT (datetime('now')),
  added_by TEXT REFERENCES profiles(id),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  owner_id TEXT NOT NULL REFERENCES profiles(id),
  org_id TEXT REFERENCES organizations(id),
  name TEXT UNIQUE NOT NULL,
  short_name TEXT NOT NULL,
  description TEXT,
  license TEXT,
  tags TEXT DEFAULT '[]',
  repository_url TEXT,
  homepage_url TEXT,
  visibility TEXT DEFAULT 'public',
  total_downloads INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tool_versions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tool_id TEXT NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  manifest TEXT NOT NULL,
  raw_manifest TEXT,
  bundle_hash TEXT NOT NULL,
  bundle_size INTEGER NOT NULL,
  bundle_path TEXT NOT NULL,
  downloads INTEGER DEFAULT 0,
  yanked INTEGER DEFAULT 0,
  yank_reason TEXT,
  yank_replacement TEXT,
  yanked_at TEXT,
  published_by TEXT NOT NULL REFERENCES profiles(id),
  published_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tool_id, version)
);

CREATE TABLE IF NOT EXISTS attestations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tool_version_id TEXT NOT NULL REFERENCES tool_versions(id) ON DELETE CASCADE,
  auditor TEXT NOT NULL,
  auditor_provider TEXT,
  bundle TEXT NOT NULL,
  checksum_manifest TEXT,
  rekor_log_id TEXT NOT NULL,
  rekor_log_index INTEGER,
  signed_at TEXT NOT NULL,
  verified INTEGER DEFAULT 0,
  rekor_verified INTEGER DEFAULT 0,
  certificate_verified INTEGER DEFAULT 0,
  signature_verified INTEGER DEFAULT 0,
  verified_at TEXT,
  revoked INTEGER DEFAULT 0,
  revoked_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS download_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tool_version_id TEXT NOT NULL REFERENCES tool_versions(id) ON DELETE CASCADE,
  downloaded_at TEXT DEFAULT (datetime('now')),
  user_agent TEXT
);

-- Full-text search index
CREATE VIRTUAL TABLE IF NOT EXISTS tools_fts USING fts5(
  name, short_name, description, tags,
  content='tools',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS tools_ai AFTER INSERT ON tools BEGIN
  INSERT INTO tools_fts(rowid, name, short_name, description, tags)
  VALUES (new.rowid, new.name, new.short_name, new.description, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS tools_ad AFTER DELETE ON tools BEGIN
  INSERT INTO tools_fts(tools_fts, rowid, name, short_name, description, tags)
  VALUES ('delete', old.rowid, old.name, old.short_name, old.description, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS tools_au AFTER UPDATE ON tools BEGIN
  INSERT INTO tools_fts(tools_fts, rowid, name, short_name, description, tags)
  VALUES ('delete', old.rowid, old.name, old.short_name, old.description, old.tags);
  INSERT INTO tools_fts(rowid, name, short_name, description, tags)
  VALUES (new.rowid, new.name, new.short_name, new.description, new.tags);
END;
`;

let db: Database | null = null;

export function initDatabase(dataDir: string): Database {
  if (db) return db;

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = join(dataDir, "registry.db");
  db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  // Run schema
  db.exec(SCHEMA);

  return db;
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
