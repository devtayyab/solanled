-- Fix infinite recursion in RLS policies by using SECURITY DEFINER functions
-- Created: 2026-03-19

-- 1. Redefine is_sloan_admin to explicitly set search_path
CREATE OR REPLACE FUNCTION public.is_sloan_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('sloan_admin', 'superadmin')
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 2. Helper function to bypass RLS and get companies user belongs to
CREATE OR REPLACE FUNCTION public.get_my_company_ids()
RETURNS setof uuid AS $$
  SELECT company_id FROM public.company_members WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 3. Helper function to bypass RLS and get companies where user is signmaker/admin
CREATE OR REPLACE FUNCTION public.get_my_managed_company_ids()
RETURNS setof uuid AS $$
  SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND role IN ('signmaker', 'admin');
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 4. Fix Profile Policies
DROP POLICY IF EXISTS "profiles_read_all" ON profiles;
CREATE POLICY "profiles_read_all" ON profiles FOR SELECT TO authenticated
USING (
  id = auth.uid() OR 
  public.is_sloan_admin() OR
  -- We query company_members directly. It will trigger company_members RLS, 
  -- but since those use our helper functions above, there will be no recursion.
  id IN (
    SELECT user_id FROM public.company_members 
    WHERE company_id IN (SELECT public.get_my_company_ids())
  )
);

-- 5. Fix Company Member Policies
DROP POLICY IF EXISTS "Sloan Admins see everything members" ON company_members;
DROP POLICY IF EXISTS "Signmakers manage their company members" ON company_members;
DROP POLICY IF EXISTS "Users see their own memberships" ON company_members;

CREATE POLICY "Sloan Admins see everything members" ON company_members FOR ALL TO authenticated USING (
  public.is_sloan_admin()
);

CREATE POLICY "Users see their own memberships" ON company_members FOR SELECT TO authenticated USING (
  user_id = auth.uid()
);

CREATE POLICY "Signmakers manage their company members" ON company_members FOR ALL TO authenticated USING (
  company_id IN (SELECT public.get_my_managed_company_ids())
);

-- 6. Fix Company Policies
DROP POLICY IF EXISTS "companies_read_access" ON companies;
CREATE POLICY "companies_read_access" ON companies FOR SELECT TO authenticated
USING (
  public.is_sloan_admin() OR
  id IN (SELECT public.get_my_company_ids()) OR
  status = 'approved'
);

DROP POLICY IF EXISTS "companies_update_access" ON companies;
CREATE POLICY "companies_update_access" ON companies FOR UPDATE TO authenticated
USING (
  public.is_sloan_admin() OR id IN (SELECT public.get_my_managed_company_ids())
)
WITH CHECK (
  public.is_sloan_admin() OR id IN (SELECT public.get_my_managed_company_ids())
);

-- 7. Fix Project Policies
DROP POLICY IF EXISTS "projects_access_v2" ON projects;
CREATE POLICY "projects_access_v2" ON projects FOR SELECT TO authenticated
USING (
  public.is_sloan_admin() OR
  company_id IN (SELECT public.get_my_company_ids()) OR
  id IN (SELECT project_id FROM project_assignments WHERE user_id = auth.uid() AND can_view = true)
);

DROP POLICY IF EXISTS "projects_insert_v2" ON projects;
CREATE POLICY "projects_insert_v2" ON projects FOR INSERT TO authenticated
WITH CHECK (
  public.is_sloan_admin() OR
  company_id IN (SELECT public.get_my_managed_company_ids())
);
