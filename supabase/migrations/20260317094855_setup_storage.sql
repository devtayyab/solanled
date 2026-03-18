-- Create storage buckets for avatars and project photos
-- Created on: 2026-03-17

-- 1. Create Buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('project-photos', 'project-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies for Avatars
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 3. Storage Policies for Project Photos
CREATE POLICY "Project photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-photos');

CREATE POLICY "Authenticated users can upload project photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-photos');

CREATE POLICY "Users can update/delete their own project photos"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'project-photos' AND owner = auth.uid());
