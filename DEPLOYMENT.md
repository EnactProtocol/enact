# Enact Deployment Plan

Deploy the Enact registry using GitHub Pages (frontend), Supabase (backend), and GitHub Actions (CI/CD).

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         GitHub Pages                             │
│                    https://enact.tools                           │
│                   (packages/web - React/Vite)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Supabase                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Edge Funcs  │  │  Postgres   │  │  Storage (R2 via S3)    │  │
│  │ /tools      │  │  - profiles │  │  - tool bundles         │  │
│  │ /attestations│ │  - tools    │  │  - .tar.gz archives     │  │
│  │ /auth       │  │  - versions │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Supabase Auth                             │ │
│  │          GitHub OAuth + Google OAuth                         │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Cloudflare R2                              │
│              (Bundle storage - S3-compatible)                    │
│         Bucket: enact-bundles                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Components to Deploy

| Component | Target | Source |
|-----------|--------|--------|
| Frontend (web) | GitHub Pages | `packages/web` |
| Backend API | Supabase Edge Functions | `packages/server/supabase/functions` |
| Database | Supabase Postgres | `packages/server/supabase/migrations` |
| Bundle Storage | Cloudflare R2 | (S3-compatible) |
| Auth | Supabase Auth | Built-in OAuth |

---

## Phase 1: Supabase Setup

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note the following credentials:
   - Project URL: `https://<project-ref>.supabase.co`
   - Anon Key: `eyJ...` (public)
   - Service Role Key: `eyJ...` (secret - for CI only)
   - Database password

### 1.2 Configure Authentication

In Supabase Dashboard → Authentication → Providers:

**GitHub OAuth:**
1. Create OAuth App at https://github.com/settings/developers
   - Application name: `Enact Registry`
   - Homepage URL: `https://enact.tools`
   - Callback URL: `https://<project-ref>.supabase.co/auth/v1/callback`
2. Copy Client ID and Client Secret to Supabase

**Google OAuth:**
1. Create OAuth credentials at https://console.cloud.google.com/
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
2. Copy Client ID and Client Secret to Supabase

### 1.3 Apply Database Migrations

```bash
cd packages/server

# Link to your Supabase project (one-time setup)
supabase link --project-ref <your-project-ref>

# Push all migrations to production
supabase db push

# Verify migrations applied successfully
supabase migration list
```

**Migrations include:**
- `20250102000000_initial_schema.sql` - Core tables (profiles, tools, tool_versions, attestations, etc.)
- `20250102000001_add_vector_embeddings.sql` - Semantic search support with pgvector
- `20250107000000_allow_anon_publish.sql` - Temporary anon policies (development only)
- `20250107000001_remove_anon_publish.sql` - Remove anon policies for production

### 1.4 Deploy Edge Functions

```bash
cd packages/server

# Deploy functions (with --no-verify-jwt to allow anon access for read operations)
supabase functions deploy tools --no-verify-jwt

# Note: attestations function requires @enactprotocol/trust package to be published
# Skip for now or deploy after publishing packages to npm

# Set function secrets (required for production)
supabase secrets set R2_ACCESS_KEY_ID=xxx
supabase secrets set R2_SECRET_ACCESS_KEY=xxx
supabase secrets set R2_BUCKET=enact-bundles
supabase secrets set R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
supabase secrets set R2_REGION=auto

# Production mode is enabled by default (dev mode requires ENACT_DEV_MODE=true)
# In production, users must authenticate via `enact auth login` before publishing
```

**Important:** The Edge Functions will use production mode by default, which requires:
- Proper authentication for publishing tools
- Namespace ownership enforcement (users can only publish under their username)
- Anonymous access for read operations (search, install, get)

---

## Phase 2: Cloudflare R2 Storage

### 2.1 Create R2 Bucket

1. Go to Cloudflare Dashboard → R2
2. Create bucket: `enact-bundles`
3. Enable public access (for bundle downloads) or use presigned URLs

### 2.2 Create API Tokens

1. Create R2 API token with read/write access
2. Note:
   - Access Key ID
   - Secret Access Key
   - Account ID (for endpoint URL)

### 2.3 Configure CORS

Add CORS policy in R2 bucket settings:
```json
[
  {
    "AllowedOrigins": ["https://enact.tools", "http://localhost:*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## Phase 3: GitHub Pages (Frontend)

### 3.1 Configure Custom Domain

1. In repo Settings → Pages, set custom domain to `enact.tools`
2. Add DNS records:
   ```
   A     @       185.199.108.153
   A     @       185.199.109.153
   A     @       185.199.110.153
   A     @       185.199.111.153
   CNAME www     EnactProtocol.github.io
   ```

### 3.2 GitHub Actions (Already Configured)

The repository includes the following deployment workflows in `.github/workflows/`:

**`deploy-web.yml`** - Deploys the React frontend to GitHub Pages
- Triggers on changes to `packages/web/**`
- Builds with environment variables from GitHub secrets
- Deploys to GitHub Pages automatically

**No additional workflow creation needed** - just configure the secrets in Phase 5 below.

---

## Phase 4: CI/CD Pipeline (Already Configured)

The repository includes complete CI/CD workflows:

**`ci.yml`** - Runs tests, typecheck, and linting on every push/PR

**`deploy-functions.yml`** - Deploys Supabase Edge Functions automatically
- Triggers on changes to `packages/server/supabase/functions/**`
- Deploys `tools` and `attestations` functions

**`migrate-db.yml`** - Applies database migrations automatically  
- Triggers on changes to `packages/server/supabase/migrations/**`
- Pushes migrations to production database

**`release.yml`** - Handles package versioning and npm publishing

**No workflow creation needed** - the workflows are ready to use once you configure secrets in Phase 5.

---

## Phase 5: GitHub Repository Secrets & Variables

**This is the only configuration step needed to activate the existing workflows.**

### Required Secrets

Go to repo Settings → Secrets and variables → Actions:

| Secret | Description | Used By |
|--------|-------------|---------|
| `SUPABASE_ACCESS_TOKEN` | Personal access token from [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) | `deploy-functions.yml`, `migrate-db.yml` |
| `SUPABASE_ANON_KEY` | Project anon key (safe for public) | `deploy-web.yml` (embedded in frontend build) |
| `NPM_TOKEN` | npm access token from [npmjs.com/settings/tokens](https://www.npmjs.com/settings/tokens) - create with "Automation" type | `release.yml` (future - currently manual) |

**Note:** R2 secrets (access keys) are configured directly in Supabase console via `supabase secrets set`, not as GitHub secrets. They're stored securely in Supabase and used by Edge Functions at runtime.

---

## Manual npm Publishing

npm packages are published manually for now (pending npm trusted publishers setup).

### Prerequisites

1. Login to npm: `npm login`
2. Ensure you have publish access to `@enactprotocol` org

### Publish Steps

```bash
cd /path/to/enact

# 1. Build all packages
bun run build

# 2. Convert workspace:* dependencies to real versions
VERSION=2.0.0  # Set to current version
for pkg in packages/*/package.json; do
  sed -i '' 's/"workspace:\*"/"'$VERSION'"/g' "$pkg"
