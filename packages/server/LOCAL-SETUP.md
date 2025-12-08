# Local Development Setup

This guide walks you through setting up a complete local development environment for the Enact registry server.

## Prerequisites

- **Docker** - For running MinIO (S3-compatible storage)
- **Bun** - JavaScript runtime (already installed)
- **Supabase CLI** - For local database and Edge Functions

Install Supabase CLI if you haven't already:
```bash
brew install supabase/tap/supabase
```

## Quick Start

```bash
# 1. Start everything (MinIO + Supabase)
cd packages/server
bun run local:start

# 2. Test storage integration
bun run storage:test

# 3. Start Edge Functions dev server
bun run dev
```

## Detailed Setup

### 1. Start MinIO (S3-Compatible Storage)

MinIO provides local S3-compatible object storage for testing bundles.

```bash
# Start MinIO container
bun run storage:start

# Check status
docker ps --filter name=enact-minio

# View logs
bun run storage:logs
```

**MinIO Web Console**: http://localhost:9001
- **Username**: `enact`
- **Password**: `enact123456`

The `enact-bundles` bucket is automatically created on startup.

### 2. Start Supabase (Database + Edge Functions)

Supabase provides PostgreSQL database and Edge Functions runtime.

```bash
# Start Supabase (from packages/server)
supabase start

# This will output:
# - API URL: http://localhost:54321
# - Database URL: postgresql://...
# - anon key
# - service_role key
# - JWT secret
```

**Important**: Copy the `anon key` and `service_role key` to your `.env.local` file.

### 3. Configure Environment Variables

Create `.env.local` from the example:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Supabase keys:

```bash
# MinIO (already configured)
R2_ENDPOINT=http://localhost:9000
R2_ACCESS_KEY_ID=enact
R2_SECRET_ACCESS_KEY=enact123456
R2_BUCKET=enact-bundles
R2_REGION=us-east-1

# Supabase (get these from 'supabase start' output)
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<paste-anon-key-here>
SUPABASE_SERVICE_ROLE_KEY=<paste-service-role-key-here>
JWT_SECRET=<paste-jwt-secret-here>
```

**Edge Functions**: Environment variables are automatically loaded from `supabase/.env.local`

### 4. Run Database Migrations

Apply the database schema:

```bash
supabase db reset  # Resets database and runs all migrations
```

### 5. Test Storage Integration

Verify MinIO is working correctly:

```bash
bun run storage:test
```

Expected output:
```
=== Enact Storage Integration Test ===

ℹ Endpoint: http://localhost:9000
ℹ Bucket: enact-bundles

✓ Storage client created
✓ Uploaded: test-bundles/test-1234567890.tar.gz
✓ File exists: test-bundles/test-1234567890.tar.gz
✓ Got metadata:
  Size: 38 bytes
  Content-Type: application/gzip
✓ Downloaded content matches original
✓ Deleted: test-bundles/test-1234567890.tar.gz
✓ File successfully deleted

=== All tests passed! ===
```

### 6. Start Edge Functions Dev Server

Run the local Edge Functions server:

```bash
bun run dev
```

This starts the Edge Functions at:
- Base URL: `http://localhost:54321/functions/v1`

Available endpoints:
- `POST /tools` - Publish tool
- `GET /tools/:name` - Get tool info
- `GET /tools/:name/versions/:version` - Get version details
- `GET /tools/:name/versions/:version/download` - Download bundle
- `POST /tools/:name/versions/:version/attestations` - Submit attestation
- `GET /tools/:name/versions/:version/attestations` - List attestations
- And more...

## Testing the Full Stack

### Test 1: Upload a Bundle (Manual)

```bash
# Create test bundle
echo "Hello, Enact!" > test.txt
tar -czf test.tar.gz test.txt

# Upload using storage client
bun run storage:test
```

### Test 2: Publish via Edge Function

```bash
# TODO: Once publish endpoint is integrated with storage
curl -X POST http://localhost:54321/functions/v1/tools \
  -H "Content-Type: multipart/form-data" \
  -F "manifest=@enact.yaml" \
  -F "bundle=@test.tar.gz"
```

### Test 3: Download via Edge Function

```bash
# TODO: Once download endpoint is integrated with storage
curl http://localhost:54321/functions/v1/tools/alice/utils/greeter/versions/1.0.0/download \
  --output downloaded.tar.gz
```

## Useful Commands

### Storage (MinIO)

```bash
# Start MinIO
bun run storage:start

# Stop MinIO
bun run storage:stop

# Restart MinIO
bun run storage:restart

# View MinIO logs
bun run storage:logs

# Test storage
bun run storage:test
```

### Database (Supabase)

```bash
# Start Supabase
supabase start

# Stop Supabase
supabase stop

# Reset database (destructive!)
supabase db reset

# View database URL
supabase status
```

### Combined

```bash
# Start everything
bun run local:start

# Stop everything
bun run local:stop

# Check status
bun run local:status
```

## Troubleshooting

### MinIO Container Won't Start

```bash
# Check if port is already in use
lsof -i :9000
lsof -i :9001

# Stop existing containers
docker ps -a --filter name=enact
docker rm -f enact-minio enact-minio-init

# Restart
bun run storage:start
```

### Storage Test Fails

**Error**: `Missing required storage credentials`

**Solution**: Make sure environment variables are set:
```bash
export R2_ENDPOINT=http://localhost:9000
export R2_ACCESS_KEY_ID=enact
export R2_SECRET_ACCESS_KEY=enact123456
export R2_BUCKET=enact-bundles
```

**Error**: `Failed to upload: Connection refused`

**Solution**: MinIO isn't running. Start it:
```bash
bun run storage:start
```

### Edge Functions Can't Connect to MinIO

Edge Functions run in Docker and can't use `localhost`. They must use `host.docker.internal`:

In `supabase/.env.local`:
```bash
R2_ENDPOINT=http://host.docker.internal:9000
```

### Database Migration Errors

Reset and reapply migrations:
```bash
supabase db reset
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Local Development                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────┐         ┌──────────────┐        │
│  │   MinIO      │         │  Supabase    │        │
│  │   (S3)       │         │  (PostgreSQL)│        │
│  │              │         │              │        │
│  │ Port: 9000   │         │ Port: 54321  │        │
│  │ Console:9001 │         │              │        │
│  └──────┬───────┘         └──────┬───────┘        │
│         │                        │                │
│         └────────┬───────────────┘                │
│                  │                                │
│         ┌────────▼──────────┐                     │
│         │  Edge Functions   │                     │
│         │  (Deno Runtime)   │                     │
│         │                   │                     │
│         │  /tools           │                     │
│         │  /attestations    │                     │
│         │  /auth            │                     │
│         └───────────────────┘                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Next Steps

1. **Integrate Storage with Edge Functions**
   - Update publish endpoint to upload to MinIO
   - Update download endpoint to fetch from MinIO
   - Test end-to-end flow

2. **Test with CLI**
   - Configure CLI to point to local server
   - Test `enact publish`
   - Test `enact install`
   - Test `enact sign`

3. **Add Tests**
   - Write Edge Function tests
   - Integration tests for storage
   - End-to-end workflow tests

## Resources

- [MinIO Documentation](https://min.io/docs/minio/linux/index.html)
- [Supabase Local Development](https://supabase.com/docs/guides/cli/local-development)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [AWS SDK for JavaScript](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
