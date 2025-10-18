-- Drop community-related and messaging tables that are no longer relevant

-- Drop the tables
DROP TABLE IF EXISTS public.community_requests CASCADE;
DROP TABLE IF EXISTS public.community_events CASCADE;
DROP TABLE IF EXISTS public.community_members CASCADE;
DROP TABLE IF EXISTS public.direct_messages CASCADE;
DROP TABLE IF EXISTS public.community_perks CASCADE;