import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface UserCoupon {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  image_url?: string;
  valid_until?: string;
  neighborhood?: string;
  business_name?: string;
  discount_amount?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const fetchUserCoupons = async () => {
  try {
    const { data, error } = await supabase
      .from('user_coupons')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching user coupons:', error);
    return [];
  }
};

interface CreateCouponData {
  title: string;
  description?: string;
  business_name?: string;
  discount_amount?: string;
  valid_until?: string;
  neighborhood?: string;
  image_url?: string;
}

const createUserCoupon = async (couponData: CreateCouponData & { user_id: string }) => {
  try {
    const { data, error } = await supabase
      .from('user_coupons')
      .insert(couponData)
      .select()
      .single();

    if (error) throw error;
    
    toast({
      title: "Coupon Created!",
      description: "Your coupon has been shared with the community.",
    });

    return data;
  } catch (error) {
    console.error('Error creating user coupon:', error);
    toast({
      title: "Error",
      description: "Failed to create coupon. Please try again.",
      variant: "destructive",
    });
    throw error;
  }
};

const fetchMyCoupons = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('user_coupons')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching my coupons:', error);
    return [];
  }
};

const deleteCoupon = async (couponId: string) => {
  try {
    const { error } = await supabase
      .from('user_coupons')
      .delete()
      .eq('id', couponId);

    if (error) throw error;
    
    toast({
      title: "Coupon Deleted!",
      description: "Your coupon has been removed.",
    });

    return true;
  } catch (error) {
    console.error('Error deleting coupon:', error);
    toast({
      title: "Error",
      description: "Failed to delete coupon. Please try again.",
      variant: "destructive",
    });
    throw error;
  }
};

export const useUserCoupons = () => {
  const queryClient = useQueryClient();

  const { data: coupons, isLoading, error } = useQuery({
    queryKey: ['user-coupons'],
    queryFn: fetchUserCoupons,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: createUserCoupon,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-coupons'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCoupon,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-coupons'] });
      queryClient.invalidateQueries({ queryKey: ['my-coupons'] });
    },
  });

  return {
    coupons: coupons || [],
    loading: isLoading,
    error: error?.message || null,
    createCoupon: createMutation.mutate,
    creating: createMutation.isPending,
    deleteCoupon: deleteMutation.mutate,
    deleting: deleteMutation.isPending,
  };
};

export const useMyCoupons = (userId?: string) => {
  const queryClient = useQueryClient();

  const { data: myCoupons, isLoading, error } = useQuery({
    queryKey: ['my-coupons', userId],
    queryFn: () => fetchMyCoupons(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCoupon,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-coupons'] });
      queryClient.invalidateQueries({ queryKey: ['my-coupons'] });
    },
  });

  const refreshCoupons = () => {
    queryClient.invalidateQueries({ queryKey: ['my-coupons', userId] });
    queryClient.invalidateQueries({ queryKey: ['user-coupons'] });
  };

  return {
    myCoupons: myCoupons || [],
    loading: isLoading,
    error: error?.message || null,
    deleteCoupon: deleteMutation.mutate,
    deleting: deleteMutation.isPending,
    refreshCoupons,
  };
};