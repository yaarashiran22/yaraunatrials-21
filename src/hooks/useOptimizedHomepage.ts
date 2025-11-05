import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import profile1 from "@/assets/profile-1.jpg";

export interface OptimizedItem {
  id: string;
  title: string;
  description?: string;
  price?: number;
  category?: string;
  image_url?: string;
  location?: string;
  user_id?: string;
  created_at?: string;
  date?: string;
  time?: string;
  uploader?: {
    name: string;
    image: string;
    small_photo: string;
    location: string;
    user_id?: string;
  };
}

export interface OptimizedProfile {
  id: string;
  name: string;
  image: string;
  interests?: string[];
}

// Ultra-optimized database queries with aggressive limits for instant mobile loading
const fetchHomepageData = async () => {
  try {
    // Batch all queries in a single Promise.all for maximum performance
    // Reduced data fetching for instant mobile loading
    const [profilesResult, businessProfilesResult, profilesCountResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, profile_image_url, interests')
          .not('name', 'is', null)
          .order('created_at', { ascending: false })
          .limit(4), // Reduced to 4 for instant loading
        supabase
          .from('profiles')
          .select('id, name, profile_image_url, interests, profile_type')
          .eq('profile_type', 'business')
          .not('name', 'is', null)
          .order('created_at', { ascending: false })
          .limit(10), // Reduced to 10 for faster loading
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .not('name', 'is', null)
    ]);

    // Handle errors gracefully
    if (profilesResult.error) throw profilesResult.error;
    if (businessProfilesResult.error) throw businessProfilesResult.error;
    if (profilesCountResult.error) throw profilesCountResult.error;
    
    const profiles = (profilesResult.data || []).map((profile) => ({
      id: profile.id,
      image: profile.profile_image_url || "/lovable-uploads/c7d65671-6211-412e-af1d-6e5cfdaa248e.png",
      name: profile.name || 'משתמש',
      interests: profile.interests || []
    }));

    const businessProfiles = (businessProfilesResult.data || []).map((profile) => ({
      id: profile.id,
      image: profile.profile_image_url || "/lovable-uploads/c7d65671-6211-412e-af1d-6e5cfdaa248e.png",
      name: profile.name || 'משתמש',
      interests: profile.interests || []
    }));

    const totalUsersCount = profilesCountResult.count || 0;

    return { 
      items: [],
      databaseEvents: [],
      recommendationItems: [],
      artItems: [],
      apartmentItems: [],
      businessItems: [], 
      profiles, 
      businessProfiles,
      totalUsersCount 
    };
  } catch (error) {
    console.error('Homepage data fetch error:', error);
    toast({
      title: "Error",
      description: "Unable to load data",
      variant: "destructive",
    });
    throw error;
  }
};

export const useOptimizedHomepage = () => {
  const queryClient = useQueryClient();

  // Ultra-aggressive preloading for instant loading
  const preloadData = () => {
    queryClient.prefetchQuery({
      queryKey: ['homepage-data-v9'], // Updated for minimal data loading
      queryFn: fetchHomepageData,
      staleTime: 1000 * 60 * 30, // Match main query stale time
    });
  };

  // Ultra-aggressive caching for instant loading
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['homepage-data-v9'], // Updated for minimal data loading
    queryFn: fetchHomepageData,
    staleTime: 1000 * 60 * 30, // 30 minutes - super aggressive
    gcTime: 1000 * 60 * 120, // 2 hours - keep data much longer
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 0, // No retries for instant loading
    enabled: true, // Always enabled for immediate data fetching
    placeholderData: (previousData) => previousData,
    refetchInterval: false, // Disable background refetching
  });

  // Extract pre-filtered data for instant mobile loading
  const items = data?.items || [];
  const profiles = data?.profiles || [];
  const businessProfiles = data?.businessProfiles || [];
  const totalUsersCount = data?.totalUsersCount || 0;
  const databaseEvents = data?.databaseEvents || [];
  const recommendationItems = data?.recommendationItems || [];
  const artItems = data?.artItems || [];
  const apartmentItems = data?.apartmentItems || [];
  const businessItems = data?.businessItems || [];

  return {
    items,
    profiles,
    businessProfiles,
    totalUsersCount,
    databaseEvents,
    recommendationItems,
    artItems,
    apartmentItems,
    businessItems,
    loading: isLoading,
    error: error?.message || null,
    refetch,
    preloadData
  };
};