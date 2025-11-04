import { useState } from "react";
import { Plus, Trash2, Edit, MapPin } from "lucide-react";
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
      
      <main className="px-4 pt-12 pb-6 lg:pt-16 max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-[#E91E63] to-[#9C27B0] bg-clip-text text-transparent">
              Yara's Top Lists
            </h1>
            {user && (
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="h-12 w-12 rounded-full bg-gradient-to-r from-[#E91E63] to-[#9C27B0] hover:from-[#D81B60] hover:to-[#8E24AA] text-white font-semibold shadow-lg hover:shadow-xl hover:scale-[1.1] transition-all duration-300 flex items-center justify-center p-0"
                disabled={userListCount !== undefined && userListCount >= 10}
              >
                <Plus className="h-6 w-6" />
              </Button>
            )}
          </div>
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
                className="group bg-gradient-to-br from-card to-accent/10 rounded-2xl p-5 border border-border/50 hover:border-[#E91E63]/30 active:bg-accent/20 transition-all duration-300 cursor-pointer hover:shadow-lg hover:scale-[1.01] shadow-none"
                onClick={() => setSelectedListId(list.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-foreground truncate group-hover:text-[#E91E63] transition-colors">
                      {list.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{list.category}</p>
                    {list.description && (
                      <p className="text-sm text-foreground/80 mt-2 line-clamp-2 leading-relaxed">
                        {list.description}
                      </p>
                    )}
                  </div>
                  {user?.id === list.user_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0 h-9 w-9 p-0 shadow-none hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
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
          <div className="text-center py-16 px-4 bg-gradient-to-br from-accent/20 to-accent/5 rounded-2xl border-2 border-dashed border-border/50">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#E91E63]/20 to-[#9C27B0]/20 flex items-center justify-center">
              <Plus className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-base text-foreground font-medium mb-2">No lists yet</p>
            {user && (
              <Button 
                onClick={() => setShowCreateDialog(true)}
                className="min-h-touch px-8 shadow-none mt-4 bg-gradient-to-r from-[#E91E63] to-[#9C27B0] hover:from-[#D81B60] hover:to-[#8E24AA] text-white"
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
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[85vh] overflow-y-auto shadow-none rounded-3xl bg-gradient-to-br from-background to-accent/10 border-2 border-border/50">
          <DialogHeader>
            <DialogTitle className="text-xl lg:text-2xl font-bold pr-8 bg-gradient-to-r from-[#E91E63] to-[#9C27B0] bg-clip-text text-transparent">
              {topLists?.find(l => l.id === selectedListId)?.title}
            </DialogTitle>
            <p className="text-foreground text-sm lg:text-base mt-2 leading-relaxed">
              {topLists?.find(l => l.id === selectedListId)?.description}
            </p>
          </DialogHeader>
          
          <div className="space-y-4 -mt-2">
            {user?.id === topLists?.find(l => l.id === selectedListId)?.user_id && (
              <Button
                onClick={() => setShowAddItemDialog(true)}
                className="w-full min-h-touch gap-2 text-base font-semibold bg-gradient-to-r from-[#E91E63] to-[#9C27B0] hover:from-[#D81B60] hover:to-[#8E24AA] text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
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
                    className="group bg-gradient-to-br from-card to-accent/20 rounded-2xl p-5 flex gap-4 border border-border/50 hover:border-[#E91E63]/30 transition-all duration-300 hover:shadow-lg hover:scale-[1.01] shadow-none"
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[#E91E63] to-[#9C27B0] flex items-center justify-center font-bold text-lg text-white shadow-md group-hover:scale-110 transition-transform duration-300">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-lg text-foreground group-hover:text-[#E91E63] transition-colors">{item.name}</h4>
                      {item.location && (
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">{item.location}</p>
                        </div>
                      )}
                      {item.description && (
                        <p className="text-sm text-foreground/80 mt-2 leading-relaxed">{item.description}</p>
                      )}
                    </div>
                    {user?.id === topLists?.find(l => l.id === selectedListId)?.user_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-shrink-0 h-9 w-9 p-0 shadow-none hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteItemMutation.mutate(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 px-4 bg-gradient-to-br from-accent/20 to-accent/5 rounded-2xl border-2 border-dashed border-border/50">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#E91E63]/20 to-[#9C27B0]/20 flex items-center justify-center">
                  <Plus className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-base font-medium">
                  No items in this list yet
                </p>
                <p className="text-muted-foreground/70 text-sm mt-1">
                  Start building your list by adding items!
                </p>
              </div>
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