# @enactprotocol/server Architecture

## Overview

The `@enactprotocol/server` package implements the Enact registry backend as a Supabase application with Edge Functions, providing a complete registry API for tool publishing, attestation management, and trust configuration.

## Technology Stack

- **Supabase** - Backend platform with:
  - PostgreSQL database with Row Level Security (RLS)
  - Edge Functions (Deno runtime) for API endpoints
  - Built-in OAuth authentication
  - Realtime subscriptions (future)

- **Cloudflare R2** - Object storage for tool bundles
  - Compatible with AWS S3 API
  - Cost-effective for large files
  - Global CDN distribution

- **Sigstore** - Cryptographic verification
  - Integrated via `@enactprotocol/trust` package
  - Verifies attestations against Rekor transparency log
  - Validates Fulcio certificate chains

## Architecture Diagram

```
┌─────────────┐
│   Client    │
│  (@enactprotocol/   │
│    api)     │
└──────┬──────┘
       │
       ├── HTTP/REST ───────────────┐
       │                            │
       ▼                            ▼
┌──────────────────┐      ┌─────────────────┐
│  Edge Functions  │      │  Supabase Auth  │
│  (Deno Runtime)  │      │   (OAuth 2.0)   │
│                  │      │                 │
│  - Tools API     │      │  - GitHub       │
│  - Attestations  │      │  - Google       │
│  - Search        │      │  - Microsoft    │
└────────┬─────────┘      └─────────────────┘
         │
         ├── Read/Write ──────┐
         │                    │
         ▼                    ▼
┌─────────────────┐   ┌──────────────┐
│   PostgreSQL    │   │ Cloudflare R2│
│                 │   │   (Bundles)  │
│  - profiles     │   │              │
│  - tools        │   │  bundles/    │
│  - versions     │   │    alice/    │
│  - attestations │   │      utils/  │
│  - trust        │   │        *.gz  │
└─────────────────┘   └──────────────┘
```

## Database Schema

### Core Tables

**profiles** - User accounts (extends `auth.users`)
- `id` - UUID (FK to auth.users)
- `username` - Unique username
- `display_name` - Display name
- `avatar_url` - Avatar image URL
- `created_at` - Account creation timestamp

**tools** - Tool metadata
- `id` - UUID primary key
- `owner_id` - FK to profiles
- `name` - Full tool name (e.g., `alice/utils/greeter`)
- `short_name` - Name without owner (e.g., `utils/greeter`)
- `description` - Tool description
- `license` - SPDX license identifier
- `tags` - Array of tags for search
- `repository_url` - Source code repository
- `total_downloads` - Aggregate download count

**tool_versions** - Published versions
- `id` - UUID primary key
- `tool_id` - FK to tools
- `version` - Semantic version (e.g., `1.2.0`)
- `manifest` - Full tool manifest (JSONB)
- `readme` - Markdown documentation
- `bundle_hash` - SHA-256 of bundle (for verification)
- `bundle_size` - Size in bytes
- `bundle_path` - R2 storage key
- `downloads` - Download count for this version
- `yanked` - Whether version is yanked
- `yank_reason` - Optional reason for yank
- `yank_replacement` - Suggested replacement version

**attestations** - Auditor attestations with Sigstore bundles
- `id` - UUID primary key
- `tool_version_id` - FK to tool_versions
- `auditor` - Email from Sigstore certificate
- `auditor_provider` - OAuth provider (github, google, etc.)
- `bundle` - Full Sigstore bundle (JSONB) for offline verification
- `rekor_log_id` - Rekor transparency log ID
- `rekor_log_index` - Log entry index
- `signed_at` - Signature timestamp
- `verified` - Server verification result
- `revoked` - Whether attestation is revoked

**trusted_auditors** - User trust lists
- `user_id` - FK to profiles
- `auditor_identity` - Auditor identifier (email or provider:identity)
- `created_at` - When trust was added

**reports** - Security and quality reports
- `id` - UUID primary key
- `tool_version_id` - FK to tool_versions
- `reporter_id` - FK to profiles
- `severity` - `critical | high | medium | low`
- `category` - `security | malware | license | quality | other`
- `description` - Report details
- `evidence` - Supporting evidence
- `status` - `submitted | reviewing | confirmed | dismissed | resolved`

**download_logs** - Analytics (anonymized)
- `id` - UUID primary key
- `tool_version_id` - FK to tool_versions
- `downloaded_at` - Download timestamp
- `ip_hash` - Hashed IP address (privacy)
- `user_agent` - Client user agent

### Row Level Security (RLS)

All tables have RLS enabled with policies:

- **profiles** - Public read, users can update their own
- **tools** - Public read, owners can insert/update/delete their own
- **tool_versions** - Public read, owners can publish/yank
- **attestations** - Public read, authenticated users can submit, auditors can revoke
- **trusted_auditors** - Users can only see/manage their own trust list
- **reports** - Only visible to reporter and admins
- **download_logs** - No RLS (internal analytics only)

