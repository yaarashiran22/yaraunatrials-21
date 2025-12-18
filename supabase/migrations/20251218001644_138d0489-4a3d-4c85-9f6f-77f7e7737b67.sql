
-- Create table to track processed WhatsApp messages for idempotency
CREATE TABLE public.processed_whatsapp_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_sid text NOT NULL UNIQUE,
  phone_number text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_processed_messages_sid ON public.processed_whatsapp_messages(message_sid);
CREATE INDEX idx_processed_messages_created ON public.processed_whatsapp_messages(created_at);

-- Enable RLS
ALTER TABLE public.processed_whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Service role can manage this table
CREATE POLICY "Service role can manage processed messages"
  ON public.processed_whatsapp_messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-cleanup old records (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_processed_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.processed_whatsapp_messages
  WHERE created_at < NOW() - INTERVAL '1 hour';
  RETURN NEW;
END;
$$;

CREATE TRIGGER cleanup_processed_messages_trigger
  AFTER INSERT ON public.processed_whatsapp_messages
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_old_processed_messages();
