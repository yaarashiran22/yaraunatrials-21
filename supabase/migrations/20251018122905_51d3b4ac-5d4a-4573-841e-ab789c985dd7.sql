-- Remove daily photos storage bucket
DELETE FROM storage.buckets WHERE id = 'daily-photos';

-- Drop daily photo submissions table
DROP TABLE IF EXISTS public.daily_photo_submissions CASCADE;