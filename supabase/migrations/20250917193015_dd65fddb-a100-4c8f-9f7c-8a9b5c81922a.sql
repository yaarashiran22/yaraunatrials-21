-- Create user_friends table for managing friend relationships
CREATE TABLE public.user_friends (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, friend_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_friends ENABLE ROW LEVEL SECURITY;

-- Create policies for user_friends
CREATE POLICY "Users can view their own friendships" 
ON public.user_friends 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own friendships" 
ON public.user_friends 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own friendships" 
ON public.user_friends 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_user_friends_user_id ON public.user_friends(user_id);
CREATE INDEX idx_user_friends_friend_id ON public.user_friends(friend_id);