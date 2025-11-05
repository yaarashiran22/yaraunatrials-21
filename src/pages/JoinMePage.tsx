import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Edit, UserPlus, Clock, Instagram, Trash2 } from "lucide-react";
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
  additional_photos: string[] | null;
  event_id: string | null;
  events?: {
    id: string;
    title: string;
    date: string | null;
    time: string | null;
    location: string | null;
    image_url: string | null;
  };
}

const JoinMePage = () => {
  console.log("🔄 JoinMePage component mounted");
  
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
    additional_photos: [] as string[],
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<JoinRequest | null>(null);

  // Fetch all active join requests with event details
  const { data: joinRequests, isLoading, error, isFetching } = useQuery({
    queryKey: ["joinRequests"],
    queryFn: async () => {
      console.log("Fetching join requests...");
      const { data, error } = await supabase
        .from("join_requests")
        .select(`
          *,
          events (
            id,
            title,
            date,
            time,
            location,
            image_url
          )
        `)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching join requests:", error);
        throw error;
      }
      console.log("Join requests fetched:", data);
      return data as JoinRequest[];
    },
    refetchInterval: 30000,
    retry: 1, // Reduced retry for faster failure on mobile
    staleTime: 5000,
    gcTime: 60000,
    networkMode: 'online',
  });

  console.log("Join requests state:", { isLoading, isFetching, hasData: !!joinRequests, dataLength: joinRequests?.length, error });

  // Update join request mutation
  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<JoinRequest> }) => {
      console.log('Updating join request with:', { id, updates });
      const { error, data } = await supabase
        .from("join_requests")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      console.log('Update result:', data);
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["joinRequests"] });
      
      // Update selectedRequest with the fresh data if it's currently open
      if (selectedRequest?.id === data.id) {
        setSelectedRequest(data as JoinRequest);
      }
      
      toast.success("Profile updated!");
      setEditingId(null);
    },
    onError: (error) => {
      console.error('Update error:', error);
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
      additional_photos: request.additional_photos || [],
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, isAdditional: boolean = false) => {
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

      if (isAdditional) {
        // Add to additional photos (max 2)
        setEditForm(prev => {
          if (prev.additional_photos.length < 2) {
            const updatedPhotos = [...prev.additional_photos, publicUrl];
            console.log('Adding additional photo:', publicUrl);
            console.log('Updated photos array:', updatedPhotos);
            toast.success("Additional photo uploaded!");
            return { 
              ...prev, 
              additional_photos: updatedPhotos
            };
          } else {
            toast.error("Maximum 2 additional photos allowed");
            return prev;
          }
        });
      } else {
        setEditForm(prev => ({ ...prev, photo_url: publicUrl }));
        toast.success("Photo uploaded!");
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error("Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removeAdditionalPhoto = (index: number) => {
    setEditForm(prev => ({
      ...prev,
      additional_photos: prev.additional_photos.filter((_, i) => i !== index)
    }));
  };

  const handleSave = () => {
    if (!editingId) return;
    
    console.log('Saving with additional_photos:', editForm.additional_photos);
    
    updateRequestMutation.mutate({
      id: editingId,
      updates: {
        name: editForm.name,
        photo_url: editForm.photo_url,
        description: editForm.description,
        additional_photos: editForm.additional_photos,
      },
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
      
      <main className="container mx-auto px-4 pt-12 lg:pt-16">
        <div className="max-w-4xl mx-auto">
          <div className="mb-5">
            <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-[#E91E63] to-[#9C27B0] bg-clip-text text-transparent mb-3">
              Join Me
            </h1>
            <p className="text-foreground/80 text-base lg:text-lg">
              Find people looking to make plans and go out together
            </p>
          </div>

          {isLoading || isFetching ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-pulse space-y-2">
                <div className="text-lg mb-2">Loading Join Requests...</div>
                <div className="text-sm">Please wait</div>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-destructive text-lg mb-2">⚠️ Error loading requests</div>
              <div className="text-sm text-muted-foreground">{error instanceof Error ? error.message : 'Unknown error'}</div>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
              >
                Retry
              </button>
            </div>
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
                    className="group rounded-2xl p-5 lg:p-6 border border-border/50 bg-gradient-to-br from-card to-accent/10 hover:border-[#E91E63]/30 transition-all duration-300 hover:shadow-lg shadow-none cursor-pointer active:scale-[0.98]"
                    onClick={(e) => {
                      // Prevent opening popup when clicking on buttons or inputs in edit mode
                      if (isEditing) return;
                      setSelectedRequest(request);
                    }}
                    onTouchEnd={(e) => {
                      // Better mobile touch handling
                      if (isEditing) return;
                      e.preventDefault();
                      setSelectedRequest(request);
                    }}
                  >
                    {isEditing ? (
                      // Edit mode
                      <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
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
                            onClick={(e) => e.stopPropagation()}
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
                                onChange={(e) => handlePhotoUpload(e, false)}
                                disabled={uploadingPhoto}
                                className="cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              />
                              {uploadingPhoto && (
                                <p className="text-xs text-muted-foreground mt-1">Uploading...</p>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-sm font-semibold text-foreground mb-2 block">
                            Additional Photos (up to 2)
                          </label>
                          <div className="space-y-3">
                            {editForm.additional_photos.map((url, index) => (
                              <div key={index} className="flex items-center gap-3">
                                <img
                                  src={url}
                                  alt={`Additional ${index + 1}`}
                                  className="w-16 h-16 rounded-lg object-cover border-2 border-border"
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeAdditionalPhoto(index);
                                  }}
                                  className="text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            {editForm.additional_photos.length < 2 && (
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handlePhotoUpload(e, true)}
                                disabled={uploadingPhoto}
                                className="cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
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
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSave();
                            }} 
                            className="flex-1"
                          >
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(null);
                            }}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <div className="space-y-4">
                        <div className="flex items-start gap-4">
                          {request.photo_url ? (
                            <img
                              src={request.photo_url}
                              alt={request.name}
                              className="w-16 h-16 lg:w-20 lg:h-20 rounded-full object-cover border-2 border-[#E91E63] shadow-md"
                            />
                          ) : (
                            <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-gradient-to-br from-[#E91E63]/20 to-[#9C27B0]/20 flex items-center justify-center border-2 border-[#E91E63]">
                              <UserPlus className="h-8 w-8 lg:h-10 lg:w-10 text-[#E91E63]" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-xl lg:text-2xl text-foreground truncate">
                              {request.name}
                            </h3>
                            {request.age && (
                              <p className="text-base lg:text-lg text-muted-foreground mt-0.5">
                                {request.age} years old
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 text-sm lg:text-base text-muted-foreground">
                              <Clock className="h-4 w-4 lg:h-5 lg:w-5" />
                              <span>{getTimeRemaining(request.expires_at)}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(request);
                            }}
                            className="shrink-0 h-9 w-9 p-0 hover:bg-[#E91E63]/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Edit className="h-4 w-4 text-[#E91E63]" />
                          </Button>
                        </div>


                        {/* Event Information */}
                        {request.events && (
                          <div className="bg-accent/20 rounded-xl p-3 border border-border/50">
                            <div className="flex gap-3">
                              {request.events.image_url && (
                                <img
                                  src={request.events.image_url}
                                  alt={request.events.title}
                                  className="w-16 h-16 rounded-lg object-cover"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground mb-1">Wants to go to:</p>
                                <h4 className="font-semibold text-sm text-foreground truncate">
                                  {request.events.title}
                                </h4>
                                <div className="flex flex-col gap-0.5 mt-1">
                                  {request.events.date && (
                                    <p className="text-xs text-muted-foreground">
                                      📅 {request.events.date}
                                    </p>
                                  )}
                                  {request.events.location && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      📍 {request.events.location}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}


                        {instagramLink && (
                          <a
                            href={instagramLink.startsWith('http') ? instagramLink : `https://${instagramLink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-[#E91E63] hover:text-[#D81B60] font-medium transition-colors"
                          >
                            <Instagram className="h-5 w-5" />
                            <span className="text-sm lg:text-base">Connect on Instagram</span>
                          </a>
                        )}

                        {phoneNumber === request.phone_number && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteRequestMutation.mutate(request.id);
                            }}
                            className="w-full mt-2"
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
            <div className="text-center py-16 px-4 bg-gradient-to-br from-accent/20 to-accent/5 rounded-2xl border-2 border-dashed border-border/50">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#E91E63]/20 to-[#9C27B0]/20 flex items-center justify-center">
                <UserPlus className="h-10 w-10 text-muted-foreground" />
              </div>
              <p className="text-foreground text-base lg:text-lg font-medium mb-2">No one is looking to connect right now</p>
              <p className="text-muted-foreground text-sm lg:text-base">Check back later or ask Yara to add you to the board!</p>
            </div>
          )}
        </div>
      </main>

      {/* View Request Details Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent 
          className="w-[calc(100vw-2rem)] max-w-lg max-h-[85vh] overflow-y-auto shadow-none rounded-3xl bg-gradient-to-br from-card to-accent/10 border-2 border-border/50"
          aria-describedby="user-profile-description"
        >
          <div id="user-profile-description" className="sr-only">
            User profile details and information
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-[#E91E63] to-[#9C27B0] bg-clip-text text-transparent">
              {selectedRequest?.name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-6 py-4">
              {/* Photo Gallery */}
              <div className="space-y-4">
                {/* Main Profile Photo */}
                <div className="flex justify-center">
                  {selectedRequest.photo_url ? (
                    <img
                      src={selectedRequest.photo_url}
                      alt={selectedRequest.name}
                      className="w-48 h-48 rounded-full object-cover border-4 border-[#E91E63] shadow-xl"
                    />
                  ) : (
                    <div className="w-48 h-48 rounded-full bg-gradient-to-br from-[#E91E63]/20 to-[#9C27B0]/20 flex items-center justify-center border-4 border-[#E91E63]">
                      <UserPlus className="h-24 w-24 text-[#E91E63]" />
                    </div>
                  )}
                </div>

                {/* Additional Photos */}
                {selectedRequest.additional_photos && selectedRequest.additional_photos.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 px-4">
                    {selectedRequest.additional_photos.map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt={`${selectedRequest.name} photo ${index + 1}`}
                        className="w-full h-32 rounded-xl object-cover border-2 border-border shadow-md"
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="space-y-4">
                {selectedRequest.age && (
                  <div className="text-center">
                    <p className="text-lg text-foreground">
                      <span className="font-semibold">{selectedRequest.age}</span> years old
                    </p>
                  </div>
                )}

                {/* Event Information in Popup */}
                {selectedRequest.events && (
                  <div className="bg-gradient-to-br from-[#E91E63]/10 to-[#9C27B0]/10 rounded-2xl p-4 border-2 border-[#E91E63]/30">
                    <h4 className="font-semibold text-foreground mb-3 text-center">Wants to go to:</h4>
                    <div className="space-y-3">
                      {selectedRequest.events.image_url && (
                        <img
                          src={selectedRequest.events.image_url}
                          alt={selectedRequest.events.title}
                          className="w-full h-32 rounded-xl object-cover"
                        />
                      )}
                      <h3 className="font-bold text-lg text-foreground text-center">
                        {selectedRequest.events.title}
                      </h3>
                      <div className="space-y-2">
                        {selectedRequest.events.date && (
                          <div className="flex items-center gap-2 text-foreground/80">
                            <span className="text-lg">📅</span>
                            <span>{selectedRequest.events.date} {selectedRequest.events.time && `at ${selectedRequest.events.time}`}</span>
                          </div>
                        )}
                        {selectedRequest.events.location && (
                          <div className="flex items-center gap-2 text-foreground/80">
                            <span className="text-lg">📍</span>
                            <span>{selectedRequest.events.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {selectedRequest.description && (
                  <div className="bg-accent/20 rounded-2xl p-4">
                    <h4 className="font-semibold text-foreground mb-2">About</h4>
                    <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {selectedRequest.description}
                    </p>
                  </div>
                )}

                {extractInstagramLink(selectedRequest.description) && (
                  <a
                    href={
                      extractInstagramLink(selectedRequest.description)?.startsWith('http')
                        ? extractInstagramLink(selectedRequest.description)!
                        : `https://${extractInstagramLink(selectedRequest.description)}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 text-[#E91E63] hover:text-[#D81B60] font-medium transition-colors bg-[#E91E63]/10 rounded-xl py-3"
                  >
                    <Instagram className="h-5 w-5" />
                    <span>Connect on Instagram</span>
                  </a>
                )}

                <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm bg-accent/20 rounded-xl py-2">
                  <Clock className="h-4 w-4" />
                  <span>{getTimeRemaining(selectedRequest.expires_at)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNavigation />
    </div>
  );
};

export default JoinMePage;
