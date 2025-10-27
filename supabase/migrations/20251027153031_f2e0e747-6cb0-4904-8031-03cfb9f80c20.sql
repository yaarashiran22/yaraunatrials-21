-- Add preferred_language column to whatsapp_users table
ALTER TABLE whatsapp_users 
ADD COLUMN preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'es'));