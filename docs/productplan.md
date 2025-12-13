# Enact Private Registry - Product Plan

## Executive Summary

Enable organizations to launch their own private Enact registry with a few clicks. Users subscribe to a plan, provision infrastructure automatically, and get a fully isolated registry for their team's tools.

---

## Problem Statement

Organizations need:
1. **Private tool distribution** - Internal tools shouldn't be on public registry
2. **Access control** - Only team members can publish/download
3. **Compliance** - Data residency, audit logs, SOC2 requirements
4. **Isolation** - Complete separation from public registry

Current state: Only public registry exists. No self-hosted or private options.

---

## Solution Overview

### Product: Enact Cloud Private Registries

A managed service where customers can:
1. Sign up and choose a plan
2. Click "Create Registry"
3. Get a private registry URL (e.g., `acme.registry.enact.dev`)
4. Configure their CLI: `enact config set registry https://acme.registry.enact.dev`
5. Invite team members
6. Publish private tools

---

## Architecture

### Option A: Multi-Tenant SaaS (Recommended for MVP)

```
┌─────────────────────────────────────────────────────────────┐
│                    Enact Cloud Platform                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Acme Corp   │  │  StartupX    │  │  BigCo       │      │
│  │  Registry    │  │  Registry    │  │  Registry    │      │
│  │  (tenant_1)  │  │  (tenant_2)  │  │  (tenant_3)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
├─────────────────────────────────────────────────────────────┤
│  Shared Infrastructure:                                      │
│  - PostgreSQL (RLS isolation)                                │
│  - R2/S3 (bucket-per-tenant or prefix isolation)            │
│  - Edge Functions (tenant context from subdomain)           │
│  - Auth (per-tenant user pools or shared with tenant claim) │
└─────────────────────────────────────────────────────────────┘
```

**Pros:**
- Lower infrastructure cost
- Faster to build
- Easier to maintain
- Can upgrade to dedicated later

**Cons:**
- Shared database (noisy neighbor risk)
- Less isolation (compliance concern for some)

### Option B: Dedicated Infrastructure (Enterprise Tier)

```
┌─────────────────────┐  ┌─────────────────────┐
│   Acme Corp         │  │   BigCo             │
│   ┌─────────────┐   │  │   ┌─────────────┐   │
│   │ PostgreSQL  │   │  │   │ PostgreSQL  │   │
│   │ R2 Bucket   │   │  │   │ R2 Bucket   │   │
│   │ Edge Funcs  │   │  │   │ Edge Funcs  │   │
│   └─────────────┘   │  │   └─────────────┘   │
│   acme.registry.    │  │   bigco.registry.   │
│   enact.dev         │  │   enact.dev         │
└─────────────────────┘  └─────────────────────┘
```

**Pros:**
- Complete isolation
- Custom SLAs
- Data residency options
- No noisy neighbor

**Cons:**
- Higher cost
- More complex provisioning
- Slower to spin up

### Recommended Approach

**Phase 1:** Multi-tenant SaaS with strong RLS isolation
**Phase 2:** Add dedicated infrastructure option for Enterprise tier

---

## Data Model Changes

### New Tables

