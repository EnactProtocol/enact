# Quick Start Guide - @enactprotocol/server

Get the Enact registry server running locally in under 5 minutes.

## Prerequisites

- [Bun](https://bun.sh) or Node.js 20+
- [Docker](https://www.docker.com/) (for local Supabase)
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed

## 1. Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Linux/WSL
npm install -g supabase

# Or use npx
npx supabase --help
```

## 2. Install Dependencies

```bash
# From the server package directory
cd packages/server
bun install

# Or from the monorepo root
bun install
```

## 3. Start Local Supabase

```bash
# Initialize Supabase (first time only)
supabase init

# Start all Supabase services
supabase start
```

This will start:
- PostgreSQL database on port 54322
- Kong API Gateway on port 54321
- Supabase Studio on port 54323
- Inbucket (email testing) on port 54324

You'll see output like:
```
API URL: http://localhost:54321
GraphQL URL: http://localhost:54321/graphql/v1
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
Studio URL: http://localhost:54323
Inbucket URL: http://localhost:54324
JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Save these values!** You'll need them for configuration.

## 4. Apply Database Migrations

```bash
# Apply the initial schema
supabase db push
```

This creates all tables, indexes, RLS policies, and functions.

## 5. Configure Environment Variables

Create a `.env.local` file in the server package:

```env
# Supabase (from supabase start output)
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# R2/S3 Storage (optional for local dev)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET=enact-bundles
R2_ENDPOINT=https://your-endpoint.r2.cloudflarestorage.com

# OAuth (optional for local dev - use Supabase defaults)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

## 6. Start Edge Functions

```bash
# Serve all Edge Functions locally
supabase functions serve
```

Or run specific function:
```bash
supabase functions serve tools
```

## 7. Test the API

### Using curl

```bash
# Health check (once implemented)
curl http://localhost:54321/functions/v1/tools

# Search for tools
curl "http://localhost:54321/functions/v1/tools/search?q=greeting"

# Get tool info (after publishing one)
curl http://localhost:54321/functions/v1/tools/alice/utils/greeter
```

### Using the Enact CLI

If you have the `@enactprotocol/cli` package built:

```bash
# Configure CLI to use local server
export ENACT_REGISTRY_URL=http://localhost:54321/functions/v1

# Search
enact search greeting

# Publish (requires auth)
enact publish ./my-tool
```

## 8. Access Supabase Studio

Open [http://localhost:54323](http://localhost:54323) in your browser.

From here you can:
- Browse tables and data
- Run SQL queries
- Test RLS policies
- View logs
- Manage auth users

## Common Commands

```bash
# Stop Supabase
supabase stop

# Reset database (WARNING: deletes all data)
supabase db reset

# View logs
supabase functions logs tools

# Generate TypeScript types from database
supabase gen types typescript --local > src/database.types.ts

# Deploy to Supabase Cloud (after setup)
supabase functions deploy
```

## Development Workflow

### Making Schema Changes

1. Create a new migration file:
   ```bash
   supabase migration new add_feature_name
   ```

2. Edit the migration file in `supabase/migrations/`

3. Apply it:
   ```bash
   supabase db reset  # Reapply all migrations
   # OR
   supabase db push   # Apply new migrations only
   ```

### Testing Edge Functions

1. Make changes to `supabase/functions/*/index.ts`

2. Functions auto-reload when you save (with `supabase functions serve`)

3. Test with curl or the CLI

4. Check logs:
   ```bash
   supabase functions logs tools --follow
   ```

### Debugging

**View database logs:**
```bash
supabase db logs
```

**View function logs:**
```bash
supabase functions logs tools
```

**Run SQL directly:**
```bash
supabase db psql
```

**Check service status:**
```bash
supabase status
```

## Troubleshooting

### Supabase won't start

```bash
# Stop all services
supabase stop

# Remove volumes (WARNING: deletes data)
supabase stop --no-backup

# Start fresh
supabase start
```

### Port conflicts

If ports are in use, edit `supabase/config.toml` to use different ports.

### Database connection errors

Make sure Docker is running and Supabase is started:
```bash
docker ps  # Should show supabase containers
supabase status  # Should show all services running
```

### Edge Function errors

Check the logs:
```bash
supabase functions logs tools
```

Common issues:
- Missing environment variables
- TypeScript errors (check with `bun run typecheck`)
- CORS errors (check CORS headers in response)

## Next Steps

- **Implement Attestations**: Complete the attestations Edge Function (Phase 4)
- **Add Tests**: Write unit and integration tests (Phase 11)
- **Enable Vector Search**: Apply vector embeddings migration (Phase 7)
- **Deploy to Production**: Follow [README.md](./README.md) deployment guide

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Enact REGISTRY-SPEC.md](../../docs/REGISTRY-SPEC.md)

## Getting Help

- Check logs: `supabase functions logs`
- Review database: [http://localhost:54323](http://localhost:54323)
- See error codes in `src/utils/errors.ts`
- Read [ARCHITECTURE.md](./ARCHITECTURE.md) for design details