done

# 3. Publish in dependency order (trust first, cli last)
cd packages/trust && npm publish --access public
cd ../secrets && npm publish --access public
cd ../shared && npm publish --access public  
cd ../execution && npm publish --access public
cd ../api && npm publish --access public
cd ../cli && npm publish --access public

# 4. Revert package.json changes (don't commit the sed changes)
git checkout packages/*/package.json
```

### Packages Published

| Package | Description |
|---------|-------------|
| `@enactprotocol/trust` | Sigstore signing & verification |
| `@enactprotocol/secrets` | Secure keychain storage |
| `@enactprotocol/shared` | Core types & utilities |
| `@enactprotocol/execution` | Tool execution engine |
| `@enactprotocol/api` | Registry API client |
| `@enactprotocol/cli` | Command-line interface |

### Required Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_PROJECT_REF` | Project reference ID (e.g., `siikwkfgsmouioodghho`) |

---

## Phase 6: DNS & Domain Setup

### 6.1 Configure enact.tools

At your DNS provider (Cloudflare recommended):

```
# GitHub Pages
A     @       185.199.108.153
A     @       185.199.109.153  
A     @       185.199.110.153
A     @       185.199.111.153
CNAME www     EnactProtocol.github.io

# API subdomain (optional, if using custom domain for Supabase)
CNAME api     <project-ref>.supabase.co
```

### 6.2 CNAME File for GitHub Pages

Create `packages/web/public/CNAME`:
```
enact.tools
```

---

## Deployment Checklist

### Initial Setup (One-time)

- [ ] Create Supabase project
- [ ] Configure GitHub OAuth in Supabase
- [ ] Configure Google OAuth in Supabase  
- [ ] Create Cloudflare R2 bucket
- [ ] Add GitHub repository secrets
- [ ] Add GitHub repository variables
- [ ] Configure custom domain DNS
- [ ] Enable GitHub Pages in repo settings

### Deploy Database

- [ ] Run `supabase link --project-ref <ref>`
- [ ] Run `supabase db push`
- [ ] Verify tables created in Supabase Dashboard

### Deploy Edge Functions

- [ ] Run `supabase functions deploy tools`
- [ ] Run `supabase functions deploy attestations`
- [ ] Set R2 secrets with `supabase secrets set`
- [ ] Test endpoints with curl

### Deploy Frontend

- [ ] Push to main branch (triggers GitHub Action)
- [ ] Verify deployment at https://enact.tools
- [ ] Test OAuth flow

### Smoke Test

```bash
# Test API
curl https://<project-ref>.supabase.co/functions/v1/tools

# Test frontend
curl https://enact.tools

# Test CLI auth
enact auth login
```

---

## Cost Estimates

| Service | Free Tier | Estimated Cost |
|---------|-----------|----------------|
| GitHub Pages | Unlimited | $0 |
| Supabase | 500MB DB, 1GB storage, 2M edge invocations | $0 (Free tier) |
| Cloudflare R2 | 10GB storage, 10M reads, 1M writes | $0 (Free tier) |
| **Total** | | **$0/month** (within free tiers) |

Paid tier recommended for production:
- Supabase Pro: $25/month (8GB DB, dedicated resources)
- R2: Pay as you go (~$0.015/GB storage)

---

## Rollback Procedures

### Frontend Rollback
```bash
# Revert to previous commit
git revert HEAD
git push origin main
# Or manually trigger deploy with specific commit
```

### Edge Functions Rollback
```bash
# Redeploy previous version
git checkout <previous-commit> -- packages/server/supabase/functions
supabase functions deploy tools
supabase functions deploy attestations
```

### Database Rollback
```bash
# Create rollback migration
supabase migration new rollback_xyz
# Add reversal SQL, then push
supabase db push
```

---

## Monitoring

### Supabase Dashboard
- Database: Query performance, connection stats
- Edge Functions: Invocations, errors, latency
- Auth: User signups, OAuth events
- Storage: Usage metrics

### GitHub Actions
- Workflow run history
- Deployment logs
- Build times

### Recommended Additions
- [ ] Sentry for error tracking
- [ ] Uptime monitoring (UptimeRobot, Betterstack)
- [ ] Slack/Discord alerts for deploy failures
