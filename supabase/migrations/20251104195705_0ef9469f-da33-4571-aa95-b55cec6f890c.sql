-- Add additional_photos column to join_requests table
ALTER TABLE join_requests 
ADD COLUMN additional_photos TEXT[] DEFAULT ARRAY[]::TEXT[];