-- Create table for tracking chatbot errors
CREATE TABLE IF NOT EXISTS public.chatbot_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  function_name TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  user_query TEXT,
  phone_number TEXT,
  context JSONB,
  resolved BOOLEAN DEFAULT false,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.chatbot_errors ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to insert/update
CREATE POLICY "Service role can manage chatbot errors"
  ON public.chatbot_errors
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_chatbot_errors_created_at ON public.chatbot_errors(created_at DESC);
CREATE INDEX idx_chatbot_errors_phone_number ON public.chatbot_errors(phone_number);
CREATE INDEX idx_chatbot_errors_resolved ON public.chatbot_errors(resolved);
CREATE INDEX idx_chatbot_errors_function_name ON public.chatbot_errors(function_name);

COMMENT ON TABLE public.chatbot_errors IS 'Logs all errors from the Yara AI chatbot for monitoring and debugging';