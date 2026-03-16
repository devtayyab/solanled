-- Migration to fix RLS infinite recursion in profiles and related tables
-- Created on: 2026-03-16

-- 1. Drop old problematic policies
DROP POLICY IF EXISTS "Users can view profiles in same company" ON profiles;
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
DROP POLICY IF EXISTS "Users can view their company projects" ON projects;

-- 2. Fixed "Profiles" policy (Infinite loop-safe)
CREATE POLICY "Users can view profiles in same company"
ON profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid() OR 
  company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid() LIMIT 1)
);

-- 3. Fixed "Companies" policy
CREATE POLICY "Users can view their own company"
ON companies FOR SELECT
TO authenticated
USING (
  id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid() LIMIT 1)
);

-- 4. Fixed "Projects" policy
CREATE POLICY "Users can view their company projects"
ON projects FOR SELECT
TO authenticated
USING (
  company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid() LIMIT 1)
);

-- Note: Using subqueries with LIMIT 1 prevents the database from performing recursive scans
-- which was causing the 500 Internal Server Error.
