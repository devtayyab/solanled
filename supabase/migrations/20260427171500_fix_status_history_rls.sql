-- Fix project_status_history RLS: 403 Forbidden on INSERT for Installers
-- Root cause: can_manage_project_history() only allowed signmaker/admin roles.
-- Fix: Allow ANY company member to insert/read status history for their company's projects.
-- Created: 2026-04-27

-- 1. Update the permission checker function to allow ALL company members
CREATE OR REPLACE FUNCTION public.can_manage_project_history(proj_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Sloan admins / Superadmins always allowed
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('sloan_admin', 'superadmin')
  ) THEN
    RETURN true;
  END IF;

  -- Any authenticated member of the company that owns this project
  RETURN EXISTS (
    SELECT 1 FROM public.projects p
    INNER JOIN public.company_members cm ON cm.company_id = p.company_id
    WHERE p.id = proj_id
    AND cm.user_id = auth.uid()
    -- No role filter: installer, signmaker, admin all allowed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Re-apply INSERT policy (uses updated function above)
DROP POLICY IF EXISTS "project_status_history_insert_v3" ON project_status_history;
DROP POLICY IF EXISTS "project_status_history_insert_v4" ON project_status_history;
DROP POLICY IF EXISTS "project_status_history_insert_v5" ON project_status_history;

CREATE POLICY "project_status_history_insert_v5" ON project_status_history
FOR INSERT TO authenticated
WITH CHECK (
  changed_by = auth.uid()
  AND public.can_manage_project_history(project_id)
);

-- 3. Re-apply SELECT policy (uses updated function above)
DROP POLICY IF EXISTS "project_status_history_read_v3" ON project_status_history;
DROP POLICY IF EXISTS "project_status_history_read_v4" ON project_status_history;
DROP POLICY IF EXISTS "project_status_history_read_v5" ON project_status_history;

CREATE POLICY "project_status_history_read_v5" ON project_status_history
FOR SELECT TO authenticated
USING (
  public.can_manage_project_history(project_id)
);
