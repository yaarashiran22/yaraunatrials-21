-- Drop and recreate match_documents with correct field names for n8n vector store
DROP FUNCTION IF EXISTS public.match_documents(vector(1536), integer, jsonb);

CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector(1536),
  match_count integer DEFAULT 10,
  filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  id uuid,
  content text,
  metadata jsonb,
  similarity double precision
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
      COALESCE(e.title, '') || ' ' || COALESCE(e.description, '') as content,
      jsonb_build_object(
        'title', e.title,
        'description', e.description,
        'date', e.date,
        'time', e.time,
        'location', e.location,
        'table_name', 'events'
      ) as metadata,
      1 - (e.embedding <=> query_embedding) as similarity
    FROM events e
    WHERE e.embedding IS NOT NULL
      AND 1 - (e.embedding <=> query_embedding) > 0.3
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count;
  ELSIF table_filter = 'user_coupons' THEN
    RETURN QUERY
    SELECT
      c.id,
      COALESCE(c.title, '') || ' ' || COALESCE(c.description, '') as content,
      jsonb_build_object(
        'title', c.title,
        'description', c.description,
        'business_name', c.business_name,
        'neighborhood', c.neighborhood,
        'table_name', 'user_coupons'
      ) as metadata,
      1 - (c.embedding <=> query_embedding) as similarity
    FROM user_coupons c
    WHERE c.embedding IS NOT NULL
      AND 1 - (c.embedding <=> query_embedding) > 0.3
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
  ELSIF table_filter = 'items' THEN
    RETURN QUERY
    SELECT
      i.id,
      COALESCE(i.title, '') || ' ' || COALESCE(i.description, '') as content,
      jsonb_build_object(
        'title', i.title,
        'description', i.description,
        'category', i.category,
        'location', i.location,
        'table_name', 'items'
      ) as metadata,
      1 - (i.embedding <=> query_embedding) as similarity
    FROM items i
    WHERE i.embedding IS NOT NULL
      AND 1 - (i.embedding <=> query_embedding) > 0.3
    ORDER BY i.embedding <=> query_embedding
    LIMIT match_count;
  ELSIF table_filter = 'top_list_items' THEN
    RETURN QUERY
    SELECT
      t.id,
      COALESCE(t.name, '') || ' ' || COALESCE(t.description, '') as content,
      jsonb_build_object(
        'name', t.name,
        'description', t.description,
        'location', t.location,
        'url', t.url,
        'table_name', 'top_list_items'
      ) as metadata,
      1 - (t.embedding <=> query_embedding) as similarity
    FROM top_list_items t
    WHERE t.embedding IS NOT NULL
      AND 1 - (t.embedding <=> query_embedding) > 0.3
    ORDER BY t.embedding <=> query_embedding
    LIMIT match_count;
  END IF;
END;
$function$;