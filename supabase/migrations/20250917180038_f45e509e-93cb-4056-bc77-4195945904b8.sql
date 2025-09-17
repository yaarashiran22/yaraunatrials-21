-- Create the remaining missing tables that hooks are trying to access

-- Create community_requests table
CREATE TABLE public.community_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  community_id UUID NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for community_requests
ALTER TABLE public.community_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for community_requests
CREATE POLICY "Community requests are viewable by everyone" 
ON public.community_requests 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own community requests" 
ON public.community_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create meetup_join_requests table
CREATE TABLE public.meetup_join_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  meetup_id UUID NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for meetup_join_requests
ALTER TABLE public.meetup_join_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for meetup_join_requests
CREATE POLICY "Meetup join requests are viewable by everyone" 
ON public.meetup_join_requests 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own meetup join requests" 
ON public.meetup_join_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);