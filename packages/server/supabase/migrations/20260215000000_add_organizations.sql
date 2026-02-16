-- Organizations for npm-style @org scoped namespaces
-- Allows businesses to reserve @org scopes and manage team publishing

-- =============================================================================
-- Organizations
-- =============================================================================

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT,
  description TEXT,
  avatar_url TEXT,
  created_by UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Org name format: same as username (lowercase alphanumeric, hyphens, underscores)
ALTER TABLE public.organizations ADD CONSTRAINT org_name_format
  CHECK (name ~ '^[a-z0-9_-]+$');

-- Prevent org names from colliding with usernames
CREATE OR REPLACE FUNCTION check_org_name_not_username()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE username = NEW.name) THEN
    RAISE EXCEPTION 'Organization name "%" conflicts with existing username', NEW.name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER org_name_uniqueness
  BEFORE INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION check_org_name_not_username();

-- Prevent new usernames from conflicting with org names
CREATE OR REPLACE FUNCTION check_username_not_org()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM organizations WHERE name = NEW.username) THEN
    RAISE EXCEPTION 'Username "%" conflicts with existing organization', NEW.username;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER username_org_uniqueness
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION check_username_not_org();

-- =============================================================================
-- Organization Members
-- =============================================================================

CREATE TABLE public.org_members (
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES profiles(id),
  PRIMARY KEY (org_id, user_id)
);

-- =============================================================================
-- Extend Tools Table
-- =============================================================================

ALTER TABLE public.tools ADD COLUMN org_id UUID REFERENCES organizations(id);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX idx_organizations_name ON organizations(name);
CREATE INDEX idx_org_members_user ON org_members(user_id);
CREATE INDEX idx_org_members_org ON org_members(org_id);
CREATE INDEX idx_tools_org ON tools(org_id) WHERE org_id IS NOT NULL;

-- =============================================================================
-- Row Level Security
-- =============================================================================

-- Organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizations are viewable by everyone"
  ON organizations FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Org admins and owners can update org"
  ON organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = organizations.id
      AND org_members.user_id = auth.uid()
      AND org_members.role IN ('owner', 'admin')
    )
  );

-- Org Members
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members visible to everyone"
  ON org_members FOR SELECT USING (true);

CREATE POLICY "Org owners and admins can add members"
  ON org_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = org_members.org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
    -- Also allow the org creator to add themselves as first member
    OR (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM organizations
        WHERE organizations.id = org_members.org_id
        AND organizations.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Org owners can remove members, members can remove themselves"
  ON org_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = org_members.org_id
      AND om.user_id = auth.uid()
      AND om.role = 'owner'
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Org owners can update member roles"
  ON org_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = org_members.org_id
      AND om.user_id = auth.uid()
      AND om.role = 'owner'
    )
  );

-- =============================================================================
-- Update Tools RLS for Org Support
-- =============================================================================

-- Replace existing INSERT policy
DROP POLICY IF EXISTS "Owners can insert their tools" ON tools;
CREATE POLICY "Owners or org members can insert tools"
  ON tools FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    OR (
      org_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM org_members
        WHERE org_members.org_id = tools.org_id
        AND org_members.user_id = auth.uid()
      )
    )
  );

-- Replace existing UPDATE policy
DROP POLICY IF EXISTS "Owners can update their tools" ON tools;
CREATE POLICY "Owners or org admins can update tools"
  ON tools FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR (
      org_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM org_members
        WHERE org_members.org_id = tools.org_id
        AND org_members.user_id = auth.uid()
        AND org_members.role IN ('owner', 'admin')
      )
    )
  );

-- Replace existing DELETE policy
DROP POLICY IF EXISTS "Owners can delete their tools" ON tools;
CREATE POLICY "Owners or org owners can delete tools"
  ON tools FOR DELETE
  USING (
    owner_id = auth.uid()
    OR (
      org_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM org_members
        WHERE org_members.org_id = tools.org_id
        AND org_members.user_id = auth.uid()
        AND org_members.role = 'owner'
      )
    )
  );

-- =============================================================================
-- Update Tool Versions RLS for Org Support
-- =============================================================================

DROP POLICY IF EXISTS "Owners can publish versions" ON tool_versions;
CREATE POLICY "Owners or org members can publish versions"
  ON tool_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools
      WHERE tools.id = tool_versions.tool_id
      AND (
        tools.owner_id = auth.uid()
        OR (
          tools.org_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM org_members
            WHERE org_members.org_id = tools.org_id
            AND org_members.user_id = auth.uid()
          )
        )
      )
    )
  );

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE organizations IS 'Organizations for @org scoped tool namespaces';
COMMENT ON TABLE org_members IS 'Organization membership with roles (owner, admin, member)';
COMMENT ON COLUMN tools.org_id IS 'Organization that owns this tool (NULL for user-scoped tools)';
