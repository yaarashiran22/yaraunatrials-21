-- Create profile for authenticated user if it doesn't exist
INSERT INTO public.profiles (id, name, email, open_to_connecting, created_at, updated_at)
SELECT 
  auth.uid(),
  COALESCE(auth.jwt() ->> 'user_metadata' ->> 'name', 'User'),
  auth.jwt() ->> 'email',
  true,
  now(),
  now()
WHERE auth.uid() IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
  email = COALESCE(EXCLUDED.email, profiles.email),
  updated_at = now();