/*
  # Distributor Portal - Schema Additions

  Adds the data model needed by the SloanLED distributor web portal.

  Hierarchy: SloanLED HQ (superadmin) -> Distributor -> Signmaker (company) -> Employee

  ## New tables
    - `distributors`               One row per local distributor (region/country level)
    - `document_views`             Audit log of which user viewed which document
    - `ai_request_log`             Lightweight log of Voiceflow / Luxa AI requests for reporting
                                   (kept separate from ai_messages so distributors can read summaries
                                   without seeing message bodies)

  ## Schema changes
    - `companies.distributor_id`   Signmaker company belongs to one distributor (nullable for HQ-managed)
    - `profiles.distributor_id`    For users that work for a distributor (not a signmaker company)
    - `profiles.role` check expanded to include 'distributor_admin' and 'distributor_user'

  ## Roles after this migration
    - superadmin         SloanLED HQ - sees everything
    - distributor_admin  Distributor staff - manages distributor users, sees all their signmakers
    - distributor_user   Distributor staff - read-only on their signmakers
    - admin              Signmaker company admin (mobile)
    - employee           Signmaker company employee (mobile)

  ## Security model
    - Distributors can read companies/projects/photos/status_history/document_views/ai_request_log
      where the company belongs to their distributor_id.
    - Superadmin policies already exist from 20260410111844_superadmin_full_access.sql
      and continue to apply.
*/

-- ============================================================================
-- 1. distributors
-- ============================================================================
CREATE TABLE IF NOT EXISTS distributors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  region text DEFAULT '',
  country text DEFAULT '',
  contact_email text DEFAULT '',
  contact_phone text DEFAULT '',
  logo_url text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. companies.distributor_id  (signmaker -> distributor)
-- ============================================================================
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS distributor_id uuid REFERENCES distributors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_companies_distributor_id ON companies(distributor_id);

-- ============================================================================
-- 3. profiles: add distributor_id + expand role check
-- ============================================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS distributor_id uuid REFERENCES distributors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_distributor_id ON profiles(distributor_id);

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('superadmin', 'admin', 'employee', 'distributor_admin', 'distributor_user', 'signmaker', 'installer'));

-- ============================================================================
-- 4. document_views
-- ============================================================================
CREATE TABLE IF NOT EXISTS document_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  source text DEFAULT 'mobile' CHECK (source IN ('mobile', 'web')),
  viewed_at timestamptz DEFAULT now()
);

ALTER TABLE document_views ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_document_views_document_id ON document_views(document_id);
CREATE INDEX IF NOT EXISTS idx_document_views_user_id    ON document_views(user_id);
CREATE INDEX IF NOT EXISTS idx_document_views_company_id ON document_views(company_id);
CREATE INDEX IF NOT EXISTS idx_document_views_viewed_at  ON document_views(viewed_at DESC);

-- ============================================================================
-- 5. ai_request_log  (summary of Voiceflow / Luxa AI requests)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_request_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  session_id uuid REFERENCES ai_sessions(id) ON DELETE SET NULL,
  intent text DEFAULT '',
  prompt_preview text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_request_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_request_log_user_id    ON ai_request_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_request_log_company_id ON ai_request_log(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_request_log_created_at ON ai_request_log(created_at DESC);

-- ============================================================================
-- 6. Helper function: current user's distributor_id
--    SECURITY DEFINER avoids the recursive RLS pattern that has bitten this
--    project before (see 20260316122246_fix_rls_recursion.sql).
-- ============================================================================
CREATE OR REPLACE FUNCTION current_distributor_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT distributor_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- ============================================================================
-- 7. RLS - distributors
-- ============================================================================
DROP POLICY IF EXISTS "distributor_users_view_own"     ON distributors;
DROP POLICY IF EXISTS "superadmin_all_distributors"    ON distributors;

CREATE POLICY "distributor_users_view_own"
  ON distributors FOR SELECT
  TO authenticated
  USING (id = current_distributor_id());

CREATE POLICY "superadmin_all_distributors"
  ON distributors FOR ALL
  TO authenticated
  USING (get_user_role() = 'superadmin')
  WITH CHECK (get_user_role() = 'superadmin');

-- ============================================================================
-- 8. RLS - companies (additive: distributors read their signmakers)
-- ============================================================================
DROP POLICY IF EXISTS "distributor_view_assigned_companies" ON companies;

CREATE POLICY "distributor_view_assigned_companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN ('distributor_admin', 'distributor_user')
    AND distributor_id = current_distributor_id()
  );

