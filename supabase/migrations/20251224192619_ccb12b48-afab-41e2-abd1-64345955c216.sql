
-- Add column to track 24-hour follow-up for first-time users
ALTER TABLE public.whatsapp_users 
ADD COLUMN IF NOT EXISTS first_day_followup_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for efficient querying of users needing follow-up
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_followup 
ON public.whatsapp_users (created_at, first_day_followup_sent_at) 
WHERE first_day_followup_sent_at IS NULL;
