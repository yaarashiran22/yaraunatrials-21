import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  location: string | null;
  profile_image_url: string | null;
  is_private: boolean | null;
  show_in_search: boolean | null;
  interests: string[] | null;
  specialty: string | null;
  created_at: string;
  updated_at: string | null;
}

export const useProfile = (profileId?: string) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchProfile = useCallback(async () => {
    const targetId = profileId || user?.id;
    
    if (!targetId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetId)
        .maybeSingle();

      if (fetchError) {
        setError(fetchError.message);
        setProfile(null);
      } else if (!data) {
        setError('Profile not found');
        setProfile(null);
      } else {
        setProfile(data);
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [profileId, user?.id]);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    const { data, error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    setProfile(data);
    return data;
  }, [user?.id]);

  const createSmallProfilePicture = useCallback(async (file: File, userId: string) => {
    try {
      // Create canvas and resize
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Create image element
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });

      // Calculate new dimensions (100px max)
      const maxSize = 100;
      const { width, height } = img;
      const aspectRatio = width / height;
      
      let newWidth = maxSize;
      let newHeight = maxSize;
      
      if (aspectRatio > 1) {
        newHeight = maxSize / aspectRatio;
      } else {
        newWidth = maxSize * aspectRatio;
      }

      // Set canvas size and draw resized image
      canvas.width = newWidth;
      canvas.height = newHeight;
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      // Convert to blob
      const resizedBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob!);
        }, 'image/jpeg', 0.8);
      });

      // Upload small image
      const smallFileName = `${userId}/small-profile.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(smallFileName, resizedBlob, {
          upsert: true
        });

      if (!uploadError) {
        // Get public URL for small image
        const { data: { publicUrl } } = supabase.storage
          .from('profile-images')
          .getPublicUrl(smallFileName);

        // Insert or update smallprofiles table
        await supabase
          .from('smallprofiles')
          .upsert({
            id: userId,
            photo: publicUrl
          });
      }

      // Clean up
      URL.revokeObjectURL(img.src);
    } catch (error) {
      console.error('Error creating small profile picture:', error);
    }
  }, []);

  const uploadProfileImage = useCallback(async (file: File) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/profile.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('profile-images')
      .upload(fileName, file, {
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('profile-images')
      .getPublicUrl(fileName);
    
    // Automatically create small version
    await createSmallProfilePicture(file, user.id);
    
    return publicUrl;
  }, [user?.id, createSmallProfilePicture]);

  useEffect(() => {
    fetchProfile();
  }, [profileId, user?.id]); // Direct dependencies instead of fetchProfile

  return {
    profile,
    loading,
    error,
    refetch: fetchProfile,
    updateProfile,
    uploadProfileImage,
    createSmallProfilePicture
  };
};