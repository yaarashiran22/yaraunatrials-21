-- Create missing tables that the code expects

-- Create profile_photos table
CREATE TABLE public.profile_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  photo_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for profile_photos
ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;

-- Create policies for profile_photos
CREATE POLICY "Users can view all profile photos" 
ON public.profile_photos 
FOR SELECT 
USING (true);

CREATE POLICY "Users can manage their own profile photos" 
ON public.profile_photos 
FOR ALL 
USING (auth.uid() = user_id);

-- Create smallprofiles table for optimized profile queries
CREATE TABLE public.smallprofiles (
  id UUID NOT NULL PRIMARY KEY,
  photo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for smallprofiles
ALTER TABLE public.smallprofiles ENABLE ROW LEVEL SECURITY;

-- Create policies for smallprofiles
CREATE POLICY "Small profiles are viewable by everyone" 
ON public.smallprofiles 
FOR SELECT 
USING (true);

CREATE POLICY "Users can manage their own small profile" 
ON public.smallprofiles 
FOR ALL 
USING (auth.uid() = id);

-- Add missing columns to existing tables
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS meetup_date TEXT,
ADD COLUMN IF NOT EXISTS meetup_time TEXT;

-- Add image_url column to neighborhood_ideas if missing
ALTER TABLE public.neighborhood_ideas 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add triggers for updated_at columns
CREATE TRIGGER update_profile_photos_updated_at
BEFORE UPDATE ON public.profile_photos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_smallprofiles_updated_at
BEFORE UPDATE ON public.smallprofiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();