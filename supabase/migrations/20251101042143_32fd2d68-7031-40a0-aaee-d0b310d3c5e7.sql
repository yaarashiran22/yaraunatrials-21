-- Add ticket_link column to events table
ALTER TABLE public.events 
ADD COLUMN ticket_link text;