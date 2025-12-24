-- Add preferences_asked column to track if we've asked for preferences
ALTER TABLE public.whatsapp_users
ADD COLUMN IF NOT EXISTS preferences_asked boolean DEFAULT false;