# Enact Registry API Specification v2

This document specifies the HTTP API endpoints that the Enact registry (enact.tools) must implement. The registry uses Supabase for metadata/auth and Cloudflare R2 (or S3-compatible) for bundle storage.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        enact.tools                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐                           │
│  │   Supabase   │    │ Cloudflare   │                           │
│  │              │    │     R2       │                           │
│  │ - Users      │    │              │                           │
│  │ - Tools      │    │ - Bundles    │                           │
│  │ - Versions   │    │   (.tar.gz)  │                           │
│  │ - Auditor    │    │              │                           │
│  │   attestation│    │              │                           │
│  │   refs       │    │              │                           │
│  │ - Trust      │    │              │                           │
│  └──────────────┘    └──────────────┘                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ References (log IDs)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Public Sigstore Infrastructure                   │
│                      (not run by us)                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐                           │
│  │   Fulcio     │    │    Rekor     │                           │
│  │              │    │              │                           │
│  │ fulcio.      │    │ rekor.       │                           │
│  │ sigstore.dev │    │ sigstore.dev │                           │
│  │              │    │              │                           │
│  │ Certificate  │    │ Transparency │                           │
│  │ Authority    │    │ Log          │                           │
│  └──────────────┘    └──────────────┘                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Namespaces

Namespaces are tied directly to user accounts. When a user creates an account with username `alice`, they automatically own the `alice/` namespace and can publish tools like `alice/utils/greeter`.

In the future, organization namespaces will be supported with an `@` prefix (e.g., `@acme-corp/tools/something`). Organization members can publish to the org namespace.

## Base URL

```
https://siikwkfgsmouioodghho.supabase.co/functions/v1
```

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

Tokens are obtained via Supabase Auth (OAuth with GitHub, Google, etc.).

---

## Endpoints

### Authentication

#### `POST /auth/login`

Initiate OAuth login flow. Returns a URL to redirect the user to.

**Request:**
```json
{
  "provider": "github" | "google" | "microsoft",
  "redirect_uri": "http://localhost:9876/callback"
}
```

**Response:**
```json
{
  "auth_url": "https://github.com/login/oauth/authorize?..."
}
```

#### `POST /auth/callback`

Exchange OAuth code for JWT token.

**Request:**
```json
{
  "provider": "github",
  "code": "abc123..."
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "expires_in": 3600,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "alice",
    "avatar_url": "https://...",
    "identities": [
      {
        "provider": "github",
        "id": "12345",
        "email": "alice@github.com"
      }
    ]
  }
}
```

#### `POST /auth/refresh`

Refresh an expired access token.

**Request:**
```json
{
  "refresh_token": "eyJ..."
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "expires_in": 3600
}
```

#### `GET /auth/me`

