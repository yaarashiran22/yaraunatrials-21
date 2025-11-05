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
    // Batch all queries - optimized with limits for mobile performance
    const [eventsResult, recommendationsResult, profilesResult, businessProfilesResult, profilesCountResult] = await Promise.all([
      supabase
        .from('items')
        .select('id, title, image_url, location, user_id')
        .eq('status', 'active')
        .eq('category', 'event')
        .order('created_at', { ascending: false })
        .limit(20), // Limit for faster loading
      supabase
        .from('items')
        .select('id, title, image_url, location, user_id, created_at')
        .eq('status', 'active')
        .eq('category', 'מוזמנים להצטרף')
        .order('created_at', { ascending: false })
        .limit(20), // Limit for faster loading
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
    if (eventsResult.error) throw eventsResult.error;
    if (recommendationsResult.error) throw recommendationsResult.error;
    if (profilesResult.error) throw profilesResult.error;
    if (businessProfilesResult.error) throw businessProfilesResult.error;
    if (profilesCountResult.error) throw profilesCountResult.error;

    const rawEvents = eventsResult.data || [];
    const rawRecommendationItems = recommendationsResult.data || [];
    
    // Initialize with default uploader info
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
    
    // Fetch uploader profiles in batch
    const allUserIds = [...new Set([
      ...rawEvents.map(event => event.user_id),
      ...rawRecommendationItems.map(item => item.user_id)
    ].filter(Boolean))];
    
    if (allUserIds.length > 0) {
      const { data: uploaderProfilesData } = await supabase
        .from('profiles')
        .select('id, name, profile_image_url, location')
        .in('id', allUserIds);
      
      const uploaderProfiles = (uploaderProfilesData || []).reduce((acc: any, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {});
      
      // Add uploader info to events
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

      // Add uploader info to recommendations
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

    // Combine items for backward compatibility
    const items = [...databaseEvents, ...recommendationItems];

    return { 
      items,
      databaseEvents,
      recommendationItems,
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

  // Preload data for faster initial render
  const preloadData = () => {
    queryClient.prefetchQuery({
      queryKey: ['homepage-data-v10'], // Updated to include restored queries
      queryFn: fetchHomepageData,
      staleTime: 1000 * 60 * 5,
    });
  };

  // Optimized caching for fast loading with data refresh
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['homepage-data-v10'], // Updated to include restored queries
    queryFn: fetchHomepageData,
    staleTime: 1000 * 60 * 5, // 5 minutes - balanced caching
    gcTime: 1000 * 60 * 30, // 30 minutes cache time
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 1, // One retry for reliability
    enabled: true,
    placeholderData: (previousData) => previousData,
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