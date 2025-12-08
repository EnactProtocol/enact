-- Enact Registry Initial Schema
-- Version: v2
-- Description: Core tables for tools, versions, attestations, and trust

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================================
-- User Profiles (extends Supabase auth.users)
-- =============================================================================

CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Username validation: lowercase alphanumeric, hyphens, underscores
ALTER TABLE public.profiles ADD CONSTRAINT username_format
  CHECK (username ~ '^[a-z0-9_-]+$');

-- =============================================================================
-- Tools
-- =============================================================================

CREATE TABLE public.tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) NOT NULL,
  name TEXT NOT NULL,  -- Full name like "alice/utils/greeter"
  short_name TEXT NOT NULL,  -- Just "utils/greeter"
  description TEXT,
  license TEXT,
  tags TEXT[],
  repository_url TEXT,
  homepage_url TEXT,
  total_downloads INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (owner_id, short_name)
);

-- =============================================================================
-- Tool Versions
-- =============================================================================

CREATE TABLE public.tool_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID REFERENCES tools(id) ON DELETE CASCADE NOT NULL,
  version TEXT NOT NULL,
  manifest JSONB NOT NULL,
  readme TEXT,
  bundle_hash TEXT NOT NULL,
  bundle_size INTEGER NOT NULL,
  bundle_path TEXT NOT NULL,
  downloads INTEGER DEFAULT 0,
  yanked BOOLEAN DEFAULT FALSE,
  yank_reason TEXT,
  yank_replacement TEXT,
  yanked_at TIMESTAMPTZ,
  published_by UUID REFERENCES profiles(id) NOT NULL,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tool_id, version)
);

-- Version validation: semver format
ALTER TABLE public.tool_versions ADD CONSTRAINT version_format
  CHECK (version ~ '^\d+\.\d+\.\d+(-[a-z0-9.-]+)?(\+[a-z0-9.-]+)?$');

-- =============================================================================
-- Auditor Attestations
-- =============================================================================

CREATE TABLE public.attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_version_id UUID REFERENCES tool_versions(id) ON DELETE CASCADE NOT NULL,
  auditor TEXT NOT NULL,  -- email from Sigstore certificate
  auditor_provider TEXT,  -- github, google, microsoft, etc.
  bundle JSONB NOT NULL,  -- Full Sigstore bundle for offline verification
  rekor_log_id TEXT NOT NULL,
  rekor_log_index BIGINT,
  signed_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  rekor_verified BOOLEAN DEFAULT FALSE,
  certificate_verified BOOLEAN DEFAULT FALSE,
  signature_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tool_version_id, auditor)  -- One attestation per auditor per version
);

-- =============================================================================
-- Trust Relationships
-- =============================================================================

CREATE TABLE public.trusted_auditors (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  auditor_identity TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, auditor_identity)
);

-- =============================================================================
-- Reports
-- =============================================================================

CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_version_id UUID REFERENCES tool_versions(id) ON DELETE CASCADE NOT NULL,
  reporter_id UUID REFERENCES profiles(id) NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  category TEXT NOT NULL CHECK (category IN ('security', 'malware', 'license', 'quality', 'other')),
  description TEXT NOT NULL,
  evidence TEXT,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewing', 'confirmed', 'dismissed', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

-- =============================================================================
-- Download Logs (for analytics)
-- =============================================================================

CREATE TABLE public.download_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_version_id UUID REFERENCES tool_versions(id) ON DELETE CASCADE NOT NULL,
  downloaded_at TIMESTAMPTZ DEFAULT NOW(),
  ip_hash TEXT,
  user_agent TEXT
);

-- =============================================================================
-- Indexes
-- =============================================================================

-- Profiles
CREATE INDEX idx_profiles_username ON profiles(username);

-- Tools
CREATE INDEX idx_tools_owner ON tools(owner_id);
CREATE INDEX idx_tools_name ON tools(name);
CREATE INDEX idx_tools_tags ON tools USING GIN(tags);
CREATE INDEX idx_tools_description_trgm ON tools USING GIN(description gin_trgm_ops);

