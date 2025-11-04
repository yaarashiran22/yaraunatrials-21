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
  const phoneNumberRaw = searchParams.get("phone");
  // Remove "whatsapp:" prefix if present
  const phoneNumber = phoneNumberRaw?.replace(/^whatsapp:/, '') || null;
  
  console.log("Full URL:", window.location.href);
  console.log("Phone number from URL (cleaned):", phoneNumber);
  console.log("All URL params:", Object.fromEntries(searchParams.entries()));
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    photo_url: "",
    description: "",
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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
      name: request.name || "",
      photo_url: request.photo_url || "",
      description: request.description || "",
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath);

      setEditForm({ ...editForm, photo_url: publicUrl });
      toast.success("Photo uploaded!");
    } catch (error) {
      console.error('Upload error:', error);
      toast.error("Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
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
            {phoneNumber && (
              <div className="mt-4 p-3 bg-primary/10 rounded-lg">
                <p className="text-sm font-semibold">Your phone: {phoneNumber}</p>
                <p className="text-xs text-muted-foreground">You can edit your card</p>
              </div>
            )}
            {!phoneNumber && (
              <div className="mt-4 p-3 bg-yellow-100 rounded-lg">
                <p className="text-sm font-semibold text-yellow-800">⚠️ No phone number detected in URL</p>
                <p className="text-xs text-yellow-700">The link should include ?phone=YOUR_NUMBER</p>
                <p className="text-xs text-yellow-700 mt-1">Current URL: {window.location.href}</p>
              </div>
            )}
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
                    className="rounded-2xl p-6 border-2 border-border bg-white"
                  >
                    {isEditing ? (
                      // Edit mode
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-semibold text-foreground mb-2 block">
                            Name
                          </label>
                          <Input
                            value={editForm.name}
                            onChange={(e) =>
                              setEditForm({ ...editForm, name: e.target.value })
                            }
                            placeholder="Your name"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-foreground mb-2 block">
                            Photo
                          </label>
                          <div className="flex items-center gap-4">
                            {editForm.photo_url && (
                              <img
                                src={editForm.photo_url}
                                alt="Preview"
                                className="w-20 h-20 rounded-full object-cover border-2 border-primary"
                              />
                            )}
                            <div className="flex-1">
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoUpload}
                                disabled={uploadingPhoto}
                                className="cursor-pointer"
                              />
                              {uploadingPhoto && (
                                <p className="text-xs text-muted-foreground mt-1">Uploading...</p>
                              )}
                            </div>
                          </div>
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
                        {/* DEBUG INFO */}
                        <div className="p-2 bg-blue-50 rounded text-xs">
                          <p><strong>URL Phone:</strong> {phoneNumber || 'NULL'}</p>
                          <p><strong>Card Phone:</strong> {request.phone_number}</p>
                          <p><strong>Match:</strong> {phoneNumber === request.phone_number ? 'YES' : 'NO'}</p>
                        </div>
                        
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(request)}
                            className="shrink-0 border-2 hover:bg-primary hover:text-primary-foreground"
                          >
                            <Edit className="h-5 w-5" />
                          </Button>
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
