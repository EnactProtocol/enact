# Private Tools Implementation Plan

This document outlines the design and implementation plan for adding private tool support to Enact.

## Overview

Add a `--private` flag to `enact publish` that sets tool visibility. Private tools are only accessible to the owner, invited collaborators, or organization members (depending on configuration).

### Phases

1. **Phase 1**: Basic private/public visibility ✅ **COMPLETE**
2. **Phase 2**: Unlisted visibility + management command ✅ **COMPLETE** (merged with Phase 1)
3. **Phase 3**: Individual collaborator access grants
4. **Phase 4**: Organization-level tools and membership

## Visibility Levels

| Level | Search | Direct Access | Who Can Access |
|-------|--------|---------------|----------------|
| `public` | ✅ | ✅ | Everyone |
| `unlisted` | ❌ | ✅ | Anyone with the tool name |
| `private` | ❌ | ❌ | Owner only (+ collaborators in Phase 3) |
| `org-private` | ❌ | ❌ | All org members (Phase 4) |

---

## Phase 1: Basic Private Tools ✅ IMPLEMENTED

### Implementation Summary

**Database Migration**: `packages/server/supabase/migrations/20251221000000_add_tool_visibility.sql`
- Added `visibility` column with CHECK constraint
- Updated RLS policies for tools and tool_versions

**Search Migration**: `packages/server/supabase/migrations/20251221000001_update_search_for_visibility.sql`
- Updated `search_tools_hybrid` function to only return public tools

**CLI Changes**:
- `enact publish --private` - Publish as private
- `enact publish --unlisted` - Publish as unlisted
- `enact visibility <tool> <visibility>` - Change tool visibility

**API Changes**:
- Added `visibility` field to publish form data
- Added `PATCH /tools/{name}/visibility` endpoint
- Added `visibility` field to tool metadata responses

### Original 1.1 Database Schema Changes

Add visibility column to the `tools` table:

```sql
-- Migration: add_tool_visibility.sql

-- Add visibility column with default 'public'
ALTER TABLE public.tools 
ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public' 
CHECK (visibility IN ('public', 'private', 'unlisted'));

-- Create index for filtering by visibility
CREATE INDEX idx_tools_visibility ON public.tools(visibility);
```

### 1.2 Row Level Security (RLS) Policy Updates

Update RLS policies to respect visibility:

```sql
-- Migration: update_visibility_rls.sql

-- Drop existing public-access policies
DROP POLICY IF EXISTS "Tools are viewable by everyone" ON tools;
DROP POLICY IF EXISTS "Tool versions are viewable by everyone" ON tool_versions;

-- Tools: viewable if public, unlisted, or owned by current user
CREATE POLICY "Tools are viewable based on visibility"
  ON tools FOR SELECT
  USING (
    visibility = 'public' 
    OR visibility = 'unlisted'
    OR owner_id = auth.uid()
  );

-- Tool versions: inherit visibility from parent tool
CREATE POLICY "Tool versions follow tool visibility"
  ON tool_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tools
      WHERE tools.id = tool_versions.tool_id
      AND (
        tools.visibility IN ('public', 'unlisted')
        OR tools.owner_id = auth.uid()
      )
    )
  );
```

### 1.3 CLI Changes

#### Publish Command

File: `packages/cli/src/commands/publish.ts`

```typescript
// Add options
.option('--private', 'Publish as private (only you can access)')
.option('--unlisted', 'Publish as unlisted (accessible via direct link, not searchable)')

// Determine visibility
const visibility = options.private ? 'private' 
  : options.unlisted ? 'unlisted' 
  : 'public';

// Pass to API client
await client.publishTool(toolPath, { 
  ...existingOptions,
  visibility 
});
```

#### Install Command

File: `packages/cli/src/commands/install.ts`

```typescript
// Include auth token when fetching tools (needed for private tools)
const authToken = await getAuthToken();

const tool = await client.getTool(toolName, { 
  authToken // May be undefined for public tools
});
```

#### List Command

File: `packages/cli/src/commands/list.ts`

```typescript
// Add option to list private tools
.option('--private', 'List only your private tools')
.option('--all-visibility', 'List tools of all visibility levels')
```

### 1.4 API Client Changes

