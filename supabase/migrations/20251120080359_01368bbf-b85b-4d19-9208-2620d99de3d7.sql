-- Fix security issues from previous migration

-- Drop the extension from public and recreate in extensions schema
DROP EXTENSION IF EXISTS vector CASCADE;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Recreate the embedding column (it was dropped by CASCADE)
ALTER TABLE events ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Recreate index for faster similarity search
CREATE INDEX IF NOT EXISTS events_embedding_idx ON events 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Recreate function with proper search_path
CREATE OR REPLACE FUNCTION match_events(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    events.id,
    events.title,
    events.description,
    1 - (events.embedding <=> query_embedding) as similarity
  FROM events
  WHERE events.embedding IS NOT NULL
    AND 1 - (events.embedding <=> query_embedding) > match_threshold
  ORDER BY events.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;