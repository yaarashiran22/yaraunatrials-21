-- Create table to track user interactions with recommendations
CREATE TABLE IF NOT EXISTS public.whatsapp_user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  item_type TEXT NOT NULL, -- 'event', 'business', 'coupon'
  item_id UUID NOT NULL,
  interaction_type TEXT NOT NULL, -- 'recommended', 'asked_about', 'clicked'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_interactions_phone ON whatsapp_user_interactions(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_interactions_item ON whatsapp_user_interactions(item_type, item_id);

-- Enable RLS
ALTER TABLE public.whatsapp_user_interactions ENABLE ROW LEVEL SECURITY;

-- Service role can manage all interactions
CREATE POLICY "Service role can manage whatsapp interactions"
  ON public.whatsapp_user_interactions
  FOR ALL
  USING (true)
  WITH CHECK (true);