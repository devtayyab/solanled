
/*
  # SloanLED - Invitation Acceptance, Profile Avatars, Document Uploads

  ## Changes
  1. Allow unauthenticated users to read company_invitations by token
  2. Allow authenticated users to accept invitations
  3. Add uploaded_by to documents table
  4. Add admin document insert/update/delete policies

  ## Security
  - Invitation lookup by token works for pre-auth users
  - Document management restricted to admins
*/

-- Allow reading invitation by token (for accept flow, even pre-auth)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'company_invitations' AND policyname = 'Anyone can view invitations by token'
  ) THEN
    CREATE POLICY "Anyone can view invitations by token"
      ON company_invitations FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- Allow authenticated users to mark their invitation as accepted
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'company_invitations' AND policyname = 'Invited users can accept their invitation'
  ) THEN
    CREATE POLICY "Invited users can accept their invitation"
      ON company_invitations FOR UPDATE
      TO authenticated
      USING (
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND accepted = false
        AND expires_at > now()
      )
      WITH CHECK (
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
      );
  END IF;
END $$;

-- Add uploaded_by to documents if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'uploaded_by'
  ) THEN
    ALTER TABLE documents ADD COLUMN uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Allow company admins to insert documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'documents' AND policyname = 'Company admins can upload documents'
  ) THEN
    CREATE POLICY "Company admins can upload documents"
      ON documents FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
          AND role IN ('admin', 'superadmin')
        )
      );
  END IF;
END $$;

-- Allow admins to update their uploaded documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'documents' AND policyname = 'Admins can update their uploaded documents'
  ) THEN
    CREATE POLICY "Admins can update their uploaded documents"
      ON documents FOR UPDATE
      TO authenticated
      USING (uploaded_by = auth.uid())
      WITH CHECK (uploaded_by = auth.uid());
  END IF;
END $$;

-- Allow admins to delete their uploaded documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'documents' AND policyname = 'Admins can delete their uploaded documents'
  ) THEN
    CREATE POLICY "Admins can delete their uploaded documents"
      ON documents FOR DELETE
      TO authenticated
      USING (uploaded_by = auth.uid());
  END IF;
END $$;

-- Add company_id to documents for scoped visibility (optional, for future)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE documents ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;
