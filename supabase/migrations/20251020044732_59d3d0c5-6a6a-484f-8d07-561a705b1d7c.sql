-- Add new fields to events table for better personalization
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS target_audience text,
ADD COLUMN IF NOT EXISTS music_type text,
ADD COLUMN IF NOT EXISTS venue_size text,
ADD COLUMN IF NOT EXISTS price_range text;

-- Add check constraints for valid values
ALTER TABLE events 
ADD CONSTRAINT venue_size_check 
CHECK (venue_size IS NULL OR venue_size IN ('intimate', 'moderate', 'big'));

ALTER TABLE events 
ADD CONSTRAINT price_range_check 
CHECK (price_range IS NULL OR price_range IN ('cheap', 'moderate', 'expensive'));

COMMENT ON COLUMN events.target_audience IS 'Target age group for the event (e.g., "18-25", "25-35", "all ages")';
COMMENT ON COLUMN events.music_type IS 'Type of music at the event (e.g., "jazz", "techno", "indie rock")';
COMMENT ON COLUMN events.venue_size IS 'Size of venue: intimate (up to 50), moderate (up to 100), big (100+)';
COMMENT ON COLUMN events.price_range IS 'Price range: cheap, moderate, or expensive';