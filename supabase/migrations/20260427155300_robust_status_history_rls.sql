-- Robust RLS for Project Status History
-- Uses Security Definer function to avoid RLS recursion/overhead issues for Signmakers and Admins
-- Created: 2026-04-27

-- 1. Create a specialized permission checker to avoid RLS subquery issues
CREATE OR REPLACE FUNCTION public.can_manage_project_history(proj_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Sloan admins/Superadmins can always manage history
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('sloan_admin', 'superadmin')) THEN
    RETURN true;
  END IF;

  -- Verify user is a signmaker/admin in the company that owns the project
  RETURN EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.company_members cm ON cm.company_id = p.company_id
    WHERE p.id = proj_id 
    AND cm.user_id = auth.uid() 
    AND cm.role IN ('signmaker', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Apply the simplified policy to project_status_history
DROP POLICY IF EXISTS "project_status_history_insert_v3" ON project_status_history;
DROP POLICY IF EXISTS "project_status_history_insert_v4" ON project_status_history;
CREATE POLICY "project_status_history_insert_v4" ON project_status_history 
FOR INSERT TO authenticated
WITH CHECK (
  public.can_manage_project_history(project_id) AND
  changed_by = auth.uid()
);

-- 3. Also allow viewing history using the same logic
DROP POLICY IF EXISTS "project_status_history_read_v3" ON project_status_history;
DROP POLICY IF EXISTS "project_status_history_read_v4" ON project_status_history;
CREATE POLICY "project_status_history_read_v4" ON project_status_history 
FOR SELECT TO authenticated
USING (
  public.can_manage_project_history(project_id)
);
