-- Fix Storage Permissions for Project Photos
-- Ensures the project-photos bucket exists and has public/authenticated access
-- Created: 2026-04-27

-- 1. Ensure the project-photos bucket exists and is public
INSERT INTO storage.buckets (id, name, public) 
VALUES ('project-photos', 'project-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop any existing restrictive policies and create simple, robust ones
DROP POLICY IF EXISTS "Project photos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload project photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update/delete their own project photos" ON storage.objects;
DROP POLICY IF EXISTS "global_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "global_read_policy" ON storage.objects;
DROP POLICY IF EXISTS "global_manage_policy" ON storage.objects;

-- 3. Allow anyone authenticated to upload to the bucket
-- This is critical for Signmakers and Installers in the field
CREATE POLICY "global_upload_policy" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'project-photos');

-- 4. Allow anyone authenticated to view photos
CREATE POLICY "global_read_policy" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'project-photos');

-- 5. Allow users to manage their own uploads (Update/Delete)
CREATE POLICY "global_manage_policy" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'project-photos' AND owner = auth.uid());
