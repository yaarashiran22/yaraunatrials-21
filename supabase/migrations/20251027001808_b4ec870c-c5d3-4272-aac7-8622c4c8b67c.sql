-- Add music_preferences column to whatsapp_users table
ALTER TABLE whatsapp_users 
ADD COLUMN music_preferences text[] DEFAULT NULL;