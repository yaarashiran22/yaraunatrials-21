import { useState } from "react";
import { Plus, Trash2, Edit, Download } from "lucide-react";
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
import { exportTopListsToExcel, exportTopListItemsToExcel } from "@/utils/excelExport";

const TopListsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [showEditListDialog, setShowEditListDialog] = useState(false);
  const [showEditItemDialog, setShowEditItemDialog] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newList, setNewList] = useState({
    title: "",
    category: "",
    description: "",
  });
  const [editList, setEditList] = useState({
    title: "",
    category: "",
    description: "",
  });
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    location: "",
    image_url: "",
    url: "",
  });
  const [editItem, setEditItem] = useState({
    name: "",
    description: "",
    location: "",
    image_url: "",
    url: "",
  });

  const categories = [
    "Bars",
    "Clubs",
    "Art Centers",
    "Workshops",
    "Cafés",
    "Communities",
    "Coworks"
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
        .select("*, top_lists(category)")
        .eq("list_id", selectedListId)
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      // Flatten the category from the joined top_lists
      return data?.map(item => ({
        ...item,
        category: (item.top_lists as any)?.category || ''
      }));
    },
    enabled: !!selectedListId,
  });

  // Fetch ALL top list items with their parent list category and title (for exporting all items)
  const { data: allItems } = useQuery({
    queryKey: ["allTopListItemsWithDetails"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("top_list_items")
        .select("*, top_lists!inner(category, title)")
        .order("list_id", { ascending: true })
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      console.log("Raw allItems data:", data);
      // Flatten the category and list_name from the joined top_lists
      return data?.map(item => ({
        ...item,
        category: (item.top_lists as any)?.category || '',
        list_name: (item.top_lists as any)?.title || ''
      }));
    },
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
          url: newItem.url,
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
      setNewItem({ name: "", description: "", location: "", image_url: "", url: "" });
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

  // Update list mutation
  const updateListMutation = useMutation({
    mutationFn: async () => {
      if (!editingListId) throw new Error("No list selected");
      
      const { error } = await supabase
        .from("top_lists")
        .update({
          title: editList.title,
          category: editList.category,
          description: editList.description,
        })
        .eq("id", editingListId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topLists"] });
      toast.success("List updated!");
      setShowEditListDialog(false);
      setEditingListId(null);
    },
    onError: () => {
      toast.error("Failed to update list");
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

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async () => {
      if (!editingItemId) throw new Error("No item selected");
      
      const { error } = await supabase
        .from("top_list_items")
        .update({
          name: editItem.name,
          description: editItem.description,
          location: editItem.location,
          image_url: editItem.image_url,
          url: editItem.url,
        })
        .eq("id", editingItemId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topListItems"] });
      toast.success("Item updated!");
      setShowEditItemDialog(false);
      setEditingItemId(null);
    },
    onError: () => {
      toast.error("Failed to update item");
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

  const handleEditList = (list: any) => {
    setEditingListId(list.id);
    setEditList({
      title: list.title,
      category: list.category,
      description: list.description || "",
    });
    setShowEditListDialog(true);
  };

  const handleUpdateList = () => {
    updateListMutation.mutate();
  };

  const handleEditItem = (item: any) => {
    setEditingItemId(item.id);
    setEditItem({
      name: item.name,
      description: item.description || "",
      location: item.location || "",
      image_url: item.image_url || "",
      url: item.url || "",
    });
    setShowEditItemDialog(true);
  };

  const handleUpdateItem = () => {
    updateItemMutation.mutate();
  };

  const handleExportLists = () => {
    if (!topLists || topLists.length === 0) {
      toast.error("No lists to export");
      return;
    }
    try {
      exportTopListsToExcel(topLists, `top-lists-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`${topLists.length} lists exported to Excel`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export lists");
    }
  };

  const handleExportItems = () => {
    if (!listItems || listItems.length === 0) {
      toast.error("No items to export");
      return;
    }
    try {
      exportTopListItemsToExcel(listItems, `top-list-items-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`${listItems.length} items exported to Excel`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export items");
    }
  };

  const handleExportAllItems = () => {
    if (!allItems || allItems.length === 0) {
      toast.error("No items to export");
      return;
    }
    try {
      exportTopListItemsToExcel(allItems, `all-top-list-items-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`${allItems.length} items exported to Excel`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export all items");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <Header />
      
      <main className="container mx-auto px-4 pt-20 lg:pt-24 max-w-7xl">
        {/* Header Section */}
        <div className="mb-10">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-2">The Yara Lists</h1>
              <p className="text-pink-400 text-lg">Curate and share your favorite places</p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleExportLists}
                variant="outline"
                className="gap-2"
                disabled={!topLists || topLists.length === 0}
              >
                <Download className="h-4 w-4" />
                Export Lists
              </Button>
              <Button
                onClick={handleExportAllItems}
                variant="outline"
                className="gap-2"
                disabled={!allItems || allItems.length === 0}
              >
                <Download className="h-4 w-4" />
                Export All Items
              </Button>
              {user && (
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  className="gap-2 h-12 px-6"
                  size="lg"
                  disabled={userListCount !== undefined && userListCount >= 10}
                >
                  <Plus className="h-5 w-5" />
                  New List
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Lists Grid */}
        {isLoading ? (
          <div className="text-center py-20">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
            <p className="mt-4 text-muted-foreground">Loading your lists...</p>
          </div>
        ) : topLists && topLists.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
            {topLists.map((list) => (
              <div
                key={list.id}
                className="group bg-card rounded-xl border border-border hover:border-primary/50 transition-all duration-200 cursor-pointer overflow-hidden"
                onClick={() => setSelectedListId(list.id)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-3">
                        {list.category}
                      </div>
                      <h3 className="font-bold text-xl text-primary mb-2 line-clamp-2 transition-colors">
                        {list.title}
                      </h3>
                    </div>
                    {user?.id === list.user_id && (
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditList(list);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteListMutation.mutate(list.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {list.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      {list.description}
                    </p>
                  )}
                </div>
                <div className="px-6 pb-4 pt-2 border-t border-border/50 bg-muted/20">
                  <p className="text-xs text-muted-foreground">
                    Click to view items →
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-muted/20 rounded-xl border-2 border-dashed border-border">
            <div className="max-w-sm mx-auto">
              <Plus className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No lists yet</h3>
              <p className="text-muted-foreground mb-6">
                Start creating your curated lists of favorite places
              </p>
              {user && (
                <Button onClick={() => setShowCreateDialog(true)} size="lg">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First List
                </Button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Create List Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl">Create New List</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">List Title</label>
              <Input
                value={newList.title}
                onChange={(e) => setNewList({ ...newList, title: e.target.value })}
                placeholder="e.g., Best Coffee Spots in Palermo"
                className="h-11"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Category</label>
              <Select
                value={newList.category}
                onValueChange={(value) => setNewList({ ...newList, category: value })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select a category" />
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
              <label className="text-sm font-semibold text-foreground mb-2 block">Description (optional)</label>
              <Textarea
                value={newList.description}
                onChange={(e) => setNewList({ ...newList, description: e.target.value })}
                placeholder="What makes this list special?"
                className="min-h-[100px] resize-none"
              />
            </div>
            <Button
              onClick={handleCreateList}
              disabled={!newList.title || !newList.category}
              className="w-full h-11"
              size="lg"
            >
              Create List
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* List Details Dialog */}
      <Dialog open={!!selectedListId} onOpenChange={() => setSelectedListId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-2xl mb-2">
                  {topLists?.find(l => l.id === selectedListId)?.title}
                </DialogTitle>
                <div className="inline-block px-2 py-1 rounded bg-primary/10 text-primary text-xs font-semibold uppercase">
                  {topLists?.find(l => l.id === selectedListId)?.category}
                </div>
              </div>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4">
            <div className="flex gap-2 mb-6">
              {user?.id === topLists?.find(l => l.id === selectedListId)?.user_id && (
                <Button
                  onClick={() => setShowAddItemDialog(true)}
                  variant="outline"
                  className="flex-1 gap-2 border-dashed border-2 h-12"
                >
                  <Plus className="h-5 w-5" />
                  Add New Item
                </Button>
              )}
              {listItems && listItems.length > 0 && (
                <Button
                  onClick={handleExportItems}
                  variant="outline"
                  className="gap-2 h-12 px-6"
                >
                  <Download className="h-4 w-4" />
                  Export Items
                </Button>
              )}
            </div>

            {listItems && listItems.length > 0 ? (
              <div className="space-y-3">
                {listItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="group bg-muted/30 rounded-lg p-5 border border-border hover:border-primary/50 hover:bg-muted/50 transition-all"
                  >
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-sm text-primary">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-lg text-foreground mb-1">{item.name}</h4>
                        {item.location && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                            {topLists?.find(l => l.id === selectedListId)?.category === "Communities" ? (
                              <>
                                <span>🔗</span>
                                <a href={item.location} target="_blank" rel="noopener noreferrer" className="hover:text-primary underline">
                                  {item.location}
                                </a>
                              </>
                            ) : (
                              <>
                                <span>📍</span>
                                <span>{item.location}</span>
                              </>
                            )}
                          </div>
                        )}
                        {item.description && (
                          <p className="text-sm text-foreground/80 leading-relaxed mt-2">
                            {item.description}
                          </p>
                        )}
                        {item.url && (
                          <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
                          >
                            <span>Instagram Link</span>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                      {user?.id === topLists?.find(l => l.id === selectedListId)?.user_id && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditItem(item)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deleteItemMutation.mutate(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-muted/20 rounded-lg border-2 border-dashed border-border">
                <p className="text-muted-foreground text-sm">
                  No items in this list yet. Add your first one!
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl">Add Item to List</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                {topLists?.find(l => l.id === selectedListId)?.category === "Communities" ? "Community Name" : "Place Name"}
              </label>
              <Input
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                placeholder={topLists?.find(l => l.id === selectedListId)?.category === "Communities" ? "e.g., Tech Meetup Group" : "e.g., Café Tortoni"}
                className="h-11"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                {topLists?.find(l => l.id === selectedListId)?.category === "Communities" ? "Join Link" : "Location"}
              </label>
              <Input
                value={newItem.location}
                onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
                placeholder={topLists?.find(l => l.id === selectedListId)?.category === "Communities" ? "e.g., https://chat.whatsapp.com/..." : "e.g., Palermo Soho"}
                className="h-11"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Description (optional)</label>
              <Textarea
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                placeholder="Why is this place special?"
                className="min-h-[100px] resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Instagram Link (optional)</label>
              <Input
                value={newItem.url}
                onChange={(e) => setNewItem({ ...newItem, url: e.target.value })}
                placeholder="e.g., https://www.instagram.com/..."
                className="h-11"
              />
            </div>
            <Button
              onClick={handleAddItem}
              disabled={!newItem.name}
              className="w-full h-11"
              size="lg"
            >
              Add Item
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit List Dialog */}
      <Dialog open={showEditListDialog} onOpenChange={setShowEditListDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl">Edit List</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">List Title</label>
              <Input
                value={editList.title}
                onChange={(e) => setEditList({ ...editList, title: e.target.value })}
                placeholder="e.g., Best Coffee Spots in Palermo"
                className="h-11"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Category</label>
              <Select
                value={editList.category}
                onValueChange={(value) => setEditList({ ...editList, category: value })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select a category" />
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
              <label className="text-sm font-semibold text-foreground mb-2 block">Description (optional)</label>
              <Textarea
                value={editList.description}
                onChange={(e) => setEditList({ ...editList, description: e.target.value })}
                placeholder="What makes this list special?"
                className="min-h-[100px] resize-none"
              />
            </div>
            <Button
              onClick={handleUpdateList}
              disabled={!editList.title || !editList.category}
              className="w-full h-11"
              size="lg"
            >
              Update List
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={showEditItemDialog} onOpenChange={setShowEditItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl">Edit Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                {topLists?.find(l => l.id === selectedListId)?.category === "Communities" ? "Community Name" : "Place Name"}
              </label>
              <Input
                value={editItem.name}
                onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                placeholder={topLists?.find(l => l.id === selectedListId)?.category === "Communities" ? "e.g., Tech Meetup Group" : "e.g., Café Tortoni"}
                className="h-11"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                {topLists?.find(l => l.id === selectedListId)?.category === "Communities" ? "Join Link" : "Location"}
              </label>
              <Input
                value={editItem.location}
                onChange={(e) => setEditItem({ ...editItem, location: e.target.value })}
                placeholder={topLists?.find(l => l.id === selectedListId)?.category === "Communities" ? "e.g., https://chat.whatsapp.com/..." : "e.g., Palermo Soho"}
                className="h-11"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Description (optional)</label>
              <Textarea
                value={editItem.description}
                onChange={(e) => setEditItem({ ...editItem, description: e.target.value })}
                placeholder="Why is this place special?"
                className="min-h-[100px] resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Instagram Link (optional)</label>
              <Input
                value={editItem.url}
                onChange={(e) => setEditItem({ ...editItem, url: e.target.value })}
                placeholder="e.g., https://www.instagram.com/..."
                className="h-11"
              />
            </div>
            <Button
              onClick={handleUpdateItem}
              disabled={!editItem.name}
              className="w-full h-11"
              size="lg"
            >
              Update Item
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNavigation />
    </div>
  );
};

export default TopListsPage;