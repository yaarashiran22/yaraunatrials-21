-- Create table for WhatsApp conversation history
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups by phone number
CREATE INDEX IF NOT EXISTS idx_whatsapp_phone ON whatsapp_conversations(phone_number, created_at DESC);

-- Enable RLS
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;

-- Allow the service role to manage all data (edge functions use service role)
CREATE POLICY "Service role can manage whatsapp conversations"
ON whatsapp_conversations
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);