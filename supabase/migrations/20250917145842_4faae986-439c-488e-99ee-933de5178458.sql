-- Add missing columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create missing tables referenced in hooks

-- Create user_coupon_claims table
CREATE TABLE IF NOT EXISTS public.user_coupon_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  perk_id UUID REFERENCES public.community_perks(id) ON DELETE CASCADE,
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  qr_code_data TEXT,
  is_used BOOLEAN DEFAULT false,
  UNIQUE(user_id, perk_id)
);

-- Create direct_messages table  
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on new tables
ALTER TABLE public.user_coupon_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_coupon_claims
CREATE POLICY "Users can view their own coupon claims" ON public.user_coupon_claims FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own coupon claims" ON public.user_coupon_claims FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own coupon claims" ON public.user_coupon_claims FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for direct_messages
CREATE POLICY "Users can view their own messages" ON public.direct_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send messages" ON public.direct_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update their own messages" ON public.direct_messages FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);