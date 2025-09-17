-- Add missing columns to existing tables
ALTER TABLE public.user_coupon_claims 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update direct_messages table to match expected schema
ALTER TABLE public.direct_messages 
ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS message TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Create event_companion_requests table
CREATE TABLE IF NOT EXISTS public.event_companion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Enable RLS and add policies
ALTER TABLE public.event_companion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event companion requests are viewable by everyone" ON public.event_companion_requests FOR SELECT USING (true);
CREATE POLICY "Users can create companion requests" ON public.event_companion_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own requests" ON public.event_companion_requests FOR UPDATE USING (auth.uid() = user_id);