```sql
-- Organizations/Tenants
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,  -- Used in subdomain: {slug}.registry.enact.dev
  plan TEXT NOT NULL DEFAULT 'free',  -- free, team, enterprise
  created_at TIMESTAMPTZ DEFAULT now(),
  settings JSONB DEFAULT '{}'::jsonb,

  -- Billing
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  billing_email TEXT,

  -- Limits (based on plan)
  max_members INTEGER DEFAULT 5,
  max_tools INTEGER DEFAULT 50,
  max_storage_gb INTEGER DEFAULT 10,

  -- Features
  custom_domain TEXT,  -- Enterprise: bring your own domain
  sso_enabled BOOLEAN DEFAULT false,
  audit_logs_enabled BOOLEAN DEFAULT false
);

-- Organization Members
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',  -- owner, admin, member, readonly
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT now(),
  joined_at TIMESTAMPTZ,

  UNIQUE(org_id, user_id)
);

-- Pending Invitations
CREATE TABLE organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + interval '7 days',
  accepted_at TIMESTAMPTZ,

  UNIQUE(org_id, email)
);

-- Modify existing tools table
ALTER TABLE tools ADD COLUMN org_id UUID REFERENCES organizations(id);
ALTER TABLE tools ADD COLUMN visibility TEXT DEFAULT 'public';  -- public, private, org

-- API Keys for CI/CD
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,  -- SHA-256 of the key (never store plaintext)
  key_prefix TEXT NOT NULL,  -- First 8 chars for identification
  scopes TEXT[] DEFAULT ARRAY['read'],  -- read, write, admin
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(key_hash)
);

-- Audit Logs (Enterprise)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,  -- tool.publish, member.invite, settings.update, etc.
  resource_type TEXT,
  resource_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Usage Tracking
CREATE TABLE usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Metrics
  tools_count INTEGER DEFAULT 0,
  versions_count INTEGER DEFAULT 0,
  storage_bytes BIGINT DEFAULT 0,
  downloads_count INTEGER DEFAULT 0,
  api_calls_count INTEGER DEFAULT 0,

  UNIQUE(org_id, period_start)
);
```

### Row-Level Security Policies

```sql
-- Organizations: members can read, owners can modify
CREATE POLICY "org_member_read" ON organizations
  FOR SELECT USING (
    id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "org_owner_modify" ON organizations
  FOR ALL USING (
    id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Tools: org members can read private tools, public tools visible to all
CREATE POLICY "tool_visibility" ON tools
  FOR SELECT USING (
    visibility = 'public'
    OR (
      visibility IN ('private', 'org')
      AND org_id IN (
        SELECT org_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

-- Tools: only org admins/owners can publish
CREATE POLICY "tool_publish" ON tools
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );
```

---

## API Changes

### New Endpoints

```
# Organization Management
POST   /orgs                     - Create organization
GET    /orgs/{slug}              - Get organization details
PUT    /orgs/{slug}              - Update organization
DELETE /orgs/{slug}              - Delete organization

# Member Management
GET    /orgs/{slug}/members      - List members
POST   /orgs/{slug}/members      - Invite member
PUT    /orgs/{slug}/members/{id} - Update member role
DELETE /orgs/{slug}/members/{id} - Remove member

# Invitations
POST   /orgs/{slug}/invitations       - Create invitation
GET    /orgs/{slug}/invitations       - List pending invitations
DELETE /orgs/{slug}/invitations/{id}  - Revoke invitation
POST   /invitations/{token}/accept    - Accept invitation

# API Keys
GET    /orgs/{slug}/api-keys          - List API keys
POST   /orgs/{slug}/api-keys          - Create API key
DELETE /orgs/{slug}/api-keys/{id}     - Revoke API key

# Usage & Billing
GET    /orgs/{slug}/usage             - Get usage metrics
GET    /orgs/{slug}/billing           - Get billing info
POST   /orgs/{slug}/billing/portal    - Get Stripe portal URL
```

### Subdomain Routing

Each registry gets a subdomain:
- `acme.registry.enact.dev` → Routes to tenant `acme`
- `public.registry.enact.dev` → The public registry

Edge function extracts tenant from `Host` header:

```typescript
function getTenantFromRequest(req: Request): string | null {
  const host = req.headers.get('host');
  const match = host?.match(/^([^.]+)\.registry\.enact\.dev$/);
  return match?.[1] ?? null;
}
```

---

## CLI Changes

### Registry Configuration

```bash
# Set registry URL
enact config set registry https://acme.registry.enact.dev

# Or use environment variable
export ENACT_REGISTRY=https://acme.registry.enact.dev

# Login to private registry
enact auth login
# Opens browser to acme.registry.enact.dev/auth

# Use API key (for CI/CD)
enact auth login --api-key
# Prompts for API key or reads from ENACT_API_KEY
```