Get current user info. **Requires auth.**

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "alice",
  "avatar_url": "https://...",
  "namespaces": ["alice", "acme-corp"],
  "created_at": "2025-01-01T00:00:00Z"
}
```

---

### Tools

#### `GET /tools/search`

Search for tools.

**Query Parameters:**
- `q` - Search query (searches name, description, tags)
- `tag` - Filter by tag (can be repeated)
- `author` - Filter by author/namespace
- `include_yanked` - Include yanked versions (default: false)
- `limit` - Max results (default: 20, max: 100)
- `offset` - Pagination offset

**Response:**
```json
{
  "tools": [
    {
      "name": "alice/utils/greeter",
      "version": "1.2.0",
      "description": "A friendly greeting tool",
      "tags": ["greeting", "utils"],
      "author": {
        "username": "alice",
        "avatar_url": "https://..."
      },
      "downloads": 1234,
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-01-20T14:00:00Z",
      "trust_status": {
        "auditor_count": 2
      }
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

#### `GET /tools/:namespace/:name`

Get tool metadata. Name can include nested paths (e.g., `alice/utils/greeter`).

**Query Parameters:**
- `versions_limit` - Max versions to return (default: 10, max: 100)
- `versions_offset` - Pagination offset for versions
- `include_yanked` - Include yanked versions (default: false)

**Response:**
```json
{
  "name": "alice/utils/greeter",
  "description": "A friendly greeting tool",
  "license": "MIT",
  "tags": ["greeting", "utils"],
  "author": {
    "username": "alice",
    "avatar_url": "https://..."
  },
  "repository": "https://github.com/alice/greeter",
  "homepage": "https://greeter.example.com",
  "versions": [
    {
      "version": "1.2.0",
      "published_at": "2025-01-20T14:00:00Z",
      "downloads": 500,
      "bundle_hash": "sha256:abc123...",
      "bundle_size": 12345,
      "yanked": false
    },
    {
      "version": "1.1.0",
      "published_at": "2025-01-10T10:00:00Z",
      "downloads": 734,
      "bundle_hash": "sha256:def456...",
      "bundle_size": 12000,
      "yanked": false
    }
  ],
  "versions_total": 5,
  "versions_limit": 10,
  "versions_offset": 0,
  "latest_version": "1.2.0",
  "total_downloads": 1234,
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-20T14:00:00Z"
}
```

#### `GET /tools/:namespace/:name/versions`

List all versions for a tool with full pagination support.

**Query Parameters:**
- `limit` - Max versions to return (default: 20, max: 100)
- `offset` - Pagination offset
- `include_yanked` - Include yanked versions (default: false)
- `sort` - Sort order: `newest` (default), `oldest`, `downloads`

**Response:**
```json
{
  "tool_name": "alice/utils/greeter",
  "versions": [
    {
      "version": "1.2.0",
      "published_at": "2025-01-20T14:00:00Z",
      "downloads": 500,
      "bundle_hash": "sha256:abc123...",
      "bundle_size": 12345,
      "yanked": false,
      "attestation_summary": {
        "auditor_count": 2
      }
    }
  ],
  "total": 15,
  "limit": 20,
  "offset": 0
}
```

#### `GET /tools/:namespace/:name/:version`

Get specific version metadata.

**Response:**
```json
{
  "name": "alice/utils/greeter",
  "version": "1.2.0",
  "description": "A friendly greeting tool",
  "license": "MIT",
  "tags": ["greeting", "utils"],
  "yanked": false,
  "yank_reason": null,
  "manifest": {
    "enact": "2.0.0",
    "name": "alice/utils/greeter",
    "version": "1.2.0",
    "description": "A friendly greeting tool",
    "from": "node:18-alpine",
    "inputSchema": { },
    "outputSchema": { },
    "command": "node /workspace/index.js ${name}"
  },
  "bundle": {
    "hash": "sha256:abc123...",
    "size": 12345,
    "download_url": "https://r2.enact.tools/bundles/alice/utils/greeter/1.2.0.tar.gz"
  },
  "attestations": [
    {
      "auditor": "security-auditor@example.com",
      "auditor_provider": "google",
      "signed_at": "2025-01-21T10:00:00Z",
      "rekor_log_id": "def456...",
      "verified": true
    }
  ],
  "published_by": {
    "username": "alice",
    "avatar_url": "https://..."
  },
  "published_at": "2025-01-20T14:00:00Z",
  "downloads": 500
}
```

**Yanked version response:**

When a version is yanked, it remains accessible (for reproducible builds) but includes warnings:

```json
{
  "name": "alice/utils/greeter",
  "version": "1.1.0",
  "yanked": true,
  "yank_reason": "Security vulnerability CVE-2025-1234",
  "yank_replacement": "1.2.0",
  "yanked_at": "2025-01-22T10:00:00Z",
  "...": "..."
}
```

**Response Headers for yanked versions:**
```
X-Enact-Yanked: true
X-Enact-Yank-Reason: Security vulnerability CVE-2025-1234
X-Enact-Yank-Replacement: 1.2.0
Warning: 299 - "This version has been yanked. Consider upgrading to 1.2.0"
```

#### `GET /tools/:namespace/:name/:version/manifest`

Get just the manifest for a version.

**Response:**
```json
{
  "enact": "2.0.0",
  "name": "alice/utils/greeter",
  "version": "1.2.0",
  "description": "A friendly greeting tool",
  "from": "node:18-alpine",
  "inputSchema": { },
  "outputSchema": { },
  "command": "node /workspace/index.js ${name}"
}
```

#### `GET /tools/:namespace/:name/:version/download`

Get bundle download URL.

**Query Parameters:**
- `acknowledge_yanked` - Must be `true` to download yanked versions

**Response (normal):** `302 Redirect` to:
```
https://r2.enact.tools/bundles/alice/utils/greeter/1.2.0.tar.gz
```

**Response (yanked without acknowledgment):**
```json
{
  "error": {
    "code": "VERSION_YANKED",
    "message": "Version 1.1.0 has been yanked",
    "details": {
      "reason": "Security vulnerability CVE-2025-1234",
      "replacement": "1.2.0",
      "yanked_at": "2025-01-22T10:00:00Z",
      "download_anyway": "Add ?acknowledge_yanked=true to proceed"
    }
  }
}
```

**Response (yanked with acknowledgment):** `302 Redirect` with warning headers.

Or direct response with signed URL:
```json
{
  "download_url": "https://r2.enact.tools/bundles/...?signature=...",
  "expires_at": "2025-01-20T15:00:00Z",
  "hash": "sha256:abc123...",
  "size": 12345,
  "yanked": false
}
```

---

### Publishing

#### `POST /tools/:namespace/:name`

Publish a new tool or version. **Requires auth.**

User must own the namespace (username must match) or have org publish permissions (future).

**Request (multipart/form-data):**
- `manifest` - JSON manifest
- `bundle` - Tool bundle (tar.gz, max 50MB)
- `readme` - Optional README content

**Response:**
```json
{
  "name": "alice/utils/greeter",
  "version": "1.2.0",
  "bundle_hash": "sha256:abc123...",
  "bundle_size": 12345,
  "download_url": "https://r2.enact.tools/bundles/...",
  "published_at": "2025-01-20T14:00:00Z"
}
```

**Error (bundle too large):**
```json
{
  "error": {
    "code": "BUNDLE_TOO_LARGE",
    "message": "Bundle exceeds 50MB limit",
    "details": {
      "max_size": 52428800,
      "actual_size": 62914560
    }
  }
}
```

#### `POST /tools/:namespace/:name/:version/yank`

Yank (soft-delete) a version. **Requires auth.**

Yanked versions remain downloadable (for reproducibility) but are excluded from version listings by default and show warnings.

**Request:**
```json
{
  "reason": "Security vulnerability CVE-2025-1234",
  "replacement_version": "1.2.0"
}
```

**Response:**
```json
{
  "yanked": true,
  "version": "1.1.0",
  "reason": "Security vulnerability CVE-2025-1234",
  "replacement_version": "1.2.0",
  "yanked_at": "2025-01-22T10:00:00Z",
  "message": "Version 1.1.0 has been yanked. Users will be warned and directed to 1.2.0."
}
```

#### `POST /tools/:namespace/:name/:version/unyank`

Restore a yanked version. **Requires auth.**

**Response:**
```json
{
  "yanked": false,
  "version": "1.1.0",
  "unyanked_at": "2025-01-23T10:00:00Z"
}
```

---

### Attestations

Attestations are simple auditor endorsements: a trusted third party signs a statement that they've reviewed a tool version and consider it safe. The registry stores these attestations and lets clients filter tools based on their own trust configuration.

#### `GET /tools/:namespace/:name/:version/attestations`

Get all auditor attestations for a version.

**Query Parameters:**
- `limit` - Max results (default: 20, max: 100)
- `offset` - Pagination offset

**Response:**
```json
{
  "attestations": [
    {
      "auditor": "security@example.com",
      "auditor_provider": "google",
      "signed_at": "2025-01-21T10:00:00Z",
      "rekor_log_id": "def456...",
      "rekor_log_index": 12345679,
      "verification": {
        "verified": true,
        "verified_at": "2025-01-21T10:00:03Z",
        "rekor_verified": true,
        "certificate_verified": true,
        "signature_verified": true
      }
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

#### `POST /tools/:namespace/:name/:version/attestations`

Submit an auditor attestation. **Requires auth.**

The attestation must be a valid Sigstore bundle. The server verifies it against the public Sigstore infrastructure (Rekor + Fulcio) using the `@sigstore/verify` library with cached TUF trust roots.

**Request:**
```json
{
  "bundle": {
    "$schema": "https://sigstore.dev/bundle/v1",
    "mediaType": "application/vnd.dev.sigstore.bundle.v0.3+json",
    "verificationMaterial": { },
    "messageSignature": { }
  }
}
```

**Response (success):**
```json
{
  "auditor": "security@example.com",
  "auditor_provider": "google",
  "signed_at": "2025-01-21T10:00:00Z",
  "rekor_log_id": "def456...",
  "rekor_log_index": 12345679,
  "verification": {
    "verified": true,
    "verified_at": "2025-01-21T10:00:03Z",
    "rekor_verified": true,
    "certificate_verified": true,
    "signature_verified": true
  }
}
```

**Response (verification failed):**
```json
{
  "error": {
    "code": "ATTESTATION_VERIFICATION_FAILED",
    "message": "Certificate chain invalid",
    "details": {
      "rekor_verified": true,
      "certificate_verified": false,
      "signature_verified": false
    }
  }
}
```

#### `DELETE /tools/:namespace/:name/:version/attestations`

Revoke an attestation. **Requires auth.** Only the original auditor can revoke their attestation.

**Query Parameters:**
- `auditor` - Email of the auditor (required)

**Example:** `DELETE /tools/alice/utils/greeter/1.2.0/attestations?auditor=security@example.com`

**Response:**
```json
{
  "auditor": "security@example.com",
  "revoked": true,
  "revoked_at": "2025-01-22T10:00:00Z"
}
```

---

### Trust

Users configure which auditors they trust. When fetching tools, clients can filter to only use tools that have been attested by a trusted auditor.

#### `GET /users/:username/trust`

Get a user's trust configuration (public).

**Response:**
```json
{
  "username": "alice",
  "trusted_auditors": [
    {
      "identity": "security@example.com",
      "added_at": "2025-01-10T00:00:00Z"
    },
    {
      "identity": "bob@github.com",
      "added_at": "2025-01-15T00:00:00Z"
    }
  ]
}
```

#### `PUT /users/me/trust`

Update current user's trust configuration. **Requires auth.**

**Request:**
```json
{
  "trusted_auditors": ["security@example.com", "bob@github.com"]
}
```

**Response:**
```json
{
  "trusted_auditors": [
    {
      "identity": "security@example.com",
      "added_at": "2025-01-10T00:00:00Z"
    },
    {
      "identity": "bob@github.com",
      "added_at": "2025-01-21T12:00:00Z"
    }
  ],
  "updated_at": "2025-01-21T12:00:00Z"
}
```

---

### Reports

#### `POST /tools/:namespace/:name/:version/reports`

Report a security issue or concern. **Requires auth.**

**Request:**
```json
{
  "severity": "critical" | "high" | "medium" | "low",
  "category": "security" | "malware" | "license" | "quality" | "other",
  "description": "This tool contains a hardcoded API key...",
  "evidence": "Line 45 of index.js contains..."
}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "submitted",
  "created_at": "2025-01-21T12:00:00Z"
}
```

#### `GET /tools/:namespace/:name/:version/reports`

Get reports for a version (admin only or report owner).

---

### Users

#### `GET /users/:username`

Get user profile and public info.

**Response:**
```json
{
  "username": "alice",
  "display_name": "Alice Smith",
  "avatar_url": "https://...",
  "tools_count": 15,
  "created_at": "2025-01-01T00:00:00Z"
}
```

---

## Database Schema (Supabase)

### Tables

```sql
-- Users (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tools (namespace is derived from owner's username)
CREATE TABLE public.tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) NOT NULL,
  name TEXT NOT NULL,  -- Full name like "alice/utils/greeter"
  short_name TEXT NOT NULL,  -- Just "utils/greeter"
  description TEXT,
  license TEXT,
  tags TEXT[],
  repository_url TEXT,
  homepage_url TEXT,
  total_downloads INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (owner_id, short_name)
);

-- Tool versions
CREATE TABLE public.tool_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID REFERENCES tools(id) NOT NULL,
  version TEXT NOT NULL,
  manifest JSONB NOT NULL,
  readme TEXT,
  bundle_hash TEXT NOT NULL,
  bundle_size INTEGER NOT NULL,
  bundle_path TEXT NOT NULL,
  downloads INTEGER DEFAULT 0,
  yanked BOOLEAN DEFAULT FALSE,
  yank_reason TEXT,
  yank_replacement TEXT,
  yanked_at TIMESTAMPTZ,
  published_by UUID REFERENCES profiles(id) NOT NULL,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tool_id, version)
);

