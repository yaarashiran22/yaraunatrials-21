-- Create the final missing tables

-- Create user_messages table
CREATE TABLE public.user_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for user_messages
ALTER TABLE public.user_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for user_messages
CREATE POLICY "Users can view their own messages" 
ON public.user_messages 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own messages" 
ON public.user_messages 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add missing columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS open_to_connecting BOOLEAN DEFAULT true;

-- Add missing columns to user_locations table
ALTER TABLE public.user_locations 
ADD COLUMN IF NOT EXISTS latitude NUMERIC,
ADD COLUMN IF NOT EXISTS longitude NUMERIC;