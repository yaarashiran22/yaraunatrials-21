-- =====================================================
-- YARA BA DATABASE BACKUP
-- Generated: 2026-01-04
-- =====================================================

-- =====================================================
-- TABLE: profiles
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  open_to_connecting BOOLEAN DEFAULT true,
  age INTEGER,
  name TEXT,
  profile_image_url TEXT,
  bio TEXT,
  location TEXT,
  mobile_number TEXT,
  interests TEXT[],
  username TEXT,
  avatar_url TEXT,
  specialties TEXT[],
  email TEXT,
  origin TEXT,
  profile_type TEXT,
  whatsapp_number TEXT
);

-- =====================================================
-- TABLE: events
-- =====================================================
CREATE TABLE IF NOT EXISTS public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  embedding vector(1536),
  title TEXT NOT NULL,
  description TEXT,
  date TEXT,
  time TEXT,
  location TEXT,
  price TEXT,
  image_url TEXT,
  video_url TEXT,
  external_link TEXT,
  event_type TEXT DEFAULT 'event',
  mood TEXT,
  market TEXT,
  target_audience TEXT,
  music_type TEXT,
  venue_size TEXT,
  price_range TEXT,
  venue_name TEXT,
  address TEXT,
  ticket_link TEXT
);

-- =====================================================
-- TABLE: items
-- =====================================================
CREATE TABLE IF NOT EXISTS public.items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  price NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  embedding vector(1536),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  location TEXT,
  mobile_number TEXT,
  image_url TEXT,
  market TEXT,
  status TEXT DEFAULT 'active',
  meetup_date TEXT,
  meetup_time TEXT
);

-- =====================================================
-- TABLE: top_lists
-- =====================================================
CREATE TABLE IF NOT EXISTS public.top_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT
);

-- =====================================================
-- TABLE: top_list_items
-- =====================================================
CREATE TABLE IF NOT EXISTS public.top_list_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  embedding vector(1536),
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  image_url TEXT,
  url TEXT
);

-- =====================================================
-- TABLE: whatsapp_users
-- =====================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  age INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  recommendation_count INTEGER DEFAULT 0,
  wants_ai_recommendations BOOLEAN DEFAULT true,
  preferences_asked BOOLEAN DEFAULT false,
  first_day_followup_sent_at TIMESTAMP WITH TIME ZONE,
  phone_number TEXT NOT NULL,
  name TEXT,
  budget_preference TEXT,
  favorite_neighborhoods TEXT[],
  interests TEXT[],
  activity_frequency TEXT,
  music_preferences TEXT[],
  preferred_language TEXT DEFAULT 'en'
);

-- =====================================================
-- TABLE: whatsapp_conversations
-- =====================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  phone_number TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL
);

-- =====================================================
-- TABLE: whatsapp_user_interactions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_user_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  interaction_type TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  item_type TEXT NOT NULL
);

-- =====================================================
-- TABLE: expired_events
-- =====================================================
CREATE TABLE IF NOT EXISTS public.expired_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_event_id UUID,
  user_id UUID,
  original_created_at TIMESTAMP WITH TIME ZONE,
  original_updated_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  title TEXT NOT NULL,
  description TEXT,
  date TEXT,
  time TEXT,
  location TEXT,
  price TEXT,
  image_url TEXT,
  video_url TEXT,
  external_link TEXT,
  event_type TEXT,
  mood TEXT,
  market TEXT,
  target_audience TEXT,
  music_type TEXT,
  venue_size TEXT,
  price_range TEXT,
  venue_name TEXT,
  address TEXT,
  ticket_link TEXT
);

-- =====================================================
-- TABLE: event_rsvps
-- =====================================================
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  event_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'going'
);

-- =====================================================
-- TABLE: join_requests
-- =====================================================
CREATE TABLE IF NOT EXISTS public.join_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  age INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '8 hours'),
  event_id UUID,
  phone_number TEXT NOT NULL,
  name TEXT NOT NULL,
  photo_url TEXT,
  description TEXT,
  additional_photos TEXT[] DEFAULT '{}'
);

