import { Calendar, MapPin, Users, Trash2, Pencil, Edit, X, Star, Heart, MessageCircle, Share2, Bell, ChevronLeft, ChevronRight, Play, Pause, Instagram, Settings, Gift, Plus, LogOut, UserPlus, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useSecureAuth } from "@/hooks/useSecureAuth";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { validateUUID, canUserModifyItem } from "@/utils/security";
import { useToast } from "@/hooks/use-toast";
import BottomNavigation from "@/components/BottomNavigation";
import Header from "@/components/Header";
import { useUserEvents } from "@/hooks/useUserEvents";
import { useUserRSVPs } from "@/hooks/useUserRSVPs";

import { useFriends } from "@/hooks/useFriends";
import { useFollowing } from "@/hooks/useFollowing";
import { useProfile } from "@/hooks/useProfile";
import { useUserPosts } from "@/hooks/useUserPosts";
import { getRelativeDay } from "@/utils/dateUtils";
import SectionHeader from "@/components/SectionHeader";
import UniformCard from "@/components/UniformCard";
import ProfilePictureViewer from "@/components/ProfilePictureViewer";
import { FeedImageViewer } from "@/components/FeedImageViewer";
import EditEventPopup from "@/components/EditEventPopup";
import { EditCouponModal } from "@/components/EditCouponModal";
import { supabase } from "@/integrations/supabase/client";

import { useMyCoupons } from "@/hooks/useUserCoupons";

import profile1 from "@/assets/profile-1.jpg";
import communityEvent from "@/assets/community-event.jpg";