File: `packages/api/src/client.ts`

```typescript
interface PublishOptions {
  visibility?: 'public' | 'private' | 'unlisted';
  // ... existing options
}

async publishTool(path: string, options: PublishOptions = {}) {
  const formData = new FormData();
  formData.append('manifest', JSON.stringify(manifest));
  formData.append('bundle', bundle);
  formData.append('visibility', options.visibility || 'public');
  // ...
}
```

### 1.5 API Server Changes

#### Publish Handler

File: `packages/api/src/handlers/publish.ts`

```typescript
// Accept visibility from request
const visibility = body.visibility || 'public';

// Validate visibility value
if (!['public', 'private', 'unlisted'].includes(visibility)) {
  return Errors.invalidVisibility(visibility);
}

// Include in upsert
await db.from('tools').upsert({
  // ...existing fields
  visibility,
});
```

#### Search Handler

File: `packages/api/src/handlers/search.ts`

```typescript
// Only return public tools in search results
// Private and unlisted tools are excluded from search
let query = db.from('tools')
  .select('*')
  .eq('visibility', 'public');

// If authenticated, also include user's own private/unlisted tools
if (userId) {
  query = db.from('tools')
    .select('*')
    .or(`visibility.eq.public,owner_id.eq.${userId}`);
}
```

#### Get Tool Handler

File: `packages/api/src/handlers/get.ts`

```typescript
// Fetch tool (RLS will filter based on auth)
const { data: tool, error } = await db
  .from('tools')
  .select('*')
  .eq('name', toolName)
  .single();

// If not found (either doesn't exist or no access), return 404
// Don't differentiate to avoid leaking existence of private tools
if (error || !tool) {
  return Errors.toolNotFound(toolName);
}
```

#### Download Handler

File: `packages/api/src/handlers/download.ts`

```typescript
// RLS handles access control, but we double-check for bundle access
const { data: tool } = await db
  .from('tools')
  .select('*, tool_versions!inner(*)')
  .eq('name', toolName)
  .eq('tool_versions.version', version)
  .single();

if (!tool) {
  return Errors.toolNotFound(toolName);
}

// Proceed with bundle download
```

---

## Phase 2: Unlisted Tools & Visibility Management

### 2.1 Change Visibility Command

Add ability to change visibility after publishing:

```bash
# Change to public
enact visibility alice/tools/my-tool public

# Make private
enact visibility alice/tools/my-tool private

# Make unlisted
enact visibility alice/tools/my-tool unlisted
```

Implementation:

```typescript
// packages/cli/src/commands/visibility.ts
export const visibilityCommand = new Command('visibility')
  .description('Change tool visibility')
  .argument('<tool>', 'Tool name (e.g., alice/tools/my-tool)')
  .argument('<visibility>', 'New visibility: public, private, or unlisted')
  .action(async (tool, visibility) => {
    await client.updateToolVisibility(tool, visibility);
    console.log(`✓ ${tool} is now ${visibility}`);
  });
```

### 2.2 API Endpoint

```typescript
// PATCH /tools/:name/visibility
router.patch('/tools/:name/visibility', async (req, res) => {
  const { name } = req.params;
  const { visibility } = req.body;
  const userId = req.auth?.userId;

  // Verify ownership
  const tool = await db.from('tools')
    .select('owner_id')
    .eq('name', name)
    .single();

  if (tool.owner_id !== userId) {
    return Errors.unauthorized();
  }

  await db.from('tools')
    .update({ visibility })
    .eq('name', name);

  return { success: true };
});
```

---

## Phase 3: Team/Collaborator Access

### 3.1 Access Grants Table

```sql
-- Migration: add_tool_access_grants.sql

CREATE TABLE public.tool_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL CHECK (access_level IN ('read', 'write', 'admin')),
  granted_by UUID NOT NULL REFERENCES profiles(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ, -- Optional expiration
  UNIQUE (tool_id, user_id)
);

-- Index for efficient lookup
CREATE INDEX idx_tool_access_user ON tool_access(user_id);
CREATE INDEX idx_tool_access_tool ON tool_access(tool_id);

-- RLS for access grants
ALTER TABLE tool_access ENABLE ROW LEVEL SECURITY;

-- Users can see grants for tools they own or grants given to them
CREATE POLICY "View own grants"
  ON tool_access FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tools
      WHERE tools.id = tool_access.tool_id
      AND tools.owner_id = auth.uid()
    )
  );

-- Only tool owners can create/delete grants
CREATE POLICY "Owners manage grants"
  ON tool_access FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tools
      WHERE tools.id = tool_access.tool_id
      AND tools.owner_id = auth.uid()
    )
  );
```