-- =====================================================
-- TABLE: chatbot_errors
-- =====================================================
CREATE TABLE IF NOT EXISTS public.chatbot_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  context JSONB,
  resolved BOOLEAN DEFAULT false,
  function_name TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  user_query TEXT,
  phone_number TEXT,
  notes TEXT
);

-- =====================================================
-- TABLE: communities
-- =====================================================
CREATE TABLE IF NOT EXISTS public.communities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  creator_id UUID,
  member_count INTEGER DEFAULT 0,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  category TEXT,
  subcategory TEXT,
  access_type TEXT DEFAULT 'open',
  logo_url TEXT,
  cover_image_url TEXT
);

-- =====================================================
-- TABLE: notifications
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  is_read BOOLEAN DEFAULT false,
  related_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  type TEXT,
  title TEXT,
  message TEXT
);

-- =====================================================
-- TABLE: posts
-- =====================================================
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  content TEXT,
  image_url TEXT,
  video_url TEXT,
  location TEXT,
  mood TEXT
);

-- =====================================================
-- TABLE: user_coupons
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  embedding vector(1536),
  title TEXT NOT NULL,
  description TEXT,
  business_name TEXT,
  discount_amount TEXT,
  valid_until TEXT,
  neighborhood TEXT,
  image_url TEXT,
  coupon_code TEXT
);

-- =====================================================
-- TABLE: user_following
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_following (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- TABLE: user_friends
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_friends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  friend_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'pending'
);

-- =====================================================
-- TABLE: user_locations
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  latitude NUMERIC,
  longitude NUMERIC,
  status TEXT DEFAULT 'open'
);

-- =====================================================
-- TABLE: profile_photos
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profile_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  display_order INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  photo_url TEXT NOT NULL
);

