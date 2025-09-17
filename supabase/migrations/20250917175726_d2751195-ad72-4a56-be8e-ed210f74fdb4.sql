-- Create the remaining missing tables

-- Create recommendation_agreements table
CREATE TABLE public.recommendation_agreements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  recommendation_id UUID NOT NULL,
  agreement_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for recommendation_agreements
ALTER TABLE public.recommendation_agreements ENABLE ROW LEVEL SECURITY;

-- Create policies for recommendation_agreements
CREATE POLICY "Users can view all recommendation agreements" 
ON public.recommendation_agreements 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own agreements" 
ON public.recommendation_agreements 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own agreements" 
ON public.recommendation_agreements 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create stories table
CREATE TABLE public.stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT,
  image_url TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  story_type TEXT DEFAULT 'user',
  is_announcement BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for stories
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- Create policies for stories
CREATE POLICY "Stories are viewable by everyone" 
ON public.stories 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own stories" 
ON public.stories 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stories" 
ON public.stories 
FOR DELETE 
USING (auth.uid() = user_id);