-- Auditor attestations (simple: who vouched for what)
CREATE TABLE public.attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_version_id UUID REFERENCES tool_versions(id) NOT NULL,
  auditor TEXT NOT NULL,  -- email from Sigstore certificate
  auditor_provider TEXT,  -- github, google, etc.
  bundle JSONB NOT NULL,  -- Sigstore bundle for offline verification
  rekor_log_id TEXT NOT NULL,
  rekor_log_index BIGINT,
  signed_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tool_version_id, auditor)  -- One attestation per auditor per version
);

-- Trust relationships (who does this user trust as auditors)
CREATE TABLE public.trusted_auditors (
  user_id UUID REFERENCES profiles(id),
  auditor_identity TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, auditor_identity)
);

-- Reports
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_version_id UUID REFERENCES tool_versions(id) NOT NULL,
  reporter_id UUID REFERENCES profiles(id) NOT NULL,
  severity TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence TEXT,
  status TEXT DEFAULT 'submitted',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Download stats (for analytics)
CREATE TABLE public.download_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_version_id UUID REFERENCES tool_versions(id) NOT NULL,
  downloaded_at TIMESTAMPTZ DEFAULT NOW(),
  ip_hash TEXT,
  user_agent TEXT
);

-- Indexes
CREATE INDEX idx_tools_owner ON tools(owner_id);
CREATE INDEX idx_tools_name ON tools(name);
CREATE INDEX idx_tool_versions_tool ON tool_versions(tool_id);
CREATE INDEX idx_tool_versions_not_yanked ON tool_versions(tool_id) WHERE NOT yanked;
CREATE INDEX idx_attestations_tool_version ON attestations(tool_version_id);
CREATE INDEX idx_attestations_auditor ON attestations(auditor);
```

### Row Level Security (RLS)

```sql
-- Anyone can read tools and versions
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tools are viewable by everyone" ON tools FOR SELECT USING (true);

