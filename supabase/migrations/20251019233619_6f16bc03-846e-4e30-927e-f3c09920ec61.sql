-- Fix profile_type for the business account that was just created
-- This is a one-time data migration to correct the issue

DO $$
BEGIN
  -- Update the most recent profile to set it as business type
  UPDATE profiles 
  SET profile_type = 'business'
  WHERE email = 'sivanie.shiran@gmail.com' 
  AND profile_type IS NULL;
END $$;