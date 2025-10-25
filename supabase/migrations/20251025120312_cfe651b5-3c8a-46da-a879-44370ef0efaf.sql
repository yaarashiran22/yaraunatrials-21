-- Remove email field from whatsapp_users
ALTER TABLE whatsapp_users DROP COLUMN IF EXISTS email;

-- Add new fields for activity frequency and recommendation preferences
ALTER TABLE whatsapp_users 
ADD COLUMN IF NOT EXISTS activity_frequency text,
ADD COLUMN IF NOT EXISTS wants_ai_recommendations boolean DEFAULT true;