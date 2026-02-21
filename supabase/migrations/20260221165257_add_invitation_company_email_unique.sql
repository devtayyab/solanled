/*
  # Add unique constraint on company_invitations (company_id, email)
  
  Allows upsert operations when syncing WordPress users.
  If constraint already exists, this is a no-op.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_invitations_company_id_email_key'
  ) THEN
    ALTER TABLE company_invitations ADD CONSTRAINT company_invitations_company_id_email_key UNIQUE (company_id, email);
  END IF;
END $$;
