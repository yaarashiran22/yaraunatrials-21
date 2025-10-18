-- Drop unused tables that are not referenced in the front-end

-- Drop smallprofiles table - not used anywhere in the frontend
DROP TABLE IF EXISTS public.smallprofiles CASCADE;

-- Drop user_messages table - replaced by direct_messages
DROP TABLE IF EXISTS public.user_messages CASCADE;

-- Drop user_picture_galleries table - not actively used in current UI
DROP TABLE IF EXISTS public.user_picture_galleries CASCADE;

-- Drop idea_votes table - neighborhood ideas voting not implemented in UI
DROP TABLE IF EXISTS public.idea_votes CASCADE;

-- Drop friends_feed_posts table - not used in current feed implementation
DROP TABLE IF EXISTS public.friends_feed_posts CASCADE;

-- Drop coupon_claims table - replaced by user_coupon_claims
DROP TABLE IF EXISTS public.coupon_claims CASCADE;