### Indexes

Performance indexes on:
- Tool names, tags, descriptions (with trigram GIN for full-text search)
- Version lookups with yanked filter
- Attestation lookups by tool_version and auditor
- Download logs by timestamp

## API Endpoints

### Tools Edge Function

**GET /tools/search?q={query}&limit={n}&offset={n}**
- Search for tools
- Returns paginated results

**POST /tools/{name}** (authenticated)
- Publish a tool version
- Multipart upload: manifest + bundle + readme
- Validates version doesn't exist
- Uploads bundle to R2
- Stores metadata in database

**GET /tools/{name}**
- Get tool metadata
- Returns all versions, tags, description, downloads

**DELETE /tools/{name}** (authenticated, owner only)
- Delete a tool and all its versions
- Cascade deletes versions, attestations, reports

**GET /tools/{name}/versions/{version}**
- Get version-specific info
- Includes manifest, attestations, bundle info

**GET /tools/{name}/versions/{version}/download**
- Download tool bundle
- Logs download for analytics
- Returns 410 Gone if yanked (unless `?acknowledge_yanked=true`)
- Redirects to R2 signed URL in production

**POST /tools/{name}/versions/{version}/yank** (authenticated, owner only)
- Mark version as yanked
- Optionally provide reason and replacement version

**POST /tools/{name}/versions/{version}/unyank** (authenticated, owner only)
- Un-yank a version

### Attestations Edge Function (TODO)

**GET /tools/{name}/versions/{version}/attestations**
- Get all attestations for a version
- Includes verification status

**POST /tools/{name}/versions/{version}/attestations** (authenticated)
- Submit an auditor attestation
- Server verifies Sigstore bundle against Rekor
- Extracts auditor email from certificate
- Stores bundle for client-side verification

**DELETE /tools/{name}/versions/{version}/attestations?auditor={email}** (authenticated, auditor only)
- Revoke an attestation
- Only the original auditor can revoke

**GET /tools/{name}/versions/{version}/trust/attestations/{auditor}**
- Get full Sigstore bundle for an attestation
- Used for client-side verification

### Authentication

OAuth authentication handled by Supabase Auth:
- GitHub: `/auth/v1/authorize?provider=github`
- Google: `/auth/v1/authorize?provider=google`
- Microsoft: `/auth/v1/authorize?provider=azure`

Returns JWT token used for subsequent API calls via `Authorization: Bearer {token}` header.

## Storage Layout

Bundles stored in R2 with this structure:

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

Each bundle is a `.tar.gz` containing:
```
tool-name-version/
├── enact.md          # or enact.yaml
├── src/              # Tool source code
├── package.json      # If applicable
└── README.md         # Documentation
```

## Security Features

1. **Row Level Security (RLS)**
   - Database-level access control
   - Ensures users can only access what they're authorized for

2. **JWT Authentication**
   - OAuth 2.0 via Supabase Auth
   - Tokens include user ID and email claims
   - Short-lived access tokens with refresh tokens

3. **Sigstore Verification**
   - Server verifies attestations against public Sigstore
   - Clients can independently verify bundles
   - Transparency via Rekor log

4. **Input Validation**
   - Tool names must match pattern
   - Versions must be valid semver
   - Bundle size limit: 50MB
   - Manifest validation before storage

5. **CORS Configuration**
   - Configured for web client access
   - Preflight handling in Edge Functions

## Performance Considerations

1. **Database Indexes**
   - All foreign keys indexed
   - Full-text search on tool descriptions
   - Trigram indexes for fuzzy search

2. **Caching**
   - R2 CDN for bundle downloads
   - Client-side caching with ETags
   - Database query caching (via Supabase)

3. **Rate Limiting**
   - Implemented at Edge Function level
   - Different limits per endpoint type
   - Headers indicate remaining quota

## Deployment

### Local Development

```bash
# Start Supabase
bun run db:start

# Apply migrations
bun run db:migrate

# Start Edge Functions
bun run dev
```

### Production (Supabase Cloud)

```bash
# Link project
supabase link --project-ref your-ref

# Push database schema
supabase db push

# Deploy Edge Functions
supabase functions deploy

# Set secrets
supabase secrets set R2_ACCOUNT_ID=xxx ...
```

## Future Enhancements

1. **Semantic Search**
   - Vector embeddings for tool descriptions
   - AI-powered search via OpenAI/Anthropic

2. **Webhooks**
   - Notify on tool publish, yank, attestation events
   - Integration with CI/CD systems

3. **Analytics Dashboard**
   - Download trends
   - Popular tools
   - Trust metrics

4. **Report Management**
   - Admin interface for reviewing reports
   - Automated vulnerability scanning
   - Integration with security databases

5. **Realtime Features**
   - Live download counts
   - Real-time attestation notifications
   - Collaborative tool editing

## References

- [Supabase Documentation](https://supabase.com/docs)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [Sigstore](https://www.sigstore.dev/)
