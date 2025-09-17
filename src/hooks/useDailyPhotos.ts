import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DailyPhotoSubmission {
  id: string;
  user_id: string;
  images: string[];
  title?: string;
  caption?: string;
  created_at: string;
  profiles?: {
    name: string;
    profile_image_url?: string;
  };
}

export const useDailyPhotos = () => {
  const queryClient = useQueryClient();

  const { data: dailyPhotos, isLoading } = useQuery({
    queryKey: ['daily-photos'],
    queryFn: async () => {
      console.log('Fetching daily photos...');
      const { data, error } = await supabase
        .from('daily_photo_submissions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching daily photos:', error);
        throw error;
      }

      console.log('Daily photos data:', data);

      // Fetch profile data separately for each user_id
      const userIds = [...new Set(data.map(item => item.user_id))];
      console.log('User IDs to fetch profiles for:', userIds);
      
      if (userIds.length === 0) {
        return [];
      }

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, profile_image_url')
        .in('id', userIds);

      console.log('Profiles data:', profilesData);

      // Combine data with profiles
      const photosWithProfiles = data.map(photo => ({
        ...photo,
        profiles: profilesData?.find(profile => profile.id === photo.user_id)
      }));

      console.log('Photos with profiles:', photosWithProfiles);
      return photosWithProfiles as DailyPhotoSubmission[];
    },
  });

  const refetchDailyPhotos = () => {
    console.log('Refetching daily photos...');
    queryClient.invalidateQueries({ queryKey: ['daily-photos'] });
  };

  const deleteDailyPhoto = async (photoId: string, imageUrl: string) => {
    try {
      console.log('Deleting photo:', photoId, imageUrl);
      
      // Extract file path from URL for storage deletion
      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const userFolder = urlParts[urlParts.length - 2];
      const filePath = `${userFolder}/${fileName}`;
      
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('daily-photos')
        .remove([filePath]);
      
      if (storageError) {
        console.error('Storage deletion error:', storageError);
        throw storageError;
      }
      
      // Delete from database
      const { error: dbError } = await supabase
        .from('daily_photo_submissions')
        .delete()
        .eq('id', photoId);
      
      if (dbError) {
        console.error('Database deletion error:', dbError);
        throw dbError;
      }
      
      console.log('Photo deleted successfully');
      // Refresh the data
      refetchDailyPhotos();
    } catch (error) {
      console.error('Delete photo error:', error);
      throw error;
    }
  };

  return {
    dailyPhotos: dailyPhotos || [],
    isLoading,
    refetchDailyPhotos,
    deleteDailyPhoto,
  };
};