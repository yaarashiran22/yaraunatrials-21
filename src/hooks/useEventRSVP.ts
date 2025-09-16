import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface EventRSVP {
  id: string;
  user_id: string;
  event_id: string;
  status: string;
  created_at: string;
}

// Combined fetch for better performance
const fetchEventRSVPData = async (eventId: string, userId: string | null): Promise<{
  userRSVP: EventRSVP | null;
  rsvpCount: number;
}> => {
  if (!eventId) return { userRSVP: null, rsvpCount: 0 };
  
  // Fetch count
  const countPromise = supabase
    .from('event_rsvps')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('status', 'going');

  // Fetch user RSVP if user is logged in
  const userRSVPPromise = userId ? supabase
    .from('event_rsvps')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle() : Promise.resolve({ data: null, error: null });

  // Execute both queries in parallel
  const [countResult, userRSVPResult] = await Promise.all([countPromise, userRSVPPromise]);

  if (countResult.error) {
    console.error('Error fetching RSVP count:', countResult.error);
  }

  if (userRSVPResult.error && userRSVPResult.error.code !== 'PGRST116') {
    console.error('Error fetching user RSVP:', userRSVPResult.error);
  }

  return {
    userRSVP: userRSVPResult.data,
    rsvpCount: countResult.count || 0
  };
};

const upsertRSVP = async (eventId: string, userId: string, status: string) => {
  const { data, error } = await supabase
    .from('event_rsvps')
    .upsert({
      event_id: eventId,
      user_id: userId,
      status: status
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

const deleteRSVP = async (eventId: string, userId: string) => {
  const { error } = await supabase
    .from('event_rsvps')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);

  if (error) throw error;
};

export const useEventRSVP = (eventId: string) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  // Only enable query if we have a valid UUID format event ID
  const isValidEventId = Boolean(eventId && eventId.length > 10 && eventId !== "1");

  // Combined query for better performance
  const { data, isLoading } = useQuery({
    queryKey: ['event-rsvp-data', eventId, user?.id],
    queryFn: () => fetchEventRSVPData(eventId, user?.id),
    enabled: isValidEventId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  const userRSVP = data?.userRSVP;
  const rsvpCount = data?.rsvpCount || 0;

  // RSVP mutation with optimistic updates
  const rsvpMutation = useMutation({
    mutationFn: ({ status }: { status: string }) => 
      upsertRSVP(eventId, user?.id!, status),
    onMutate: async ({ status }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['event-rsvp-data', eventId, user?.id] });
      
      // Snapshot previous value
      const previousData = queryClient.getQueryData(['event-rsvp-data', eventId, user?.id]);
      
      // Optimistically update
      queryClient.setQueryData(['event-rsvp-data', eventId, user?.id], (old: any) => {
        if (!old) return old;
        const wasGoing = old.userRSVP?.status === 'going';
        const isGoing = status === 'going';
        
        return {
          ...old,
          userRSVP: { ...old.userRSVP, status },
          rsvpCount: old.rsvpCount + (isGoing ? 1 : 0) - (wasGoing ? 1 : 0)
        };
      });
      
      return { previousData };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['event-rsvp-data', eventId, user?.id], context.previousData);
      }
      console.error('RSVP error:', error);
      toast({
        title: "Error",
        description: "Unable to update RSVP",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "RSVP מעודכן!",
        description: "התגובה שלך לאירוע נשמרה",
      });
    },
    onSettled: () => {
      // Always refetch after success or error
      queryClient.invalidateQueries({ queryKey: ['event-rsvp-data', eventId, user?.id] });
    },
  });

  // Remove RSVP mutation with optimistic updates
  const removeRSVPMutation = useMutation({
    mutationFn: () => deleteRSVP(eventId, user?.id!),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['event-rsvp-data', eventId, user?.id] });
      const previousData = queryClient.getQueryData(['event-rsvp-data', eventId, user?.id]);
      
      queryClient.setQueryData(['event-rsvp-data', eventId, user?.id], (old: any) => {
        if (!old) return old;
        const wasGoing = old.userRSVP?.status === 'going';
        
        return {
          ...old,
          userRSVP: null,
          rsvpCount: Math.max(0, old.rsvpCount - (wasGoing ? 1 : 0))
        };
      });
      
      return { previousData };
    },
    onError: (error, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['event-rsvp-data', eventId, user?.id], context.previousData);
      }
      console.error('Remove RSVP error:', error);
      toast({
        title: "Error",
        description: "Unable to remove RSVP",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "RSVP הוסר",
        description: "התגובה שלך לאירוע הוסרה",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['event-rsvp-data', eventId, user?.id] });
    },
  });

  const handleRSVP = useCallback((status: string) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "You need to log in to respond to events",
        variant: "destructive",
      });
      return;
    }

    if (userRSVP?.status === status) {
      // If clicking the same status, remove RSVP
      removeRSVPMutation.mutate();
    } else {
      // Otherwise update RSVP
      rsvpMutation.mutate({ status });
    }
  }, [user, userRSVP?.status, removeRSVPMutation, rsvpMutation]);

  const memoizedReturn = useMemo(() => ({
    userRSVP,
    rsvpCount,
    isLoading,
    handleRSVP,
    isUpdating: rsvpMutation.isPending || removeRSVPMutation.isPending,
  }), [userRSVP, rsvpCount, isLoading, handleRSVP, rsvpMutation.isPending, removeRSVPMutation.isPending]);

  return memoizedReturn;
};
