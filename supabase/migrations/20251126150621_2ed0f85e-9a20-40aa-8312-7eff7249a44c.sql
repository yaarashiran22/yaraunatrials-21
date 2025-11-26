-- Create expired_events table to archive past events
CREATE TABLE public.expired_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_event_id UUID,
  user_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  date TEXT,
  time TEXT,
  location TEXT,
  price TEXT,
  image_url TEXT,
  video_url TEXT,
  external_link TEXT,
  event_type TEXT,
  mood TEXT,
  market TEXT,
  target_audience TEXT,
  music_type TEXT,
  venue_size TEXT,
  price_range TEXT,
  venue_name TEXT,
  address TEXT,
  ticket_link TEXT,
  original_created_at TIMESTAMP WITH TIME ZONE,
  original_updated_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expired_events ENABLE ROW LEVEL SECURITY;

-- Allow public read access for analytics/reporting
CREATE POLICY "Expired events are viewable by everyone" 
ON public.expired_events 
FOR SELECT 
USING (true);

-- Only service role can insert/update/delete (via edge function)
CREATE POLICY "Service role can manage expired events" 
ON public.expired_events 
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_expired_events_archived_at ON public.expired_events(archived_at);
CREATE INDEX idx_expired_events_date ON public.expired_events(date);