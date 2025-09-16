import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { handleAuthError } from '@/utils/authErrorHandler';

export interface UserMessage {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  updated_at: string;
}

export const useUserMessages = (userId?: string) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const targetUserId = userId || user?.id;

  const fetchMessages = async () => {
    if (!targetUserId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_messages')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        
        // Handle JWT expiration
        if (handleAuthError(error)) {
          return;
        }
        
        toast({
          title: "Error",
          description: "Unable to load messages",
          variant: "destructive",
        });
      } else {
        setMessages(data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const createMessage = async (messageText: string) => {
    if (!user || !messageText.trim()) {
      return false;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('user_messages')
        .insert({
          user_id: user.id,
          message: messageText.trim()
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating message:', error);
        toast({
          title: "Error",
          description: "Unable to save message",
          variant: "destructive",
        });
        return false;
      }

      setMessages(prev => [...prev, data]);
      toast({
        title: "Success",
        description: "Message saved successfully",
      });
      return true;
    } catch (err) {
      console.error('Unexpected error creating message:', err);
      return false;
    } finally {
      setCreating(false);
    }
  };

  const updateMessage = async (messageId: string, newText: string) => {
    if (!user || !newText.trim()) {
      return false;
    }

    setUpdating(messageId);
    try {
      const { data, error } = await supabase
        .from('user_messages')
        .update({ message: newText.trim() })
        .eq('id', messageId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating message:', error);
        toast({
          title: "Error",
          description: "Unable to update message",
          variant: "destructive",
        });
        return false;
      }

      setMessages(prev => 
        prev.map(msg => msg.id === messageId ? data : msg)
      );
      toast({
        title: "Success",
        description: "Message updated successfully",
      });
      return true;
    } catch (err) {
      console.error('Unexpected error updating message:', err);
      return false;
    } finally {
      setUpdating(null);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!user) {
      return false;
    }

    try {
      const { error } = await supabase
        .from('user_messages')
        .delete()
        .eq('id', messageId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting message:', error);
        toast({
          title: "Error",
          description: "Unable to delete message",
          variant: "destructive",
        });
        return false;
      }

      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      toast({
        title: "Success",
        description: "Message deleted successfully",
      });
      return true;
    } catch (err) {
      console.error('Unexpected error deleting message:', err);
      return false;
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [targetUserId]);

  return {
    messages,
    loading,
    creating,
    updating,
    createMessage,
    updateMessage,
    deleteMessage,
    refetch: fetchMessages
  };
};