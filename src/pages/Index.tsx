import BottomNavigation from "@/components/BottomNavigation";
import Header from "@/components/Header";
import DesktopHeader from "@/components/DesktopHeader";
import MoodFilterStrip from "@/components/MoodFilterStrip";
import FilterPopup from "@/components/FilterPopup";
import EventPopup from "@/components/EventPopup";
import EventVerticalPopup from "@/components/EventVerticalPopup";
import MarketplacePopup from "@/components/MarketplacePopup";
import MeetupVerticalPopup from "@/components/MeetupVerticalPopup";
import NotificationsPopup from "@/components/NotificationsPopup";
import OptimizedProfileCard from "@/components/OptimizedProfileCard";
import ScrollAnimatedCard from "@/components/ScrollAnimatedCard";
import UniformCard from "@/components/UniformCard";
import FriendMeetupPopup from "@/components/FriendMeetupPopup";
import CreateEventPopup from "@/components/CreateEventPopup";
import EventsFilterPopup, { EventFilters } from "@/components/EventsFilterPopup";
import AIAssistantButton from "@/components/AIAssistantButton";
import { getRelativeDay } from "@/utils/dateUtils";
import SectionHeader from "@/components/SectionHeader";
import FastLoadingSkeleton from "@/components/FastLoadingSkeleton";
import { Button } from "@/components/ui/button";
import { Bell, Users, Plus, Search, Filter, MapPin, Calendar, MessageCircle, Heart, Share2, UserPlus, MessageSquare, ChevronRight, Clock, Star, ArrowRight, Map as MapIcon } from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNewItem } from "@/contexts/NewItemContext";
import { useOptimizedHomepage } from "@/hooks/useOptimizedHomepage";
import { useEvents } from "@/hooks/useEvents";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { useFollowing } from "@/hooks/useFollowing";
import profile1 from "@/assets/profile-1.jpg";
import profile2 from "@/assets/profile-2.jpg";
import profile3 from "@/assets/profile-3.jpg";
import coffeeShop from "@/assets/coffee-shop.jpg";
import vintageStore from "@/assets/vintage-store.jpg";
import communityEvent from "@/assets/community-event.jpg";
import dressItem from "@/assets/dress-item.jpg";
import furnitureItem from "@/assets/furniture-item.jpg";
import artPiece1 from "@/assets/canvas-art-1.jpg";
import artPiece2 from "@/assets/canvas-art-2.jpg";
import artPiece3 from "@/assets/canvas-art-3.jpg";
import artPiece4 from "@/assets/canvas-art-4.jpg";
const Index = () => {
  const {
    t,
    language
  } = useLanguage();
  const {
    setRefreshCallback,
    openNewItem
  } = useNewItem();
  const {
    user
  } = useAuth();
  const {
    profile: currentUserProfile
  } = useProfile(user?.id);
  const navigate = useNavigate();

  // Listen for navigation events from MarketplacePopup, MeetupPopup, and EventPopup
  useEffect(() => {
    const handleNavigateToItem = (event: CustomEvent) => {
      const itemData = event.detail;
      if (itemData) {
        setSelectedMarketplaceItem(itemData);
        setIsMarketplacePopupOpen(true);
      }
    };
    const handleNavigateToMeetup = (event: CustomEvent) => {
      const meetupData = event.detail;
      if (meetupData) {
        setSelectedMeetupItem(meetupData);
        setIsMeetupPopupOpen(true);
      }
    };
    const handleNavigateToEvent = (event: CustomEvent) => {
      const eventData = event.detail;
      if (eventData) {
        setSelectedEventItem(eventData);
        setIsEventVerticalPopupOpen(true);
      }
    };
    window.addEventListener('navigateToItem', handleNavigateToItem);
    window.addEventListener('navigateToMeetup', handleNavigateToMeetup);
    window.addEventListener('navigateToEvent', handleNavigateToEvent);
    return () => {
      window.removeEventListener('navigateToItem', handleNavigateToItem);
      window.removeEventListener('navigateToMeetup', handleNavigateToMeetup);
      window.removeEventListener('navigateToEvent', handleNavigateToEvent);
    };
  }, []);

  // Use optimized homepage hook with React Query caching
  const {
    profiles,
    businessProfiles,
    totalUsersCount,
    databaseEvents,
    recommendationItems,
    artItems,
    apartmentItems,
    businessItems,
    loading,
    error,
    refetch,
    preloadData
  } = useOptimizedHomepage();

  // Fetch events separately from the new events table
  const [eventFilter, setEventFilter] = useState<'all' | 'following'>('all');
  const {
    events: realEvents = [],
    refetch: refetchEvents
  } = useEvents('event', eventFilter === 'following');
  const {
    following,
    isFollowing
  } = useFollowing();

  // Preload data immediately on component mount for instant loading
  useEffect(() => {
    preloadData();
  }, []); // Removed preloadData dependency

  // Mood filter state
  const [selectedMoodFilter, setSelectedMoodFilter] = useState<string>("all");

  // Popup states
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isEventPopupOpen, setIsEventPopupOpen] = useState(false);
  const [selectedEventItem, setSelectedEventItem] = useState<any>(null);
  const [isEventVerticalPopupOpen, setIsEventVerticalPopupOpen] = useState(false);
  const [selectedMarketplaceItem, setSelectedMarketplaceItem] = useState<any>(null);
  const [isMarketplacePopupOpen, setIsMarketplacePopupOpen] = useState(false);
  const [selectedMeetupItem, setSelectedMeetupItem] = useState<any>(null);
  const [isMeetupPopupOpen, setIsMeetupPopupOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showFriendMeetup, setShowFriendMeetup] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [createEventType, setCreateEventType] = useState<'event' | 'meetup'>('event');
  
  // Event filter states
  const [showEventFilters, setShowEventFilters] = useState(false);
  const [eventFilters, setEventFilters] = useState<EventFilters>({
    search: "",
    neighborhood: "All Neighborhoods",
    priceRange: "All Prices",
    mood: "All",
    dateRange: "All"
  });

  // Set refresh callback for new items - stabilized with useCallback
  const refreshCallback = useCallback(() => {
    refetch();
    refetchEvents();
  }, [refetch, refetchEvents]);
  useEffect(() => {
    setRefreshCallback(() => refreshCallback);
  }, [setRefreshCallback, refreshCallback]);

  // Global event listener for event updates
  useEffect(() => {
    const handleEventUpdate = () => {
      refetchEvents();
    };
    window.addEventListener('eventUpdated', handleEventUpdate);
    return () => window.removeEventListener('eventUpdated', handleEventUpdate);
  }, []); // Removed unstable dependencies

  const [userStoryCounts, setUserStoryCounts] = useState<{
    [key: string]: number;
  }>({});

  // Completely disable story fetching for maximum loading speed
  useEffect(() => {
    // Stories are disabled for faster initial loading
    // This eliminates the multiple story API calls seen in network logs
    return;
  }, []);

  // Memoize display profiles with mood filtering
  const displayProfiles = useMemo(() => {
    const profilesList = [];

    // Always show current user first if logged in - immediate display
    if (user) {
      const currentUserDisplayProfile = {
        id: user.id,
        name: currentUserProfile?.name || user.email?.split('@')[0] || 'You',
        image: currentUserProfile?.profile_image_url || user.user_metadata?.avatar_url || "/lovable-uploads/c7d65671-6211-412e-af1d-6e5cfdaa248e.png",
        isCurrentUser: true,
        hasStories: false // Skip stories for performance
      };
      profilesList.push(currentUserDisplayProfile);
    }

    // Always show other profiles regardless of mood filter
    if (profiles.length > 0) {
      const filteredProfiles = profiles.filter(p => p.id !== user?.id && p.name?.toLowerCase() !== 'juani');
      
      const otherProfiles = filteredProfiles.slice(0, 6) // Reduced to 6 for faster loading
      .map(p => ({
        id: p.id,
        name: p.name || "User",
        image: p.image || "/lovable-uploads/c7d65671-6211-412e-af1d-6e5cfdaa248e.png",
        hasStories: false,
        // Skip stories check for performance
        isCurrentUser: false
      }));
      profilesList.push(...otherProfiles);
    }
    return profilesList;
  }, [user, currentUserProfile, profiles, selectedMoodFilter]);

  // Filter events based on applied filters
  const filteredEvents = useMemo(() => {
    if (!realEvents.length) return [];
    
    return realEvents.filter(event => {
      // Search filter - case insensitive
      if (eventFilters.search.trim()) {
        const query = eventFilters.search.toLowerCase().trim();
        const matchesSearch = event.title.toLowerCase().includes(query) ||
                             event.description?.toLowerCase().includes(query) ||
                             event.location?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Neighborhood filter
      if (eventFilters.neighborhood !== "All Neighborhoods") {
        if (!event.location?.includes(eventFilters.neighborhood)) return false;
      }

      // Price filter
      if (eventFilters.priceRange !== "All Prices") {
        const priceStr = event.price || "0";
        const price = typeof priceStr === 'string' ? parseFloat(priceStr.replace(/[^\d.]/g, '')) || 0 : priceStr;
        switch (eventFilters.priceRange) {
          case "Free":
            if (price !== 0) return false;
            break;
          case "Up to ₪50":
            if (price === 0 || price > 50) return false;
            break;
          case "₪50-100":
            if (price <= 50 || price > 100) return false;
            break;
          case "₪100-200":
            if (price <= 100 || price > 200) return false;
            break;
          case "Over ₪200":
            if (price <= 200) return false;
            break;
        }
      }

      // Mood filter
      if (eventFilters.mood !== "All") {
        const eventContent = `${event.title} ${event.description || ''}`.toLowerCase();
        const moodKeywords = {
          'Chill': ['chill', 'relax', 'coffee', 'cafe', 'calm', 'peaceful', 'casual', 'lounge'],
          'Go Out': ['party', 'night', 'club', 'bar', 'dance', 'nightlife', 'celebration', 'festival'],
          'Romantic': ['romantic', 'date', 'couple', 'love', 'dinner', 'wine', 'sunset', 'intimate'],
          'Active': ['sport', 'fitness', 'gym', 'run', 'bike', 'hike', 'workout', 'active', 'exercise'],
          'Creative': ['art', 'creative', 'workshop', 'paint', 'music', 'craft', 'design', 'artistic'],
          'Wellness': ['wellness', 'yoga', 'meditation', 'spa', 'health', 'mindfulness', 'therapy'],
          'Music': ['music', 'concert', 'live', 'band', 'song', 'artist', 'performance', 'sound', 'audio']
        };
        
        const keywords = moodKeywords[eventFilters.mood as keyof typeof moodKeywords] || [];
        const hasMatchingKeyword = keywords.some(keyword => eventContent.includes(keyword));
        
        if (!hasMatchingKeyword) return false;
      }

      // Date filter
      if (eventFilters.dateRange !== "All") {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
        const eventDate = event.date ? new Date(event.date) : null;
        
        if (!eventDate) return false;
        
        eventDate.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
        
        switch (eventFilters.dateRange) {
          case "Today":
            if (eventDate.toDateString() !== today.toDateString()) return false;
            break;
          case "Tomorrow":
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            if (eventDate.toDateString() !== tomorrow.toDateString()) return false;
            break;
          case "This Week":
            const weekFromNow = new Date(today);
            weekFromNow.setDate(today.getDate() + 7);
            if (eventDate < today || eventDate > weekFromNow) return false;
            break;
          case "This Month":
            const monthFromNow = new Date(today);
            monthFromNow.setMonth(today.getMonth() + 1);
            if (eventDate < today || eventDate > monthFromNow) return false;
            break;
        }
      }

      return true;
    });
  }, [realEvents, eventFilters]);

  // All business, event, and artwork data now comes from the database
  // Static data has been removed to show only real content

  // Memoize event handlers to prevent unnecessary re-renders
  const handleEventClick = useCallback((event: any, allEvents?: any[], currentIndex?: number) => {
    const eventDetails = {
      id: event.id,
      title: event.title,
      image: event.image_url || event.image,
      price: event.price,
      description: event.description || event.title,
      date: event.date,
      time: event.time,
      location: event.location,
      organizer: event.organizer,
      allEvents: allEvents,
      currentIndex: currentIndex || 0
    };
    setSelectedEventItem(eventDetails);
    setIsEventVerticalPopupOpen(true);
  }, []);

  // Meetup click handler for vertical scrolling popup - REMOVED since moved to MeetupsPage
  const handleMarketplaceClick = useCallback((item: any, itemType?: string, items?: any[], currentIndex?: number) => {
    const itemDetails = {
      id: item.id,
      title: item.title,
      image: item.image_url || item.image,
      price: item.price ? `₪${item.price}` : undefined,
      description: item.description || `${item.title} in excellent condition.`,
      seller: {
        name: "Yael Shein",
        image: profile1,
        location: item.location || "Tel Aviv"
      },
      condition: "Like New",
      type: itemType || 'marketplace'
    };
    setSelectedMarketplaceItem({
      ...itemDetails,
      allItems: items || [item],
      currentIndex: currentIndex || 0
    });
    setIsMarketplacePopupOpen(true);
  }, []);
  return <div className="min-h-screen bg-black" dir="ltr">
      {/* Mobile Header */}
      <div className="lg:hidden">
        <Header title={t('common.home')} />
      </div>
      
      {/* Desktop Header */}
      <DesktopHeader title={t('common.home')} />
      
      
      {/* Mood Filter Strip */}
      <MoodFilterStrip onFilterChange={setSelectedMoodFilter} showTitle={false} />
      
      <main className="px-3 lg:px-6 py-3 lg:py-6 space-y-5 lg:space-y-10 pb-24 lg:pb-8 w-full max-w-md lg:max-w-none mx-auto lg:mx-0">
        {/* AI Assistant Toggle Bar */}
        <AIAssistantButton variant="toggle" />
        
        {/* Business Profiles Section - Only show if there are business profiles */}
        {businessProfiles && businessProfiles.length > 0 && (
          <section className="-mb-1 lg:-mb-1">
            <div className="px-1 lg:px-5 mb-3">
              <h3 className="title-section-white">organizers & businesses</h3>
            </div>
            <div className="relative">
              <div className="flex overflow-x-auto gap-6 pb-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40" dir="ltr" style={{
              scrollBehavior: 'smooth'
            }}>
                {loading ? <FastLoadingSkeleton type="profiles" /> : businessProfiles.map((profile, index) => <OptimizedProfileCard key={profile.id} id={profile.id} image={profile.image} name={profile.name} className={`flex-shrink-0 min-w-[90px] animate-fade-in`} style={{
                animationDelay: `${Math.min(index * 0.03, 0.3)}s`
              } as React.CSSProperties} isCurrentUser={false} />)}
              </div>
            </div>
          </section>
        )}


        {/* Events Section - Vertical Carousel */}
        <section className="home-section">
          <div className="flex justify-between items-center mb-4">
            <h2 className="title-section">
            EVENTS
            </h2>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/events')}
                className="text-xs px-3 py-1 rounded-full border-2 border-primary bg-transparent text-black hover:border-primary/80 gap-1"
              >
                All
                <ArrowRight className="h-3 w-3 text-black" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
              setCreateEventType('event');
              setShowCreateEvent(true);
            }} className="text-xs px-2 py-1 rounded-full border-2 border-primary bg-transparent text-foreground hover:border-primary/80 gap-1">
                <Plus className="h-3 w-3 text-black" />
              </Button>
            </div>
          </div>
          
          {loading ? <FastLoadingSkeleton type="cards" count={3} /> : filteredEvents.length === 0 ? <div className="text-center py-6 text-muted-foreground">
              <p>No events available at the moment</p>
            </div> : <div className="flex flex-col items-center space-y-8 p-4 overflow-visible">
              {filteredEvents.map((event, index) => <ScrollAnimatedCard key={`event-${event.id}`} index={index}>
                   <UniformCard 
                     id={event.id} 
                     image={event.image_url || communityEvent} 
                     video={(event as any).video_url} 
                     title={event.title} 
                     subtitle={event.location || 'Tel Aviv'} 
                     price={event.price} 
                     date={getRelativeDay(event.date)} 
                     type="event" 
                     uploader={{
                       ...event.uploader,
                       user_id: event.user_id
                     }} 
                     onProfileClick={userId => navigate(`/profile/${userId}`)} 
                     className="scale-90"
                     onClick={() => handleEventClick({
              id: event.id,
              title: event.title,
              description: event.description || event.title,
              date: event.date || 'Date to be determined',
              time: event.time || 'Time to be determined',
              location: event.location || 'Tel Aviv',
              price: event.price,
              image: event.image_url || communityEvent,
              video: (event as any).video_url,
              organizer: {
                name: event.uploader?.name || "Event Organizer",
                image: event.uploader?.image || profile1
              }
            }, [...filteredEvents], index)} showFavoriteButton={true} favoriteData={{
              id: event.id,
              title: event.title,
              description: event.description || event.title,
              image: event.image_url,
              type: 'event'
            }} />
                </ScrollAnimatedCard>)}
            </div>}
        </section>



      </main>
      
      {/* Conditional Popup Rendering for Performance */}
      {isFilterOpen && <FilterPopup isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} />}

      {isEventPopupOpen && selectedEvent && <EventPopup isOpen={isEventPopupOpen} onClose={() => setIsEventPopupOpen(false)} eventId={selectedEvent?.id} event={selectedEvent} />}

      {isEventVerticalPopupOpen && selectedEventItem && <EventVerticalPopup isOpen={isEventVerticalPopupOpen} onClose={() => setIsEventVerticalPopupOpen(false)} event={selectedEventItem} />}

      {isMarketplacePopupOpen && selectedMarketplaceItem && <MarketplacePopup isOpen={isMarketplacePopupOpen} onClose={() => setIsMarketplacePopupOpen(false)} item={selectedMarketplaceItem} />}

      {isMeetupPopupOpen && selectedMeetupItem && <MeetupVerticalPopup isOpen={isMeetupPopupOpen} onClose={() => setIsMeetupPopupOpen(false)} item={selectedMeetupItem} />}

      {showFriendMeetup && <FriendMeetupPopup isOpen={showFriendMeetup} onClose={() => setShowFriendMeetup(false)} />}

      {showCreateEvent && <CreateEventPopup isOpen={showCreateEvent} onClose={() => setShowCreateEvent(false)} initialEventType={createEventType} onEventCreated={() => {
      refetchEvents();
      refetch();
    }} />}

      {/* Events Filter Popup */}
      <EventsFilterPopup 
        isOpen={showEventFilters}
        onClose={() => setShowEventFilters(false)}
        onFiltersApply={setEventFilters}
        currentFilters={eventFilters}
      />
      
      <BottomNavigation />
    </div>;
};
export default Index;