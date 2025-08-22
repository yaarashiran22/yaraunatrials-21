-- Fix search_path security issue for the new function
DROP FUNCTION IF EXISTS public.update_user_locations_updated_at_column();

CREATE OR REPLACE FUNCTION public.update_user_locations_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;