# @enactprotocol/server

Supabase-based registry server for Enact tools.

## Overview

This package implements the Enact registry backend using:
- **Supabase** for database, authentication, and Edge Functions
- **PostgreSQL** for relational data storage with RLS
- **R2/S3** for bundle storage
- **Sigstore** integration for attestation verification

## Architecture

### Database Schema

The registry uses the following tables:

- **profiles** - User profiles (extends Supabase auth.users)
- **tools** - Tool metadata
- **tool_versions** - Tool versions with manifests and bundle references
- **attestations** - Auditor attestations with Sigstore bundles
- **trusted_auditors** - User trust lists
- **reports** - Security and quality reports
- **download_logs** - Download analytics

See [supabase/migrations/](./supabase/migrations/) for the complete schema.

### Edge Functions

Supabase Edge Functions handle API endpoints:

- **tools** - Tool CRUD, versioning, downloads, yank operations
- **attestations** - Attestation submission and verification (TODO)
- **auth** - OAuth authentication (handled by Supabase Auth)

## Development

### Quick Start

See **[LOCAL-SETUP.md](./LOCAL-SETUP.md)** for complete local development setup with MinIO + Supabase.

**TL;DR:**
```bash
# Start everything (MinIO + Supabase)
bun run local:start

# Test storage
bun run storage:test

# Start Edge Functions
bun run dev
```

### Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- Docker (for MinIO and Supabase)
- Bun or Node.js

### Setup

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Start local Supabase:**
   ```bash
   bun run db:start
   ```

   This will start a local Supabase instance at `http://localhost:54321`.

3. **Apply migrations:**
   ```bash
   bun run db:migrate
   ```

4. **Start Edge Functions:**
   ```bash
   bun run dev
   ```

### Environment Variables

Create a `.env` file in the server package:

```env
# Supabase
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# R2/S3 Storage
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET=enact-bundles
R2_ENDPOINT=https://your-endpoint.r2.cloudflarestorage.com

# OAuth Providers
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Database Commands

```bash
# Start local Supabase
bun run db:start

# Stop local Supabase
bun run db:stop

# Reset database (drop all tables and reapply migrations)
bun run db:reset

# Apply migrations
bun run db:migrate
```

### Edge Functions

Edge Functions are deployed as Deno modules:

```bash
# Develop locally
bun run dev

# Deploy to Supabase
bun run deploy
```

## API Endpoints

### Tools

- `GET /tools/search?q={query}` - Search for tools
- `GET /tools/{name}` - Get tool metadata
- `POST /tools/{name}` - Publish a tool
- `DELETE /tools/{name}` - Delete a tool
- `GET /tools/{name}/versions/{version}` - Get version info
- `GET /tools/{name}/versions/{version}/download` - Download bundle
- `POST /tools/{name}/versions/{version}/yank` - Yank a version
- `POST /tools/{name}/versions/{version}/unyank` - Unyank a version

### Attestations (TODO)

- `GET /tools/{name}/versions/{version}/attestations` - Get attestations
- `POST /tools/{name}/versions/{version}/attestations` - Submit attestation
- `DELETE /tools/{name}/versions/{version}/attestations?auditor={email}` - Revoke attestation
- `GET /tools/{name}/versions/{version}/trust/attestations/{auditor}` - Get Sigstore bundle

### Authentication

Authentication is handled by Supabase Auth with OAuth providers:
- GitHub (`/auth/v1/authorize?provider=github`)
- Google (`/auth/v1/authorize?provider=google`)
- Microsoft (`/auth/v1/authorize?provider=azure`)

## Testing

```bash
# Run tests
bun test

# Run tests in watch mode
bun test --watch
```

## Deployment

### Supabase Cloud

1. **Create a Supabase project:**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project

2. **Link your project:**
   ```bash
   supabase link --project-ref your-project-ref
   ```

3. **Apply migrations:**
   ```bash
   supabase db push
   ```

4. **Deploy Edge Functions:**
   ```bash
   supabase functions deploy
   ```

5. **Set environment variables:**
   ```bash
   supabase secrets set R2_ACCOUNT_ID=xxx R2_ACCESS_KEY_ID=xxx ...
   ```

### R2 Storage

1. **Create a Cloudflare R2 bucket:**
   - Go to Cloudflare dashboard
   - Create a new R2 bucket named `enact-bundles`

2. **Create API token:**
   - Generate R2 API token with read/write permissions
   - Add credentials to Supabase secrets

## Security

- **Row Level Security (RLS)** enabled on all tables
- **OAuth authentication** via Supabase Auth
- **JWT tokens** for API authentication
- **Sigstore verification** for attestations
- **CORS** configured for web clients

## License

MIT
