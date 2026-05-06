/*
  # Fix RLS recursion introduced by 20260506120000_distributor_portal.sql

  ## What went wrong
    - `current_role()` was a function name collision with the SQL standard
      built-in `CURRENT_ROLE`.
    - The new policies on `profiles`, `companies`, `projects`, etc. used inline
      subqueries that crossed tables (profiles -> companies -> profiles), which
      Postgres rewrites at planning time and triggers infinite recursion. The
      same trap is documented in 20260316122246_fix_rls_recursion.sql.

  ## The fix
    - Drop the offending policies + functions.
    - Replace with SECURITY DEFINER helper functions that bypass RLS internally
      (the established pattern in this repo, c.f. is_sloan_admin /
      get_my_company_ids in 20260427151700_fix_global_admin_rls.sql).
    - Re-add the same logical policies, but now they call the helpers instead
      of running cross-table subqueries inline.
*/

-- ============================================================================
-- 1. Drop the broken policies + helpers from 20260506120000
-- ============================================================================
DROP POLICY IF EXISTS "distributor_users_view_own"          ON distributors;
DROP POLICY IF EXISTS "superadmin_all_distributors"         ON distributors;
DROP POLICY IF EXISTS "distributor_view_assigned_companies" ON companies;
DROP POLICY IF EXISTS "distributor_view_signmaker_profiles" ON profiles;
DROP POLICY IF EXISTS "distributor_view_assigned_projects"  ON projects;
DROP POLICY IF EXISTS "distributor_view_project_photos"          ON project_photos;
DROP POLICY IF EXISTS "distributor_view_project_status_history"  ON project_status_history;
DROP POLICY IF EXISTS "users_insert_own_document_views"   ON document_views;
DROP POLICY IF EXISTS "users_view_own_document_views"     ON document_views;
DROP POLICY IF EXISTS "distributor_view_document_views"   ON document_views;
DROP POLICY IF EXISTS "superadmin_all_document_views"     ON document_views;
DROP POLICY IF EXISTS "users_insert_own_ai_request_log"  ON ai_request_log;
DROP POLICY IF EXISTS "users_view_own_ai_request_log"    ON ai_request_log;
DROP POLICY IF EXISTS "distributor_view_ai_request_log"  ON ai_request_log;
DROP POLICY IF EXISTS "superadmin_all_ai_request_log"    ON ai_request_log;

DROP FUNCTION IF EXISTS current_role();
DROP FUNCTION IF EXISTS current_distributor_id();

-- ============================================================================
-- 2. SECURITY DEFINER helpers (avoid recursion; safe to call from any RLS USING)
-- ============================================================================
CREATE OR REPLACE FUNCTION my_distributor_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT distributor_id FROM profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION is_portal_superadmin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin') $$;

CREATE OR REPLACE FUNCTION is_distributor_user()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('distributor_admin','distributor_user')
  )
$$;

CREATE OR REPLACE FUNCTION my_distributor_company_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id FROM companies c
  WHERE c.distributor_id = (SELECT p.distributor_id FROM profiles p WHERE p.id = auth.uid())
$$;

-- ============================================================================
-- 3. distributors
-- ============================================================================
CREATE POLICY "distributor_users_view_own"
  ON distributors FOR SELECT TO authenticated
  USING (id = my_distributor_id());

CREATE POLICY "superadmin_all_distributors"
  ON distributors FOR ALL TO authenticated
  USING (is_portal_superadmin())
  WITH CHECK (is_portal_superadmin());

-- ============================================================================
-- 4. companies (distributors read their assigned signmakers)
-- ============================================================================
CREATE POLICY "distributor_view_assigned_companies"
  ON companies FOR SELECT TO authenticated
  USING (is_distributor_user() AND distributor_id = my_distributor_id());

-- ============================================================================
-- 5. profiles (distributors see profiles of their signmakers)
-- ============================================================================
CREATE POLICY "distributor_view_signmaker_profiles"
  ON profiles FOR SELECT TO authenticated
  USING (
    is_distributor_user()
    AND (
      company_id IN (SELECT my_distributor_company_ids())
      OR distributor_id = my_distributor_id()
    )
  );

-- ============================================================================
-- 6. projects (distributor read-through)
-- ============================================================================
CREATE POLICY "distributor_view_assigned_projects"
  ON projects FOR SELECT TO authenticated
  USING (
    is_distributor_user()
    AND company_id IN (SELECT my_distributor_company_ids())
  );

-- ============================================================================
-- 7. project_photos / project_status_history
-- ============================================================================
CREATE POLICY "distributor_view_project_photos"
  ON project_photos FOR SELECT TO authenticated
  USING (
    is_distributor_user()
    AND project_id IN (
      SELECT id FROM projects WHERE company_id IN (SELECT my_distributor_company_ids())
    )
  );

CREATE POLICY "distributor_view_project_status_history"
  ON project_status_history FOR SELECT TO authenticated
  USING (
    is_distributor_user()
    AND project_id IN (
      SELECT id FROM projects WHERE company_id IN (SELECT my_distributor_company_ids())
    )
  );

-- ============================================================================
-- 8. document_views
-- ============================================================================
CREATE POLICY "users_insert_own_document_views"
  ON document_views FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_view_own_document_views"
  ON document_views FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "distributor_view_document_views"
  ON document_views FOR SELECT TO authenticated
  USING (
    is_distributor_user()
    AND company_id IN (SELECT my_distributor_company_ids())
  );

CREATE POLICY "superadmin_all_document_views"
  ON document_views FOR ALL TO authenticated
  USING (is_portal_superadmin())
  WITH CHECK (is_portal_superadmin());

-- ============================================================================
-- 9. ai_request_log
-- ============================================================================
CREATE POLICY "users_insert_own_ai_request_log"
  ON ai_request_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_view_own_ai_request_log"
  ON ai_request_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "distributor_view_ai_request_log"
  ON ai_request_log FOR SELECT TO authenticated
  USING (
    is_distributor_user()
    AND company_id IN (SELECT my_distributor_company_ids())
  );

CREATE POLICY "superadmin_all_ai_request_log"
  ON ai_request_log FOR ALL TO authenticated
  USING (is_portal_superadmin())
  WITH CHECK (is_portal_superadmin());
