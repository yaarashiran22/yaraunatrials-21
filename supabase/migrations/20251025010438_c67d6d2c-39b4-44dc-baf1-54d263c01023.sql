-- Add email and ensure phone_number is unique in whatsapp_users table
ALTER TABLE whatsapp_users 
ADD COLUMN IF NOT EXISTS email text;

-- Add unique constraint on phone_number to prevent duplicates
ALTER TABLE whatsapp_users 
DROP CONSTRAINT IF EXISTS whatsapp_users_phone_number_key;

ALTER TABLE whatsapp_users 
ADD CONSTRAINT whatsapp_users_phone_number_key UNIQUE (phone_number);