### 3.2 Updated Tool Visibility RLS

```sql
-- Update tools RLS to include access grants
DROP POLICY "Tools are viewable based on visibility" ON tools;

CREATE POLICY "Tools are viewable based on visibility or grants"
  ON tools FOR SELECT
  USING (
    visibility = 'public'
    OR visibility = 'unlisted'
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tool_access
      WHERE tool_access.tool_id = tools.id
      AND tool_access.user_id = auth.uid()
      AND (tool_access.expires_at IS NULL OR tool_access.expires_at > now())
    )
  );
```

### 3.3 CLI Commands for Access Management

```bash
# Grant read access to a user
enact access grant alice/tools/my-tool --user bob --level read

# Grant write access (can publish new versions)
enact access grant alice/tools/my-tool --user carol --level write

# Revoke access
enact access revoke alice/tools/my-tool --user bob

# List who has access
enact access list alice/tools/my-tool

# View tools shared with you
enact list --shared
```

### 3.4 Access Levels

| Level | View | Install | Publish New Version | Manage Access |
|-------|------|---------|---------------------|---------------|
| `read` | ✅ | ✅ | ❌ | ❌ |
| `write` | ✅ | ✅ | ✅ | ❌ |
| `admin` | ✅ | ✅ | ✅ | ✅ |

---

## Phase 4: Organization Tools

> **Prerequisite**: Requires organization infrastructure (see backlog item `org-namespaces`)

### 4.1 Organization Schema

```sql
-- Migration: add_organizations.sql

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,  -- url-safe: acme, my-company
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Membership with roles
CREATE TABLE public.org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('member', 'admin', 'owner')),
  invited_by UUID REFERENCES profiles(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX idx_org_members_user ON org_members(user_id);
CREATE INDEX idx_org_members_org ON org_members(org_id);

-- RLS for organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

-- Anyone can see orgs (public namespaces)
CREATE POLICY "Organizations are viewable by everyone"
  ON organizations FOR SELECT
  USING (true);

-- Only owners can update org
CREATE POLICY "Owners can update org"
  ON organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = organizations.id
      AND org_members.user_id = auth.uid()
      AND org_members.role = 'owner'
    )
  );

-- Members can view membership
CREATE POLICY "Members can view org members"
  ON org_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_members AS my_membership
      WHERE my_membership.org_id = org_members.org_id
      AND my_membership.user_id = auth.uid()
    )
  );

-- Admins/owners can manage members
CREATE POLICY "Admins manage members"
  ON org_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_members AS my_membership
      WHERE my_membership.org_id = org_members.org_id
      AND my_membership.user_id = auth.uid()
      AND my_membership.role IN ('admin', 'owner')
    )
  );
```

### 4.2 Extended Tools Schema

```sql
-- Add org ownership to tools
ALTER TABLE public.tools
ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add org-private visibility option
ALTER TABLE public.tools
DROP CONSTRAINT tools_visibility_check,
ADD CONSTRAINT tools_visibility_check
  CHECK (visibility IN ('public', 'unlisted', 'private', 'org-private'));

-- Index for org lookups
CREATE INDEX idx_tools_org ON tools(org_id) WHERE org_id IS NOT NULL;

-- Tools can have either owner_id OR org_id (not both required)
-- user tools: owner_id set, org_id null
-- org tools: org_id set, owner_id = publishing user (for audit)
```

### 4.3 Org Tool Visibility RLS