-- Only owner can insert/update their tools
CREATE POLICY "Owners can manage their tools" ON tools 
  FOR ALL USING (owner_id = auth.uid());

-- Attestations are public, but only auditor can revoke
ALTER TABLE attestations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attestations are viewable by everyone" ON attestations FOR SELECT USING (true);
```

---

## R2/S3 Storage Structure

```
bundles/
├── alice/
│   └── utils/
│       └── greeter/
│           ├── 1.0.0.tar.gz
│           ├── 1.1.0.tar.gz
│           └── 1.2.0.tar.gz
├── bob/
│   └── tools/
│       └── converter/
│           └── 2.0.0.tar.gz
```

### Bundle Format

The `.tar.gz` bundle contains:
```
greeter-1.2.0/
├── enact.md          # Manifest file
├── index.js          # Tool code
├── package.json      # Dependencies (if applicable)
└── README.md         # Documentation
```

---

## Verification Flow

### Attestation Verification

When an auditor attestation is submitted, the server verifies it using `@sigstore/verify` with cached TUF trust roots from the public Sigstore instance:

1. **Rekor Verification** - Validate the inclusion proof against the transparency log
2. **Certificate Verification** - Validate the certificate chain against Fulcio root CA
3. **Signature Verification** - Verify the signature matches the tool version's bundle hash

The server caches TUF trust roots locally and updates them periodically. No live queries to Rekor are required at verification time since Sigstore bundles are self-contained.

### Bundle Upload Verification

When a bundle is published, the server:

1. **Hash Verification** - Compute SHA-256 of uploaded file, store as `bundle_hash`
2. **Size Verification** - Check file size is under 50MB limit
3. **Format Verification** - Validate tar.gz structure, confirm manifest exists

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Tool not found: alice/nonexistent",
    "details": { }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `FORBIDDEN` | 403 | User lacks permission |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Version already exists |
| `VERSION_YANKED` | 410 | Version has been yanked (with details) |
| `VALIDATION_ERROR` | 422 | Invalid request data |
| `BUNDLE_TOO_LARGE` | 413 | Bundle exceeds 50MB limit |
| `ATTESTATION_VERIFICATION_FAILED` | 422 | Sigstore verification failed |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| Search | 100/min |
| Download | 1000/min |
| Publish | 10/min |
| Auth | 20/min |

---

## Webhooks (Future)

The registry can notify external services of events:

- `tool.published` - New version published
- `tool.yanked` - Version yanked
- `tool.unyanked` - Version restored
- `attestation.created` - New auditor attestation added
- `attestation.revoked` - Auditor attestation revoked
- `report.created` - New report submitted

---

## CLI Integration

The `@enactprotocol/api` package implements this spec:

```typescript
import { createApiClient } from '@enactprotocol/api';
import semver from 'semver';

