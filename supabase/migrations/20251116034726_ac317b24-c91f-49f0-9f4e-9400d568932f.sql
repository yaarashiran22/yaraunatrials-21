-- Create table to track event upload conversation state
CREATE TABLE IF NOT EXISTS whatsapp_event_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'awaiting_intent', -- awaiting_intent, awaiting_image, awaiting_title, awaiting_description, awaiting_date, awaiting_time, awaiting_instagram, complete
  title TEXT,
  description TEXT,
  date TEXT,
  time TEXT,
  instagram_handle TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Add RLS policies
ALTER TABLE whatsapp_event_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage event uploads"
  ON whatsapp_event_uploads
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_whatsapp_event_uploads_phone ON whatsapp_event_uploads(phone_number);
CREATE INDEX idx_whatsapp_event_uploads_expires ON whatsapp_event_uploads(expires_at);