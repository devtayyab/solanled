-- SloanLED: Consolidated Dashboard, Invitations & RLS Fixes
-- Date: 2026-04-21

-- ==============================================================
-- 1. SECURITY & PERFORMANCE (Recursion Fixes for 500 Errors)
-- ==============================================================

-- Cleanup old recursive policies
DROP POLICY IF EXISTS "Users can view profiles in same company" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own company" ON public.companies;
DROP POLICY IF EXISTS "Users can view their company projects" ON public.projects;
DROP POLICY IF EXISTS "profiles_read_v3" ON public.profiles;
DROP POLICY IF EXISTS "profiles_view_final" ON public.profiles;
DROP POLICY IF EXISTS "profiles_view_v4" ON public.profiles;
DROP POLICY IF EXISTS "profiles_view_safe" ON public.profiles;

-- Fixed Profiles (Allow reading all for basic info to avoid loops)
CREATE POLICY "profiles_view_v5" ON public.profiles FOR SELECT TO authenticated USING (true);

-- Fixed Companies (Simple direct check)
CREATE POLICY "companies_view_v5" ON public.companies FOR SELECT TO authenticated 
USING (
  id = (SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin', 'sloan_admin'))
);

-- Fixed Projects (Simple direct check)
CREATE POLICY "projects_view_v6" ON public.projects FOR SELECT TO authenticated 
USING (
  company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin', 'sloan_admin', 'signmaker', 'admin'))
);


-- ==============================================================
-- 2. TEAM INVITATIONS (Invitations Management & Joining)
-- ==============================================================

-- Cleanup and Fix Invitation Policies
DROP POLICY IF EXISTS "Company admins can create invitations" ON public.company_invitations;
DROP POLICY IF EXISTS "Company members can view invitations" ON public.company_invitations;
DROP POLICY IF EXISTS "Anyone can view invitations by token" ON public.company_invitations;
DROP POLICY IF EXISTS "Anyone can view invitations by email" ON public.company_invitations;
DROP POLICY IF EXISTS "invitations_view_by_email" ON public.company_invitations;

-- Create invitations (Signmakers & Admins only)
CREATE POLICY "invitations_create_admin_v2" ON public.company_invitations FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('signmaker', 'admin', 'superadmin', 'sloan_admin')
  )
);

-- View invitations (For the invited user on their dashboard)
CREATE POLICY "invitations_view_personal_v2" ON public.company_invitations FOR SELECT TO authenticated
USING (LOWER(email) = LOWER(auth.jwt() ->> 'email'));

-- View invitations (Admin view for management)
CREATE POLICY "invitations_view_admin_v2" ON public.company_invitations FOR SELECT TO authenticated
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid() AND role IN ('signmaker', 'admin'))
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin', 'sloan_admin'))
);


-- ==============================================================
-- 3. COMPANY MEMBERSHIP (Join via ID Feature)
-- ==============================================================

-- Allow users to Join by inserting their own membership
DROP POLICY IF EXISTS "Users can join a company" ON public.company_members;
DROP POLICY IF EXISTS "members_self_join" ON public.company_members;
CREATE POLICY "members_self_join_v2" ON public.company_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own membership" ON public.company_members;
DROP POLICY IF EXISTS "members_self_update" ON public.company_members;
CREATE POLICY "members_self_update_v2" ON public.company_members FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Management access for company owners
DROP POLICY IF EXISTS "Signmakers manage their company members" ON public.company_members;
DROP POLICY IF EXISTS "members_admin_managed" ON public.company_members;
CREATE POLICY "members_admin_managed_v2" ON public.company_members FOR ALL TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('signmaker', 'admin', 'superadmin', 'sloan_admin')
  )
);


-- ==============================================================
-- 4. AUTOMATIC SIGNUP TRIGGER (Metadata Driven)
-- ==============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_company_id uuid;
  company_name_val text;
BEGIN
  -- 1. Extract company name from metadata
  company_name_val := new.raw_user_meta_data->>'company_name';

  -- 2. Create company if name provided
  IF company_name_val IS NOT NULL AND company_name_val <> '' THEN
    INSERT INTO public.companies (name, status)
    VALUES (company_name_val, 'pending')
    RETURNING id INTO new_company_id;
  END IF;

  -- 3. Insert into profiles with correct role and company
  INSERT INTO public.profiles (id, full_name, language, company_id, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', ''), 
    COALESCE(new.raw_user_meta_data->>'language', 'en'),
    new_company_id,
    CASE WHEN new_company_id IS NOT NULL THEN 'signmaker' ELSE 'installer' END
  );

  -- 4. Add to company_members if company was created
  IF new_company_id IS NOT NULL THEN
    INSERT INTO public.company_members (company_id, user_id, role, is_primary)
    VALUES (new_company_id, new.id, 'signmaker', true);
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
