-- Add venue_name column to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS venue_name TEXT;