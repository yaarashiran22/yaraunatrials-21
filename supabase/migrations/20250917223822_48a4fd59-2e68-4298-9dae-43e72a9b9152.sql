-- Update existing profiles to have email field populated if missing
UPDATE public.profiles 
SET email = COALESCE(email, 'user@example.com'),
    updated_at = now()
WHERE email IS NULL;