### Multi-Registry Support

```bash
# Add named registry
enact registry add acme https://acme.registry.enact.dev
enact registry add public https://public.registry.enact.dev

# Switch default registry
enact registry use acme

# Publish to specific registry
enact publish --registry acme

# Install from specific registry
enact install acme::myorg/tools/mytool
# Or with full URL
enact install https://acme.registry.enact.dev/myorg/tools/mytool
```

### Config File (~/.enact/config.yaml)

```yaml
default_registry: acme
registries:
  acme:
    url: https://acme.registry.enact.dev
    auth: token  # or api-key
  public:
    url: https://public.registry.enact.dev
    auth: token
```

---

## Pricing Tiers

### Free Tier
- 1 organization
- 5 members
- 50 private tools
- 10 GB storage
- Community support
- **$0/month**

### Team Tier
- Unlimited organizations
- 25 members per org
- 500 private tools
- 100 GB storage
- Email support
- API keys for CI/CD
- **$49/month** (or $490/year)

### Enterprise Tier
- Unlimited everything
- Dedicated infrastructure option
- Custom domain (your-registry.yourcompany.com)
- SSO/SAML integration
- Audit logs
- SLA (99.9% uptime)
- Priority support
- **Custom pricing** (starting ~$500/month)

---

## Implementation Phases

### Phase 1: Foundation (2-3 weeks)
- [ ] Database schema for organizations, members, invitations
- [ ] RLS policies for multi-tenancy
- [ ] Basic org CRUD API endpoints
- [ ] Subdomain routing in Edge Functions
- [ ] CLI registry configuration (`enact config set registry`)

### Phase 2: Authentication & Access (2 weeks)
- [ ] Per-org OAuth setup (or shared auth with org claim)
- [ ] API key generation and authentication
- [ ] Member invitation flow (email invites)
- [ ] Role-based access control (owner, admin, member, readonly)

### Phase 3: Tool Publishing (1-2 weeks)
- [ ] Tool visibility (public, private, org)
- [ ] Namespace scoping per organization
- [ ] Storage isolation (bucket prefix per org)
- [ ] Private tool download authentication

### Phase 4: Billing Integration (1-2 weeks)
- [ ] Stripe integration for subscriptions
- [ ] Usage tracking and limits enforcement
- [ ] Billing portal (manage subscription, invoices)
- [ ] Plan upgrade/downgrade flow

### Phase 5: Self-Service Portal (2 weeks)
- [ ] Web dashboard for org management
- [ ] Member management UI
- [ ] API key management UI
- [ ] Usage dashboard
- [ ] Settings page

### Phase 6: Enterprise Features (2-3 weeks)
- [ ] Custom domain support
- [ ] SSO/SAML integration
- [ ] Audit logs
- [ ] Dedicated infrastructure provisioning (Terraform/Pulumi)

---

## Provisioning Flow

### Self-Service (Team Tier)

```
User Journey:
1. Visit enact.dev/pricing
2. Click "Start Free Trial" on Team plan
3. Sign up / Login
4. Enter organization name → generates slug
5. Stripe checkout for payment
6. On success:
   - Create organization record
   - Provision subdomain DNS (Cloudflare API)
   - Send welcome email with setup instructions
7. Redirect to dashboard
8. Show CLI setup instructions:

   enact config set registry https://acme.registry.enact.dev
   enact auth login
```

### Enterprise (Dedicated)

```
User Journey:
1. Contact sales / fill out enterprise form
2. Sales call to understand requirements
3. Sign contract
4. Provisioning team runs Terraform:
   - Dedicated Supabase project (or self-hosted Postgres)
   - Dedicated R2 bucket
   - Dedicated Edge Function deployment
   - Custom domain SSL certificate
   - DNS configuration
5. Hand off to customer with admin credentials
6. Customer configures SSO
7. Customer invites team
```

### Terraform Module (Enterprise)

