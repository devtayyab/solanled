-- Fix project_photos RLS: 403 Forbidden on INSERT
-- Root cause: photos_upload_v2 only allowed signmaker/admin roles.
-- Installers and other company members were blocked unless explicitly assigned.
-- Solution: Allow any authenticated company member to insert photos for
--           projects belonging to their company, OR via direct assignment.
-- Created: 2026-04-27

-- ── SELECT policy ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "photos_read_v2" ON project_photos;
DROP POLICY IF EXISTS "photos_read_v3" ON project_photos;

CREATE POLICY "photos_read_v3" ON project_photos
FOR SELECT TO authenticated
USING (
  public.is_sloan_admin()
  OR project_id IN (
    SELECT p.id FROM public.projects p
    WHERE p.company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
    )
  )
  OR project_id IN (
    SELECT pa.project_id FROM public.project_assignments pa
    WHERE pa.user_id = auth.uid() AND pa.can_view = true
  )
);

-- ── INSERT policy ──────────────────────────────────────────────────────────
-- Previously only signmaker/admin roles could insert; installers got 403.
-- Now ANY member of the company (installer, signmaker, admin, etc.) can upload.
DROP POLICY IF EXISTS "photos_upload_v2" ON project_photos;
DROP POLICY IF EXISTS "photos_upload_v3" ON project_photos;

CREATE POLICY "photos_upload_v3" ON project_photos
FOR INSERT TO authenticated
WITH CHECK (
  public.is_sloan_admin()
  OR (
    uploaded_by = auth.uid()
    AND project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.company_id IN (
        SELECT cm.company_id FROM public.company_members cm
        WHERE cm.user_id = auth.uid()
      )
    )
  )
  OR project_id IN (
    SELECT pa.project_id FROM public.project_assignments pa
    WHERE pa.user_id = auth.uid() AND pa.can_upload_photos = true
  )
);

-- ── DELETE policy ──────────────────────────────────────────────────────────
-- Allow uploaders to delete their own photos; sloan_admins can delete any.
DROP POLICY IF EXISTS "photos_delete_v2" ON project_photos;
DROP POLICY IF EXISTS "photos_delete_v3" ON project_photos;

CREATE POLICY "photos_delete_v3" ON project_photos
FOR DELETE TO authenticated
USING (
  public.is_sloan_admin()
  OR uploaded_by = auth.uid()
);