const ProfilePage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, requireAuth, canAccessResource } = useSecureAuth();
  const { toast } = useToast();
  
  // Use security utility for UUID validation - memoized to prevent re-renders
  const actualProfileId = useMemo(() => {
    if (!id || !validateUUID(id)) {
      return user?.id;
    }
    return id;
  }, [id, user?.id]);
  
  // Check if this is the current user's profile - memoized
  const isOwnProfile = useMemo(() => {
    return user && (!id || !validateUUID(id) || actualProfileId === user.id);
  }, [user, id, actualProfileId]);
  const { profile: profileData, loading, error, refetch } = useProfile(actualProfileId);
  const { events: userEvents, loading: eventsLoading, deleteEvent, refetch: refetchEvents } = useUserEvents(actualProfileId);
  const { imagePosts, loading: postsLoading } = useUserPosts(actualProfileId);
  const { addFriend, isFriend } = useFriends();
  const { isFollowing, toggleFollow, isToggling } = useFollowing();
  const { myCoupons, loading: couponsLoading, deleteCoupon, deleting: deletingCoupon, refreshCoupons } = useMyCoupons(user?.id);
  const { rsvps: userRSVPs, loading: rsvpsLoading, refetch: refetchRSVPs } = useUserRSVPs(actualProfileId);
  // Messages feature removed
  
  
  const [newMessage, setNewMessage] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState("");
  const [showProfilePicture, setShowProfilePicture] = useState(false);
  const [showFeedImages, setShowFeedImages] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<any>(null);
  const [showEditCoupon, setShowEditCoupon] = useState(false);
  const [selectedCouponForEdit, setSelectedCouponForEdit] = useState<any>(null);

  // Function to extract dominant colors from an image
  const extractImageColors = (img: HTMLImageElement): { primary: string; secondary: string } => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    // Use smaller canvas for color sampling for performance
    const sampleSize = 50;
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    
    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
    const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
    const data = imageData.data;
    
    const colorCounts: { [key: string]: number } = {};
    
    // Sample colors from the image
    for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = data[i + 3];
      
      // Skip transparent pixels
      if (alpha < 128) continue;
      
      // Group similar colors together (reduce precision)
      const rGroup = Math.floor(r / 32) * 32;
      const gGroup = Math.floor(g / 32) * 32;
      const bGroup = Math.floor(b / 32) * 32;
      
      const colorKey = `${rGroup},${gGroup},${bGroup}`;
      colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;
    }
    
    // Get the most common colors
    const sortedColors = Object.entries(colorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);
    
    if (sortedColors.length === 0) {
      // Fallback to default colors
      return { primary: '#3B82F6', secondary: '#8B5CF6' };
    }
    
    const [r1, g1, b1] = sortedColors[0][0].split(',').map(Number);
    const primary = `rgb(${r1}, ${g1}, ${b1})`;
    
    let secondary = primary;
    if (sortedColors.length > 1) {
      const [r2, g2, b2] = sortedColors[1][0].split(',').map(Number);
      secondary = `rgb(${r2}, ${g2}, ${b2})`;
    } else {
      // Create a complementary color if only one dominant color
      const hsl = rgbToHsl(r1, g1, b1);
      const compHue = (hsl.h + 180) % 360;
      secondary = `hsl(${compHue}, ${hsl.s}%, ${Math.max(30, hsl.l - 20)}%)`;
    }
    
    return { primary, secondary };
  };

  // Helper function to convert RGB to HSL
  const rgbToHsl = (r: number, g: number, b: number) => {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    
    return { h: h * 360, s: s * 100, l: l * 100 };
  };



  const handleDeleteEvent = async (eventId: string) => {
    console.log('Delete event clicked for ID:', eventId);
    
    // Require authentication
    if (!requireAuth()) {
      console.log('Authentication required failed');
      return;
    }

    // Verify user can delete this event
    const event = userEvents.find(event => event.id === eventId);
    console.log('Found event:', event);
    console.log('User ID:', user?.id);
    console.log('Event user_id:', event?.user_id);
    
    if (!event || !canUserModifyItem(user!.id, event.user_id)) {
      console.log('Permission check failed');
      toast({
        title: "Authorization Error",
        description: "You don't have permission to delete this event",
        variant: "destructive",
      });
      return;
    }

    if (window.confirm('Are you sure you want to delete this event?')) {
      console.log('User confirmed deletion, calling deleteEvent...');
      const result = await deleteEvent(eventId);
      console.log('Delete result:', result);
    }
  };

  const handleEditEvent = (eventId: string) => {
    // Require authentication
    if (!requireAuth()) {
      return;
    }

    // Verify user can edit this event
    const event = userEvents.find(event => event.id === eventId);
    if (!event || !canUserModifyItem(user!.id, event.user_id)) {
      toast({
        title: "Authorization Error",
        description: "You don't have permission to edit this event",
        variant: "destructive",
      });
      return;
    }

    setSelectedEventForEdit(event);
    setShowEditEvent(true);
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (!requireAuth()) return;

    const coupon = myCoupons.find(c => c.id === couponId);
    if (!coupon || !canUserModifyItem(user!.id, coupon.user_id)) {
      toast({
        title: "Authorization Error",
        description: "You don't have permission to delete this coupon",
        variant: "destructive",
      });
      return;
    }

    if (window.confirm('Are you sure you want to delete this coupon?')) {
      deleteCoupon(couponId);
    }
  };

  const handleEditCoupon = (couponId: string) => {
    if (!requireAuth()) return;

    const coupon = myCoupons.find(c => c.id === couponId);
    if (!coupon || !canUserModifyItem(user!.id, coupon.user_id)) {
      toast({
        title: "Authorization Error",
        description: "You don't have permission to edit this coupon",
        variant: "destructive",
      });
      return;
    }

    setSelectedCouponForEdit(coupon);
    setShowEditCoupon(true);
  };

  // Listen for profile updates (when returning from edit page)
  useEffect(() => {
    const handleFocus = () => {
      refetch();
      refetchEvents(); // Also refresh events when page regains focus
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetch, refetchEvents]);

  // Also refetch when returning from navigation
  useEffect(() => {
    refetch();
  }, [id, user?.id]);

  const handleLogout = () => {
    navigate('/login');
  };

  // Message handlers removed - feature disabled

  const handleAddFriend = async () => {
    if (!actualProfileId || isOwnProfile) return;
    
    const success = await addFriend(actualProfileId);
    if (success) {
      // Friend added successfully
    }
  };


  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20" dir="ltr">
        <Header 
          title="Profile"
        />
        <main className="px-4 py-6 pb-20">
          <div className="text-center">Loading...</div>
        </main>
        <BottomNavigation />
      </div>
    );
  }

  // Show error state
  if (error || !profileData) {
    // If no user is authenticated and no valid profile ID, redirect to login
    if (!user && (!actualProfileId || !validateUUID(actualProfileId))) {
      return (
        <div className="min-h-screen bg-background pb-20" dir="ltr">
          <Header 
            title="Profile"
          />
          <main className="px-4 py-6 pb-20">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                Please log in to view profile
              </p>
              <Button onClick={() => navigate('/login')}>
                Login
              </Button>
            </div>
          </main>
          <BottomNavigation />
        </div>
      );
    }
    
    return (
      <div className="min-h-screen bg-background pb-20" dir="ltr">
        <Header 
          title="Profile"
        />
        <main className="px-4 py-6 pb-20">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              {error || 'Profile not found'}
            </p>
            {isOwnProfile && (
              <Button onClick={() => navigate('/profile/edit')}>
                Create Profile
              </Button>
            )}
          </div>
        </main>
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20 font-app" dir="ltr">
      <Header 
        title="Profile"
      />


      <main className="px-4 py-6 pb-20">
        {/* Profile Header */}
        <div className="relative mb-8 p-4 rounded-2xl bg-gradient-to-br from-white to-primary-100 border border-primary-200/30 shadow-card overflow-hidden">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_25%_25%,hsl(var(--primary))_0%,transparent_50%),radial-gradient(circle_at_75%_75%,hsl(var(--coral))_0%,transparent_50%)]"></div>
          
          
          <div className="relative flex items-start gap-4">
            <div className="relative flex-shrink-0 z-10">
              <div className="rounded-full bg-gradient-to-br from-coral to-primary p-0.5 w-[76px] h-[76px]">
                <div className="w-full h-full rounded-full bg-white p-1">
                  <img 
                    src={profileData?.profile_image_url || "/lovable-uploads/c7d65671-6211-412e-af1d-6e5cfdaa248e.png"}
                    alt={profileData?.name || "User"}
                    className="w-[64px] h-[64px] rounded-full object-cover cursor-pointer hover:opacity-80 transition-all hover:scale-105"
                    onClick={() => setShowProfilePicture(true)}
                  />
                </div>
              </div>
            </div>
          
            <div className="flex-1 min-w-0 space-y-3">
              {/* Name and Location */}
              <div className="space-y-2">
                <h1 className="text-xl font-display font-bold bg-gradient-to-r from-primary to-coral bg-clip-text text-transparent">
                  {profileData?.name || "User"}
                </h1>
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary-100 text-secondary-700">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="text-sm">{profileData?.location || "Not specified"}</span>
                  </div>
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-3">
                <p className="text-sm text-neutral-700 font-system leading-relaxed">
                  {profileData?.bio || "No description"}
                </p>
                
                {/* Specialties */}
                {profileData?.specialties && profileData.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {profileData.specialties.map((specialty, index) => (
                      <div key={index} className="rounded-full px-3 py-1 bg-gradient-to-r from-coral to-coral-hover text-coral-foreground shadow-sm border border-coral/20 hover:shadow-md transition-all hover:scale-105">
                        <span className="text-xs font-medium">{specialty}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Actions and Links */}
              <div className="flex flex-col gap-3 pt-2">
                {/* Instagram Link */}
                <div className="flex items-center">
                  {profileData?.username ? (
                    <a 
                      href={profileData.username} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 hover:from-purple-200 hover:to-pink-200 transition-all text-sm font-medium"
                    >
                      <Instagram className="h-3 w-3" />
                      Instagram
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-sm">No Instagram</span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {isOwnProfile && (
                    <>
                       <Button 
                         variant="outline" 
                         size="sm" 
                         className="rounded-full px-3 py-1 h-7 text-xs bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all shadow-md hover:shadow-lg font-medium" 
                         onClick={() => navigate('/profile/edit')}
                       >
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded-full px-3 py-1 h-7 text-xs bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all shadow-md hover:shadow-lg font-medium" 
                        onClick={() => navigate('/settings')}
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        Settings
                      </Button>
                    </>
                  )}
                  
                  {!isOwnProfile && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className={`rounded-full px-3 py-1 h-7 text-xs transition-all shadow-sm hover:shadow-md ${isFriend(actualProfileId || '') ? 'bg-gradient-to-r from-success to-success-foreground text-white border-success hover:from-success-foreground hover:to-success' : 'border-success/30 text-success hover:bg-success hover:text-white'}`}
                        onClick={handleAddFriend}
                      >
                        <UserPlus className="h-3 w-3 mr-1" />
                        {isFriend(actualProfileId || '') ? 'Friends' : 'Add'}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className={`rounded-full px-3 py-1 h-7 text-xs transition-all shadow-sm hover:shadow-md ${isFollowing(actualProfileId || '') ? 'bg-gradient-to-r from-primary to-secondary text-white border-primary hover:from-secondary hover:to-primary' : 'border-primary/30 text-primary hover:bg-primary hover:text-white'}`}
                        onClick={() => actualProfileId && toggleFollow(actualProfileId)}
                        disabled={isToggling}
                      >
                        <Heart className="h-3 w-3 mr-1" />
                        {isFollowing(actualProfileId || '') ? 'Following' : 'Follow'}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>



        {/* My Events Section - Only shown for own profile */}
        {isOwnProfile && userEvents && userEvents.length > 0 && (
          <section className="mb-8 p-5 rounded-xl bg-gradient-to-br from-secondary-50 to-primary-50 border border-secondary-200/30 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-semibold bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent flex items-center gap-2">
                <Calendar className="h-5 w-5 text-secondary" />
                My Events & Meetups
              </h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {userEvents.map((event) => (
                <div key={event.id} className="relative group">
                  <div 
                    className="bg-white rounded-xl border border-primary/20 overflow-hidden hover:shadow-lg hover:border-primary/40 transition-all hover:-translate-y-1 shadow-sm"
                  >
                    <div className="aspect-video bg-muted">
                      {(event as any).video_url ? (
                        <video 
                          src={(event as any).video_url}
                          className="w-full h-full object-cover"
                          muted
                          autoPlay
                          loop
                          playsInline
                          preload="metadata"
                          poster={event.image_url || communityEvent}
                          onLoadedData={(e) => {
                            // Ensure video plays when loaded
                            e.currentTarget.play().catch(() => {
                              console.log('Autoplay blocked, video will play on user interaction');
                            });
                          }}
                          onError={(e) => {
                            // If video fails to load, hide the video element and show fallback image
                            e.currentTarget.style.display = 'none';
                            console.log('Video failed to load:', (event as any).video_url);
                          }}
                        />
                      ) : (
                        <img 
                          src={event.image_url || communityEvent} 
                          alt={event.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-3 py-1 rounded-full font-medium shadow-sm border transition-all ${
                          event.event_type === 'meetup' 
                            ? 'bg-gradient-to-r from-secondary-100 to-secondary-200 text-secondary-800 border-secondary-300' 
                            : 'bg-gradient-to-r from-success-100 to-success-200 text-success-800 border-success-300'
                        }`}>
                          {event.event_type === 'meetup' ? 'Meetup' : 'Event'}
                        </span>
                        {event.date && (
                          <span className="text-xs text-muted-foreground">
                            {getRelativeDay(event.date)}
                          </span>
                        )}
                      </div>
                      <h4 className="font-medium text-sm mb-2 line-clamp-2">{event.title}</h4>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{event.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span>{event.location || 'Location TBD'}</span>
                        </div>
                        {event.price && (
                          <span className="text-sm font-semibold text-primary">₪{event.price}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                   {/* Edit/Delete/Instagram buttons - show on hover */}
                   <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 w-8 p-0 bg-primary-50 hover:bg-primary-100 border border-primary-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditEvent(event.id);
                        }}
                      >
                        <Pencil className="h-3 w-3 text-primary-600" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 w-8 p-0 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 hover:border-red-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEvent(event.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                   </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state for events */}
        {isOwnProfile && userEvents && userEvents.length === 0 && !eventsLoading && (
          <section className="mb-8 p-6 rounded-xl bg-gradient-to-br from-neutral-50 to-primary-50 border border-neutral-200/50 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">My Events & Meetups</h3>
            </div>
            <div className="text-center py-8 bg-white/50 rounded-xl border border-white/80 backdrop-blur-sm">
              <div className="mb-4 p-3 rounded-full bg-primary-100 w-fit mx-auto">
                <Calendar className="h-8 w-8 text-primary" />
              </div>
              <p className="text-neutral-600 mb-4">You haven't created any events or meetups yet</p>
              <Button 
                onClick={() => navigate('/events/create')}
                className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary hover:from-primary-600 hover:to-secondary-600 text-white shadow-md hover:shadow-lg transition-all"
              >
                <Plus className="h-4 w-4" />
                Create Your First Event
              </Button>
            </div>
          </section>
        )}

        {/* My RSVPs Section */}
        {isOwnProfile && userRSVPs && userRSVPs.length > 0 && (
          <section className="mb-8 p-6 rounded-xl bg-gradient-to-br from-neutral-50 to-success-50 border border-neutral-200/50 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold bg-gradient-to-r from-success to-secondary bg-clip-text text-transparent flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                My RSVPs
              </h3>
              <span className="text-sm text-muted-foreground">{userRSVPs.length} event{userRSVPs.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {userRSVPs.map((event) => (
                <div 
                  key={event.id}
                  className="relative bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all group cursor-pointer border border-neutral-200/50"
                  onClick={() => navigate(`/events/${event.id}`)}
                >
                  <div className="aspect-video w-full overflow-hidden bg-neutral-100">
                    {event.video_url ? (
                      <video 
                        src={event.video_url} 
                        className="w-full h-full object-cover"
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        poster={event.image_url}
                        onMouseEnter={(e) => e.currentTarget.play()}
                        onMouseLeave={(e) => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 0;
                        }}
                      />
                    ) : (
                      <img 
                        src={event.image_url || communityEvent} 
                        alt={event.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-3 py-1 rounded-full font-medium shadow-sm border transition-all ${
                        event.event_type === 'meetup' 
                          ? 'bg-gradient-to-r from-secondary-100 to-secondary-200 text-secondary-800 border-secondary-300' 
                          : 'bg-gradient-to-r from-success-100 to-success-200 text-success-800 border-success-300'
                      }`}>
                        {event.event_type === 'meetup' ? 'Meetup' : 'Event'}
                      </span>
                      {event.date && (
                        <span className="text-xs text-muted-foreground">
                          {getRelativeDay(event.date)}
                        </span>
                      )}
                    </div>
                    <h4 className="font-medium text-sm mb-2 line-clamp-2">{event.title}</h4>
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{event.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{event.location || 'Location TBD'}</span>
                      </div>
                      {event.price && (
                        <span className="text-sm font-semibold text-primary">₪{event.price}</span>
                      )}
                    </div>
                  </div>
                  
                  {/* RSVP Badge */}
                  <div className="absolute top-2 left-2">
                    <div className="bg-success text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 shadow-md">
                      <CheckCircle className="h-3 w-3" />
                      Going
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}


        {/* Logout Button */}
        {isOwnProfile && (
          <div className="mt-8 pt-6 border-t border-primary-200/50">
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 text-destructive border-destructive/30 hover:bg-gradient-to-r hover:from-destructive hover:to-destructive-foreground hover:text-white transition-all shadow-sm hover:shadow-md rounded-xl py-3"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        )}

      </main>
      
      <BottomNavigation />
      <ProfilePictureViewer
        isOpen={showProfilePicture}
        onClose={() => setShowProfilePicture(false)}
        imageUrl={profileData?.profile_image_url || ""}
        userName={profileData?.name || "User"}
        userId={actualProfileId}
      />
      <FeedImageViewer
        isOpen={showFeedImages}
        onClose={() => {
          setShowFeedImages(false);
          setSelectedImageId(null);
        }}
        images={imagePosts}
        initialImageId={selectedImageId}
      />
      <EditEventPopup 
        isOpen={showEditEvent}
        onClose={() => {
          setShowEditEvent(false);
          setSelectedEventForEdit(null);
        }}
        eventData={selectedEventForEdit}
        onSuccess={() => {
          refetchEvents();
          setShowEditEvent(false);
          setSelectedEventForEdit(null);
        }}
      />
      <EditCouponModal
        isOpen={showEditCoupon}
        onClose={() => {
          setShowEditCoupon(false);
          setSelectedCouponForEdit(null);
        }}
        coupon={selectedCouponForEdit}
        onUpdate={() => {
          refreshCoupons();
          setShowEditCoupon(false);
          setSelectedCouponForEdit(null);
        }}
      />
      
    </div>
  );
};

export default ProfilePage;