-- Add raw_manifest column to store the full enact.md file content
-- The existing 'readme' column is reserved for future README.md support

ALTER TABLE tool_versions ADD COLUMN IF NOT EXISTS raw_manifest TEXT;

-- Copy existing readme data to raw_manifest (if any tools were published with enact.md content)
UPDATE tool_versions SET raw_manifest = readme WHERE readme IS NOT NULL;

-- Comment on the columns to clarify their purpose
COMMENT ON COLUMN tool_versions.raw_manifest IS 'The raw enact.md file content (frontmatter + markdown documentation)';
COMMENT ON COLUMN tool_versions.readme IS 'Reserved for future README.md file content';
