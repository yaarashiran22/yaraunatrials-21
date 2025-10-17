-- Remove meetup-related tables
DROP TABLE IF EXISTS public.meetup_join_requests CASCADE;

-- Update events table to remove meetup-specific event types if needed
-- (keeping events table as it's used for both events and other purposes)