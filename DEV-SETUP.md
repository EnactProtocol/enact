# Dev Setup Guide

This guide will help you set up the Enact CLI project for local development.

## Prerequisites

Before you begin, make sure you have the following installed:

- **[Bun](https://bun.sh)** - JavaScript runtime and package manager
- **[Docker](https://www.docker.com/)** - For running Supabase and MinIO
- **[Supabase CLI](https://supabase.com/docs/guides/cli)** - For local database and Edge Functions

### Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Linux/WSL or alternative
npm install -g supabase
```

## Quick Start

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/EnactProtocol/enact-cli-2.0.git
cd enact-cli-2.0
bun install
```

### 2. Start Supabase

```bash
cd packages/server
supabase start
```

This will start:
- PostgreSQL database on port 54322
- Kong API Gateway on port 54321
- Supabase Studio on http://127.0.0.1:54323
- Mailpit (email testing) on http://127.0.0.1:54324

**Note the output!** You'll see the anon key and service role key - these are already configured in `.env.local`.

### 3. Start MinIO (S3-compatible storage)

```bash
# From packages/server
docker-compose up -d
```

This starts MinIO on port 9000 with the console on port 9001.

### 4. Apply Database Migrations

```bash
# From packages/server
supabase db push
```

### 5. Start Edge Functions

```bash
# From packages/server
supabase functions serve --env-file supabase/.env.local
```

Leave this running in a terminal. The Edge Functions server will be available at `http://127.0.0.1:54321/functions/v1`.

### 6. Build the Project

In a new terminal:

```bash
# From project root
bun run build
```

This builds all packages in the monorepo in the correct order.

## Set Up Your Configuration

### Option 1: Use the setup command (recommended)

```bash
# From project root
bun run packages/cli/dist/index.js setup --global
```

When prompted:
- **Registry URL**: `http://127.0.0.1:54321/functions/v1`
- **Use local development anon key?**: Yes
- **Minimum attestations**: 1
- **Maximum cache size**: 1024
- **Default execution timeout**: 30s

### Option 2: Manual configuration

Create or edit `~/.enact/config.yaml`:

```yaml
version: 1.0.0
trust:
  minimum_attestations: 1
cache:
  maxSizeMb: 1024
  ttlSeconds: 604800
execution:
  defaultTimeout: 30s
  verbose: false
registry:
  url: http://127.0.0.1:54321/functions/v1
  authToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

## Verify Your Setup

### 1. Publish an example tool

```bash
# From project root
ENACT_REGISTRY_URL=http://127.0.0.1:54321/functions/v1 \
  bun run packages/cli/dist/index.js publish examples/hello-js --skip-auth
```

### 2. Search for tools

```bash
bun run packages/cli/dist/index.js search "hello"
```

### 3. Install a tool

```bash
bun run packages/cli/dist/index.js install testuser/hello-js
```

### 4. Run a tool

```bash
bun run packages/cli/dist/index.js run testuser/hello-js --args '{"name": "World"}'
```

## Common Development Tasks

### Build individual packages

```bash
# Build just the CLI
bun run build:cli

# Build just the API client
bun run build:api

# Build specific package
cd packages/<package-name>
bun run build
```

### Run tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage
```

### Lint and format

```bash
# Check code style
bun run lint

# Auto-fix issues
bun run lint:fix

# Format code
bun run format:fix
```

### Type checking

```bash
# Check all packages
bun run typecheck

# Check specific package
bun run typecheck:cli
```

### Clean build artifacts

```bash
bun run clean
```

## Project Structure

```
enact-cli-2.0/
├── packages/
│   ├── cli/           # Command-line interface
│   ├── api/           # Registry API client
│   ├── shared/        # Shared utilities and types
│   ├── execution/     # Tool execution engine (Dagger)
│   ├── trust/         # Cryptographic verification (Sigstore)
│   ├── secrets/       # Secret management
│   ├── server/        # Registry server (Supabase)
│   ├── mcp-server/    # Model Context Protocol server
│   └── web/           # Web interface (Vite + React)
├── examples/          # Example tools for testing
├── docs/             # Documentation
└── scripts/          # Build and utility scripts
```

## Environment Variables

The CLI supports these environment variables for local development:

- `ENACT_REGISTRY_URL` - Override the registry URL
- `ENACT_AUTH_TOKEN` - Set authentication token
- `ENACT_DEV_MODE` - Enable development mode features

## Troubleshooting

### Supabase won't start

```bash
# Stop all containers
supabase stop
docker-compose down

# Remove volumes and restart
supabase stop --no-backup
supabase start
```

### Edge Functions not responding

Check that they're running:
```bash
# Check Supabase status
supabase status

# Check Edge Functions logs
docker logs supabase_edge_runtime_server -f
```

### MinIO connection issues

```bash
# Check MinIO is running
docker ps | grep minio

# Restart MinIO
docker-compose restart

# View MinIO logs
docker-compose logs -f minio
```

### Database migration issues

```bash
# Reset the database
supabase db reset

# Reapply migrations
supabase db push
```

### Build errors

```bash
# Clean and rebuild
bun run clean
bun install
bun run build
```

## Working with the Registry

### Switching Between Local and Production

The project supports both local development and production environments. Here's how to switch:

**Local Development (Active when `supabase start` is running):**
- Registry URL: `http://127.0.0.1:54321/functions/v1`
- Database: Local PostgreSQL on port 54322
- Storage: MinIO on port 9000
- Dev mode: Enabled (no auth required)
- Studio: http://127.0.0.1:54323

**Production (Linked project: `siikwkfgsmouioodghho`):**
- Registry URL: `https://siikwkfgsmouioodghho.supabase.co/functions/v1` (default)
- Database: Supabase hosted PostgreSQL
- Storage: Supabase/Cloudflare
- Auth: Required

**Switching Commands:**

```bash
# Start local development
cd packages/server
supabase start
docker-compose up -d  # Start MinIO

# Stop local (returns to production for linked commands)
supabase stop
docker-compose down

# CLI - Local dev
ENACT_REGISTRY_URL=http://127.0.0.1:54321/functions/v1 \
  enact publish ./examples/json-formatter --skip-auth

# CLI - Production (default when local not running)
enact publish ./examples/json-formatter

# Migrations - Local
supabase db push

# Migrations - Production
supabase db push --linked

# Edge Functions - Local (automatic with supabase start)
# Edge Functions - Production
supabase functions deploy tools
```

**Environment Configuration:**

The Edge Functions dev mode is enabled via `packages/server/supabase/config.toml`:
```toml
[edge_runtime.secrets]
ENACT_DEV_MODE = "env(ENACT_DEV_MODE)"
R2_ENDPOINT = "env(R2_ENDPOINT)"
# ... other env vars
```

Values come from `packages/server/supabase/.env.local`.

### Local development mode

With `ENACT_DEV_MODE=true` configured, local Edge Functions:
- Allow publishing without authentication (use `--skip-auth` flag)
- Use service role key to bypass Row Level Security
- Enable additional logging
- Accept any namespace for tool publishing

### Publishing tools

```bash
# Local development
ENACT_REGISTRY_URL=http://127.0.0.1:54321/functions/v1 \
  bun run packages/cli/dist/index.js publish <path-to-tool> --skip-auth

# Production (requires login)
bun run packages/cli/dist/index.js publish <path-to-tool>
```

### Database access

- **Supabase Studio**: http://127.0.0.1:54323
- **Direct SQL**: `supabase db psql`
- **Database URL**: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

### Storage access

- **MinIO Console**: http://127.0.0.1:9001
  - Username: `enact`
  - Password: `enact123456`

## Next Steps

- Read [COMMANDS.md](docs/COMMANDS.md) for detailed CLI command reference
- Check [ROADMAP.md](ROADMAP.md) to see what's being worked on
- Read [packages/server/LOCAL-DEV-GUIDE.md](packages/server/LOCAL-DEV-GUIDE.md) for server-specific details
- Explore the example tools in `examples/`

## Getting Help

- Check existing issues on GitHub
- Read the documentation in `docs/`
- Review package-specific READMEs in `packages/*/README.md`
