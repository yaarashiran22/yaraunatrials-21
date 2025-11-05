import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { handleAuthError } from '@/utils/authErrorHandler';
import { Event } from './useEvents';

export const useUserEvents = (userId?: string) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const fetchUserEvents = async () => {
    const targetUserId = userId || user?.id;
    
    if (!targetUserId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Add timeout for mobile networks
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      const fetchPromise = supabase
        .from('events')
        .select(`
          id,
          user_id,
          title,
          description,
          date,
          time,
          location,
          price,
          image_url,
          video_url,
          market,
          event_type,
          created_at,
          updated_at
        `)
        .eq('user_id', targetUserId)
        .eq('market', 'argentina')
        .order('created_at', { ascending: false });

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (error) throw error;
      
      setEvents((data || []) as Event[]);
    } catch (error: any) {
      console.error('Error fetching user events:', error);
      
      // Handle JWT expiration
      if (handleAuthError(error)) {
        return;
      }
      
      // Don't show error toast for empty results or timeout on mobile
      if (error?.message !== 'Request timeout') {
        toast({
          title: "Error",
          description: "Failed to load events",
          variant: "destructive",
        });
      }
      
      // Set empty array on error to allow page to render
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteEvent = async (id: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Event Deleted",
        description: "Event has been deleted successfully",
      });

      // Remove event from local state
      setEvents(prevEvents => prevEvents.filter(event => event.id !== id));
      
      // Invalidate React Query cache to update home page and other components
      queryClient.invalidateQueries({ queryKey: ['events'] });
      
      return true;
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        title: "Error",
        description: "Failed to delete event",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchUserEvents();
  }, [userId, user?.id]);

  return {
    events,
    loading,
    deleteEvent,
    refetch: fetchUserEvents,
  };
};