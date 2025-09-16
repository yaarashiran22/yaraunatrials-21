import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface Item {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  price?: number;
  category?: string;
  image_url?: string;
  location?: string;
  status: 'active' | 'sold' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface CreateItemData {
  title: string;
  description?: string;
  price?: number;
  category?: string;
  image_url?: string;
  location?: string;
}

export const useItems = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const { user } = useAuth();

  const fetchItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('items')
        .select('id, title, description, price, category, image_url, location, status, created_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setItems((data || []) as Item[]);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast({
        title: "Error",
        description: "Unable to load items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createItem = async (itemData: CreateItemData) => {
    console.log('createItem called with:', itemData);
    console.log('Current user:', user);
    
    let currentUser = user;
    
    if (!currentUser) {
      console.log('No user found, attempting anonymous sign in...');
      
      toast({
        title: "מתחבר למערכת...",
        description: "מתחבר אוטומטית כדי לשמור את הפריט",
      });
      
      // Auto sign in anonymously if no user
      const { signInAnonymously } = useAuth();
      const { error: authError } = await signInAnonymously();
      console.log('Anonymous sign in result:', { error: authError });
      
      if (authError) {
        console.error('Anonymous sign in failed:', authError);
        toast({
          title: "Authentication Error",
          description: "Unable to connect to the system",
          variant: "destructive",
        });
        return null;
      }
      
      // Wait for auth state to update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get updated session
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session after anonymous sign in:', session);
      currentUser = session?.user || null;
      
      if (!currentUser) {
        console.error('Still no user after anonymous sign in');
        toast({
          title: "Error",
          description: "Unable to connect to the system",
          variant: "destructive",
        });
        return null;
      }
    }

    try {
      setCreating(true);
      console.log('About to create item with user:', currentUser.id);
      console.log('Item data to insert:', { ...itemData, user_id: currentUser.id });
      
      const { data, error } = await supabase
        .from('items')
        .insert([{
          ...itemData,
          user_id: currentUser.id
        }])
        .select()
        .single();

      console.log('Supabase insert result:', { data, error });
      if (error) throw error;

      toast({
        title: "Item added successfully!",
        description: "Your item has been added to the marketplace",
      });

      // Refresh items list
      fetchItems();
      return data;
    } catch (error) {
      console.error('Error creating item:', error);
      toast({
        title: "Error",
        description: "Unable to add item",
        variant: "destructive",
      });
      return null;
    } finally {
      setCreating(false);
    }
  };

  const updateItem = async (id: string, updates: Partial<CreateItemData>) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('items')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      
      toast({
        title: "פריט עודכן",
        description: "הפריט עודכן בהצלחה",
      });

      fetchItems();
      return data;
    } catch (error) {
      console.error('Error updating item:', error);
      toast({
        title: "Error",
        description: "Unable to update item",
        variant: "destructive",
      });
      return null;
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
        title: "פריט נמחק",
        description: "הפריט נמחק בהצלחה",
      });

      fetchItems();
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

  // Remove automatic fetching - let components control when to fetch
  // useEffect(() => {
  //   fetchItems();
  // }, []);

  return {
    items,
    loading,
    creating,
    fetchItems,
    createItem,
    updateItem,
    deleteItem,
  };
};