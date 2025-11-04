-- Create join_requests table for WhatsApp users looking for companions
CREATE TABLE public.join_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number text NOT NULL,
  name text NOT NULL,
  age integer,
  photo_url text,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '8 hours')
);

-- Enable Row Level Security
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view active (non-expired) join requests
CREATE POLICY "Anyone can view active join requests"
ON public.join_requests
FOR SELECT
USING (expires_at > now());

-- Policy: Service role can create join requests (from WhatsApp bot)
CREATE POLICY "Service role can create join requests"
ON public.join_requests
FOR INSERT
WITH CHECK (true);

-- Policy: Users can update their own requests by phone number
CREATE POLICY "Users can update their own join requests"
ON public.join_requests
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Policy: Users can delete their own requests
CREATE POLICY "Users can delete their own join requests"
ON public.join_requests
FOR DELETE
USING (true);

-- Create index on expires_at for faster queries
CREATE INDEX idx_join_requests_expires ON public.join_requests(expires_at);

-- Create index on phone number for lookups
CREATE INDEX idx_join_requests_phone ON public.join_requests(phone_number);