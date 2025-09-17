-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  profile_image_url TEXT,
  bio TEXT,
  location TEXT,
  mobile_number TEXT,
  interests TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create items table for marketplace
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  category TEXT,
  location TEXT,
  mobile_number TEXT,
  image_url TEXT,
  market TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create posts table for social feed
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  image_url TEXT,
  video_url TEXT,
  location TEXT,
  mood TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create communities table
CREATE TABLE public.communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  category TEXT,
  subcategory TEXT,
  access_type TEXT DEFAULT 'open',
  logo_url TEXT,
  cover_image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_coupons table
CREATE TABLE public.user_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  business_name TEXT,
  discount_amount TEXT,
  valid_until TEXT,
  neighborhood TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT,
  title TEXT,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  related_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create event_rsvps table
CREATE TABLE public.event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'going',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);

-- Create community_events table
CREATE TABLE public.community_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(community_id, event_id)
);

-- Create community_perks table
CREATE TABLE public.community_perks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_picture_galleries table
CREATE TABLE public.user_picture_galleries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create friends_picture_galleries table
CREATE TABLE public.friends_picture_galleries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create neighbor_questions table
CREATE TABLE public.neighbor_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT false,
  message_type TEXT DEFAULT 'inquiry',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_perks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_picture_galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends_picture_galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neighbor_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for items
CREATE POLICY "Items are viewable by everyone" ON public.items FOR SELECT USING (true);
CREATE POLICY "Users can create their own items" ON public.items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own items" ON public.items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own items" ON public.items FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for events
CREATE POLICY "Events are viewable by everyone" ON public.events FOR SELECT USING (true);
CREATE POLICY "Users can create their own events" ON public.events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own events" ON public.events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own events" ON public.events FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for posts
CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users can create their own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own posts" ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own posts" ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for communities
CREATE POLICY "Communities are viewable by everyone" ON public.communities FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create communities" ON public.communities FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update communities" ON public.communities FOR UPDATE USING (auth.uid() IS NOT NULL);

-- RLS Policies for user_coupons
CREATE POLICY "Users can view their own coupons" ON public.user_coupons FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own coupons" ON public.user_coupons FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own coupons" ON public.user_coupons FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own coupons" ON public.user_coupons FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can create notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for event_rsvps
CREATE POLICY "Event RSVPs are viewable by everyone" ON public.event_rsvps FOR SELECT USING (true);
CREATE POLICY "Users can create their own RSVPs" ON public.event_rsvps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own RSVPs" ON public.event_rsvps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own RSVPs" ON public.event_rsvps FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for community_events
CREATE POLICY "Community events are viewable by everyone" ON public.community_events FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create community events" ON public.community_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for community_perks
CREATE POLICY "Community perks are viewable by everyone" ON public.community_perks FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create community perks" ON public.community_perks FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for user_picture_galleries
CREATE POLICY "Users can view their own galleries" ON public.user_picture_galleries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own galleries" ON public.user_picture_galleries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own galleries" ON public.user_picture_galleries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own galleries" ON public.user_picture_galleries FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for friends_picture_galleries
CREATE POLICY "Friend galleries are viewable by everyone" ON public.friends_picture_galleries FOR SELECT USING (true);
CREATE POLICY "Users can create their own friend galleries" ON public.friends_picture_galleries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own friend galleries" ON public.friends_picture_galleries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own friend galleries" ON public.friends_picture_galleries FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for neighbor_questions
CREATE POLICY "Neighbor questions are viewable by everyone" ON public.neighbor_questions FOR SELECT USING (true);
CREATE POLICY "Users can create neighbor questions" ON public.neighbor_questions FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can update their own neighbor questions" ON public.neighbor_questions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own neighbor questions" ON public.neighbor_questions FOR DELETE USING (auth.uid() = user_id);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('item-images', 'item-images', true),
  ('photos', 'photos', true),
  ('videos', 'videos', true),
  ('profile-images', 'profile-images', true),
  ('daily-photos', 'daily-photos', true);

-- Storage policies for item-images bucket
CREATE POLICY "Item images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'item-images');
CREATE POLICY "Users can upload item images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'item-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can update item images" ON storage.objects FOR UPDATE USING (bucket_id = 'item-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete item images" ON storage.objects FOR DELETE USING (bucket_id = 'item-images' AND auth.uid() IS NOT NULL);

-- Storage policies for photos bucket
CREATE POLICY "Photos are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'photos');
CREATE POLICY "Users can upload photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can update photos" ON storage.objects FOR UPDATE USING (bucket_id = 'photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete photos" ON storage.objects FOR DELETE USING (bucket_id = 'photos' AND auth.uid() IS NOT NULL);

-- Storage policies for videos bucket
CREATE POLICY "Videos are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'videos');
CREATE POLICY "Users can upload videos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'videos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can update videos" ON storage.objects FOR UPDATE USING (bucket_id = 'videos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete videos" ON storage.objects FOR DELETE USING (bucket_id = 'videos' AND auth.uid() IS NOT NULL);

-- Storage policies for profile-images bucket
CREATE POLICY "Profile images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'profile-images');
CREATE POLICY "Users can upload profile images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'profile-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can update profile images" ON storage.objects FOR UPDATE USING (bucket_id = 'profile-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete profile images" ON storage.objects FOR DELETE USING (bucket_id = 'profile-images' AND auth.uid() IS NOT NULL);

-- Storage policies for daily-photos bucket
CREATE POLICY "Daily photos are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'daily-photos');
CREATE POLICY "Users can upload daily photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'daily-photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can update daily photos" ON storage.objects FOR UPDATE USING (bucket_id = 'daily-photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete daily photos" ON storage.objects FOR DELETE USING (bucket_id = 'daily-photos' AND auth.uid() IS NOT NULL);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_communities_updated_at BEFORE UPDATE ON public.communities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_coupons_updated_at BEFORE UPDATE ON public.user_coupons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_neighbor_questions_updated_at BEFORE UPDATE ON public.neighbor_questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();