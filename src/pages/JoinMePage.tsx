import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Edit, UserPlus, Clock, Instagram } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface JoinRequest {
  id: string;
  phone_number: string;
  name: string;
  age: number | null;
  photo_url: string | null;
  description: string | null;
  created_at: string;
  expires_at: string;
}

const JoinMePage = () => {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const phoneNumber = searchParams.get("phone");
  
  console.log("Full URL:", window.location.href);
  console.log("Phone number from URL:", phoneNumber);
  console.log("All URL params:", Object.fromEntries(searchParams.entries()));
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    photo_url: "",
    description: "",
  });

  // Fetch all active join requests
  const { data: joinRequests, isLoading } = useQuery({
    queryKey: ["joinRequests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("join_requests")
        .select("*")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as JoinRequest[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Update join request mutation
  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<JoinRequest> }) => {
      const { error } = await supabase
        .from("join_requests")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["joinRequests"] });
      toast.success("Profile updated!");
      setEditingId(null);
    },
    onError: () => {
      toast.error("Failed to update profile");
    },
  });

  // Delete join request mutation
  const deleteRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("join_requests")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["joinRequests"] });
      toast.success("Request removed!");
    },
    onError: () => {
      toast.error("Failed to remove request");
    },
  });

  const handleEdit = (request: JoinRequest) => {
    setEditingId(request.id);
    setEditForm({
      photo_url: request.photo_url || "",
      description: request.description || "",
    });
  };

  const handleSave = () => {
    if (!editingId) return;
    updateRequestMutation.mutate({
      id: editingId,
      updates: editForm,
    });
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins}m left`;
    }
    return `${diffMins}m left`;
  };

  const extractInstagramLink = (description: string | null) => {
    if (!description) return null;
    const instagramRegex = /(https?:\/\/)?(www\.)?(instagram\.com|instagr\.am)\/[\w.-]+/i;
    const match = description.match(instagramRegex);
    return match ? match[0] : null;
  };

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <Header />
      
      <main className="container mx-auto px-4 pt-20 lg:pt-24">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">Join Me</h1>
            <p className="text-foreground/80 text-lg">
              Find people looking to make plans and go out together
            </p>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : joinRequests && joinRequests.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              {(() => {
                // Filter to show only one card per phone number (most recent)
                const seenPhones = new Set<string>();
                const uniqueRequests = joinRequests.filter(request => {
                  if (seenPhones.has(request.phone_number)) {
                    return false;
                  }
                  seenPhones.add(request.phone_number);
                  return true;
                });
                
                return uniqueRequests.map((request) => {
                const isEditing = editingId === request.id;
                const instagramLink = extractInstagramLink(request.description);

                return (
                  <div
                    key={request.id}
                    className="rounded-2xl p-6 border-2 border-border"
                    style={{ 
                      boxShadow: 'none', 
                      backgroundColor: '#FFFFFF',
                      filter: 'none'
                    }}
                  >
                    {isEditing ? (
                      // Edit mode
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-semibold text-foreground mb-2 block">
                            Photo URL
                          </label>
                          <Input
                            value={editForm.photo_url}
                            onChange={(e) =>
                              setEditForm({ ...editForm, photo_url: e.target.value })
                            }
                            placeholder="https://..."
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-foreground mb-2 block">
                            Description (add Instagram link here!)
                          </label>
                          <Textarea
                            value={editForm.description}
                            onChange={(e) =>
                              setEditForm({ ...editForm, description: e.target.value })
                            }
                            placeholder="Looking for people to explore the nightlife! Instagram: @yourhandle or https://instagram.com/yourhandle"
                            rows={3}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleSave} className="flex-1">
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setEditingId(null)}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <div className="space-y-4">
                        <div className="flex items-start gap-4" style={{ filter: 'none', boxShadow: 'none', textShadow: 'none' }}>
                          {request.photo_url ? (
                            <img
                              src={request.photo_url}
                              alt={request.name}
                              className="w-20 h-20 rounded-full object-cover border-2 border-primary"
                              style={{ filter: 'none', boxShadow: 'none' }}
                            />
                          ) : (
                            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary" style={{ filter: 'none', boxShadow: 'none' }}>
                              <UserPlus className="h-10 w-10 text-primary" />
                            </div>
                          )}
                          <div className="flex-1" style={{ filter: 'none', textShadow: 'none' }}>
                            <h3 
                              className="font-bold text-2xl" 
                              style={{ 
                                color: '#000000',
                                textShadow: 'none', 
                                filter: 'none', 
                                opacity: 1,
                                fontWeight: 700
                              }}
                            >
                              {request.name}
                            </h3>
                            {request.age && (
                              <p 
                                className="text-lg font-semibold mt-1" 
                                style={{ 
                                  color: '#000000',
                                  textShadow: 'none', 
                                  filter: 'none', 
                                  opacity: 1,
                                  fontWeight: 600
                                }}
                              >
                                {request.age} years old
                              </p>
                            )}
                            <div 
                              className="flex items-center gap-2 mt-2 text-base font-medium" 
                              style={{ 
                                color: '#000000',
                                textShadow: 'none', 
                                filter: 'none', 
                                opacity: 1 
                              }}
                            >
                              <Clock className="h-5 w-5" style={{ color: '#000000' }} />
                              <span style={{ color: '#000000', textShadow: 'none', filter: 'none' }}>
                                {getTimeRemaining(request.expires_at)}
                              </span>
                            </div>
                          </div>
                          {phoneNumber && phoneNumber === request.phone_number && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(request)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        {request.description && (
                          <p className="text-base" style={{ color: '#000000', textShadow: 'none', filter: 'none', opacity: 1 }}>
                            {request.description}
                          </p>
                        )}

                        {instagramLink && (
                          <a
                            href={instagramLink.startsWith('http') ? instagramLink : `https://${instagramLink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-primary hover:underline"
                          >
                            <Instagram className="h-5 w-5" />
                            Connect on Instagram
                          </a>
                        )}

                        {phoneNumber === request.phone_number && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteRequestMutation.mutate(request.id)}
                            className="w-full"
                          >
                            Remove My Request
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              });
              })()}
            </div>
          ) : (
            <div className="text-center py-12 bg-card rounded-2xl border-2 border-border">
              <UserPlus className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-foreground/80 text-lg mb-2">No one is looking to connect right now</p>
              <p className="text-foreground/60">Check back later or ask Yara to add you to the board!</p>
            </div>
          )}
        </div>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default JoinMePage;
