import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Item } from './useItems';

export const useUserItems = (userId?: string) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchUserItems = async () => {
    const targetUserId = userId || user?.id;
    
    if (!targetUserId) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems((data || []) as Item[]);
    } catch (error) {
      console.error('Error fetching user items:', error);
      toast({
        title: "Error",
        description: "Unable to load items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async (id: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Item deleted",
        description: "Item deleted successfully",
      });

      // Remove item from local state
      setItems(prevItems => prevItems.filter(item => item.id !== id));
      return true;
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: "Error",
        description: "Unable to delete item",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchUserItems();
  }, [userId, user?.id]);

  return {
    items,
    loading,
    deleteItem,
    refetch: fetchUserItems,
  };
};