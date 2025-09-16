import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const usePostLikes = (postId: string) => {
  const { user } = useAuth();
  const [likes, setLikes] = useState<any[]>([]);
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch likes for the post
  const fetchLikes = async () => {
    try {
      const { data, error } = await supabase
        .from('post_likes')
        .select('*')
        .eq('post_id', postId);

      if (error) {
        console.error('Error fetching likes:', error);
        return;
      }

      setLikes(data || []);
      
      // Check if current user has liked this post
      if (user) {
        const userLike = data?.find(like => like.user_id === user.id);
        setIsLiked(!!userLike);
      }
    } catch (error) {
      console.error('Error fetching likes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle like
  const toggleLike = async () => {
    if (!user) {
      toast.error('יש להתחבר כדי לעשות לייק');
      return;
    }

    try {
      if (isLiked) {
        // Remove like
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error removing like:', error);
          toast.error('Error removing like');
          return;
        }

        setIsLiked(false);
        setLikes(prev => prev.filter(like => like.user_id !== user.id));
      } else {
        // Add like
        const { error } = await supabase
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: user.id
          });

        if (error) {
          console.error('Error adding like:', error);
          toast.error('Error adding like');
          return;
        }

        setIsLiked(true);
        setLikes(prev => [...prev, { post_id: postId, user_id: user.id }]);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Error updating like');
    }
  };

  useEffect(() => {
    if (postId) {
      fetchLikes();
    }
  }, [postId, user]);

  return {
    likes,
    likesCount: likes.length,
    isLiked,
    loading,
    toggleLike
  };
};