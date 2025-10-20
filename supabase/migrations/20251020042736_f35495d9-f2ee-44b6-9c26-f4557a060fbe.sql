-- Create a function to delete past events
CREATE OR REPLACE FUNCTION delete_past_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete events where the date is in the past
  DELETE FROM events
  WHERE date < CURRENT_DATE::text;
  
  RAISE NOTICE 'Deleted past events';
END;
$$;

-- Create a function that will be called by pg_cron to clean up past events daily
-- Note: This is a placeholder - actual pg_cron setup would need to be done separately
-- For now, we'll document that this function should be called periodically

COMMENT ON FUNCTION delete_past_events() IS 'Deletes events with dates in the past. Should be run daily via cron job or manual trigger.';