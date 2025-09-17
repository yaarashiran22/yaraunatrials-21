import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface FriendsPictureGallery {
  id: string;
  user_id: string;
  title?: string;
  image_url?: string;
  created_at: string;
  profiles?: {
    name: string;
    profile_image_url?: string;
  };
}

export const useFriendsPictureGalleries = () => {
  const [galleries, setGalleries] = useState<FriendsPictureGallery[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetchGalleries = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: galleriesData, error: galleriesError } = await supabase
        .from('friends_picture_galleries')
        .select('*')
        .order('created_at', { ascending: false });

      if (galleriesError) {
        console.error('Error fetching galleries:', galleriesError);
        throw galleriesError;
      }

      if (galleriesData && galleriesData.length > 0) {
        const userIds = galleriesData.map(gallery => gallery.user_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, profile_image_url')
          .in('id', userIds);

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
          throw profilesError;
        }

        const galleriesWithProfiles = galleriesData.map(gallery => ({
          ...gallery,
          profiles: profilesData?.find(profile => profile.id === gallery.user_id)
        }));

        setGalleries(galleriesWithProfiles);
      } else {
        setGalleries([]);
      }
    } catch (error) {
      console.error('Error fetching picture galleries:', error);
    } finally {
      setLoading(false);
    }
  };

  const createGallery = async (images: string[], title?: string) => {
    if (!user) return null;

    try {
      const { data: galleryData, error: galleryError } = await supabase
        .from('friends_picture_galleries')
        .insert({
          user_id: user.id,
          image_url: images[0] || '',
          title
        })
        .select('*')
        .single();

      if (galleryError) {
        console.error('Error creating gallery:', galleryError);
        throw galleryError;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, profile_image_url')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        throw profileError;
      }

      const newGallery = {
        ...galleryData,
        profiles: profileData
      };
      
      setGalleries(prev => [newGallery, ...prev]);
      return newGallery;
    } catch (error) {
      console.error('Error creating picture gallery:', error);
      return null;
    }
  };

  const deleteGallery = async (galleryId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('friends_picture_galleries')
        .delete()
        .eq('id', galleryId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      setGalleries(prev => prev.filter(gallery => gallery.id !== galleryId));
      return true;
    } catch (error) {
      console.error('Error deleting picture gallery:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchGalleries();
  }, [user]);

  return {
    galleries,
    loading,
    createGallery,
    deleteGallery,
    refreshGalleries: fetchGalleries
  };
};