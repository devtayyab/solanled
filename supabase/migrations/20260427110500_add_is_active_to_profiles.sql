
-- Migration: Add is_active status to profiles
-- Created: 2026-04-27

-- 1. Add is_active column to profiles table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_active') THEN
        ALTER TABLE profiles ADD COLUMN is_active boolean DEFAULT true;
    END IF;
END $$;

-- 2. Helper function to check SuperAdmin status without recursion
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'superadmin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Add RLS policy for Superadmins to update ANY profile
DROP POLICY IF EXISTS "Superadmins can update any profile" ON profiles;
CREATE POLICY "Superadmins can update any profile" ON profiles
FOR UPDATE TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());


-- 3. Optional: Add a check for deactivated users in RLS (if needed)
-- This ensures that if a profile is not active, even if authenticated, 
-- they might be restricted from certain actions across all tables.
-- However, for now we just add the field so the Admin can toggle it.