-- =====================================================
-- DATA: profiles (9 rows)
-- =====================================================
INSERT INTO public.profiles (id, email, name, bio, location, profile_image_url, interests, specialties, open_to_connecting, created_at, updated_at, profile_type) VALUES
('f7be367e-8962-4cae-ad35-f1a45705bfda', 'cristin.sebastian@gmail.com', 'Tin', 'A seasoned professional based in Buenos Aires with extensive experience in finance and banking. Dedicated in fostering meaningful connections, she also founded the Girls Brunch Group, an all-women community that brings together locals and expats for networking, friendship, and inspiring conversations.', 'Palermo Soho', 'https://nxtfugcmatkiqjzxucgh.supabase.co/storage/v1/object/public/profile-images/f7be367e-8962-4cae-ad35-f1a45705bfda/profile.jpg?t=1765817475912', ARRAY['🧘 Wellness & Health', '👗 Fashion & Style', '✈️ Travel & Adventure', '🎨 Art & Design', '💻 Technology'], ARRAY[]::text[], true, '2025-12-15 16:38:33.812177+00', '2025-12-15 16:51:37.517365+00', NULL),
('0dd5269a-f860-4fce-87eb-3b041d26d485', 'ezequiel.ibarra@mdc54.com.ar', 'Ezequiel Ibarra', NULL, NULL, NULL, ARRAY[]::text[], ARRAY[]::text[], true, '2025-09-19 13:11:24.460105+00', '2025-09-19 13:11:24.460105+00', NULL),
('34a06d3e-3716-4b3c-8c08-a9062b732253', 'yaara.shiran@gmail.com', 'yara', '', 'Chacarita', 'https://nxtfugcmatkiqjzxucgh.supabase.co/storage/v1/object/public/profile-images/34a06d3e-3716-4b3c-8c08-a9062b732253/profile.jpeg?t=1760794226038', ARRAY[]::text[], ARRAY[]::text[], true, '2025-09-17 22:47:14.233357+00', '2025-10-18 13:30:59.863198+00', NULL),
('7860ba80-871d-4457-9262-ba052eace238', 'lucasrubim2009@gmail.com', 'lucasrubim2009', NULL, NULL, NULL, ARRAY[]::text[], ARRAY[]::text[], true, '2025-10-19 20:44:19.917718+00', '2025-10-19 20:44:19.917718+00', NULL),
('cd1db31c-a217-467a-95f0-a664fe1c9ecd', 'sivanie.shiran@gmail.com', 'Nantes ArtShop', '', '', 'https://nxtfugcmatkiqjzxucgh.supabase.co/storage/v1/object/public/profile-images/cd1db31c-a217-467a-95f0-a664fe1c9ecd/profile.jpeg?t=1760935024150', ARRAY[]::text[], ARRAY[]::text[], true, '2025-10-19 23:32:52.103933+00', '2025-10-20 04:37:04.78883+00', 'business'),
('b13cdf21-4b27-4a67-a1ba-c16c25cb4714', 'milenajx@outlook.com', 'Milena', '', 'Almagro', 'https://nxtfugcmatkiqjzxucgh.supabase.co/storage/v1/object/public/profile-images/b13cdf21-4b27-4a67-a1ba-c16c25cb4714/profile.jpeg?t=1761532174693', ARRAY[]::text[], ARRAY[]::text[], true, '2025-10-24 16:20:16.017587+00', '2025-10-27 02:29:35.672961+00', NULL),
('af8ea009-618f-4e86-9dc8-643b51886f10', 'sivanie.shiran@hotmail.com', 'jackson', NULL, NULL, NULL, ARRAY[]::text[], ARRAY[]::text[], true, '2025-10-23 12:54:42.786062+00', '2025-11-20 01:16:09.066831+00', NULL),
('853298a4-0f10-4adf-add3-c3b7379cdcda', 'user@example.com', 'yaarass', '', '', 'https://nxtfugcmatkiqjzxucgh.supabase.co/storage/v1/object/public/profile-images/853298a4-0f10-4adf-add3-c3b7379cdcda/profile.jpeg', ARRAY[]::text[], ARRAY[]::text[], true, '2025-09-17 19:21:36.73348+00', '2025-11-20 14:02:22.042036+00', NULL),
('d000ab8a-9509-4d16-917c-94d50d35eedf', 'danielac880@gmail.com', 'Daniela', NULL, NULL, NULL, ARRAY[]::text[], ARRAY[]::text[], true, '2025-11-20 15:48:51.751465+00', '2025-11-20 15:48:51.751465+00', NULL)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- DATA: top_lists (9 rows)
-- =====================================================
INSERT INTO public.top_lists (id, user_id, title, category, description, created_at, updated_at) VALUES
('623598f7-e4e9-4bda-91cd-0d2e817d2357', 'af8ea009-618f-4e86-9dc8-643b51886f10', 'Communities', 'Communities', 'for new commers in the city looking to meet people', '2025-11-13 00:50:22.894894+00', '2025-11-13 14:17:42.616162+00'),
('cd6ed9e6-9ef6-422c-b862-d4d649e3349b', '853298a4-0f10-4adf-add3-c3b7379cdcda', 'Fancy Bars', 'Bars', 'Curated list of upscale and sophisticated bars in Buenos Aires', '2025-11-18 23:24:18.793588+00', '2025-11-18 23:24:18.793588+00'),
('7cdbe621-1b5e-4d50-b8a8-c81e6eed6745', '853298a4-0f10-4adf-add3-c3b7379cdcda', 'Chill, Social Bars', 'Bars', 'Relaxed, affordable bars with great social atmosphere', '2025-11-18 23:30:04.175824+00', '2025-11-18 23:30:04.175824+00'),
('4b6b4e88-e707-4ccc-8e1b-58f3ea26821a', '34a06d3e-3716-4b3c-8c08-a9062b732253', 'backpacker favorites Bars', 'Bars', 'Social bars for travelers and young backpackers looking to go out, socialize and have an unforgettable BA experience 😉', '2025-11-04 15:22:54.441465+00', '2025-11-18 23:30:14.013142+00'),
('a87864cb-ff74-4ad4-b1c2-5dd400c23307', 'af8ea009-618f-4e86-9dc8-643b51886f10', 'Club', 'clubs', 'Buenos Aires club scene - techno, house, and electronic music venues', '2025-11-16 00:02:25.752087+00', '2025-11-18 23:30:41.174059+00'),
('719b4480-957e-4bb2-bbea-127a69aa68b3', '853298a4-0f10-4adf-add3-c3b7379cdcda', 'Theaters', 'Theaters', 'Curated list of theaters, cinemas, and cultural spaces in Buenos Aires', '2025-11-18 23:32:29.626748+00', '2025-11-18 23:32:29.626748+00'),
('5e68e942-82d3-4433-8723-18dd4e902d5e', '853298a4-0f10-4adf-add3-c3b7379cdcda', 'Misc Clubs/Bars', 'Clubs', 'Indie and alternative clubs and bars that blend multiple genres and cultural experiences', '2025-11-18 23:37:12.147984+00', '2025-11-18 23:37:12.147984+00'),
('a61f1cb0-9a18-4370-b9c4-32d7b80ec092', '853298a4-0f10-4adf-add3-c3b7379cdcda', 'Cafes', 'Cafes', 'Curated list of notable cafes and coffee houses in Buenos Aires', '2025-11-18 23:39:11.438702+00', '2025-11-18 23:39:11.438702+00'),
('78751ccb-ea8c-4d5c-b202-74b950311ede', '853298a4-0f10-4adf-add3-c3b7379cdcda', 'Cultural Centers', 'Cultural Centers', 'Notable cultural centers and art spaces in Buenos Aires', '2025-11-18 23:40:17.514469+00', '2025-11-18 23:40:17.514469+00')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- DATA: event_rsvps (1 row)
-- =====================================================
INSERT INTO public.event_rsvps (id, user_id, event_id, status, created_at) VALUES
('4dca07cc-789c-46e9-a247-f4698c5952df', 'f7be367e-8962-4cae-ad35-f1a45705bfda', '7caf1b68-befa-47f4-8bfc-24a6d198c749', 'going', '2025-12-15 18:06:48.431592+00')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- DATA: join_requests (5 rows)
-- =====================================================
INSERT INTO public.join_requests (id, phone_number, name, age, photo_url, description, event_id, created_at, expires_at, additional_photos) VALUES
('a1095d8d-a454-4209-bd49-28b83364563a', 'whatsapp:+5491158679182', 'Anonymous', 25, NULL, NULL, NULL, '2025-11-04 17:27:08.183604+00', '2025-11-05 01:27:08.183604+00', ARRAY[]::text[]),
('3cd9b6da-a921-4ad2-999e-a852f4a21de3', 'whatsapp:+5491158679182', 'Anonymous', 25, NULL, NULL, NULL, '2025-11-04 17:35:39.182515+00', '2025-11-05 01:35:39.182515+00', ARRAY[]::text[]),
('62571ab1-49b0-48a6-93f1-03bd5ccd34e4', 'whatsapp:+5491158679182', 'Anonymous', 25, NULL, NULL, NULL, '2025-11-04 17:37:52.523922+00', '2025-11-05 01:37:52.523922+00', ARRAY[]::text[]),
('ffabee6f-5a8d-4d5b-b2bc-8939fdd922c8', 'whatsapp:+5491158679182', 'yara', 25, 'https://nxtfugcmatkiqjzxucgh.supabase.co/storage/v1/object/public/profile-images/0.9063103173171354.jpeg', '', NULL, '2025-11-04 17:48:06.825336+00', '2025-11-05 01:48:06.825336+00', ARRAY[]::text[]),
('9db20223-a8aa-4404-8327-ca2a0858e58c', 'whatsapp:+5491158679182', 'yara', 25, 'https://nxtfugcmatkiqjzxucgh.supabase.co/storage/v1/object/public/profile-images/0.35512254669281496.jpeg', 'new in buenos aires and into jazz nights
my insta: @yaratakingphotos', NULL, '2025-11-04 18:34:09.366849+00', '2025-11-05 02:34:09.366849+00', ARRAY[]::text[])
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- NOTE: Large tables not fully included
-- =====================================================
-- The following tables have many rows and were not fully exported:
-- - events: 311 rows (use CSV export for full data)
-- - expired_events: 56 rows
-- - whatsapp_users: 454 rows
-- - whatsapp_conversations: 5079 rows
-- - whatsapp_user_interactions: 7051 rows
-- - top_list_items: 103 rows
-- - chatbot_errors: 15 rows
--
-- To get full data, use the CSV export in Cloud → Database → Tables
-- =====================================================

-- =====================================================
-- END OF BACKUP
-- =====================================================
