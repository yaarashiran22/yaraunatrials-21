-- Create match_documents function for vector similarity search across tables
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector(1536),
  match_count integer DEFAULT 10,
  filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  id uuid,
  title text,
  description text,
  similarity double precision,
  table_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  table_filter text;
BEGIN
  table_filter := filter->>'table';
  
  IF table_filter = 'events' OR table_filter IS NULL THEN
    RETURN QUERY
    SELECT
      e.id,
      e.title,
      e.description,
      1 - (e.embedding <=> query_embedding) as similarity,
      'events'::text as table_name
    FROM events e
    WHERE e.embedding IS NOT NULL
      AND 1 - (e.embedding <=> query_embedding) > 0.3
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count;
  ELSIF table_filter = 'user_coupons' THEN
    RETURN QUERY
    SELECT
      c.id,
      c.title,
      c.description,
      1 - (c.embedding <=> query_embedding) as similarity,
      'user_coupons'::text as table_name
    FROM user_coupons c
    WHERE c.embedding IS NOT NULL
      AND 1 - (c.embedding <=> query_embedding) > 0.3
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
  ELSIF table_filter = 'items' THEN
    RETURN QUERY
    SELECT
      i.id,
      i.title,
      i.description,
      1 - (i.embedding <=> query_embedding) as similarity,
      'items'::text as table_name
    FROM items i
    WHERE i.embedding IS NOT NULL
      AND 1 - (i.embedding <=> query_embedding) > 0.3
    ORDER BY i.embedding <=> query_embedding
    LIMIT match_count;
  ELSIF table_filter = 'top_list_items' THEN
    RETURN QUERY
    SELECT
      t.id,
      t.name as title,
      t.description,
      1 - (t.embedding <=> query_embedding) as similarity,
      'top_list_items'::text as table_name
    FROM top_list_items t
    WHERE t.embedding IS NOT NULL
      AND 1 - (t.embedding <=> query_embedding) > 0.3
    ORDER BY t.embedding <=> query_embedding
    LIMIT match_count;
  END IF;
END;
$function$;