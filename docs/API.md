# Enact API Specification

**Version:** 2.0.0  
**Base URL:** `https://siikwkfgsmouioodghho.supabase.co/functions/v1`

---

## Overview

| Resource | Endpoint | Purpose |
|----------|----------|---------|
| **Auth** | `/auth` | OAuth login, token management |
| **Tools** | `/tools` | Discovery, metadata, bundles, publishing |
| **Attestations** | `/tools/.../attestations` | Auditor attestations (Sigstore) |
| **Trust** | `/users/.../trust` | User trust configuration |
| **Feedback** | `/tools/.../feedback` | Community ratings (aggregates only) |
| **Users** | `/users` | Profiles and identity |
| **Reports** | `/tools/.../reports` | Security issue reporting |

### Authentication

Authentication uses OAuth via Supabase Auth. The CLI opens a browser for login and receives JWT tokens.

```
Authorization: Bearer <jwt_token>
```

Most read operations are public. Write operations require authentication.

### Tool Naming

Tools use hierarchical naming: `{username}/{path}/{tool}`

- `alice/utils/greeter`
- `bob/data/processors/csv`

Namespaces are tied directly to usernames. When a user creates an account with username `alice`, they automatically own the `alice/` namespace.

In the future, organization namespaces will be supported with an `@` prefix (e.g., `@acme-corp/tools/something`).

---

## Authentication

### Initiate Login

```
POST /auth/login
```

Start OAuth login flow.

**Request:**

```json
{
  "provider": "github",
  "redirect_uri": "http://localhost:9876/callback"
}
```

**Response:**

```json
{
  "auth_url": "https://github.com/login/oauth/authorize?..."
}
```

---

### OAuth Callback

```
POST /auth/callback
```

