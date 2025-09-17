import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface ItemWithUploader {
  id: string;
  title: string;
  description?: string;
  price?: number;
  category?: string;
  image_url?: string;
  location?: string;
  mobile_number?: string;
  status: string;
  created_at: string;
  uploader: {
    id: string;
    name: string;
    profile_image_url?: string;
    location?: string;
    small_profile_photo?: string;
  };
}

const fetchItemDetails = async (itemId: string): Promise<ItemWithUploader | null> => {
  if (!itemId || itemId.trim() === '') {
    return null;
  }

  // First fetch the item
  const { data: itemData, error: itemError } = await supabase
    .from('items')
    .select('*')
    .eq('id', itemId)
    .eq('status', 'active')
    .single();

  if (itemError) throw itemError;
  
  if (!itemData) {
    throw new Error('פריט לא נמצא');
  }

  // Then fetch the uploader profile and small profile in parallel
  const [uploaderResult, smallProfileResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, profile_image_url, location')
      .eq('id', itemData.user_id)
      .single(),
    Promise.resolve({ data: null, error: null })
  ]);

  const { data: uploaderData, error: uploaderError } = uploaderResult;
  const { data: smallProfileData } = smallProfileResult;

  if (uploaderError) {
    console.error('Error fetching uploader profile:', uploaderError);
  }

  const itemWithUploader: ItemWithUploader = {
    id: itemData.id,
    title: itemData.title,
    description: itemData.description,
    price: itemData.price,
    category: itemData.category,
    image_url: itemData.image_url,
    location: itemData.location,
    mobile_number: itemData.mobile_number,
    status: itemData.status,
    created_at: itemData.created_at,
    uploader: {
      id: uploaderData?.id || itemData.user_id,
      name: uploaderData?.name || 'משתמש',
      profile_image_url: uploaderData?.profile_image_url,
      location: uploaderData?.location,
      small_profile_photo: undefined
    }
  };

  return itemWithUploader;
};

export const useItemDetails = (itemId: string) => {
  const { data: item, isLoading: loading, error, refetch } = useQuery({
    queryKey: ['item-details', itemId],
    queryFn: () => fetchItemDetails(itemId),
    enabled: !!itemId && itemId.trim() !== '',
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });

  return {
    item: item || null,
    loading,
    error: error?.message || null,
    refetch,
  };
};