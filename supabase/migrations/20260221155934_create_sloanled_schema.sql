
/*
  # SloanLED Mobile App - Core Schema

  ## Overview
  Complete database schema for SloanLED project management mobile application.

  ## New Tables
  1. `companies` - Organization/company accounts
     - id, name, address, country, phone, logo_url, created_at
  2. `profiles` - Extended user info linked to auth.users
     - id (auth.uid), company_id, role (admin/employee), full_name, avatar_url, language, created_at
  3. `projects` - Field installation projects
     - id, company_id, created_by, title, description, status, gps_lat, gps_lng, location_address, notes, installed_at, created_at, updated_at
  4. `project_photos` - Photos attached to projects
     - id, project_id, uploaded_by, url, caption, created_at
  5. `project_status_history` - Audit trail of status changes
     - id, project_id, changed_by, old_status, new_status, notes, created_at
  6. `documents` - Product datasheets and spec sheets
     - id, title, description, category, file_url, thumbnail_url, language, created_at

  ## Security
  - RLS enabled on all tables
  - Users can only access their company's data
  - Admins can manage all company resources
  - Employees have read/create access to projects
*/

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text DEFAULT '',
  country text DEFAULT '',
  phone text DEFAULT '',
  logo_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee', 'superadmin')),
  full_name text DEFAULT '',
  avatar_url text DEFAULT '',
  language text DEFAULT 'en',
  phone text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE SET DEFAULT,
  title text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'installed', 'completed', 'cancelled')),
  gps_lat double precision,
  gps_lng double precision,
  location_address text DEFAULT '',
  notes text DEFAULT '',
  installed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Project photos table
CREATE TABLE IF NOT EXISTS project_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE SET DEFAULT,
  url text NOT NULL,
  caption text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE project_photos ENABLE ROW LEVEL SECURITY;

-- Project status history table
CREATE TABLE IF NOT EXISTS project_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL REFERENCES profiles(id) ON DELETE SET DEFAULT,
  old_status text,
  new_status text NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE project_status_history ENABLE ROW LEVEL SECURITY;

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  category text DEFAULT 'general' CHECK (category IN ('datasheet', 'spec_sheet', 'installation_guide', 'general', 'certificate')),
  file_url text NOT NULL,
  thumbnail_url text DEFAULT '',
  language text DEFAULT 'en',
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- AI chat sessions table
CREATE TABLE IF NOT EXISTS ai_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  voiceflow_session_id text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;

-- AI chat messages table
CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

-- ===================== RLS POLICIES =====================

-- Companies: Users can see their own company
CREATE POLICY "Users can view their own company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can update their company"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  )
  WITH CHECK (
    id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

CREATE POLICY "Anyone can insert a company"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Profiles: Users can view profiles in same company
CREATE POLICY "Users can view profiles in same company"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    OR id = auth.uid()
  );

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Projects: Company-scoped access
CREATE POLICY "Users can view their company projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can create projects for their company"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update their company projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can delete company projects"
  ON projects FOR DELETE
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- Project photos
CREATE POLICY "Users can view photos of their company projects"
  ON project_photos FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE p.company_id = pr.company_id
    )
  );

CREATE POLICY "Users can upload photos to their company projects"
  ON project_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND project_id IN (
      SELECT p.id FROM projects p
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE p.company_id = pr.company_id
    )
  );

CREATE POLICY "Users can delete their own photos"
  ON project_photos FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

-- Project status history
CREATE POLICY "Users can view status history of their company projects"
  ON project_status_history FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE p.company_id = pr.company_id
    )
  );

CREATE POLICY "Users can insert status history for their company projects"
  ON project_status_history FOR INSERT
  TO authenticated
  WITH CHECK (
    changed_by = auth.uid()
    AND project_id IN (
      SELECT p.id FROM projects p
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE p.company_id = pr.company_id
    )
  );

-- Documents: Public read for authenticated users
CREATE POLICY "Authenticated users can view documents"
  ON documents FOR SELECT
  TO authenticated
  USING (true);

-- AI sessions
CREATE POLICY "Users can view their own AI sessions"
  ON ai_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own AI sessions"
  ON ai_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- AI messages
CREATE POLICY "Users can view messages from their sessions"
  ON ai_messages FOR SELECT
  TO authenticated
  USING (
    session_id IN (SELECT id FROM ai_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert messages to their sessions"
  ON ai_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    session_id IN (SELECT id FROM ai_sessions WHERE user_id = auth.uid())
  );

-- ===================== INDEXES =====================
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_project_photos_project_id ON project_photos(project_id);
CREATE INDEX IF NOT EXISTS idx_project_status_history_project_id ON project_status_history(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_user_id ON ai_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_session_id ON ai_messages(session_id);

-- ===================== SEED DOCUMENTS =====================
INSERT INTO documents (title, description, category, file_url, thumbnail_url, language, tags) VALUES
  ('SloanLED Pro Series Datasheet', 'Complete technical specifications for the SloanLED Pro Series LED modules', 'datasheet', 'https://www.sloanled.eu/docs/pro-series-datasheet.pdf', 'https://images.pexels.com/photos/1108572/pexels-photo-1108572.jpeg?auto=compress&cs=tinysrgb&w=400', 'en', ARRAY['pro', 'led', 'technical']),
  ('SloanLED Flex Installation Guide', 'Step-by-step installation guide for SloanLED Flex products', 'installation_guide', 'https://www.sloanled.eu/docs/flex-installation.pdf', 'https://images.pexels.com/photos/257736/pexels-photo-257736.jpeg?auto=compress&cs=tinysrgb&w=400', 'en', ARRAY['flex', 'installation', 'guide']),
  ('LED Neon Spec Sheet', 'Detailed specifications for LED Neon product line', 'spec_sheet', 'https://www.sloanled.eu/docs/neon-spec.pdf', 'https://images.pexels.com/photos/2747449/pexels-photo-2747449.jpeg?auto=compress&cs=tinysrgb&w=400', 'en', ARRAY['neon', 'spec', 'led']),
  ('CE Certificate - Pro Series', 'CE certification documentation for SloanLED Pro Series', 'certificate', 'https://www.sloanled.eu/docs/ce-cert.pdf', 'https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg?auto=compress&cs=tinysrgb&w=400', 'en', ARRAY['certificate', 'ce', 'compliance']),
  ('SloanLED Datenblatt Pro Serie (DE)', 'Technische Daten für die SloanLED Pro Serie', 'datasheet', 'https://www.sloanled.eu/docs/pro-series-datasheet-de.pdf', 'https://images.pexels.com/photos/1108572/pexels-photo-1108572.jpeg?auto=compress&cs=tinysrgb&w=400', 'de', ARRAY['pro', 'led', 'technisch']),
  ('Fiche Technique SloanLED Pro (FR)', 'Spécifications techniques complètes pour la série SloanLED Pro', 'datasheet', 'https://www.sloanled.eu/docs/pro-series-datasheet-fr.pdf', 'https://images.pexels.com/photos/1108572/pexels-photo-1108572.jpeg?auto=compress&cs=tinysrgb&w=400', 'fr', ARRAY['pro', 'led', 'technique'])
ON CONFLICT DO NOTHING;

-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, language)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', ''), COALESCE(new.raw_user_meta_data->>'language', 'en'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
