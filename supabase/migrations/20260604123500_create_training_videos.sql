-- Create training_videos table
CREATE TABLE IF NOT EXISTS training_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  video_url text NOT NULL,
  thumbnail_url text DEFAULT '',
  language text DEFAULT 'en',
  tags text[] DEFAULT '{}',
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE training_videos ENABLE ROW LEVEL SECURITY;

-- Select policy: Authenticated users can view training videos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'training_videos' AND policyname = 'Authenticated users can view training videos'
  ) THEN
    CREATE POLICY "Authenticated users can view training videos"
      ON training_videos FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Insert policy: Company admins can upload training videos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'training_videos' AND policyname = 'Company admins can upload training videos'
  ) THEN
    CREATE POLICY "Company admins can upload training videos"
      ON training_videos FOR INSERT
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

-- Update policy: Admins can update their uploaded training videos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'training_videos' AND policyname = 'Admins can update their uploaded training videos'
  ) THEN
    CREATE POLICY "Admins can update their uploaded training videos"
      ON training_videos FOR UPDATE
      TO authenticated
      USING (uploaded_by = auth.uid())
      WITH CHECK (uploaded_by = auth.uid());
  END IF;
END $$;

-- Delete policy: Admins can delete their uploaded training videos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'training_videos' AND policyname = 'Admins can delete their uploaded training videos'
  ) THEN
    CREATE POLICY "Admins can delete their uploaded training videos"
      ON training_videos FOR DELETE
      TO authenticated
      USING (uploaded_by = auth.uid());
  END IF;
END $$;

-- Indexing for lookup performance
CREATE INDEX IF NOT EXISTS idx_training_videos_uploaded_by ON training_videos(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_training_videos_company_id ON training_videos(company_id);
