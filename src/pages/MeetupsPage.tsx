import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import DesktopHeader from '@/components/DesktopHeader';
import BottomNavigation from '@/components/BottomNavigation';
import MoodFilterStrip from '@/components/MoodFilterStrip';
import { Button } from '@/components/ui/button';
import { Users, Plus, Filter } from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useOptimizedHomepage } from '@/hooks/useOptimizedHomepage';
import FastLoadingSkeleton from '@/components/FastLoadingSkeleton';
import ScrollAnimatedCard from '@/components/ScrollAnimatedCard';
import UniformCard from '@/components/UniformCard';
import OptimizedProfileCard from '@/components/OptimizedProfileCard';
import { getRelativeDay } from '@/utils/dateUtils';
import MeetupVerticalPopup from '@/components/MeetupVerticalPopup';
import CreateEventPopup from '@/components/CreateEventPopup';
import MeetupFiltersPopup from '@/components/MeetupFiltersPopup';
import communityEvent from '@/assets/community-event.jpg';
import profile1 from '@/assets/profile-1.jpg';

const MeetupsPage = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { profile: currentUserProfile } = useProfile(user?.id);
  const navigate = useNavigate();
  
  // Use optimized homepage hook for profiles data
  const {
    profiles,
    loading: profilesLoading
  } = useOptimizedHomepage();
  
  // Meetup states
  const [meetupFilter, setMeetupFilter] = useState<'all' | 'friends'>('all');
  const [selectedMoodFilter, setSelectedMoodFilter] = useState<string>('all');
  const [selectedMeetupItem, setSelectedMeetupItem] = useState<any>(null);
  const [isMeetupPopupOpen, setIsMeetupPopupOpen] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showMeetupFilter, setShowMeetupFilter] = useState(false);
  
  // Fetch meetups
  const {
    events: meetupEvents = [],
    refetch: refetchMeetups
  } = useEvents('meetup', meetupFilter === 'friends');

  // Mood filter handler
  const handleMoodFilterChange = (filterId: string) => {
    setSelectedMoodFilter(filterId);
    // TODO: Could implement mood-based filtering here if needed
  };

  // Memoize display profiles for meetup organizers
  const displayProfiles = useMemo(() => {
    const profilesList = [];

    // Always show current user first if logged in
    if (user) {
      const currentUserDisplayProfile = {
        id: user.id,
        name: currentUserProfile?.name || user.email?.split('@')[0] || 'You',
        image: currentUserProfile?.profile_image_url || user.user_metadata?.avatar_url || "/lovable-uploads/c7d65671-6211-412e-af1d-6e5cfdaa248e.png",
        isCurrentUser: true,
        hasStories: false
      };
      profilesList.push(currentUserDisplayProfile);
    }

    // Show all other profiles as potential meetup organizers
    if (profiles.length > 0) {
      const filteredProfiles = profiles.filter(p => p.id !== user?.id && p.name?.toLowerCase() !== 'juani');
      
      const otherProfiles = filteredProfiles.map(p => ({
        id: p.id,
        name: p.name || "User",
        image: p.image || "/lovable-uploads/c7d65671-6211-412e-af1d-6e5cfdaa248e.png",
        hasStories: false,
        isCurrentUser: false
      }));
      profilesList.push(...otherProfiles);
    }
    return profilesList;
  }, [user, currentUserProfile, profiles, selectedMoodFilter]);

  // Meetup click handler for vertical scrolling popup
  const handleMeetupClick = useCallback((meetup: any, allMeetups?: any[], currentIndex?: number) => {
    const meetupDetails = {
      id: meetup.id,
      title: meetup.title,
      image: meetup.image_url || meetup.image,
      price: meetup.price || 'Free',
      description: meetup.description || meetup.title,
      neighborhood: meetup.neighborhood || meetup.location,
      seller: {
        id: meetup.uploader?.id,
        name: meetup.uploader?.name || meetup.organizer?.name || "Organizer",
        image: meetup.uploader?.image || meetup.organizer?.image || profile1,
        location: meetup.uploader?.location || meetup.location || "Tel Aviv"
      },
      type: 'meetup',
      allItems: allMeetups,
      currentIndex: currentIndex || 0
    };
    setSelectedMeetupItem(meetupDetails);
    setIsMeetupPopupOpen(true);
  }, []);

  return (
    <div className="min-h-screen bg-background" dir="ltr">
      {/* Mobile Header */}
      <div className="lg:hidden">
        <Header title="Meetups" />
      </div>
      
      {/* Desktop Header */}
      <DesktopHeader title="Meetups" />
      
      {/* Mood Filter Strip */}
      <MoodFilterStrip onFilterChange={handleMoodFilterChange} showTitle={false} />
      
      <main className="px-3 lg:px-6 py-3 lg:py-6 space-y-5 lg:space-y-10 pb-24 lg:pb-8 w-full max-w-md lg:max-w-none mx-auto lg:mx-0">
        {/* Community Members Section - Horizontal Carousel */}
        <section className="-mb-1 lg:-mb-1">
          <div className="px-1 lg:px-5 mb-3">
            <h3 className="title-section-white">popular hosts</h3>
          </div>
          <div className="relative">
            <div className="flex overflow-x-auto gap-2 pb-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40" dir="ltr" style={{
            scrollBehavior: 'smooth'
          }}>
              {profilesLoading ? <FastLoadingSkeleton type="profiles" /> : displayProfiles.length > 0 ? displayProfiles.map((profile, index) => <OptimizedProfileCard key={profile.id} id={profile.id} image={profile.image} name={profile.name} className={`flex-shrink-0 min-w-[90px] animate-fade-in ${index === 0 && user?.id === profile.id ? '' : ''}`} style={{
              animationDelay: `${Math.min(index * 0.03, 0.3)}s`
            } as React.CSSProperties} isCurrentUser={user?.id === profile.id} />) : <div className="text-center py-8 text-muted-foreground w-full">No registered users yet</div>}
            </div>
          </div>
        </section>

        {/* Meetups Section - Vertical Carousel */}
        <section className="home-section">
          <div className="flex justify-between items-center mb-4">
            <h2 className="title-section">
              wanna meet up
            </h2>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowMeetupFilter(true)}
                className="text-xs px-2 py-1 rounded-full border-2 border-primary bg-transparent text-foreground hover:border-primary/80 gap-1"
              >
                <Filter className="h-3 w-3 text-black" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowCreateEvent(true)} className="text-xs px-2 py-1 rounded-full border-2 border-primary bg-transparent text-foreground hover:border-primary/80 gap-1">
                <Plus className="h-3 w-3 text-black" />
              </Button>
            </div>
          </div>
          
          {meetupEvents.length === 0 ? <div className="text-center py-6 text-muted-foreground">
              <p>No meetups available at the moment</p>
            </div> : <div className="flex flex-col items-center space-y-6 p-4 overflow-visible">
              {meetupEvents.slice(0, 6).map((event, index) => <ScrollAnimatedCard key={`meetup-${event.id}`} index={index}>
                   <UniformCard id={event.id} image={event.image_url || communityEvent} video={(event as any).video_url} title={event.title} subtitle={event.location || 'Tel Aviv'} price={event.price} date={getRelativeDay(event.date)} type="event" uploader={{
                      ...event.uploader,
                      user_id: event.user_id
                    }} onProfileClick={userId => navigate(`/profile/${userId}`)} onClick={() => handleMeetupClick({
              id: event.id,
              title: event.title,
              description: event.description || event.title,
              date: event.date || 'Date to be determined',
              time: event.time || 'Time to be determined',
              location: event.location || 'Tel Aviv',
              price: event.price,
              image: event.image_url || communityEvent,
              video: (event as any).video_url,
              uploader: event.uploader,
              organizer: {
                name: event.uploader?.name || "Meetup Organizer",
                image: event.uploader?.image || profile1
              }
            }, [...meetupEvents], index)} showFavoriteButton={true} favoriteData={{
              id: event.id,
              title: event.title,
              description: event.description || event.title,
              image: event.image_url,
              type: 'meetup'
            }} />
                </ScrollAnimatedCard>)}
            </div>}
        </section>
      </main>

      {/* Meetup Popup */}
      {isMeetupPopupOpen && selectedMeetupItem && (
        <MeetupVerticalPopup 
          isOpen={isMeetupPopupOpen} 
          onClose={() => setIsMeetupPopupOpen(false)} 
          item={selectedMeetupItem} 
        />
      )}

      {/* Create Event Popup */}
      {showCreateEvent && (
        <CreateEventPopup 
          isOpen={showCreateEvent} 
          onClose={() => setShowCreateEvent(false)} 
          initialEventType="meetup" 
          onEventCreated={() => {
            refetchMeetups();
          }} 
        />
      )}

      {/* Meetup Filter Popup */}
      {showMeetupFilter && (
        <MeetupFiltersPopup 
          isOpen={showMeetupFilter} 
          onClose={() => setShowMeetupFilter(false)} 
        />
      )}
      
      <BottomNavigation />
    </div>
  );
};

export default MeetupsPage;