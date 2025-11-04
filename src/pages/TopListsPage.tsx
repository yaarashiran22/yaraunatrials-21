import { useState } from "react";
import { Plus, Trash2, Edit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const TopListsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [newList, setNewList] = useState({
    title: "",
    category: "",
    description: "",
  });
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    location: "",
    image_url: "",
  });

  const categories = [
    "Best Bars",
    "Best Cafés",
    "Best Clubs",
    "Best Restaurants",
    "Best Parks",
    "Best Museums",
    "Best Shops",
    "Other"
  ];

  // Fetch all top lists
  const { data: topLists, isLoading } = useQuery({
    queryKey: ["topLists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("top_lists")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch items for a specific list
  const { data: listItems } = useQuery({
    queryKey: ["topListItems", selectedListId],
    queryFn: async () => {
      if (!selectedListId) return [];
      const { data, error } = await supabase
        .from("top_list_items")
        .select("*")
        .eq("list_id", selectedListId)
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedListId,
  });

  // Create list mutation
  const createListMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Must be logged in");
      
      const { data, error } = await supabase
        .from("top_lists")
        .insert({
          user_id: user.id,
          title: newList.title,
          category: newList.category,
          description: newList.description,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topLists"] });
      toast.success("List created!");
      setShowCreateDialog(false);
      setNewList({ title: "", category: "", description: "" });
    },
    onError: () => {
      toast.error("Failed to create list");
    },
  });

  // Add item mutation
  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!selectedListId) throw new Error("No list selected");
      
      const { data, error } = await supabase
        .from("top_list_items")
        .insert({
          list_id: selectedListId,
          name: newItem.name,
          description: newItem.description,
          location: newItem.location,
          image_url: newItem.image_url,
          display_order: listItems?.length || 0,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topListItems"] });
      toast.success("Item added!");
      setShowAddItemDialog(false);
      setNewItem({ name: "", description: "", location: "", image_url: "" });
    },
    onError: () => {
      toast.error("Failed to add item");
    },
  });

  // Delete list mutation
  const deleteListMutation = useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase
        .from("top_lists")
        .delete()
        .eq("id", listId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topLists"] });
      toast.success("List deleted!");
      if (selectedListId) setSelectedListId(null);
    },
    onError: () => {
      toast.error("Failed to delete list");
    },
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("top_list_items")
        .delete()
        .eq("id", itemId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topListItems"] });
      toast.success("Item removed!");
    },
    onError: () => {
      toast.error("Failed to remove item");
    },
  });

  const handleCreateList = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    createListMutation.mutate();
  };

  const handleAddItem = () => {
    addItemMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <Header />
      
      <main className="container mx-auto px-4 pt-20 lg:pt-24">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Yara's Top Lists</h1>
          {user && (
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Create List
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : topLists && topLists.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {topLists.map((list) => (
              <div
                key={list.id}
                className="bg-card rounded-xl p-6 border border-border hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => setSelectedListId(list.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{list.title}</h3>
                    <p className="text-sm text-muted-foreground">{list.category}</p>
                  </div>
                  {user?.id === list.user_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteListMutation.mutate(list.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {list.description && (
                  <p className="text-sm text-muted-foreground">{list.description}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No lists yet</p>
            {user && (
              <Button onClick={() => setShowCreateDialog(true)}>
                Create Your First List
              </Button>
            )}
          </div>
        )}
      </main>

      {/* Create List Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={newList.title}
                onChange={(e) => setNewList({ ...newList, title: e.target.value })}
                placeholder="e.g., Best Coffee Spots in Palermo"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <Select
                value={newList.category}
                onValueChange={(value) => setNewList({ ...newList, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Textarea
                value={newList.description}
                onChange={(e) => setNewList({ ...newList, description: e.target.value })}
                placeholder="What makes this list special?"
              />
            </div>
            <Button
              onClick={handleCreateList}
              disabled={!newList.title || !newList.category}
              className="w-full"
            >
              Create List
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* List Details Dialog */}
      <Dialog open={!!selectedListId} onOpenChange={() => setSelectedListId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {topLists?.find(l => l.id === selectedListId)?.title}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {user?.id === topLists?.find(l => l.id === selectedListId)?.user_id && (
              <Button
                onClick={() => setShowAddItemDialog(true)}
                variant="outline"
                className="w-full gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            )}

            {listItems && listItems.length > 0 ? (
              <div className="space-y-3">
                {listItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="bg-muted/50 rounded-lg p-4 flex gap-4"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">{item.name}</h4>
                      {item.location && (
                        <p className="text-sm text-muted-foreground">{item.location}</p>
                      )}
                      {item.description && (
                        <p className="text-sm mt-2">{item.description}</p>
                      )}
                    </div>
                    {user?.id === topLists?.find(l => l.id === selectedListId)?.user_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteItemMutation.mutate(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No items in this list yet
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Item to List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                placeholder="e.g., Café Tortoni"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Location</label>
              <Input
                value={newItem.location}
                onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
                placeholder="e.g., Palermo Soho"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Textarea
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                placeholder="Why is this place special?"
              />
            </div>
            <Button
              onClick={handleAddItem}
              disabled={!newItem.name}
              className="w-full"
            >
              Add Item
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNavigation />
    </div>
  );
};

export default TopListsPage;