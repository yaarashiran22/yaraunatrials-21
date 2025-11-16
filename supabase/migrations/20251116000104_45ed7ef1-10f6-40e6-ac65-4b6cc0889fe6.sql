-- Add url field to top_list_items to store links like Instagram URLs
ALTER TABLE public.top_list_items 
ADD COLUMN url text;