-- Tool Versions
CREATE INDEX idx_tool_versions_tool ON tool_versions(tool_id);
CREATE INDEX idx_tool_versions_not_yanked ON tool_versions(tool_id) WHERE NOT yanked;
CREATE INDEX idx_tool_versions_published ON tool_versions(published_at DESC);

-- Attestations
CREATE INDEX idx_attestations_tool_version ON attestations(tool_version_id);
CREATE INDEX idx_attestations_auditor ON attestations(auditor);
CREATE INDEX idx_attestations_verified ON attestations(tool_version_id, verified) WHERE verified = true;

-- Reports
CREATE INDEX idx_reports_tool_version ON reports(tool_version_id);
CREATE INDEX idx_reports_status ON reports(status) WHERE status IN ('submitted', 'reviewing');

-- Download Logs
CREATE INDEX idx_download_logs_tool_version ON download_logs(tool_version_id);
CREATE INDEX idx_download_logs_downloaded_at ON download_logs(downloaded_at DESC);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Tools
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tools are viewable by everyone"
  ON tools FOR SELECT
  USING (true);

CREATE POLICY "Owners can insert their tools"
  ON tools FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their tools"
  ON tools FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete their tools"
  ON tools FOR DELETE
  USING (owner_id = auth.uid());

-- Tool Versions
ALTER TABLE tool_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tool versions are viewable by everyone"
  ON tool_versions FOR SELECT
  USING (true);

CREATE POLICY "Owners can publish versions"
  ON tool_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools
      WHERE tools.id = tool_versions.tool_id
      AND tools.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can yank/unyank versions"
  ON tool_versions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tools
      WHERE tools.id = tool_versions.tool_id
      AND tools.owner_id = auth.uid()
    )
  );

-- Attestations
ALTER TABLE attestations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attestations are viewable by everyone"
  ON attestations FOR SELECT
  USING (true);

CREATE POLICY "Anyone authenticated can submit attestations"
  ON attestations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update attestations"
  ON attestations FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Trusted Auditors
ALTER TABLE trusted_auditors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trust list"
  ON trusted_auditors FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their trust list"
  ON trusted_auditors FOR ALL
  USING (user_id = auth.uid());

-- Reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reports viewable by reporter and admins"
  ON reports FOR SELECT
  USING (
    reporter_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Authenticated users can submit reports"
  ON reports FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND reporter_id = auth.uid()
  );

-- Download Logs (no RLS - internal analytics only)
-- ALTER TABLE download_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Functions
-- =============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tools_updated_at
  BEFORE UPDATE ON tools
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Increment download counter
CREATE OR REPLACE FUNCTION increment_download_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment version downloads
  UPDATE tool_versions
  SET downloads = downloads + 1
  WHERE id = NEW.tool_version_id;

  -- Increment total tool downloads
  UPDATE tools
  SET total_downloads = total_downloads + 1
  WHERE id = (
    SELECT tool_id FROM tool_versions WHERE id = NEW.tool_version_id
  );

  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER increment_downloads_on_log
  AFTER INSERT ON download_logs
  FOR EACH ROW
  EXECUTE FUNCTION increment_download_count();

-- =============================================================================
-- Initial Data
-- =============================================================================

-- Create system user for migrations and internal operations
-- This will be replaced with actual OAuth users in production
INSERT INTO auth.users (id, email, email_confirmed_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'system@enact.tools',
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (id, username, display_name, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'system',
  'Enact System',
  NOW()
) ON CONFLICT DO NOTHING;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE profiles IS 'User profiles extending Supabase auth.users';
COMMENT ON TABLE tools IS 'Tool metadata - one row per tool (namespace/path)';
COMMENT ON TABLE tool_versions IS 'Tool versions with manifests and bundle references';
COMMENT ON TABLE attestations IS 'Auditor attestations with Sigstore bundles for offline verification';
COMMENT ON TABLE trusted_auditors IS 'User trust lists - which auditors they trust';
COMMENT ON TABLE reports IS 'Security and quality reports submitted by users';
COMMENT ON TABLE download_logs IS 'Download analytics (anonymized)';