Exchange OAuth code for JWT tokens.

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
    "username": "alice",
    "email": "alice@example.com"
  }
}
```

---

### Refresh Token

```
POST /auth/refresh
```

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

---

### Get Current User

```
GET /auth/me
```

Requires authentication.

**Response:**

```json
{
  "id": "uuid",
  "username": "alice",
  "email": "alice@example.com",
  "namespaces": ["alice", "acme-corp"],
  "created_at": "2025-01-01T00:00:00Z"
}
```

---

## Tools

### Search Tools

```
GET /tools/search?q={query}
```

Semantic search using vector embeddings. Tool descriptions and documentation are embedded at publish time; queries are matched via cosine similarity.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query (semantic) |
| `tag` | string | Filter by tag (can be repeated) |
| `author` | string | Filter by author/namespace |
| `include_yanked` | boolean | Include yanked versions (default: false) |
| `limit` | integer | Max results (default: 20, max: 100) |
| `offset` | integer | Pagination offset |

**Response:**

```json
{
  "tools": [
    {
      "name": "alice/utils/greeter",
      "version": "1.2.0",
      "description": "Greets the user by name",
      "tags": ["utility", "text"],
      "author": {
        "username": "alice",
        "avatar_url": "https://..."
      },
      "downloads": 1203,
      "trust_status": {
        "auditor_count": 2
      }
    }
  ],
  "total": 47,
  "limit": 20,
  "offset": 0
}
```

---

### Get Tool

```
GET /tools/{name}
```

**Example:** `GET /tools/alice/utils/greeter`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `versions_limit` | integer | Max versions to return (default: 10, max: 100) |
| `versions_offset` | integer | Pagination offset for versions |
| `include_yanked` | boolean | Include yanked versions (default: false) |

**Response:**

```json
{
  "name": "alice/utils/greeter",
  "description": "Greets the user by name",
  "tags": ["utility", "text"],
  "license": "MIT",
  "author": {
    "username": "alice",
    "avatar_url": "https://..."
  },
  "repository": "https://github.com/alice/greeter",
  "created_at": "2025-01-10T10:30:00Z",
  "updated_at": "2025-01-15T14:20:00Z",
  "latest_version": "1.2.0",
  "versions": [
    {
      "version": "1.2.0",
      "published_at": "2025-01-20T14:00:00Z",
      "downloads": 500,
      "bundle_hash": "sha256:abc123...",
      "yanked": false
    },
    {
      "version": "1.1.0",
      "published_at": "2025-01-10T10:00:00Z",
      "downloads": 734,
      "bundle_hash": "sha256:def456...",
      "yanked": false
    }
  ],
  "versions_total": 5,
  "total_downloads": 1234
}
```

---

### List Versions

```
GET /tools/{name}/versions
```

List all versions for a tool with full pagination support.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | integer | Max versions to return (default: 20, max: 100) |
| `offset` | integer | Pagination offset |
| `include_yanked` | boolean | Include yanked versions (default: false) |
| `sort` | string | Sort order: `newest` (default), `oldest`, `downloads` |

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

---

### Get Version

```
GET /tools/{name}/versions/{version}
```

**Example:** `GET /tools/alice/utils/greeter/versions/1.2.0`

**Response:**

```json
{
  "name": "alice/utils/greeter",
  "version": "1.2.0",
  "description": "Greets the user by name",
  "license": "MIT",
  "yanked": false,
  "manifest": {
    "enact": "2.0.0",
    "name": "alice/utils/greeter",
    "version": "1.2.0",
    "from": "alpine:latest",
    "command": "echo 'Hello, ${name}!'",
    "timeout": "30s",
    "inputSchema": {
      "type": "object",
      "properties": {
        "name": { "type": "string" }
      },
      "required": ["name"]
    }
  },
  "bundle": {
    "hash": "sha256:abc123...",
    "size": 12345,
    "download_url": "https://r2.enact.tools/bundles/alice/utils/greeter/1.2.0.tar.gz"
  },
  "attestations": [
    {
      "auditor": "security@example.com",
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
  "published_at": "2025-01-15T14:20:00Z",
  "downloads": 450
}
```

**Yanked version response:**

When a version is yanked, it remains accessible but includes warnings:

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

---

### Download Bundle

```
GET /tools/{name}/versions/{version}/download
```

Get bundle download URL.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `acknowledge_yanked` | boolean | Must be `true` to download yanked versions |

**Response (normal):** `302 Redirect` to bundle URL

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

**Response (with signed URL):**

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

## Publishing

### Publish Tool

```
POST /tools/{name}
```

Publish a new tool or version. Requires authentication. User must own the namespace (username must match).

**Request:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `manifest` | JSON | Tool manifest |
| `bundle` | file | Tool bundle (tar.gz, max 50MB) |
| `readme` | string | Optional README content |

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

---

### Yank Version

```
POST /tools/{name}/versions/{version}/yank
```

Soft-delete a version. Yanked versions remain downloadable but are excluded from resolution by default.

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
  "yanked_at": "2025-01-22T10:00:00Z"
}
```

---

### Unyank Version

```
POST /tools/{name}/versions/{version}/unyank
```

Restore a yanked version.

**Response:**

```json
{
  "yanked": false,
  "version": "1.1.0",
  "unyanked_at": "2025-01-23T10:00:00Z"
}
```

---

## Attestations

Attestations are auditor endorsements: a trusted third party signs a statement that they've reviewed a tool version and consider it safe. The registry verifies attestations against Sigstore infrastructure and lets clients filter tools based on their trust configuration.

### Get Attestations

```
GET /tools/{name}/versions/{version}/attestations
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | integer | Max results (default: 20, max: 100) |
| `offset` | integer | Pagination offset |

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

---

### Get Attestation Bundle

```
GET /tools/{name}/versions/{version}/trust/attestations/{auditor}
```

Get the complete Sigstore bundle for a specific attestation. This is needed for client-side verification using the local trust system.

**Important Security Note**: Never trust the registry's `verification.verified` field. Always verify attestations locally using this bundle endpoint and the `@enactprotocol/trust` package to check against Rekor transparency log.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `auditor` | string | URL-encoded auditor email |

**Response:**

```json
{
  "$schema": "https://sigstore.dev/bundle/v1",
  "mediaType": "application/vnd.dev.sigstore.bundle.v0.3+json",
  "verificationMaterial": {
    "certificate": "...",
    "tlogEntries": [
      {
        "logIndex": 123789,
        "logId": "..."
      }
    ]
  },
  "messageSignature": {
    "signature": "..."
  }
}
```

---

### Submit Attestation

```
POST /tools/{name}/versions/{version}/attestations
```

Submit a signed attestation. Requires authentication. Server performs full verification against Rekor and Fulcio before accepting.

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

---

### Revoke Attestation

```
DELETE /tools/{name}/versions/{version}/attestations?auditor={email}
```

Revoke an attestation. Requires authentication. Only the original auditor can revoke their attestation.

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

## Trust

Users configure which auditors they trust. Clients can filter tools to only use those attested by trusted auditors.

### Get User Trust

```
GET /users/{username}/trust
```

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

---

### Update Trust Configuration

```
PUT /users/me/trust
```

Requires authentication.

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

## Feedback

Community signals. Public reads return aggregates only; raw reviews visible to tool author only.

### Get Feedback

```
GET /tools/{name}/feedback
```

**Response:**

```json
{
  "rating": 4.2,
  "rating_count": 47,
  "downloads": 1203
}
```

---

### Submit Feedback

```
POST /tools/{name}/feedback
```

Submit a rating/review. Requires authentication. Content visible only to tool author.

**Request Body:**

```json
{
  "rating": 5,
  "version": "1.2.0",
  "comment": "Works great!"
}
```

**Response:** `201 Created`

---

### Get Reviews (Author Only)

```
GET /tools/{name}/feedback/reviews
```

Requires authentication and tool ownership.

**Response:**

```json
{
  "reviews": [
    {
      "user": "bob",
      "rating": 5,
      "version": "1.2.0",
      "comment": "Works great!",
      "submitted_at": "2025-01-17T12:00:00Z"
    }
  ]
}
```

---

## Users

### Get User Profile

```
GET /users/{username}
```

**Response:**

```json
{
  "username": "alice",
  "display_name": "Alice Developer",
  "avatar_url": "https://enact.tools/avatars/alice.png",
  "created_at": "2024-06-15T10:00:00Z",
  "tools_published": 12
}
```

---

## Reports

### Submit Report

```
POST /tools/{name}/versions/{version}/reports
```

Report a security issue or concern. Requires authentication.

**Request:**

```json
{
  "severity": "critical",
  "category": "security",
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

---

## Errors

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Tool not found: alice/utils/missing",
    "details": { }
  }
}
```

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `BAD_REQUEST` | Invalid request |
| 401 | `UNAUTHORIZED` | Authentication required |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Already exists |
| 410 | `VERSION_YANKED` | Version has been yanked (with details) |
| 413 | `BUNDLE_TOO_LARGE` | Bundle exceeds 50MB limit |
| 422 | `VALIDATION_ERROR` | Invalid request data |
| 422 | `ATTESTATION_VERIFICATION_FAILED` | Sigstore verification failed |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| Search | 100/min |
| Download | 1000/min |
| Publish | 10/min |
| Auth | 20/min |

Headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 998
X-RateLimit-Reset: 1705500000
```

---

## References

- [SPEC.md](SPEC.md) — Protocol specification
- [REGISTRY-SPEC.md](REGISTRY-SPEC.md) — Registry API specification (detailed)
- [TRUST.md](TRUST.md) — Trust system documentation
- [COMMANDS.md](COMMANDS.md) — CLI reference