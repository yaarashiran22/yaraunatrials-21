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
    "Bars",
    "Clubs",
    "Art Centers",
    "Workshops",
    "Cafés"
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

  // Fetch user's list count
  const { data: userListCount } = useQuery({
    queryKey: ["userListCount", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("top_lists")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
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
      toast.error("Please log in to create a list");
      navigate("/login");
      return;
    }
    if (userListCount && userListCount >= 10) {
      toast.error("You can only create up to 10 lists");
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
      
      <main className="px-4 pt-16 pb-6 lg:pt-24 max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="mb-6 space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Yara's Top Lists</h1>
          {user && (
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="w-full min-h-touch gap-2 shadow-none"
              disabled={userListCount !== undefined && userListCount >= 10}
            >
              <Plus className="h-5 w-5" />
              <span className="text-base font-semibold">
                Create List {userListCount !== undefined && `(${userListCount}/10)`}
              </span>
            </Button>
          )}
        </div>

        {/* Lists Grid */}
        {isLoading ? (
          <div className="text-center py-16">
            <p className="text-base text-muted-foreground">Loading...</p>
          </div>
        ) : topLists && topLists.length > 0 ? (
          <div className="space-y-3">
            {topLists.map((list) => (
              <div
                key={list.id}
                className="bg-card rounded-2xl p-5 border border-border active:bg-accent/20 transition-colors cursor-pointer shadow-none"
                onClick={() => setSelectedListId(list.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-foreground truncate">{list.title}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{list.category}</p>
                    {list.description && (
                      <p className="text-sm text-foreground/80 mt-2 line-clamp-2">{list.description}</p>
                    )}
                  </div>
                  {user?.id === list.user_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0 h-9 w-9 p-0 shadow-none hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteListMutation.mutate(list.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 px-4">
            <p className="text-base text-muted-foreground mb-6">No lists yet</p>
            {user && (
              <Button 
                onClick={() => setShowCreateDialog(true)}
                className="min-h-touch px-8 shadow-none"
              >
                Create Your First List
              </Button>
            )}
          </div>
        )}
      </main>

      {/* Create List Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="shadow-none rounded-3xl mx-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Create New List</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Title</label>
              <Input
                value={newList.title}
                onChange={(e) => setNewList({ ...newList, title: e.target.value })}
                placeholder="e.g., Best Coffee Spots in Palermo"
                className="h-12 text-base shadow-none"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Category</label>
              <Select
                value={newList.category}
                onValueChange={(value) => setNewList({ ...newList, category: value })}
              >
                <SelectTrigger className="h-12 text-base shadow-none">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="shadow-none">
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-base">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Description (optional)</label>
              <Textarea
                value={newList.description}
                onChange={(e) => setNewList({ ...newList, description: e.target.value })}
                placeholder="What makes this list special?"
                className="min-h-24 text-base shadow-none"
              />
            </div>
            <Button
              onClick={handleCreateList}
              disabled={!newList.title || !newList.category}
              className="w-full min-h-touch text-base font-semibold shadow-none"
            >
              Create List
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* List Details Dialog */}
      <Dialog open={!!selectedListId} onOpenChange={() => setSelectedListId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto shadow-none rounded-3xl mx-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold pr-8">
              {topLists?.find(l => l.id === selectedListId)?.title}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 -mt-2">
            {user?.id === topLists?.find(l => l.id === selectedListId)?.user_id && (
              <Button
                onClick={() => setShowAddItemDialog(true)}
                variant="outline"
                className="w-full min-h-touch gap-2 text-base font-semibold shadow-none"
              >
                <Plus className="h-5 w-5" />
                Add Item
              </Button>
            )}

            {listItems && listItems.length > 0 ? (
              <div className="space-y-3">
                {listItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="bg-accent/30 rounded-2xl p-4 flex gap-3 border-0 shadow-none"
                  >
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary flex items-center justify-center font-bold text-base text-primary-foreground">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-base text-foreground">{item.name}</h4>
                      {item.location && (
                        <p className="text-sm text-muted-foreground mt-0.5">{item.location}</p>
                      )}
                      {item.description && (
                        <p className="text-sm text-foreground/80 mt-2">{item.description}</p>
                      )}
                    </div>
                    {user?.id === topLists?.find(l => l.id === selectedListId)?.user_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-shrink-0 h-9 w-9 p-0 shadow-none"
                        onClick={() => deleteItemMutation.mutate(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-12 text-base">
                No items in this list yet
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="shadow-none rounded-3xl mx-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Add Item to List</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Name</label>
              <Input
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                placeholder="e.g., Café Tortoni"
                className="h-12 text-base shadow-none"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Location</label>
              <Input
                value={newItem.location}
                onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
                placeholder="e.g., Palermo Soho"
                className="h-12 text-base shadow-none"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Description (optional)</label>
              <Textarea
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                placeholder="Why is this place special?"
                className="min-h-24 text-base shadow-none"
              />
            </div>
            <Button
              onClick={handleAddItem}
              disabled={!newItem.name}
              className="w-full min-h-touch text-base font-semibold shadow-none"
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