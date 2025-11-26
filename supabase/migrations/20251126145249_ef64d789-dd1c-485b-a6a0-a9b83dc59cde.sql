-- Create views without embedding columns for n8n to query

-- Events view without embedding
CREATE OR REPLACE VIEW public.events_no_embedding AS
SELECT 
  id, user_id, created_at, updated_at, title, description, date, time, 
  location, price, image_url, video_url, external_link, event_type, 
  mood, market, target_audience, music_type, venue_size, price_range, 
  venue_name, address, ticket_link
FROM public.events;

-- User coupons view without embedding
CREATE OR REPLACE VIEW public.user_coupons_no_embedding AS
SELECT 
  id, user_id, created_at, updated_at, is_active, title, description, 
  business_name, discount_amount, valid_until, neighborhood, image_url, coupon_code
FROM public.user_coupons;

-- Items view without embedding
CREATE OR REPLACE VIEW public.items_no_embedding AS
SELECT 
  id, user_id, created_at, updated_at, title, description, category, 
  location, mobile_number, image_url, market, status, meetup_date, 
  meetup_time, price
FROM public.items;

-- Top list items view without embedding
CREATE OR REPLACE VIEW public.top_list_items_no_embedding AS
SELECT 
  id, list_id, created_at, display_order, name, description, 
  location, image_url, url
FROM public.top_list_items;

-- Grant access to authenticated and anon users
GRANT SELECT ON public.events_no_embedding TO authenticated, anon;
GRANT SELECT ON public.user_coupons_no_embedding TO authenticated, anon;
GRANT SELECT ON public.items_no_embedding TO authenticated, anon;
GRANT SELECT ON public.top_list_items_no_embedding TO authenticated, anon;