```hcl
module "enact_registry" {
  source = "enact/private-registry/cloudflare"

  organization_name = "Acme Corp"
  slug              = "acme"
  region            = "us-east-1"

  # Optional: custom domain
  custom_domain     = "registry.acme.com"

  # Optional: dedicated database
  dedicated_db      = true
  db_size           = "medium"  # small, medium, large

  # Admin user
  admin_email       = "admin@acme.com"
}

output "registry_url" {
  value = module.enact_registry.url
}

output "admin_invite_link" {
  value = module.enact_registry.admin_invite_link
}
```

---

## Security Considerations

### Data Isolation
- **Database:** RLS policies ensure tenant isolation
- **Storage:** Bucket prefix `{org_id}/` for all objects
- **API:** Tenant context validated on every request
- **Logs:** Tenant ID included in all log entries

### Authentication
- **OAuth:** Per-org or shared with org claim in JWT
- **API Keys:** Hashed storage, scoped permissions, expiration
- **SSO:** Enterprise SAML integration for corporate IdPs

### Secrets Management
- API keys stored hashed (SHA-256)
- Stripe keys in Supabase Edge Secrets
- No plaintext secrets in database
- Key rotation support

### Audit Trail
- All write operations logged
- IP address and user agent captured
- Retention: 90 days (Team), unlimited (Enterprise)
- Export capability for compliance

---

## Success Metrics

### Adoption
- Number of private registries created
- Monthly active organizations
- Tools published to private registries
- Team members invited

### Revenue
- MRR (Monthly Recurring Revenue)
- Conversion rate: Free → Team
- Conversion rate: Team → Enterprise
- Churn rate

### Engagement
- API calls per registry
- Downloads per registry
- Average tools per organization
- Average members per organization

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Noisy neighbor (shared DB) | Performance degradation | Query limits, connection pooling, dedicated tier |
| Data breach across tenants | Critical | Strong RLS, security audits, penetration testing |
| Billing integration issues | Revenue loss | Webhook idempotency, reconciliation jobs |
| DNS propagation delays | Poor UX on signup | Pre-provision subdomains, use Cloudflare for fast propagation |
| Enterprise provisioning slow | Lost deals | Terraform automation, reduce manual steps |

---

## Open Questions

1. **Self-hosted option?** Do we want to offer a Docker image for on-prem deployment?
   - Pro: Some enterprises require it
   - Con: Support burden, version fragmentation

2. **Federation?** Can private registries pull from public registry?
   - Use case: Use public tools alongside private ones
   - Implementation: Proxy/mirror functionality

3. **Tool mirroring?** Can orgs mirror public tools into their private registry?
   - Use case: Audit all tools before use, air-gapped environments
   - Implementation: Import command + periodic sync

4. **Pricing model?** Per-seat vs. flat rate vs. usage-based?
   - Per-seat: Predictable, but discourages adoption
   - Flat rate: Simple, good for small teams
   - Usage-based: Fair, but unpredictable costs

---

## Appendix: Competitive Analysis

| Feature | Enact Private | npm Enterprise | Artifactory | GitHub Packages |
|---------|---------------|----------------|-------------|-----------------|
| Private packages | ✅ | ✅ | ✅ | ✅ |
| Self-hosted option | Phase 2 | ❌ | ✅ | ❌ |
| Container tools | ✅ | ❌ | ✅ | ✅ |
| Cryptographic signing | ✅ (Sigstore) | ❌ | ✅ | ✅ |
| SSO/SAML | Enterprise | ✅ | ✅ | ✅ |
| Starting price | $0 (free tier) | $7/user/mo | ~$150/mo | Free (limited) |

---

## Next Steps

1. **Validate demand:** Talk to 5-10 potential customers about private registry needs
2. **Technical spike:** Prototype subdomain routing + RLS isolation
3. **Design review:** UX for self-service provisioning flow
4. **Prioritize:** Decide Phase 1 scope based on customer feedback
5. **Build:** Start with foundation (Phase 1)