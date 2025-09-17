-- Create missing database functions that the hooks are calling

-- Function to update community membership status
CREATE OR REPLACE FUNCTION public.update_community_membership_status(
  membership_id UUID,
  new_status TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE community_members 
  SET status = new_status
  WHERE id = membership_id;
  
  RETURN json_build_object('success', true);
END;
$$;

-- Function to update meetup join status  
CREATE OR REPLACE FUNCTION public.update_meetup_join_status(
  rsvp_id UUID,
  new_status TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE meetup_join_requests 
  SET status = new_status
  WHERE id = rsvp_id;
  
  RETURN json_build_object('success', true);
END;
$$;