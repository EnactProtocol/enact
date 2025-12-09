-- Allow authenticated users to insert their own profile
-- This is needed for the "choose username" flow after signup

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
