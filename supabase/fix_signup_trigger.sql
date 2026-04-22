-- MIGRATION: Fix Signup Logic (Automatic Company Creation)
-- Run this in Supabase SQL Editor

-- This fix moves the company creation logic to a database trigger.
-- This is necessary because client-side RLS prevents new users from 
-- creating companies or updating their own roles before they are fully authenticated.

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
