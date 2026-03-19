
-- SloanLED New Roles & Hierarchy Migration
-- Created: 2026-03-18

-- 1. Update Companies table to include status for approval
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='status') THEN
        ALTER TABLE companies ADD COLUMN status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));
    END IF;
END $$;

-- 2. Update Profiles table to support new roles
-- First, drop the old constraint if it exists
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('sloan_admin', 'signmaker', 'installer', 'customer', 'admin', 'employee', 'superadmin'));
-- Note: keeping old roles (admin, employee) for backward compatibility during transition

-- 3. Create Company Members table (Many-to-Many relationship)
-- This allows one user to belong to multiple companies
CREATE TABLE IF NOT EXISTS company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'installer' CHECK (role IN ('signmaker', 'installer', 'admin')),
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- 4. Create Project Assignments table
-- This allows project-based permissions
CREATE TABLE IF NOT EXISTS project_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  can_view boolean DEFAULT true,
  can_edit boolean DEFAULT false,
  can_upload_photos boolean DEFAULT true,
  assigned_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- 5. Data Migration: Move existing profile-company links to company_members
INSERT INTO company_members (company_id, user_id, role, is_primary)
SELECT company_id, id, role, true
FROM profiles
WHERE company_id IS NOT NULL
ON CONFLICT (company_id, user_id) DO NOTHING;

-- 6. Enable RLS on new tables
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;

-- 7. Basic Starter Policies (Detailed RLS will follow in next step)
CREATE POLICY "Sloan Admins see everything members" ON company_members FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles pf WHERE pf.id = auth.uid() AND pf.role IN ('sloan_admin', 'superadmin'))
);

CREATE POLICY "Users see their own memberships" ON company_members FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Signmakers manage their company members" ON company_members FOR ALL TO authenticated USING (
  company_id IN (SELECT cm.company_id FROM company_members cm WHERE cm.user_id = auth.uid() AND cm.role IN ('signmaker', 'admin'))
);

CREATE POLICY "Assignments visibility" ON project_assignments FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR 
  project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('signmaker', 'admin')))
);
