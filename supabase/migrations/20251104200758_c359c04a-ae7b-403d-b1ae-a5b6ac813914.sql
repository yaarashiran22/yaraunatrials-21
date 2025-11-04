-- Add event_id to join_requests table to link requests to specific events
ALTER TABLE join_requests 
ADD COLUMN event_id uuid REFERENCES events(id) ON DELETE CASCADE;

-- Add index for faster lookups
CREATE INDEX idx_join_requests_event_id ON join_requests(event_id);