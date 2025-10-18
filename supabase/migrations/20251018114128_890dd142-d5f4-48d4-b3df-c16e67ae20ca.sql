-- Drop tables that are no longer relevant to the website

-- Drop recommendations table
DROP TABLE IF EXISTS public.recommendations CASCADE;

-- Drop stories table
DROP TABLE IF EXISTS public.stories CASCADE;

-- Drop post_likes table
DROP TABLE IF EXISTS public.post_likes CASCADE;

-- Drop photo_gallery_likes table
DROP TABLE IF EXISTS public.photo_gallery_likes CASCADE;

-- Drop neighbor_questions table
DROP TABLE IF EXISTS public.neighbor_questions CASCADE;

-- Drop post_comments table
DROP TABLE IF EXISTS public.post_comments CASCADE;

-- Drop neighborhood_ideas table
DROP TABLE IF EXISTS public.neighborhood_ideas CASCADE;