const api = createApiClient({
  baseUrl: 'https://siikwkfgsmouioodghho.supabase.co/functions/v1',
  token: 'eyJ...'
});

// Search
const results = await api.search({ query: 'greeting', tags: ['utils'] });

// Get versions and resolve client-side
const tool = await api.getTool('alice/utils/greeter');
const resolved = semver.maxSatisfying(
  tool.versions.filter(v => !v.yanked).map(v => v.version),
  '^1.0.0'
);

// Download (handles yanked version warnings)
const bundle = await api.downloadBundle('alice/utils/greeter', resolved);

// Publish (single POST, max 50MB)
const published = await api.publish('alice/utils/greeter', {
  manifest,
  bundle: bundleBuffer,
  readme
});

// Submit auditor attestation (server verifies via Sigstore)
const attestation = await api.submitAttestation('alice/utils/greeter', '1.2.0', {
  bundle: sigstoreBundle
});
console.log(attestation.verified); // true

// Revoke attestation (by auditor email)
await api.revokeAttestation('alice/utils/greeter', '1.2.0', 'security@example.com');

// Check if tool has attestation from trusted auditor
const trustedAuditors = ['security@example.com', 'bob@github.com'];
const attestations = await api.getAttestations('alice/utils/greeter', '1.2.0');
const isTrusted = attestations.some(a => trustedAuditors.includes(a.auditor));
```

---

## Changelog from v1

- **Simplified namespace model** - Namespaces are tied to usernames, no explicit creation needed
- **Removed publisher attestations** - Registry already knows who published via OAuth; attestations are now auditor-only
- **Simplified auditor attestations** - Just "who vouched for this tool", no complex predicate types
- **Attestation revocation by email** - No internal UUIDs exposed, revoke via `?auditor=email`
- **Single-POST publish** - Simple multipart upload for bundles under 50MB (covers 99% of cases)
- **Client-side version resolution** - Fetch versions list, resolve locally with `semver` package
- **Added `/tools/:namespace/:name/versions`** - Dedicated paginated endpoint for listing versions
- **Yanking semantics clarified** - Yanked versions return 200 with warning headers, not 404
- **Added `?acknowledge_yanked=true`** - Required parameter to download yanked versions
- **Offline Sigstore verification** - Uses `@sigstore/verify` with cached TUF trust roots
- **Added pagination to version lists** - `versions_limit`, `versions_offset` on tool metadata
- **Added `published_by`** - Version responses include who published
- **Added yank metadata** - `yank_reason`, `yank_replacement`, `yanked_at` fields
- **Future: Organization namespaces** - Will use `@` prefix (e.g., `@acme-corp/tools/thing`)