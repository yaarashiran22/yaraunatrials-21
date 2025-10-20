-- Create WhatsApp users table for storing user profiles and preferences
CREATE TABLE public.whatsapp_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  name TEXT,
  age INTEGER,
  budget_preference TEXT,
  favorite_neighborhoods TEXT[],
  interests TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  recommendation_count INTEGER DEFAULT 0 NOT NULL
);

-- Enable RLS
ALTER TABLE public.whatsapp_users ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage all WhatsApp users
CREATE POLICY "Service role can manage whatsapp users"
ON public.whatsapp_users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create updated_at trigger
CREATE TRIGGER update_whatsapp_users_updated_at
BEFORE UPDATE ON public.whatsapp_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index on phone_number for faster lookups
CREATE INDEX idx_whatsapp_users_phone ON public.whatsapp_users(phone_number);