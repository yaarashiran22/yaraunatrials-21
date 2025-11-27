CREATE OR REPLACE FUNCTION public.match_documents(query_embedding extensions.vector, match_count integer DEFAULT 10, filter jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(id uuid, content text, metadata jsonb, similarity double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  table_filter text;
  location_filter text;
  mood_filter text;
  event_type_filter text;
  date_filter text;
  neighborhood_filter text;
  category_filter text;
BEGIN
  table_filter := filter->>'table';
  location_filter := filter->>'location';
  mood_filter := filter->>'mood';
  event_type_filter := filter->>'event_type';
  date_filter := filter->>'date';
  neighborhood_filter := filter->>'neighborhood';
  category_filter := filter->>'category';
  
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
        'address', e.address,
        'image_url', e.image_url,
        'video_url', e.video_url,
        'external_link', e.external_link,
        'ticket_link', e.ticket_link,
        'price', e.price,
        'price_range', e.price_range,
        'event_type', e.event_type,
        'mood', e.mood,
        'music_type', e.music_type,
        'venue_name', e.venue_name,
        'venue_size', e.venue_size,
        'target_audience', e.target_audience,
        'market', e.market,
        'table_name', 'events'
      ) as metadata,
      1 - (e.embedding <=> query_embedding) as similarity
    FROM events e
    WHERE e.embedding IS NOT NULL
      AND 1 - (e.embedding <=> query_embedding) > 0.3
      AND (location_filter IS NULL OR e.location ILIKE '%' || location_filter || '%' OR e.address ILIKE '%' || location_filter || '%')
      AND (mood_filter IS NULL OR e.mood ILIKE '%' || mood_filter || '%')
      AND (event_type_filter IS NULL OR e.event_type ILIKE '%' || event_type_filter || '%')
      AND (date_filter IS NULL OR e.date = date_filter)
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
        'image_url', c.image_url,
        'discount_amount', c.discount_amount,
        'valid_until', c.valid_until,
        'coupon_code', c.coupon_code,
        'is_active', c.is_active,
        'table_name', 'user_coupons'
      ) as metadata,
      1 - (c.embedding <=> query_embedding) as similarity
    FROM user_coupons c
    WHERE c.embedding IS NOT NULL
      AND 1 - (c.embedding <=> query_embedding) > 0.3
      AND (neighborhood_filter IS NULL OR c.neighborhood ILIKE '%' || neighborhood_filter || '%')
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
        'image_url', i.image_url,
        'price', i.price,
        'mobile_number', i.mobile_number,
        'market', i.market,
        'status', i.status,
        'meetup_date', i.meetup_date,
        'meetup_time', i.meetup_time,
        'table_name', 'items'
      ) as metadata,
      1 - (i.embedding <=> query_embedding) as similarity
    FROM items i
    WHERE i.embedding IS NOT NULL
      AND 1 - (i.embedding <=> query_embedding) > 0.3
      AND (location_filter IS NULL OR i.location ILIKE '%' || location_filter || '%')
      AND (category_filter IS NULL OR i.category ILIKE '%' || category_filter || '%')
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
        'image_url', t.image_url,
        'url', t.url,
        'display_order', t.display_order,
        'list_id', t.list_id,
        'table_name', 'top_list_items'
      ) as metadata,
      1 - (t.embedding <=> query_embedding) as similarity
    FROM top_list_items t
    WHERE t.embedding IS NOT NULL
      AND 1 - (t.embedding <=> query_embedding) > 0.3
      AND (location_filter IS NULL OR t.location ILIKE '%' || location_filter || '%')
    ORDER BY t.embedding <=> query_embedding
    LIMIT match_count;
  END IF;
END;
$function$;