```sql
-- Update tools RLS to include org membership
DROP POLICY "Tools are viewable based on visibility or grants" ON tools;

CREATE POLICY "Tools are viewable based on visibility, grants, or org membership"
  ON tools FOR SELECT
  USING (
    -- Public tools
    visibility = 'public'
    -- Unlisted (anyone with link)
    OR visibility = 'unlisted'
    -- Personal private tools (owner only)
    OR (visibility = 'private' AND org_id IS NULL AND owner_id = auth.uid())
    -- Org-private tools (any org member)
    OR (visibility = 'org-private' AND EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = tools.org_id
      AND org_members.user_id = auth.uid()
    ))
    -- Private tools with explicit grants
    OR EXISTS (
      SELECT 1 FROM tool_access
      WHERE tool_access.tool_id = tools.id
      AND tool_access.user_id = auth.uid()
      AND (tool_access.expires_at IS NULL OR tool_access.expires_at > now())
    )
  );

-- Publishing to org: must be admin/owner or have write role
CREATE POLICY "Org members can publish org tools"
  ON tools FOR INSERT
  WITH CHECK (
    -- Personal tools
    (org_id IS NULL AND owner_id = auth.uid())
    -- Org tools (admin/owner only)
    OR EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = tools.org_id
      AND org_members.user_id = auth.uid()
      AND org_members.role IN ('admin', 'owner')
    )
  );
```

### 4.4 Org Member Roles

| Role | View Org Tools | Publish Org Tools | Manage Members | Delete Org |
|------|----------------|-------------------|----------------|------------|
| `member` | ✅ | ❌ | ❌ | ❌ |
| `admin` | ✅ | ✅ | ✅ | ❌ |
| `owner` | ✅ | ✅ | ✅ | ✅ |

### 4.5 CLI Commands for Organizations

```bash
# Create an organization
enact org create acme --display-name "Acme Corp"
# ✓ Created organization: acme

# Invite members
enact org invite acme --email bob@acme.com --role admin
enact org invite acme --email carol@acme.com --role member
# ✓ Invitation sent to bob@acme.com (admin)
# ✓ Invitation sent to carol@acme.com (member)

# List members
enact org members acme
# User              Role     Joined
# alice@acme.com    owner    2024-01-01
# bob@acme.com      admin    2024-01-15
# carol@acme.com    member   2024-01-20

# Remove member
enact org remove acme --user carol@acme.com
# ✓ Removed carol@acme.com from acme

# Change member role
enact org role acme --user bob@acme.com --role owner
# ✓ Updated bob@acme.com to owner

# List your organizations
enact org list
# Organization    Role     Members
# acme            owner    3
# beta-team       member   12
```

### 4.6 Publishing Org Tools

```bash
# Publish as org-private (all members can see/install)
enact publish ./my-tool --org acme --org-private
# ✓ Published acme/tools/my-tool@1.0.0 (org-private)

# Publish as public under org namespace
enact publish ./my-tool --org acme
# ✓ Published acme/tools/my-tool@1.0.0 (public)

# Publish private under org (only you, even within org)
enact publish ./my-tool --org acme --private
# ✓ Published acme/tools/my-tool@1.0.0 (private)
```

### 4.7 Org Tool Namespacing

```
# User tools (existing):
alice/tools/my-tool

# Org tools:
acme/tools/internal-api
acme/tools/deployment-helper

# Disambiguation when user and org have same name:
# User namespace takes precedence, orgs must use unique names
# Or: @acme/tools/... for orgs (npm-style)
```

### 4.8 Org Access via Tool Grants (Hybrid)

Organizations can also grant access to non-members:

```bash
# Grant external user access to org tool
enact access grant acme/tools/partner-api --user partner@external.com --level read
# ✓ Granted read access to partner@external.com

# This uses the existing tool_access table
# Works for both personal and org tools
```

---

## Usage Examples

### Basic Private Publishing

```bash
# Publish a private tool
enact publish ./my-tool --private
# ✓ Published alice/tools/my-tool@1.0.0 (private)

# Publish unlisted (shareable link but not searchable)
enact publish ./my-tool --unlisted
# ✓ Published alice/tools/my-tool@1.0.0 (unlisted)

# Default is still public
enact publish ./my-tool
# ✓ Published alice/tools/my-tool@1.0.0 (public)
```

### Installing Private Tools

```bash
# Must be authenticated to install your own private tools
enact auth login
enact install alice/tools/my-private-tool
# ✓ Installed alice/tools/my-private-tool@1.0.0

# Unauthenticated access to private tools fails
enact auth logout
enact install alice/tools/my-private-tool
# ✗ Error: Tool not found (or not accessible)
```

