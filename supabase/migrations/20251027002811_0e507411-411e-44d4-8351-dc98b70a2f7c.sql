-- Remove email column from whatsapp_users table
ALTER TABLE whatsapp_users 
DROP COLUMN IF EXISTS email;