import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_read: boolean;
}

export interface Profile {
  id: string;
  name: string;
  profile_image_url?: string;
  email: string;
}

export interface Conversation {
  user: Profile;
  lastMessage?: DirectMessage;
  unreadCount: number;
}

export const useDirectMessages = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentMessages, setCurrentMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Fetch all users (profiles) for user selection
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    if (user) {
      console.log('Current user:', { id: user.id, email: user.email });
      fetchAllUsers();
      fetchConversations();
    } else {
      console.log('No user authenticated');
    }
  }, [user]);

  const fetchAllUsers = async () => {
    if (!user) return;
    
    setUsersLoading(true);
    try {
      console.log('Fetching all users...');
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, profile_image_url')
        .neq('id', user.id) // Exclude current user
        .order('name');

      if (error) {
        console.error('Error fetching users:', error);
        // Log more detailed error information
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        toast({
          title: "Error",
          description: `Failed to load users: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      console.log('Fetched users successfully:', data?.length, 'users found');
      console.log('Sample users:', data?.slice(0, 3));
      setAllUsers(data || []);
    } catch (err) {
      console.error('Unexpected error fetching users:', err);
      toast({
        title: "Error",
        description: "Unexpected error occurred while loading users",
        variant: "destructive",
      });
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchConversations = async () => {
    if (!user) return;

    try {
      // First get all messages involving the current user
      const { data: messages, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching conversations:', error);
        return;
      }

      if (!messages || messages.length === 0) {
        setConversations([]);
        return;
      }

      // Get unique user IDs that the current user has conversations with
      const conversationUserIds = new Set<string>();
      messages.forEach(message => {
        if (message.sender_id === user.id) {
          conversationUserIds.add(message.recipient_id);
        } else {
          conversationUserIds.add(message.sender_id);
        }
      });

      // Fetch profile data for all conversation partners
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email, profile_image_url')
        .in('id', Array.from(conversationUserIds));

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return;
      }

      // Create a map of profiles for quick lookup
      const profileMap = new Map<string, Profile>();
      profiles?.forEach(profile => {
        profileMap.set(profile.id, profile);
      });

      // Group messages by conversation partner
      const conversationMap = new Map<string, Conversation>();

      messages.forEach((message: any) => {
        const isFromCurrentUser = message.sender_id === user.id;
        const partnerId = isFromCurrentUser ? message.recipient_id : message.sender_id;
        const conversationPartner = profileMap.get(partnerId);

        if (!conversationPartner) return;

        if (!conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, {
            user: conversationPartner,
            lastMessage: message,
            unreadCount: 0
          });
        }

        // Count unread messages (messages sent to current user that are unread)
        if (!isFromCurrentUser && !message.is_read) {
          const conversation = conversationMap.get(partnerId)!;
          conversation.unreadCount++;
        }
      });

      setConversations(Array.from(conversationMap.values()));
    } catch (err) {
      console.error('Unexpected error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessagesWithUser = async (userId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      setCurrentMessages(data || []);
      setSelectedUserId(userId);

      // Mark messages as read
      await markMessagesAsRead(userId);
    } catch (err) {
      console.error('Unexpected error fetching messages:', err);
    }
  };

  const markMessagesAsRead = async (senderId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('direct_messages')
        .update({ is_read: true })
        .eq('sender_id', senderId)
        .eq('recipient_id', user.id)
        .eq('is_read', false);
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  const sendMessage = async (recipientId: string, messageText: string) => {
    if (!user || !messageText.trim()) {
      return false;
    }

    setSending(true);
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .insert({
          sender_id: user.id,
          recipient_id: recipientId,
          content: messageText.trim()
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        toast({
          title: "Error",
          description: "Failed to send message",
          variant: "destructive",
        });
        return false;
      }

      // Add to current messages if viewing this conversation
      if (selectedUserId === recipientId) {
        setCurrentMessages(prev => [...prev, data]);
      }

      // Refresh conversations
      fetchConversations();

      return true;
    } catch (err) {
      console.error('Unexpected error sending message:', err);
      return false;
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('direct_messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', user.id);

      if (error) {
        console.error('Error deleting message:', error);
        toast({
          title: "Error",
          description: "Failed to delete message",
          variant: "destructive",
        });
        return false;
      }

      // Remove from current messages
      setCurrentMessages(prev => prev.filter(msg => msg.id !== messageId));
      
      // Refresh conversations
      fetchConversations();

      return true;
    } catch (err) {
      console.error('Unexpected error deleting message:', err);
      return false;
    }
  };

  return {
    conversations,
    currentMessages,
    allUsers,
    loading,
    sending,
    usersLoading,
    selectedUserId,
    fetchMessagesWithUser,
    sendMessage,
    deleteMessage,
    clearSelectedUser: () => setSelectedUserId(null),
    refetch: fetchConversations
  };
};