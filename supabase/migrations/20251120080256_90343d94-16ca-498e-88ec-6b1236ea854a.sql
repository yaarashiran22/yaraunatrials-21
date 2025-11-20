-- Enable pgvector extension for similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create index for faster similarity search
CREATE INDEX IF NOT EXISTS events_embedding_idx ON events 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create function to search events by similarity
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