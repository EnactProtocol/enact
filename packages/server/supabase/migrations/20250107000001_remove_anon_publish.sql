-- Remove temporary anonymous publishing policies for production
-- This enforces proper authentication and namespace ownership

DROP POLICY IF EXISTS "Allow anon to insert tools for testing" ON tools;
DROP POLICY IF EXISTS "Allow anon to insert tool_versions for testing" ON tool_versions;
