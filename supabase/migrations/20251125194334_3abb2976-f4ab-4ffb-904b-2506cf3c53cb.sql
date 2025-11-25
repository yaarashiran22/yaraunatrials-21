-- Add embedding columns to user_coupons, items, and top_list_items tables

-- Add embedding to user_coupons
ALTER TABLE public.user_coupons 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add embedding to items
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add embedding to top_list_items
ALTER TABLE public.top_list_items 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create indexes for faster similarity search
CREATE INDEX IF NOT EXISTS idx_user_coupons_embedding ON public.user_coupons USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_items_embedding ON public.items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_top_list_items_embedding ON public.top_list_items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);