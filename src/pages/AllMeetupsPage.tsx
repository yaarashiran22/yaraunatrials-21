import { useState, useMemo, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import MeetupVerticalPopup from "@/components/MeetupVerticalPopup";
import NotificationsPopup from "@/components/NotificationsPopup";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, ArrowLeft, Bell } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEvents } from "@/hooks/useEvents";
import communityEvent from "@/assets/community-event.jpg";
import profile1 from "@/assets/profile-1.jpg";

// Predefined neighborhoods - memoized for performance
const neighborhoods = ["All Neighborhoods", "Palermo", "Palermo Soho", "Palermo Hollywood", "Palermo Chico", "Recoleta", "San Telmo", "Villa Crespo", "Caballito"] as const;

// Price filter options - memoized for performance
const priceOptions = ["All Prices", "Free", "Up to ₪50", "₪50-100", "₪100-200", "Over ₪200"] as const;

// Mood filter options
const moodOptions = ["All", "Chill", "Go Out", "Romantic", "Active", "Creative", "Wellness", "Sightseeing"] as const;

// Date filter options
const dateOptions = ["All", "Today", "Tomorrow", "This Week", "This Month"] as const;
const AllMeetupsPage = () => {
  const {
    t
  } = useLanguage();
  const navigate = useNavigate();
  const {
    events: meetups,
    loading
  } = useEvents('meetup');

  // State management
  const [selectedMeetup, setSelectedMeetup] = useState<any>(null);
  const [isMeetupPopupOpen, setIsMeetupPopupOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState("All Neighborhoods");
  const [priceFilter, setPriceFilter] = useState("All Prices");
  const [moodFilter, setMoodFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");

  // Optimized filtering with useMemo for better performance
  const filteredMeetups = useMemo(() => {
    if (!meetups.length) return [];
    return meetups.filter(meetup => {
      // Search filter - case insensitive
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesSearch = meetup.title.toLowerCase().includes(query) || meetup.description?.toLowerCase().includes(query) || meetup.location?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Neighborhood filter
      if (selectedNeighborhood !== "All Neighborhoods") {
        if (!meetup.location?.includes(selectedNeighborhood)) return false;
      }

      // Price filter
      if (priceFilter !== "All Prices") {
        const priceStr = meetup.price || "0";
        const price = typeof priceStr === 'string' ? parseFloat(priceStr.replace(/[^\d.]/g, '')) || 0 : priceStr;
        switch (priceFilter) {
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

      // Mood filter - use description as fallback for now
      if (moodFilter !== "All") {
        // Check if meetup description or title contains mood-related keywords
        const meetupContent = `${meetup.title} ${meetup.description || ''}`.toLowerCase();
        const moodKeywords = {
          'Chill': ['chill', 'relax', 'coffee', 'cafe', 'calm', 'peaceful', 'casual', 'lounge'],
          'Go Out': ['party', 'night', 'club', 'bar', 'dance', 'nightlife', 'celebration', 'festival'],
          'Romantic': ['romantic', 'date', 'couple', 'love', 'dinner', 'wine', 'sunset', 'intimate'],
          'Active': ['sport', 'fitness', 'gym', 'run', 'bike', 'hike', 'workout', 'active', 'exercise'],
          'Creative': ['art', 'creative', 'workshop', 'paint', 'music', 'craft', 'design', 'artistic'],
          'Wellness': ['wellness', 'yoga', 'meditation', 'spa', 'health', 'mindfulness', 'therapy'],
          'Music': ['music', 'concert', 'live', 'band', 'song', 'artist', 'performance', 'sound', 'audio']
        };
        const keywords = moodKeywords[moodFilter as keyof typeof moodKeywords] || [];
        const hasMatchingKeyword = keywords.some(keyword => meetupContent.includes(keyword));
        if (!hasMatchingKeyword) return false;
      }

      // Date filter
      if (dateFilter !== "All") {
        const today = new Date();
        const meetupDate = meetup.date ? new Date(meetup.date) : null;
        if (!meetupDate) return false;
        switch (dateFilter) {
          case "Today":
            if (meetupDate.toDateString() !== today.toDateString()) return false;
            break;
          case "Tomorrow":
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            if (meetupDate.toDateString() !== tomorrow.toDateString()) return false;
            break;
          case "This Week":
            const weekFromNow = new Date(today);
            weekFromNow.setDate(today.getDate() + 7);
            if (meetupDate < today || meetupDate > weekFromNow) return false;
            break;
          case "This Month":
            const monthFromNow = new Date(today);
            monthFromNow.setMonth(today.getMonth() + 1);
            if (meetupDate < today || meetupDate > monthFromNow) return false;
            break;
        }
      }
      return true;
    });
  }, [meetups, searchQuery, selectedNeighborhood, priceFilter, moodFilter, dateFilter]);

  // Optimized meetup handlers with useCallback
  const handleMeetupClick = useCallback((meetup: any) => {
    setSelectedMeetup({
      id: meetup.id,
      title: meetup.title,
      description: meetup.description || meetup.title,
      date: 'Date to be determined',
      time: 'Time to be determined',
      location: meetup.location || 'Tel Aviv',
      image: meetup.image_url || communityEvent,
      organizer: {
        name: "Meetup Organizer",
        image: profile1
      }
    });
    setIsMeetupPopupOpen(true);
  }, []);
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedNeighborhood("All Neighborhoods");
    setPriceFilter("All Prices");
    setMoodFilter("All");
    setDateFilter("All");
  }, []);
  return <div className="min-h-screen bg-background pb-20">
      {/* Custom Header with Back Button */}
      <div className="flex items-center p-4 bg-background border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="p-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">All Meetups</h1>
        </div>
      </div>
      
      
      {/* Search and Filter Section */}
      <div className="px-4 py-4 space-y-4 bg-card/30 backdrop-blur-sm border-b">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input placeholder="Search meetups..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 pr-4" />
        </div>

        {/* Filter Options - Always Visible */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-2 block">Neighborhood</label>
              <Select value={selectedNeighborhood} onValueChange={setSelectedNeighborhood}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {neighborhoods.map(neighborhood => <SelectItem key={neighborhood} value={neighborhood}>
                      {neighborhood}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Price</label>
              <Select value={priceFilter} onValueChange={setPriceFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priceOptions.map(option => <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-2 block">Mood</label>
              <Select value={moodFilter} onValueChange={setMoodFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {moodOptions.map(option => <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Date</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dateOptions.map(option => <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {(selectedNeighborhood !== "All Neighborhoods" || priceFilter !== "All Prices" || moodFilter !== "All" || dateFilter !== "All") && <div className="flex justify-center">
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                Clear Filters
              </Button>
            </div>}
        </div>
      </div>

      {/* Results Section */}
      <main className="px-4 py-4">
        <div className="mb-4 text-sm text-muted-foreground">
          Found {filteredMeetups.length} meetups
        </div>

        {loading ? <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[...Array(6)].map((_, index) => <div key={index} className="w-full aspect-[3/4] bg-muted rounded-lg animate-pulse"></div>)}
          </div> : filteredMeetups.length === 0 ? <div className="text-center py-16">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-lg font-semibold mb-2">No meetups found</h3>
            <p className="text-muted-foreground mb-4">Try changing your filters or search</p>
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div> : <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filteredMeetups.map(meetup => <MeetupCard key={meetup.id} meetup={meetup} onClick={() => handleMeetupClick(meetup)} />)}
          </div>}
      </main>

      <MeetupVerticalPopup isOpen={isMeetupPopupOpen} onClose={() => setIsMeetupPopupOpen(false)} item={selectedMeetup} />

      <NotificationsPopup isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
      
      <BottomNavigation />
    </div>;
};

// Memoized MeetupCard component with enhanced UI
const MeetupCard = memo(({
  meetup,
  onClick
}: {
  meetup: any;
  onClick: () => void;
}) => (
  <div 
    onClick={onClick} 
    className="group cursor-pointer bg-card rounded-2xl overflow-hidden shadow-sm border border-border/50 hover:shadow-xl hover:shadow-primary/10 transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1 relative"
  >
    {/* Image Container with Overlay */}
    <div className="aspect-[3/4] w-full relative overflow-hidden">
      {meetup.image_url ? (
        <img 
          src={meetup.image_url} 
          alt={meetup.title} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
          loading="lazy" 
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-muted via-muted/80 to-muted/60 flex items-center justify-center relative">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center backdrop-blur-sm">
            <div className="text-2xl font-bold text-primary">👥</div>
          </div>
        </div>
      )}
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Price Badge */}
      <div className="absolute top-3 right-3">
        {meetup.price && meetup.price > 0 ? (
          <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-bold shadow-lg backdrop-blur-sm">
            ₪{meetup.price}
          </div>
        ) : (
          <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg backdrop-blur-sm">
            Free
          </div>
        )}
      </div>
      
      {/* Hover Action Indicator */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100">
        <div className="bg-white/90 backdrop-blur-sm rounded-full p-3 shadow-xl">
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
    
    {/* Enhanced Content Section */}
    <div className="p-4 space-y-2">
      <h3 className="font-bold text-base leading-tight text-card-foreground group-hover:text-primary transition-colors duration-300 line-clamp-2">
        {meetup.title}
      </h3>
      
      {meetup.location && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <div className="w-3 h-3 rounded-full bg-muted flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
          </div>
          <p className="truncate flex-1">{meetup.location}</p>
        </div>
      )}
      
      {/* Enhanced Metadata */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-green-600 font-medium">Available</span>
        </div>
        
        {/* Join Button */}
        <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
          <div className="bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 rounded-lg text-xs font-bold transition-colors">
            Join
          </div>
        </div>
      </div>
    </div>
    
    {/* Subtle Border Glow Effect */}
    <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
      <div className="absolute inset-0 rounded-2xl border-2 border-primary/20 shadow-lg shadow-primary/10"></div>
    </div>
  </div>
));
export default AllMeetupsPage;