-- For Development Only: Disable RLS on citizens and credentials tables
-- This allows writes via anon key during local development
-- For Production: Re-enable RLS and use service_role key, or create proper policies

-- Disable RLS on citizens table
ALTER TABLE citizens DISABLE ROW LEVEL SECURITY;

-- Disable RLS on credentials table
ALTER TABLE credentials DISABLE ROW LEVEL SECURITY;

-- Verify RLS status
SELECT schemaname, tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('citizens', 'credentials');