-- ============================================================================
-- 9. RLS - profiles (distributors see profiles of their signmakers)
-- ============================================================================
DROP POLICY IF EXISTS "distributor_view_signmaker_profiles" ON profiles;

CREATE POLICY "distributor_view_signmaker_profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN ('distributor_admin', 'distributor_user')
    AND (
      company_id IN (SELECT id FROM companies WHERE distributor_id = current_distributor_id())
      OR distributor_id = current_distributor_id()
    )
  );

-- ============================================================================
-- 10. RLS - projects (distributors read projects of their signmakers)
-- ============================================================================
DROP POLICY IF EXISTS "distributor_view_assigned_projects" ON projects;

CREATE POLICY "distributor_view_assigned_projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN ('distributor_admin', 'distributor_user')
    AND company_id IN (SELECT id FROM companies WHERE distributor_id = current_distributor_id())
  );

-- ============================================================================
-- 11. RLS - project_photos / project_status_history (distributor read-through)
-- ============================================================================
DROP POLICY IF EXISTS "distributor_view_project_photos"          ON project_photos;
DROP POLICY IF EXISTS "distributor_view_project_status_history"  ON project_status_history;

CREATE POLICY "distributor_view_project_photos"
  ON project_photos FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN ('distributor_admin', 'distributor_user')
    AND project_id IN (
      SELECT p.id FROM projects p
      JOIN companies c ON c.id = p.company_id
      WHERE c.distributor_id = current_distributor_id()
    )
  );

CREATE POLICY "distributor_view_project_status_history"
  ON project_status_history FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN ('distributor_admin', 'distributor_user')
    AND project_id IN (
      SELECT p.id FROM projects p
      JOIN companies c ON c.id = p.company_id
      WHERE c.distributor_id = current_distributor_id()
    )
  );

-- ============================================================================
-- 12. RLS - document_views
-- ============================================================================
DROP POLICY IF EXISTS "users_insert_own_document_views"   ON document_views;
DROP POLICY IF EXISTS "users_view_own_document_views"     ON document_views;
DROP POLICY IF EXISTS "distributor_view_document_views"   ON document_views;
DROP POLICY IF EXISTS "superadmin_all_document_views"     ON document_views;

CREATE POLICY "users_insert_own_document_views"
  ON document_views FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_view_own_document_views"
  ON document_views FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "distributor_view_document_views"
  ON document_views FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN ('distributor_admin', 'distributor_user')
    AND company_id IN (SELECT id FROM companies WHERE distributor_id = current_distributor_id())
  );

CREATE POLICY "superadmin_all_document_views"
  ON document_views FOR ALL
  TO authenticated
  USING (get_user_role() = 'superadmin')
  WITH CHECK (get_user_role() = 'superadmin');

-- ============================================================================
-- 13. RLS - ai_request_log
-- ============================================================================
DROP POLICY IF EXISTS "users_insert_own_ai_request_log"  ON ai_request_log;
DROP POLICY IF EXISTS "users_view_own_ai_request_log"    ON ai_request_log;
DROP POLICY IF EXISTS "distributor_view_ai_request_log"  ON ai_request_log;
DROP POLICY IF EXISTS "superadmin_all_ai_request_log"    ON ai_request_log;

CREATE POLICY "users_insert_own_ai_request_log"
  ON ai_request_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_view_own_ai_request_log"
  ON ai_request_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "distributor_view_ai_request_log"
  ON ai_request_log FOR SELECT
  TO authenticated
  USING (
    get_user_role() IN ('distributor_admin', 'distributor_user')
    AND company_id IN (SELECT id FROM companies WHERE distributor_id = current_distributor_id())
  );

CREATE POLICY "superadmin_all_ai_request_log"
  ON ai_request_log FOR ALL
  TO authenticated
  USING (get_user_role() = 'superadmin')
  WITH CHECK (get_user_role() = 'superadmin');

-- ============================================================================
-- 14. Updated_at trigger for distributors
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS distributors_set_updated_at ON distributors;
CREATE TRIGGER distributors_set_updated_at
  BEFORE UPDATE ON distributors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
