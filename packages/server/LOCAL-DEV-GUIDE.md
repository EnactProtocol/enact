# Local Development Guide

This guide covers how to run the full Enact stack locally for development and testing.

## Quick Start

```bash
# 1. Start all services
cd packages/server
bun run local:start

# 2. Publish a test tool
cd packages/cli
ENACT_REGISTRY_URL=http://127.0.0.1:54321/functions/v1 \
  bun run dist/index.js publish ../examples/hello-js --skip-auth

# 3. Test the API
curl -s "http://127.0.0.1:54321/functions/v1/tools/testuser/hello-js" | jq
```

## Prerequisites

- **Docker** - For MinIO storage and Supabase
- **Bun** - JavaScript runtime
- **Supabase CLI** - `brew install supabase/tap/supabase`

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Local Development                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   CLI (packages/cli)                                         │
│     │                                                        │
│     │ ENACT_REGISTRY_URL=http://127.0.0.1:54321/functions/v1│
│     │ --skip-auth (uses default anon key)                   │
│     ▼                                                        │
│   Edge Functions (Supabase)                                  │
│     │ ENACT_DEV_MODE=true (bypasses auth)                   │
│     │ SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)              │
│     ▼                                                        │
│   PostgreSQL ◄──► MinIO (S3-compatible storage)             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Step-by-Step Setup

### 1. Start Supabase

```bash
cd packages/server
supabase start
```

This starts PostgreSQL, Kong gateway, and other Supabase services.

### 2. Start MinIO (Object Storage)

```bash
bun run storage:start
```

MinIO provides S3-compatible storage for tool bundles.
- Console: http://localhost:9001 (enact / enact123456)

### 3. Configure Environment

The environment file at `supabase/.env.local` should contain:

```bash
# Storage
R2_ENDPOINT=http://host.docker.internal:9000
R2_ACCESS_KEY_ID=enact
R2_SECRET_ACCESS_KEY=enact123456
R2_BUCKET=enact-bundles
R2_REGION=us-east-1

# Development Mode - CRITICAL for local publishing
ENACT_DEV_MODE=true

# Service Role Key - bypasses Row Level Security
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# OpenAI (optional - for semantic search)
OPENAI_API_KEY=your-key-here
```

### 4. Start Edge Functions

```bash
supabase functions serve --env-file supabase/.env.local
```

### 5. Seed Test Data (Optional)

The database includes a test user `testuser` with ID `550e8400-e29b-41d4-a716-446655440000`.

## Publishing Tools Locally

### Option 1: Using the CLI

```bash
cd packages/cli

# Build first if needed
bun run build

# Publish with local registry
ENACT_REGISTRY_URL=http://127.0.0.1:54321/functions/v1 \
  bun run dist/index.js publish ../examples/hello-js --skip-auth --verbose
```

**Important**: Tool names must start with a valid username (e.g., `testuser/my-tool`).

### Option 2: Using curl

```bash
# Create a test bundle
tar -czf bundle.tar.gz -C examples/hello-js .

# Publish
curl -X POST "http://127.0.0.1:54321/functions/v1/tools/testuser/my-tool" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  -F 'manifest={"name":"testuser/my-tool","version":"1.0.0","description":"Test"}' \
  -F "bundle=@bundle.tar.gz"
```

## Testing Endpoints

### Search Tools
```bash
curl -s "http://127.0.0.1:54321/functions/v1/tools/search?q=hello" \
  -H "Authorization: Bearer $ANON_KEY" | jq
```

### Get Tool Info
```bash
curl -s "http://127.0.0.1:54321/functions/v1/tools/testuser/hello-js" \
  -H "Authorization: Bearer $ANON_KEY" | jq
```

### List Files in Bundle
```bash
curl -s "http://127.0.0.1:54321/functions/v1/tools/testuser/hello-js/versions/1.0.0/files" \
  -H "Authorization: Bearer $ANON_KEY" | jq
```

