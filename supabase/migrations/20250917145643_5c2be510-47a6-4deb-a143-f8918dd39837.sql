-- Add missing columns to existing tables

-- Add missing columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add missing columns to communities table
ALTER TABLE public.communities 
ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0;

-- Add missing columns to user_picture_galleries table
ALTER TABLE public.user_picture_galleries 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add missing columns to community_perks table  
ALTER TABLE public.community_perks 
ADD COLUMN IF NOT EXISTS business_name TEXT,
ADD COLUMN IF NOT EXISTS discount_amount TEXT,
ADD COLUMN IF NOT EXISTS valid_until TEXT,
ADD COLUMN IF NOT EXISTS is_used BOOLEAN DEFAULT false;

-- Create coupon_claims table for tracking used coupons
CREATE TABLE IF NOT EXISTS public.coupon_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  perk_id UUID REFERENCES public.community_perks(id) ON DELETE CASCADE,
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  qr_code_data TEXT,
  is_used BOOLEAN DEFAULT false,
  UNIQUE(user_id, perk_id)
);

-- Enable RLS on coupon_claims
ALTER TABLE public.coupon_claims ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coupon_claims
CREATE POLICY "Users can view their own coupon claims" ON public.coupon_claims FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own coupon claims" ON public.coupon_claims FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own coupon claims" ON public.coupon_claims FOR UPDATE USING (auth.uid() = user_id);