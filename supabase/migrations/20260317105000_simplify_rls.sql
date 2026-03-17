
-- Simplify and fix company update policy
-- Dropping problematic functions and using direct checks

DROP POLICY IF EXISTS "Companies update" ON companies;
DROP POLICY IF EXISTS "Admins can update their company" ON companies;

CREATE POLICY "Admins can update their company"
ON companies FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT company_id FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
)
WITH CHECK (
  id IN (
    SELECT company_id FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

-- Ensure profiles are visible to themselves at least
DROP POLICY IF EXISTS "Profiles visibility" ON profiles;
CREATE POLICY "Profiles visibility"
ON profiles FOR SELECT
TO authenticated
USING (id = auth.uid() OR company_id IN (SELECT company_id FROM profiles p2 WHERE p2.id = auth.uid()));
