-- Create friends_feed_posts table
CREATE TABLE public.friends_feed_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.friends_feed_posts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Friends feed posts are viewable by everyone" 
ON public.friends_feed_posts 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own friends feed posts" 
ON public.friends_feed_posts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own friends feed posts" 
ON public.friends_feed_posts 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own friends feed posts" 
ON public.friends_feed_posts 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_friends_feed_posts_updated_at
BEFORE UPDATE ON public.friends_feed_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Fix direct_messages table to add content field properly
ALTER TABLE public.direct_messages 
ADD COLUMN IF NOT EXISTS content_new TEXT NOT NULL DEFAULT '';

-- Update existing data
UPDATE public.direct_messages 
SET content_new = COALESCE(message, content, '');

-- Drop old columns and rename
ALTER TABLE public.direct_messages 
DROP COLUMN IF EXISTS message,
DROP COLUMN IF EXISTS content;

ALTER TABLE public.direct_messages 
RENAME COLUMN content_new TO content;