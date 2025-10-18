-- Add new columns to profiles table for registration
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS age integer,
ADD COLUMN IF NOT EXISTS origin text CHECK (origin IN ('Argentina', 'Abroad')),
ADD COLUMN IF NOT EXISTS profile_type text CHECK (profile_type IN ('business', 'personal')),
ADD COLUMN IF NOT EXISTS whatsapp_number text;

-- Add comment to clarify whatsapp_number usage
COMMENT ON COLUMN public.profiles.whatsapp_number IS 'WhatsApp contact number for business profiles (internal use only, not public)';