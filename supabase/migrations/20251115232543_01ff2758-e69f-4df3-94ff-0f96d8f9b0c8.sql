-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Users can create their own events" ON public.events;

-- Create a new policy that allows anyone to create events
CREATE POLICY "Anyone can create events" 
ON public.events 
FOR INSERT 
WITH CHECK (
  -- Allow unauthenticated users to create events with null user_id
  -- OR allow authenticated users to create events with their own user_id
  auth.uid() IS NULL OR auth.uid() = user_id
);