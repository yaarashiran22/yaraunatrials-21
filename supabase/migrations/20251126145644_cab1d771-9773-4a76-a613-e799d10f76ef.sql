-- Fix security by setting views to SECURITY INVOKER
ALTER VIEW public.events_no_embedding SET (security_invoker = on);
ALTER VIEW public.user_coupons_no_embedding SET (security_invoker = on);
ALTER VIEW public.items_no_embedding SET (security_invoker = on);
ALTER VIEW public.top_list_items_no_embedding SET (security_invoker = on);