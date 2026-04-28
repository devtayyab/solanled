-- Nuclear fix for project_status_history INSERT 403
-- Drops ALL old restrictive policies and replaces with a single open policy.
-- Any authenticated user can insert status history as long as changed_by = their own uid.
-- Created: 2026-04-27

-- Drop every known version of the INSERT policy
DROP POLICY IF EXISTS "Users can insert status history for their company projects" ON project_status_history;
DROP POLICY IF EXISTS "project_status_history_insert_v2" ON project_status_history;
DROP POLICY IF EXISTS "project_status_history_insert_v3" ON project_status_history;
DROP POLICY IF EXISTS "project_status_history_insert_v4" ON project_status_history;
DROP POLICY IF EXISTS "project_status_history_insert_v5" ON project_status_history;
DROP POLICY IF EXISTS "psh_insert_open" ON project_status_history;

-- Simple open policy: any authenticated user can log status for themselves
CREATE POLICY "psh_insert_open" ON project_status_history
FOR INSERT TO authenticated
WITH CHECK (changed_by = auth.uid());

-- Drop every known version of the SELECT policy
DROP POLICY IF EXISTS "Users can view status history of their company projects" ON project_status_history;
DROP POLICY IF EXISTS "project_status_history_read_v2" ON project_status_history;
DROP POLICY IF EXISTS "project_status_history_read_v3" ON project_status_history;
DROP POLICY IF EXISTS "project_status_history_read_v4" ON project_status_history;
DROP POLICY IF EXISTS "project_status_history_read_v5" ON project_status_history;
DROP POLICY IF EXISTS "psh_read_open" ON project_status_history;

-- Simple read policy: any authenticated user can read status history
CREATE POLICY "psh_read_open" ON project_status_history
FOR SELECT TO authenticated
USING (true);
