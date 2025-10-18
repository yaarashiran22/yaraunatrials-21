import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface UserRSVPEvent {
  id: string;
  title: string;
  description?: string;
  date?: string;
  time?: string;
  location?: string;
  price?: string;
  image_url?: string;
  video_url?: string;
  event_type: 'event' | 'meetup';
  rsvp_status: string;
  rsvp_created_at: string;
}

const fetchUserRSVPs = async (userId: string): Promise<UserRSVPEvent[]> => {
  try {
    // Fetch RSVPs with event details
    const { data: rsvps, error } = await supabase
      .from('event_rsvps')
      .select(`
        id,
        status,
        created_at,
        event_id,
        events (
          id,
          title,
          description,
          date,
          time,
          location,
          price,
          image_url,
          video_url,
          event_type
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'going')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform data to include event details at top level
    const events = (rsvps || [])
      .filter(rsvp => rsvp.events) // Filter out any RSVPs without event data
      .map(rsvp => ({
        ...(rsvp.events as any),
        rsvp_status: rsvp.status,
        rsvp_created_at: rsvp.created_at,
      }));

    return events;
  } catch (error) {
    console.error('Error fetching user RSVPs:', error);
    toast({
      title: "Error",
      description: "Unable to load your RSVPs",
      variant: "destructive",
    });
    return [];
  }
};

export const useUserRSVPs = (userId?: string) => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['user-rsvps', userId],
    queryFn: () => fetchUserRSVPs(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });

  return {
    rsvps: data || [],
    loading: isLoading,
    error: error?.message || null,
    refetch,
  };
};
