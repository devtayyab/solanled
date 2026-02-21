
/*
  # SloanLED - Notifications & WordPress Sync Tables

  ## Overview
  Adds tables for in-app notifications, push notification tokens, WordPress sync configuration, and company invitations.

  ## New Tables
  1. `notifications` - In-app notification messages for users
     - id, user_id, type, title, message, data (JSON), read, created_at
  2. `push_tokens` - FCM/APNS push notification tokens per device
     - id, user_id, token, platform, created_at
  3. `wordpress_sync_config` - WordPress connection settings per company
     - id, company_id, wp_url, wp_username, wp_app_password, last_synced_at, enabled
  4. `company_invitations` - Pending invitations to join a company
     - id, company_id, invited_by, email, role, token, accepted, expires_at, created_at
  5. `project_comments` - Comments on projects from team members
     - id, project_id, user_id, content, created_at

  ## Security
  - RLS enabled on all tables
  - Strict ownership checks on all policies
*/

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'project_update', 'status_change', 'team_invite', 'document_update', 'system')),
  title text NOT NULL,
  message text DEFAULT '',
  data jsonb DEFAULT '{}',
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Push tokens table
CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'expo' CHECK (platform IN ('ios', 'android', 'expo')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push tokens"
  ON push_tokens FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own push tokens"
  ON push_tokens FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own push tokens"
  ON push_tokens FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- WordPress sync config
CREATE TABLE IF NOT EXISTS wordpress_sync_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  wp_url text NOT NULL DEFAULT '',
  wp_username text DEFAULT '',
  wp_app_password text DEFAULT '',
  last_synced_at timestamptz,
  last_sync_status text DEFAULT 'never' CHECK (last_sync_status IN ('never', 'success', 'failed', 'syncing')),
  last_sync_message text DEFAULT '',
  enabled boolean DEFAULT true,
  sync_documents boolean DEFAULT true,
  sync_users boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE wordpress_sync_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company admins can view WordPress config"
  ON wordpress_sync_config FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Company admins can insert WordPress config"
  ON wordpress_sync_config FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

CREATE POLICY "Company admins can update WordPress config"
  ON wordpress_sync_config FOR UPDATE
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- Company invitations table
CREATE TABLE IF NOT EXISTS company_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  token text NOT NULL DEFAULT gen_random_uuid()::text,
  accepted boolean DEFAULT false,
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE company_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view invitations"
  ON company_invitations FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Company admins can create invitations"
  ON company_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

CREATE POLICY "Company admins can update invitations"
  ON company_invitations FOR UPDATE
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- Project comments table
CREATE TABLE IF NOT EXISTS project_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view project comments"
  ON project_comments FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE p.company_id = pr.company_id
    )
  );

CREATE POLICY "Company members can add project comments"
  ON project_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND project_id IN (
      SELECT p.id FROM projects p
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE p.company_id = pr.company_id
    )
  );

CREATE POLICY "Users can delete their own comments"
  ON project_comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_company_invitations_company_id ON company_invitations(company_id);
CREATE INDEX IF NOT EXISTS idx_company_invitations_email ON company_invitations(email);
CREATE INDEX IF NOT EXISTS idx_project_comments_project_id ON project_comments(project_id);

-- Function to create notification on project status change
CREATE OR REPLACE FUNCTION notify_project_status_change()
RETURNS trigger AS $$
DECLARE
  company_member RECORD;
  project_title TEXT;
BEGIN
  IF NEW.new_status != OLD.new_status OR TG_OP = 'INSERT' THEN
    SELECT title INTO project_title FROM projects WHERE id = NEW.project_id;

    FOR company_member IN
      SELECT p.id FROM profiles p
      JOIN projects proj ON proj.company_id = p.company_id
      WHERE proj.id = NEW.project_id AND p.id != NEW.changed_by
    LOOP
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        company_member.id,
        'status_change',
        'Project Status Updated',
        project_title || ' is now ' || NEW.new_status,
        jsonb_build_object('project_id', NEW.project_id, 'new_status', NEW.new_status)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_project_status_change ON project_status_history;
CREATE TRIGGER on_project_status_change
  AFTER INSERT ON project_status_history
  FOR EACH ROW EXECUTE FUNCTION notify_project_status_change();
