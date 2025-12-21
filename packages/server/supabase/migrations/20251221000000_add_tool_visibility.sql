-- Migration: Add Tool Visibility
-- Phase 1: Basic private/public/unlisted visibility for tools
-- Description: Adds visibility column and updates RLS policies

-- =============================================================================
-- Add visibility column
-- =============================================================================

-- Add visibility column with default 'public'
ALTER TABLE public.tools 
ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';

-- Add constraint for valid visibility values
ALTER TABLE public.tools 
ADD CONSTRAINT tools_visibility_check 
CHECK (visibility IN ('public', 'private', 'unlisted'));

-- Create index for filtering by visibility
CREATE INDEX IF NOT EXISTS idx_tools_visibility ON public.tools(visibility);

-- =============================================================================
-- Update Row Level Security (RLS) Policies
-- =============================================================================

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

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON COLUMN tools.visibility IS 'Tool visibility: public (searchable), unlisted (direct link only), private (owner only)';
