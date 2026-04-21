-- MIGRATION: Fix Role Constraints for Invitations
-- Run this in the Supabase SQL Editor

-- The 400 error happens because the database was still using the old role system 
-- ('admin', 'employee') for invitations instead of the new roles ('installer', 'signmaker', etc.)

-- 1. Update the check constraint for company_invitations
ALTER TABLE company_invitations DROP CONSTRAINT IF EXISTS company_invitations_role_check;

ALTER TABLE company_invitations ADD CONSTRAINT company_invitations_role_check 
CHECK (role IN ('sloan_admin', 'signmaker', 'installer', 'customer', 'admin', 'employee', 'superadmin'));

-- 2. Update the check constraint for company_members (so it won't fail when they accept)
ALTER TABLE company_members DROP CONSTRAINT IF EXISTS company_members_role_check;

ALTER TABLE company_members ADD CONSTRAINT company_members_role_check 
CHECK (role IN ('sloan_admin', 'signmaker', 'installer', 'customer', 'admin', 'employee', 'superadmin'));
