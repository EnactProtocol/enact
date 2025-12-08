-- Temporarily allow anonymous publishing for testing
-- TODO: Replace with proper authentication flow

CREATE POLICY "Allow anon to insert tools for testing"
  ON tools FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon to insert tool_versions for testing"
  ON tool_versions FOR INSERT
  TO anon
  WITH CHECK (true);
