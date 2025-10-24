import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Event {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  date?: string;
  time?: string;
  location?: string;
  venue_name?: string;
  price?: string;
  image_url?: string;
  video_url?: string;
  market: string;
  event_type: 'event' | 'meetup';
  created_at: string;
  updated_at: string;
  uploader?: {
    name: string;
    image: string;
    small_photo: string;
    location: string;
  };
}

const fetchEvents = async (eventType?: 'event' | 'meetup', filterType?: boolean, userId?: string, userInterests?: string[]): Promise<Event[]> => {
  console.log('🔍 Fetching events with interests:', userInterests);
  
  let query = supabase
    .from('events')
    .select(`
      id,
      user_id,
      title,
      description,
      date,
      time,
      location,
      venue_name,
      price,
      image_url,
      video_url,
      market,
      event_type,
      created_at,
      updated_at
    `)
    .eq('market', 'argentina')
    .order('created_at', { ascending: false });

  if (eventType) {
    query = query.eq('event_type', eventType);
  }

  if (filterType && userId) {
    if (eventType === 'meetup') {
      // For meetups, filter by friends
      const { data: friendsData, error: friendsError } = await supabase
        .from('user_friends')
        .select('friend_id')
        .eq('user_id', userId);

      if (friendsError) throw friendsError;

      const friendIds = friendsData?.map(f => f.friend_id) || [];
      
      if (friendIds.length > 0) {
        query = query.in('user_id', friendIds);
      } else {
        return [];
      }
    } else {
      // For events, filter by following
      const { data: followingData, error: followingError } = await supabase
        .from('user_following')
        .select('following_id')
        .eq('follower_id', userId);

      if (followingError) throw followingError;

      const followingIds = followingData?.map(f => f.following_id) || [];
      
      if (followingIds.length > 0) {
        query = query.in('user_id', followingIds);
      } else {
        return [];
      }
    }
  }

  const { data: events, error: eventsError } = await query;

  if (eventsError) throw eventsError;

  if (!events || events.length === 0) {
    console.log('❌ No events found');
    return [];
  }

  console.log('📅 Total events before filtering:', events.length);

  // Prioritize by interests if provided (don't filter out, just reorder)
  let prioritizedEvents: Event[] = [];
  if (userInterests && userInterests.length > 0) {
    console.log('🎯 Prioritizing by interests:', userInterests);
    
    const matchingEvents: Event[] = [];
    const nonMatchingEvents: Event[] = [];
    
    events.forEach(event => {
      const eventText = `${event.title} ${event.description || ''}`.toLowerCase();
      const matches = userInterests.some(interest => {
        // Extract keywords from interest (remove emoji and common words)
        const keywords = interest.toLowerCase()
          .replace(/[^\w\s]/g, '') // Remove emojis and special chars
          .split('&')[0] // Take first part if multiple interests
          .trim();
        
        const hasMatch = eventText.includes(keywords) || 
               eventText.includes(keywords.split(' ')[0]); // Check first word too
        
        if (hasMatch) {
          console.log(`✅ Match found: "${event.title}" matches interest "${interest}"`);
        }
        
        return hasMatch;
      });
      
      // Cast to Event type for proper typing
      const typedEvent = {
        ...event,
        event_type: event.event_type as 'event' | 'meetup'
      } as Event;
      
      if (matches) {
        matchingEvents.push(typedEvent);
      } else {
        nonMatchingEvents.push(typedEvent);
      }
    });
    
    // Put matching events first, then non-matching events
    prioritizedEvents = [...matchingEvents, ...nonMatchingEvents];
    console.log(`🎯 Events prioritized: ${matchingEvents.length} matching interests first, ${nonMatchingEvents.length} others after`);
  } else {
    // No interests provided, just convert to proper Event type
    prioritizedEvents = events.map(event => ({
      ...event,
      event_type: event.event_type as 'event' | 'meetup'
    }) as Event);
  }

  // Fetch uploader profiles
  const userIds = prioritizedEvents.map(event => event.user_id);
  
  if (userIds.length === 0) {
    console.log('❌ No events after prioritizing');
    return [];
  }
  
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, name, profile_image_url')
    .in('id', userIds);

  if (profilesError) throw profilesError;

  const profilesMap = (profiles || []).reduce((acc: any, profile) => {
    acc[profile.id] = profile;
    return acc;
  }, {});

  // Don't filter out past events - show all events

  return prioritizedEvents.map(event => ({
    ...event,
    uploader: {
      name: profilesMap[event.user_id]?.name || 'משתמש',
      image: profilesMap[event.user_id]?.profile_image_url || '/lovable-uploads/c7d65671-6211-412e-af1d-6e5cfdaa248e.png',
      small_photo: profilesMap[event.user_id]?.profile_image_url || '/lovable-uploads/c7d65671-6211-412e-af1d-6e5cfdaa248e.png',
      location: profilesMap[event.user_id]?.location || 'לא צוין'
    }
  }));
};

export const useEvents = (eventType?: 'event' | 'meetup', filterActive?: boolean) => {
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
  
  const queryResult = useQuery({
    queryKey: ['events', eventType, filterActive, user?.id, userProfile?.interests],
    queryFn: () => fetchEvents(eventType, filterActive, user?.id, userProfile?.interests || []),
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    enabled: !filterActive || !!user?.id, // Only fetch filtered events if user is logged in
  });

  return {
    events: queryResult.data || [],
    loading: queryResult.isLoading,
    refetch: queryResult.refetch,
  };
};