
-- Migration: Superadmin Full Access & Missing Policies Fix
-- Created: 2026-04-10

-- 1. Ensure COMPANIES has full access for Superadmins
DROP POLICY IF EXISTS "Companies full access for sloan admins" ON companies;
CREATE POLICY "Companies full access for sloan admins" ON companies 
FOR ALL TO authenticated 
USING (is_sloan_admin())
WITH CHECK (is_sloan_admin());

-- Ensure anyone can still insert a company (for onboarding) if it doesn't conflict
-- Or better, restrict it to authenticated users for now if that's the flow
DROP POLICY IF EXISTS "Anyone can insert a company" ON companies;
CREATE POLICY "authenticated_insert_company" ON companies 
FOR INSERT TO authenticated 
WITH CHECK (true);

-- 2. Ensure PROJECTS has full access for Superadmins
DROP POLICY IF EXISTS "Projects full access for sloan admins" ON projects;
CREATE POLICY "Projects full access for sloan admins" ON projects 
FOR ALL TO authenticated 
USING (is_sloan_admin())
WITH CHECK (is_sloan_admin());

-- 3. Ensure COMPANY_MEMBERS (Team) has full access for Superadmins
DROP POLICY IF EXISTS "Team management for sloan admins" ON company_members;
CREATE POLICY "Team management for sloan admins" ON company_members 
FOR ALL TO authenticated 
USING (is_sloan_admin())
WITH CHECK (is_sloan_admin());

-- 4. Ensure PROJECT_ASSIGNMENTS has full access for Superadmins
DROP POLICY IF EXISTS "Assignments management for sloan admins" ON project_assignments;
CREATE POLICY "Assignments management for sloan admins" ON project_assignments 
FOR ALL TO authenticated 
USING (is_sloan_admin())
WITH CHECK (is_sloan_admin());

-- 5. DOCUMENTS management for Superadmins
DROP POLICY IF EXISTS "Documents management for sloan admins" ON documents;
CREATE POLICY "Documents management for sloan admins" ON documents 
FOR ALL TO authenticated 
USING (is_sloan_admin())
WITH CHECK (is_sloan_admin());
