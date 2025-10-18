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
    const [eventsResult, recommendationsResult, profilesResult, businessProfilesResult, profilesCountResult] = await Promise.all([
      supabase
        .from('items')
        .select('id, title, image_url, location, user_id')
        .eq('status', 'active')
        .eq('category', 'event')
        .order('created_at', { ascending: false }),
      supabase
        .from('items')
        .select('id, title, image_url, location, user_id, created_at')
        .eq('status', 'active')
        .eq('category', 'מוזמנים להצטרף')
        .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, name, profile_image_url, interests')
          .not('name', 'is', null)
          .order('created_at', { ascending: false })
          .limit(6), // Reduced to 6 for faster loading
        supabase
          .from('profiles')
          .select('id, name, profile_image_url, interests, profile_type')
          .eq('profile_type', 'business')
          .not('name', 'is', null)
          .order('created_at', { ascending: false })
          .limit(20),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .not('name', 'is', null)
    ]);

    // Handle errors gracefully
    if (eventsResult.error) throw eventsResult.error;
    if (recommendationsResult.error) throw recommendationsResult.error;
    if (profilesResult.error) throw profilesResult.error;
    if (businessProfilesResult.error) throw businessProfilesResult.error;
    if (profilesCountResult.error) throw profilesCountResult.error;

    const rawEvents = eventsResult.data || [];
    const rawRecommendationItems = recommendationsResult.data || [];
    
    // Optimized uploader profile fetching for both events and recommendations
    let databaseEvents: OptimizedItem[] = rawEvents.map(event => ({
      ...event,
      uploader: {
        name: 'משתמש',
        image: profile1,
        small_photo: profile1,
        location: 'לא צוין'
      }
    }));

    let recommendationItems: OptimizedItem[] = rawRecommendationItems.map(item => ({
      ...item,
      uploader: {
        name: 'משתמש',
        image: profile1,
        small_photo: profile1,
        location: 'לא צוין'
      }
    }));
    
    // Fetch uploader profiles for both events and recommendations
    const allUserIds = [
      ...rawEvents.map(event => event.user_id),
      ...rawRecommendationItems.map(item => item.user_id)
    ].filter(Boolean);
    
    if (allUserIds.length > 0) {
      const [uploaderProfilesResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, profile_image_url, location')
          .in('id', allUserIds)
      ]);
      
      const uploaderProfiles = (uploaderProfilesResult.data || []).reduce((acc: any, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {});
      
      // Transform events data with uploader info
      databaseEvents = rawEvents.map(event => ({
        ...event,
        uploader: {
          name: uploaderProfiles[event.user_id]?.name || 'משתמש',
          image: uploaderProfiles[event.user_id]?.profile_image_url || profile1,
          small_photo: uploaderProfiles[event.user_id]?.profile_image_url || profile1,
          location: uploaderProfiles[event.user_id]?.location || 'לא צוין',
          user_id: event.user_id
        }
      }));

      // Transform recommendation items with uploader info
      recommendationItems = rawRecommendationItems.map(item => ({
        ...item,
        uploader: {
          name: uploaderProfiles[item.user_id]?.name || 'משתמש',
          image: uploaderProfiles[item.user_id]?.profile_image_url || profile1,
          small_photo: uploaderProfiles[item.user_id]?.profile_image_url || profile1,
          location: uploaderProfiles[item.user_id]?.location || 'לא צוין',
          user_id: item.user_id
        }
      }));
    }
    
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

    // Combine items for backward compatibility - removed marketplace items
    const items = [...databaseEvents, ...recommendationItems];

    return { 
      items, 
      databaseEvents, 
      recommendationItems, 
      artItems: [], // Empty for faster loading
      apartmentItems: [], // Empty for faster loading
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
      queryKey: ['homepage-data-v7'], // Updated to match main query
      queryFn: fetchHomepageData,
      staleTime: 1000 * 60 * 30, // Match main query stale time
    });
  };

  // Ultra-aggressive caching for instant loading
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['homepage-data-v7'], // Updated for faster loading optimizations
    queryFn: fetchHomepageData,
    staleTime: 1000 * 60 * 15, // 15 minutes - ultra aggressive
    gcTime: 1000 * 60 * 60, // 1 hour - keep data longer
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