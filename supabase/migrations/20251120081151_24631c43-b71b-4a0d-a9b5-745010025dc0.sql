-- Fix the match_events function to work with vector extension in extensions schema
DROP FUNCTION IF EXISTS match_events(vector(1536), float, int);

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
SET search_path = public, extensions
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