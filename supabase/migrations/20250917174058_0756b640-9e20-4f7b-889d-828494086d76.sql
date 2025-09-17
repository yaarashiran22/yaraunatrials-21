-- Create user_friends table
CREATE TABLE public.user_friends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  friend_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

-- Enable RLS
ALTER TABLE public.user_friends ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own friendships" 
ON public.user_friends 
FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friend requests" 
ON public.user_friends 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own friendships" 
ON public.user_friends 
FOR UPDATE 
USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete their own friendships" 
ON public.user_friends 
FOR DELETE 
USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Create user_following table
CREATE TABLE public.user_following (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- Enable RLS
ALTER TABLE public.user_following ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view all followings" 
ON public.user_following 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own followings" 
ON public.user_following 
FOR INSERT 
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can delete their own followings" 
ON public.user_following 
FOR DELETE 
USING (auth.uid() = follower_id);

-- Create daily_photo_submissions table
CREATE TABLE public.daily_photo_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  images TEXT[] NOT NULL,
  title TEXT,
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_photo_submissions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Daily photos are viewable by everyone" 
ON public.daily_photo_submissions 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own daily photos" 
ON public.daily_photo_submissions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily photos" 
ON public.daily_photo_submissions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily photos" 
ON public.daily_photo_submissions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_user_friends_updated_at
BEFORE UPDATE ON public.user_friends
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_photo_submissions_updated_at
BEFORE UPDATE ON public.daily_photo_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();