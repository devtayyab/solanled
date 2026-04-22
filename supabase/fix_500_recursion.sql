-- VERY IMPORTANT FIX: run this in your Supabase SQL Editor.
-- This breaks the infinite loop between `projects` and `project_assignments`.

-- 1. Fix the infinite recursion between projects and project_assignments
DROP POLICY IF EXISTS "Assignments visibility" ON project_assignments;

CREATE POLICY "Assignments visibility" ON project_assignments 
FOR SELECT 
TO authenticated 
USING (
  user_id = auth.uid() OR 
  assigned_by = auth.uid()
);

-- 2. Make sure profile reading does not cause an infinite loop
DROP POLICY IF EXISTS "profiles_read_all" ON profiles;

CREATE POLICY "profiles_read_all" ON profiles 
FOR SELECT 
TO authenticated
USING (true);

-- 3. Rewrite is_sloan_admin safely
CREATE OR REPLACE FUNCTION public.is_sloan_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('sloan_admin', 'superadmin')
  );
$$;
