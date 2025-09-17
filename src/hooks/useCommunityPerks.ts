import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export interface CommunityPerk {
  id: string;
  community_id: string;
  business_name: string;
  title: string;
  description: string;
  discount_amount?: string;
  terms?: string;
  image_url?: string;
  valid_until?: string;
  is_active: boolean;
  created_at: string;
}

const fetchCommunityPerks = async (userInterests?: string[]) => {
  console.log('🏷️ Fetching community perks with interests:', userInterests);
  
  try {
    const { data, error } = await supabase
      .from('community_perks')
      .select(`
        *,
        communities(name, logo_url, member_count)
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    
    let filteredData = data || [];
    
    console.log('🏪 Total perks before prioritizing:', filteredData.length);
    
    // Prioritize by interests if provided (don't filter out, just reorder)
    if (userInterests && userInterests.length > 0) {
      console.log('🎯 Prioritizing perks by interests:', userInterests);
      
      const matchingPerks: any[] = [];
      const nonMatchingPerks: any[] = [];
      
      (data || []).forEach(perk => {
        const perkText = `${perk.title} ${perk.description} ${perk.business_name}`.toLowerCase();
        const matches = userInterests.some(interest => {
          // Extract keywords from interest (remove emoji and common words)
          const keywords = interest.toLowerCase()
            .replace(/[^\w\s]/g, '') // Remove emojis and special chars
            .split('&')[0] // Take first part if multiple interests
            .trim();
          
          const hasMatch = perkText.includes(keywords) || 
                 perkText.includes(keywords.split(' ')[0]); // Check first word too
                 
          if (hasMatch) {
            console.log(`✅ Perk match found: "${perk.title}" matches interest "${interest}"`);
          }
          
          return hasMatch;
        });
        
        if (matches) {
          matchingPerks.push(perk);
        } else {
          nonMatchingPerks.push(perk);
        }
      });
      
      // Put matching perks first, then non-matching perks
      filteredData = [...matchingPerks, ...nonMatchingPerks];
      console.log(`🏪 Perks prioritized: ${matchingPerks.length} matching interests first, ${nonMatchingPerks.length} others after`);
    }
    
    return filteredData;
  } catch (error) {
    console.error('Error fetching community perks:', error);
    toast({
      title: "Error",
      description: "Failed to load community coupons",
      variant: "destructive",
    });
    throw error;
  }
};

export const useCommunityPerks = () => {
  const { user } = useAuth();
  
  // Get user profile with interests
  const { data: userProfile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('interests')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['community-perks', userProfile?.interests],
    queryFn: () => fetchCommunityPerks(userProfile?.interests || []),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return {
    perks: data || [],
    loading: isLoading,
    error: error?.message || null,
    refetch
  };
};