-- Add address column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS address text;