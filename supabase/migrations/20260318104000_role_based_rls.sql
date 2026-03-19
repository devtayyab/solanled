
-- Phase 2: Role Based Access Control (RBAC) System
-- Created: 2026-03-18

-- 1. Helper function to check Sloan Admin status
CREATE OR REPLACE FUNCTION is_sloan_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('sloan_admin', 'superadmin')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Drop old emergency/basic policies to replace them
DROP POLICY IF EXISTS "profiles_select_basic" ON profiles;
DROP POLICY IF EXISTS "companies_select_basic" ON companies;
DROP POLICY IF EXISTS "projects_select_basic" ON projects;
DROP POLICY IF EXISTS "companies_update_basic" ON companies;

-- 3. PROFILES: Security Rules
CREATE POLICY "profiles_read_all" ON profiles FOR SELECT TO authenticated
USING (
  id = auth.uid() OR 
  is_sloan_admin() OR
  EXISTS (
    SELECT 1 FROM company_members cm1
    JOIN company_members cm2 ON cm1.company_id = cm2.company_id
    WHERE cm1.user_id = auth.uid() AND cm2.user_id = profiles.id
  )
);

-- 4. COMPANIES: Security Rules
CREATE POLICY "companies_read_access" ON companies FOR SELECT TO authenticated
USING (
  is_sloan_admin() OR
  id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()) OR
  status = 'approved' -- Allow public view of approved companies if needed?
);

CREATE POLICY "companies_update_access" ON companies FOR UPDATE TO authenticated
USING (
  is_sloan_admin() OR
  id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('signmaker', 'admin'))
)
WITH CHECK (
  is_sloan_admin() OR
  id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('signmaker', 'admin'))
);

-- 5. PROJECTS: Multi-Company & Assignment Aware
CREATE POLICY "projects_access_v2" ON projects FOR SELECT TO authenticated
USING (
  is_sloan_admin() OR
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('signmaker', 'admin')) OR
  id IN (SELECT project_id FROM project_assignments WHERE user_id = auth.uid() AND can_view = true)
);

CREATE POLICY "projects_insert_v2" ON projects FOR INSERT TO authenticated
WITH CHECK (
  is_sloan_admin() OR
  company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('signmaker', 'admin'))
);

-- 6. PROJECT PHOTOS & DOCUMENTS (Project Assignment based)
DROP POLICY IF EXISTS "Users can view photos of their company projects" ON project_photos;
CREATE POLICY "photos_read_v2" ON project_photos FOR SELECT TO authenticated
USING (
  is_sloan_admin() OR
  project_id IN (SELECT project_id FROM projects WHERE company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('signmaker', 'admin'))) OR
  project_id IN (SELECT project_id FROM project_assignments WHERE user_id = auth.uid() AND can_view = true)
);

DROP POLICY IF EXISTS "Users can upload photos to their company projects" ON project_photos;
CREATE POLICY "photos_upload_v2" ON project_photos FOR INSERT TO authenticated
WITH CHECK (
  is_sloan_admin() OR
  project_id IN (SELECT project_id FROM projects WHERE company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('signmaker', 'admin'))) OR
  project_id IN (SELECT project_id FROM project_assignments WHERE user_id = auth.uid() AND can_upload_photos = true)
);