### Get File Content
```bash
curl -s "http://127.0.0.1:54321/functions/v1/tools/testuser/hello-js/versions/1.0.0/files/hello.js" \
  -H "Authorization: Bearer $ANON_KEY"
```

## Environment Variables Reference

### CLI Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENACT_REGISTRY_URL` | Registry API URL | `https://siikwkfgsmouioodghho.supabase.co/functions/v1` |
| `ENACT_AUTH_TOKEN` | Auth token for publishing | (none) |
| `SUPABASE_ANON_KEY` | Anon key for `--skip-auth` | Local dev default |

### Server Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ENACT_DEV_MODE` | Enable dev mode (skip user auth) | For local dev |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypass RLS policies | For local dev |
| `R2_ENDPOINT` | MinIO/S3 endpoint | Yes |
| `R2_ACCESS_KEY_ID` | Storage access key | Yes |
| `R2_SECRET_ACCESS_KEY` | Storage secret key | Yes |
| `R2_BUCKET` | Storage bucket name | Yes |
| `OPENAI_API_KEY` | For semantic search embeddings | Optional |

## Troubleshooting

### "Missing authorization header"

The Supabase gateway requires an Authorization header. When using `--skip-auth`, the CLI automatically uses the default local anon key.

**Fix**: Ensure you're using `--skip-auth` flag or set `ENACT_AUTH_TOKEN`.

### "Row-level security policy violation"

RLS is blocking database writes.

**Fix**: Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in `supabase/.env.local` and `ENACT_DEV_MODE=true`.

### "Invalid tool name format"

Tool names must follow the pattern: `namespace/tool-name` or `namespace/category/tool-name`.

**Fix**: Use a valid namespace like `testuser/my-tool`.

### "Namespace mismatch"

In production, you can only publish under your own username.

**Fix**: In dev mode with `ENACT_DEV_MODE=true`, use `testuser` as namespace (or any username that exists in the profiles table).

### "Version already exists"

You're trying to publish a version that already exists.

**Fix**: Bump the version in your `enact.md` or `enact.yaml` manifest.

### Edge functions not picking up env changes

The edge runtime caches environment variables.

**Fix**: Restart the edge functions:
```bash
pkill -f "supabase functions serve"
supabase functions serve --env-file supabase/.env.local
```

## Suggested Improvements

### 1. Add a `dev` script to CLI

Add to `packages/cli/package.json`:
```json
{
  "scripts": {
    "dev:publish": "ENACT_REGISTRY_URL=http://127.0.0.1:54321/functions/v1 bun run dist/index.js publish --skip-auth"
  }
}
```

### 2. Create a root-level dev script

Add to root `package.json`:
```json
{
  "scripts": {
    "dev:server": "cd packages/server && supabase functions serve --env-file supabase/.env.local",
    "dev:web": "cd packages/web && bun run dev",
    "dev:all": "concurrently \"bun run dev:server\" \"bun run dev:web\""
  }
}
```

### 3. Auto-detect local development in CLI

The CLI could automatically detect when running against localhost and use appropriate defaults.

### 4. Docker Compose for full stack

Create a `docker-compose.dev.yml` that starts everything:
- Supabase (already has compose)
- MinIO
- Edge Functions
- Web dev server

### 5. Seed script for test data

Create `packages/server/scripts/seed-dev.ts`:
```typescript
// Seed test users and sample tools for development
```

## Viewing Logs

### Edge Function Logs
```bash
docker logs supabase_edge_runtime_server -f
```

### Kong Gateway Logs (HTTP requests)
```bash
docker logs supabase_kong_server -f
```

### Database Logs
```bash
docker logs supabase_db_server -f
```

## Web Development

To run the web app against local backend:

```bash
cd packages/web

# Set the API URL
echo "VITE_API_URL=http://127.0.0.1:54321/functions/v1" > .env.local

# Start dev server
bun run dev
```

The web app will be available at http://localhost:5173.
