-- Fix missing Project Update RLS
-- Allows Sloan Admins, Signmakers, and Installers to update project details (status, GPS, etc.)
-- Created: 2026-04-27

-- 1. Add UPDATE policy for projects
DROP POLICY IF EXISTS "projects_update_v2" ON projects;
CREATE POLICY "projects_update_v2" ON projects FOR UPDATE TO authenticated
USING (
  public.is_sloan_admin() OR
  company_id IN (SELECT public.get_my_company_ids()) OR
  id IN (SELECT project_id FROM project_assignments WHERE user_id = auth.uid() AND can_edit = true)
)
WITH CHECK (
  public.is_sloan_admin() OR
  company_id IN (SELECT public.get_my_company_ids()) OR
  id IN (SELECT project_id FROM project_assignments WHERE user_id = auth.uid() AND can_edit = true)
);

-- 2. Add DELETE policy for projects (Admins only)
DROP POLICY IF EXISTS "projects_delete_v2" ON projects;
CREATE POLICY "projects_delete_v2" ON projects FOR DELETE TO authenticated
USING (
  public.is_sloan_admin() OR
  company_id IN (SELECT public.get_my_managed_company_ids())
);
