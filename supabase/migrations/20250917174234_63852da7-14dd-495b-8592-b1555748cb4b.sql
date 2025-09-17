-- Create neighborhood_ideas table
CREATE TABLE public.neighborhood_ideas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  neighborhood TEXT,
  market TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.neighborhood_ideas ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Neighborhood ideas are viewable by everyone" 
ON public.neighborhood_ideas 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create neighborhood ideas" 
ON public.neighborhood_ideas 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own neighborhood ideas" 
ON public.neighborhood_ideas 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own neighborhood ideas" 
ON public.neighborhood_ideas 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create idea_votes table
CREATE TABLE public.idea_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  idea_id UUID NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('agree', 'disagree')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, idea_id)
);

-- Enable RLS
ALTER TABLE public.idea_votes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Idea votes are viewable by everyone" 
ON public.idea_votes 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own votes" 
ON public.idea_votes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes" 
ON public.idea_votes 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes" 
ON public.idea_votes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_neighborhood_ideas_updated_at
BEFORE UPDATE ON public.neighborhood_ideas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();