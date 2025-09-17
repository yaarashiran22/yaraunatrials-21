import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useFriends = () => {
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const lastFetchRef = useRef<number>(0);
  const CACHE_DURATION = 60000; // 1 minute cache

  const fetchFriends = async (forceRefresh = false) => {
    const now = Date.now();
    
    // Use cache unless forced refresh or cache expired
    if (!forceRefresh && now - lastFetchRef.current < CACHE_DURATION && friends.length > 0) {
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data, error } = await supabase
        .from('user_friends')
        .select(`
          friend_id,
          status
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching friends:', error);
        return;
      }

      // If we have friends, fetch their profiles separately
      if (data && data.length > 0) {
        const friendIds = data.map(friend => friend.friend_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, username, profile_image_url, bio')
          .in('id', friendIds);

        if (!profilesError && profilesData) {
          // Combine the friend data with profile data
          const friendsWithProfiles = data.map(friend => ({
            ...friend,
            profiles: profilesData.find(profile => profile.id === friend.friend_id)
          }));
          setFriends(friendsWithProfiles || []);
        } else {
          setFriends(data || []);
        }
      } else {
        setFriends(data || []);
      }

      lastFetchRef.current = now;
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const addFriend = async (friendId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Error",
          description: "You need to log in to add friends",
          variant: "destructive",
        });
        return false;
      }

      const { error } = await supabase
        .from('user_friends')
        .insert({
          user_id: user.id,
          friend_id: friendId,
          status: 'accepted'
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "המשתמש כבר ברשימת החברים",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error adding friend",
            description: "Please try again",
            variant: "destructive",
          });
        }
        return false;
      }

      toast({
        title: "Friend added successfully!",
      });

      fetchFriends(); // Refresh the friends list
      return true;
    } catch (error) {
      console.error('Error adding friend:', error);
      toast({
        title: "Error adding friend",
        description: "Please try again",
        variant: "destructive",
      });
      return false;
    }
  };

  const removeFriend = async (friendId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return false;

      const { error } = await supabase
        .from('user_friends')
        .delete()
        .eq('user_id', user.id)
        .eq('friend_id', friendId);

      if (error) {
        toast({
          title: "Error removing friend",
          description: "Please try again",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Friend removed successfully",
      });

      fetchFriends(); // Refresh the friends list
      return true;
    } catch (error) {
      console.error('Error removing friend:', error);
      return false;
    }
  };

  const isFriend = (friendId: string) => {
    return friends.some(friend => friend.friend_id === friendId);
  };

  const getFriendItems = async (friendId: string) => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', friendId)
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching friend items:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error:', error);
      return [];
    }
  };

  /**
   * Get all friends' items organized by category (optimized with parallel requests and caching)
   */
  const getAllFriendsItemsByCategory = async () => {
    const categories: { [category: string]: any[] } = {};
    
    if (friends.length === 0) return categories;
    
    try {
      // Make all API calls in parallel instead of sequential
      const friendItemPromises = friends.map(friend => 
        getFriendItems(friend.friend_id).then(items => ({
          friend,
          items
        }))
      );
      
      // Wait for all requests to complete
      const friendsWithItems = await Promise.all(friendItemPromises);
      
      // Process the results
      friendsWithItems.forEach(({ friend, items }) => {
        items.forEach(item => {
          const category = item.category || 'other';
          if (!categories[category]) {
            categories[category] = [];
          }
          categories[category].push({
            ...item,
            uploader: friend.profiles
          });
        });
      });
    } catch (error) {
      console.error('Error fetching friends items:', error);
    }
    
    return categories;
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  return {
    friends,
    loading,
    addFriend,
    removeFriend,
    isFriend,
    getFriendItems,
    getAllFriendsItemsByCategory,
    refreshFriends: () => fetchFriends(true)
  };
};