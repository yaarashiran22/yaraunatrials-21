-- Create a function to handle new user registration and ensure profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, username, bio, location, profile_image_url, is_private, show_in_search, interests, specialties, account_type, market)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NULL,
    NULL,
    NULL,
    NULL,
    false,
    true,
    ARRAY[]::text[],
    ARRAY[]::text[],
    'personal',
    'buenos_aires'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(profiles.name, EXCLUDED.name),
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Create the trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Also create profiles for any existing users that don't have them
INSERT INTO public.profiles (id, email, name, username, bio, location, profile_image_url, is_private, show_in_search, interests, specialties, account_type, market)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)) as name,
  NULL as username,
  NULL as bio,
  NULL as location,
  NULL as profile_image_url,
  false as is_private,
  true as show_in_search,
  ARRAY[]::text[] as interests,
  ARRAY[]::text[] as specialties,
  'personal' as account_type,
  'buenos_aires' as market
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = COALESCE(profiles.name, EXCLUDED.name),
  updated_at = now();