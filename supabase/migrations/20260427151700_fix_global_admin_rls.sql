-- Fix RLS Policies for Global Admins
-- Targeted tables: project_status_history, project_comments, company_invitations, wordpress_sync_config
-- Created: 2026-04-27

-- 1. Update project_status_history policies
DROP POLICY IF EXISTS "Users can view status history of their company projects" ON project_status_history;
DROP POLICY IF EXISTS "project_status_history_read_v2" ON project_status_history;
DROP POLICY IF EXISTS "project_status_history_read_v3" ON project_status_history;
CREATE POLICY "project_status_history_read_v3" ON project_status_history FOR SELECT TO authenticated
USING (
  public.is_sloan_admin() OR
  project_id IN (
    SELECT p.id FROM public.projects p
    WHERE p.company_id IN (SELECT public.get_my_company_ids())
  )
);

DROP POLICY IF EXISTS "Users can insert status history for their company projects" ON project_status_history;
DROP POLICY IF EXISTS "project_status_history_insert_v2" ON project_status_history;
DROP POLICY IF EXISTS "project_status_history_insert_v3" ON project_status_history;
CREATE POLICY "project_status_history_insert_v3" ON project_status_history FOR INSERT TO authenticated
WITH CHECK (
  public.is_sloan_admin() OR
  (
    changed_by = auth.uid() AND
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.company_id IN (SELECT public.get_my_managed_company_ids())
    )
  )
);

-- 2. Update project_comments policies
DROP POLICY IF EXISTS "Company members can view project comments" ON project_comments;
DROP POLICY IF EXISTS "project_comments_read_v2" ON project_comments;
DROP POLICY IF EXISTS "project_comments_read_v3" ON project_comments;
CREATE POLICY "project_comments_read_v3" ON project_comments FOR SELECT TO authenticated
USING (
  public.is_sloan_admin() OR
  project_id IN (
    SELECT p.id FROM public.projects p
    WHERE p.company_id IN (SELECT public.get_my_company_ids())
  )
);

DROP POLICY IF EXISTS "Company members can add project comments" ON project_comments;
DROP POLICY IF EXISTS "project_comments_insert_v2" ON project_comments;
DROP POLICY IF EXISTS "project_comments_insert_v3" ON project_comments;
CREATE POLICY "project_comments_insert_v3" ON project_comments FOR INSERT TO authenticated
WITH CHECK (
  public.is_sloan_admin() OR
  (
    user_id = auth.uid() AND
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.company_id IN (SELECT public.get_my_company_ids())
    )
  )
);

-- 3. Update company_invitations policies
DROP POLICY IF EXISTS "Company members can view invitations" ON company_invitations;
DROP POLICY IF EXISTS "company_invitations_read_v2" ON company_invitations;
DROP POLICY IF EXISTS "company_invitations_read_v3" ON company_invitations;
CREATE POLICY "company_invitations_read_v3" ON company_invitations FOR SELECT TO authenticated
USING (
  public.is_sloan_admin() OR
  company_id IN (SELECT public.get_my_company_ids())
);

DROP POLICY IF EXISTS "Company admins can create invitations" ON company_invitations;
DROP POLICY IF EXISTS "company_invitations_insert_v2" ON company_invitations;
DROP POLICY IF EXISTS "company_invitations_insert_v3" ON company_invitations;
CREATE POLICY "company_invitations_insert_v3" ON company_invitations FOR INSERT TO authenticated
WITH CHECK (
  public.is_sloan_admin() OR
  company_id IN (SELECT public.get_my_managed_company_ids())
);

DROP POLICY IF EXISTS "Company admins can update invitations" ON company_invitations;
DROP POLICY IF EXISTS "company_invitations_update_v2" ON company_invitations;
DROP POLICY IF EXISTS "company_invitations_update_v3" ON company_invitations;
CREATE POLICY "company_invitations_update_v3" ON company_invitations FOR UPDATE TO authenticated
USING (
  public.is_sloan_admin() OR
  company_id IN (SELECT public.get_my_managed_company_ids())
)
WITH CHECK (
  public.is_sloan_admin() OR
  company_id IN (SELECT public.get_my_managed_company_ids())
);

-- 4. Update wordpress_sync_config policies
DROP POLICY IF EXISTS "Company admins can view WordPress config" ON wordpress_sync_config;
DROP POLICY IF EXISTS "wordpress_sync_read_v2" ON wordpress_sync_config;
DROP POLICY IF EXISTS "wordpress_sync_read_v3" ON wordpress_sync_config;
CREATE POLICY "wordpress_sync_read_v3" ON wordpress_sync_config FOR SELECT TO authenticated
USING (
  public.is_sloan_admin() OR
  company_id IN (SELECT public.get_my_managed_company_ids())
);

DROP POLICY IF EXISTS "Company admins can insert WordPress config" ON wordpress_sync_config;
DROP POLICY IF EXISTS "wordpress_sync_insert_v2" ON wordpress_sync_config;
DROP POLICY IF EXISTS "wordpress_sync_insert_v3" ON wordpress_sync_config;
CREATE POLICY "wordpress_sync_insert_v3" ON wordpress_sync_config FOR INSERT TO authenticated
WITH CHECK (
  public.is_sloan_admin() OR
  company_id IN (SELECT public.get_my_managed_company_ids())
);

DROP POLICY IF EXISTS "Company admins can update WordPress config" ON wordpress_sync_config;
DROP POLICY IF EXISTS "wordpress_sync_update_v2" ON wordpress_sync_config;
DROP POLICY IF EXISTS "wordpress_sync_update_v3" ON wordpress_sync_config;
CREATE POLICY "wordpress_sync_update_v3" ON wordpress_sync_config FOR UPDATE TO authenticated
USING (
  public.is_sloan_admin() OR
  company_id IN (SELECT public.get_my_managed_company_ids())
)
WITH CHECK (
  public.is_sloan_admin() OR
  company_id IN (SELECT public.get_my_managed_company_ids())
);
