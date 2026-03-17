
-- Final fix for RLS recursion and company updates
-- This migration uses SECURITY DEFINER functions to break the recursion chain

-- 1. Helper function to get current user's company_id without recursion
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS uuid AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Helper function to check if current user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. Drop old problematic policies
DROP POLICY IF EXISTS "Users can view profiles in same company" ON profiles;
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
DROP POLICY IF EXISTS "Admins can update their company" ON companies;
DROP POLICY IF EXISTS "Users can view their company projects" ON projects;
DROP POLICY IF EXISTS "Users can update their company projects" ON projects;

-- 4. New Policies for Profiles
CREATE POLICY "Profiles visibility"
ON profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid() 
  OR company_id = get_my_company_id()
);

-- 5. New Policies for Companies
CREATE POLICY "Companies visibility"
ON companies FOR SELECT
TO authenticated
USING (
  id = get_my_company_id()
);

CREATE POLICY "Companies update"
ON companies FOR UPDATE
TO authenticated
USING (
  id = get_my_company_id() AND is_admin()
)
WITH CHECK (
  id = get_my_company_id() AND is_admin()
);

-- 6. New Policies for Projects
CREATE POLICY "Projects visibility"
ON projects FOR SELECT
TO authenticated
USING (
  company_id = get_my_company_id()
);

CREATE POLICY "Projects update"
ON projects FOR UPDATE
TO authenticated
USING (
  company_id = get_my_company_id()
)
WITH CHECK (
  company_id = get_my_company_id()
);

-- 7. Ensure profiles can be updated (already defined usually, but just in case)
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());
