import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface RecommendationItem {
  id: string;
  title: string;
  description?: string;
  price?: number;
  image_url?: string;
  location?: string;
  user_id?: string;
  created_at?: string;
}

// Optimized query specifically for recommendations page
const fetchRecommendationItems = async () => {
  try {
    const { data, error } = await supabase
      .from('items')
      .select('id, title, description, price, image_url, location, user_id, created_at')
      .eq('status', 'active')
      .in('category', ['מוזמנים להצטרף', 'business', 'recommendation'])
      .order('created_at', { ascending: false })
      .limit(100); // Reasonable limit for recommendations page

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching recommendation items:', error);
    toast({
      title: "Error",
      description: "Unable to load recommendations",
      variant: "destructive",
    });
    throw error;
  }
};

export const useRecommendations = () => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['recommendation-items'],
    queryFn: fetchRecommendationItems,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return {
    recommendations: data || [],
    loading: isLoading,
    error: error?.message || null,
    refetch
  };
};