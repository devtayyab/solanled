-- Migration to ensure a specific user has a profile and the correct role
-- This fixes the 'no_profile' redirect loop

INSERT INTO public.profiles (id, full_name, role, distributor_id)
SELECT 
    id, 
    'Ahsan Maqsood', 
    'distributor_admin', 
    (SELECT id FROM distributors LIMIT 1)
FROM auth.users 
WHERE email = 'muhammadahsanmaqsood28@gmail.com'
ON CONFLICT (id) DO UPDATE 
SET role = 'distributor_admin',
    distributor_id = (SELECT id FROM distributors LIMIT 1);
