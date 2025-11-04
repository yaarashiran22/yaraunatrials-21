-- Create top_lists table
CREATE TABLE public.top_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create top_list_items table
CREATE TABLE public.top_list_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.top_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  image_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.top_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.top_list_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for top_lists
CREATE POLICY "Top lists are viewable by everyone"
  ON public.top_lists FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own top lists"
  ON public.top_lists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own top lists"
  ON public.top_lists FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own top lists"
  ON public.top_lists FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for top_list_items
CREATE POLICY "Top list items are viewable by everyone"
  ON public.top_list_items FOR SELECT
  USING (true);

CREATE POLICY "Users can create items for their own lists"
  ON public.top_list_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.top_lists
      WHERE id = list_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update items in their own lists"
  ON public.top_list_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.top_lists
      WHERE id = list_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete items from their own lists"
  ON public.top_list_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.top_lists
      WHERE id = list_id AND user_id = auth.uid()
    )
  );

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_top_lists_updated_at
  BEFORE UPDATE ON public.top_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();