### Managing Visibility

```bash
# Check current visibility
enact get alice/tools/my-tool --format json | jq .visibility
# "private"

# Change visibility
enact visibility alice/tools/my-tool public
# ✓ alice/tools/my-tool is now public
```

### Team Access (Phase 3)

```bash
# Share with a collaborator
enact access grant alice/tools/internal-tool --user bob@company.com --level read
# ✓ Granted read access to bob@company.com

# Bob can now install
# (as bob)
enact install alice/tools/internal-tool
# ✓ Installed alice/tools/internal-tool@1.0.0

# List collaborators
enact access list alice/tools/internal-tool
# User                Level    Granted
# bob@company.com     read     2024-01-15
# carol@company.com   write    2024-01-10
```

---

## Security Considerations

### 1. Don't Leak Existence

When a user requests a private tool they don't have access to, return the same error as if the tool doesn't exist:

```typescript
// Good: Same error for "not found" and "no access"
return Errors.toolNotFound(toolName);

// Bad: Reveals that tool exists but is private
return Errors.accessDenied(toolName);
```

### 2. Validate Visibility on Every Access

Don't cache visibility status. Check on every:
- GET /tools/:name
- GET /tools/:name/versions/:version
- GET /tools/:name/download/:version
- Search results

### 3. Audit Logging

Log access to private tools for security auditing:

```sql
CREATE TABLE tool_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID REFERENCES tools(id),
  user_id UUID REFERENCES profiles(id),
  action TEXT, -- 'view', 'download', 'install'
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4. Bundle Storage

Private tool bundles should:
- Use signed URLs with expiration for downloads
- Not be served from public CDN paths
- Have access logged

---

## Migration Path

### For Existing Tools

All existing tools default to `public` visibility, so no breaking changes:

```sql
ALTER TABLE public.tools 
ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';
```

### Rollback Plan

If issues arise:

```sql
-- Rollback: remove visibility column
ALTER TABLE public.tools DROP COLUMN visibility;

-- Restore original RLS policies
CREATE POLICY "Tools are viewable by everyone"
  ON tools FOR SELECT
  USING (true);
```

---

## Testing Checklist

### Phase 1
- [ ] Publish with `--private` flag sets visibility correctly
- [ ] Private tools don't appear in search results
- [ ] Owner can install their own private tools
- [ ] Non-owner gets "not found" for private tools
- [ ] Unlisted tools are accessible via direct name but not searchable
- [ ] Default visibility remains `public`

### Phase 2
- [ ] `enact visibility` command works
- [ ] Cannot change visibility of tools you don't own

### Phase 3
- [ ] Access grants work correctly
- [ ] Expired grants are rejected
- [ ] Revoking access takes effect immediately
- [ ] Access levels are enforced (read vs write)

### Phase 4
- [ ] Organization creation works
- [ ] Member invites/acceptance flow
- [ ] Role permissions enforced (member vs admin vs owner)
- [ ] `org-private` visibility restricts to org members only
- [ ] Publishing to org namespace requires admin/owner role
- [ ] Org tools visible to all members
- [ ] External access grants work for org tools
- [ ] Org deletion cascades to tools appropriately

---

## Timeline Estimate

| Phase | Scope | Estimate |
|-------|-------|----------|
| Phase 1 | Basic private/public | 2-3 days |
| Phase 2 | Unlisted + visibility management | 1-2 days |
| Phase 3 | Team access grants | 3-5 days |
| Phase 4 | Organizations | 5-8 days |

---

## Open Questions

1. **Pricing**: Should private tools be a paid feature? Org plans?
2. **Limits**: Max number of private tools per user? Per org?
3. ~~**Organizations**: Support org-level private tools vs user-level?~~ → **Phase 4**
4. **Transfer**: Can ownership of private tools be transferred? Between users? User to org?
5. **Forking**: Can private tools be forked? By whom? Within same org?
6. **Org Billing**: Per-seat pricing? Flat rate? Usage-based?
7. **SSO/SAML**: Enterprise orgs with SSO for member management?
8. **Audit Logs**: Org-level audit logs for compliance?
