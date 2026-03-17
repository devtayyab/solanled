
-- 1. Drop ALL problematic RLS policies to stop recursion
DROP POLICY IF EXISTS "Users can view profiles in same company" ON profiles;
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
DROP POLICY IF EXISTS "Users can view their company projects" ON projects;
DROP POLICY IF EXISTS "Profiles visibility" ON profiles;
DROP POLICY IF EXISTS "Companies visibility" ON companies;
DROP POLICY IF EXISTS "Projects visibility" ON projects;
DROP POLICY IF EXISTS "Admins can update their company" ON companies;

-- 2. Profiles: Simplest possible select
CREATE POLICY "profiles_select_basic" ON profiles FOR SELECT TO authenticated
USING (true); -- Temporarily allow select to break the recursion chain

-- 3. Companies: Simplest possible select 
CREATE POLICY "companies_select_basic" ON companies FOR SELECT TO authenticated
USING (true); -- Temporarily allow select

-- 4. Projects: Simplest possible select
CREATE POLICY "projects_select_basic" ON projects FOR SELECT TO authenticated
USING (true);

-- 5. Company Update: Simple check
CREATE POLICY "companies_update_basic" ON companies FOR UPDATE TO authenticated
USING (
  id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'superadmin'))
);
