-- Migration to seed a test distributor and link a user
-- Note: Replace 'test@example.com' with the actual email before running

-- 1. Create a default distributor if it doesn't exist
INSERT INTO distributors (name, region, country)
VALUES ('Global Distributor', 'Global', 'USA')
ON CONFLICT DO NOTHING;

-- 2. Link a specific user as distributor_admin
-- We use a subquery to find the distributor ID we just created
UPDATE profiles
SET role = 'distributor_admin',
    distributor_id = (SELECT id FROM distributors WHERE name = 'Global Distributor' LIMIT 1)
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'test@example.com' -- CHANGE THIS EMAIL
);

-- 3. Link all existing companies to this distributor for testing purposes
UPDATE companies
SET distributor_id = (SELECT id FROM distributors WHERE name = 'Global Distributor' LIMIT 1)
WHERE id IN (SELECT id FROM companies LIMIT 1);
