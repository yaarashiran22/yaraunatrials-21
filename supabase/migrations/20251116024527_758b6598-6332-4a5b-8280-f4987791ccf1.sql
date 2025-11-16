-- Create table for tracking Instagram pages to scan for events
CREATE TABLE IF NOT EXISTS public.tracked_instagram_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instagram_handle TEXT NOT NULL UNIQUE,
  page_name TEXT,
  page_type TEXT, -- 'venue', 'promoter', 'artist', etc.
  is_active BOOLEAN DEFAULT true,
  last_scanned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.tracked_instagram_pages ENABLE ROW LEVEL SECURITY;

-- Create policies - viewable by everyone, manageable by authenticated users
CREATE POLICY "Instagram pages are viewable by everyone" 
ON public.tracked_instagram_pages 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can manage Instagram pages" 
ON public.tracked_instagram_pages 
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Add trigger for updated_at
CREATE TRIGGER update_tracked_instagram_pages_updated_at
BEFORE UPDATE ON public.tracked_instagram_pages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_tracked_instagram_pages_active ON public.tracked_instagram_pages(is_active, last_scanned_at);

COMMENT ON TABLE public.tracked_instagram_pages IS 'Instagram pages tracked for automatic event detection and scraping';