import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { handleAuthError } from '@/utils/authErrorHandler';

interface UserPost {
  id: string;
  content: string;
  image_url?: string;
  video_url?: string;
  created_at: string;
  updated_at: string;
}

export const useUserPosts = (userId?: string) => {
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUserPosts = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select('id, content, image_url, video_url, created_at, updated_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user posts:', error);
        
        // Handle JWT expiration
        if (handleAuthError(error)) {
          return;
        }
        
        toast({
          title: "Error",
          description: "Failed to load posts",
          variant: "destructive",
        });
      } else {
        setPosts(data || []);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({
        title: "Error",
        description: "Failed to load posts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserPosts();
  }, [userId]);

  // Filter posts with images only
  const imagePosts = posts.filter(post => post.image_url);
  
  // Filter posts with videos only
  const videoPosts = posts.filter(post => post.video_url);

  return {
    posts,
    imagePosts,
    videoPosts,
    loading,
    refetch: fetchUserPosts,
  };
};