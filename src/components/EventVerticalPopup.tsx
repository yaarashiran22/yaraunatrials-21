import { X, MessageCircle, Share, Heart, MapPin, Calendar, ChevronUp, ChevronDown, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useEventRSVP } from "@/hooks/useEventRSVP";
import { useState, useRef, useCallback, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";

// Location mapping from English to Spanish (Buenos Aires neighborhoods)
const locationMapping: Record<string, string> = {
  'palermo': 'Palermo',
  'san-telmo': 'San Telmo',
  'recoleta': 'Recoleta',
  'puerto-madero': 'Puerto Madero',
  'belgrano': 'Belgrano',
  'villa-crespo': 'Villa Crespo'
};

interface EventVerticalPopupProps {
  isOpen: boolean;
  onClose: () => void;
  event?: {
    id?: string;
    title: string;
    image: string;
    price?: string;
    description?: string;
    date?: string;
    time?: string;
    location?: string;
    organizer?: {
      id?: string;
      name: string;
      image: string;
      location?: string;
    };
    allEvents?: any[];
    currentIndex?: number;
  };
}

const EventVerticalPopup = ({
  isOpen,
  onClose,
  event
}: EventVerticalPopupProps) => {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const {
    user
  } = useAuth();
  const isMobile = useIsMobile();
  // Navigation state
  const allEvents = event?.allEvents || [];
  const currentIndex = event?.currentIndex || 0;

  // Vertical scroll state
  const [touchStartY, setTouchStartY] = useState<number>(0);
  const [touchEndY, setTouchEndY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Minimum swipe distance for vertical navigation
  const minScrollDistance = 80;

  // Navigation functions
  const handlePrevious = useCallback(() => {
    if (currentIndex > 0 && allEvents.length > 0) {
      const prevEvent = allEvents[currentIndex - 1];
      if (prevEvent) {
        const newEvent = {
          ...event,
          id: prevEvent.id,
          title: prevEvent.title,
          image: prevEvent.image_url || prevEvent.image,
          price: prevEvent.price,
          description: prevEvent.description || prevEvent.title,
          date: prevEvent.date,
          time: prevEvent.time,
          location: prevEvent.location,
          organizer: prevEvent.organizer,
          currentIndex: currentIndex - 1
        };
        onClose();
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('navigateToEvent', {
            detail: newEvent
          }));
        }, 100);
      }
    }
  }, [currentIndex, allEvents, event, onClose]);

  const handleNext = useCallback(() => {
    if (currentIndex < allEvents.length - 1 && allEvents.length > 0) {
      const nextEvent = allEvents[currentIndex + 1];
      if (nextEvent) {
        const newEvent = {
          ...event,
          id: nextEvent.id,
          title: nextEvent.title,
          image: nextEvent.image_url || nextEvent.image,
          price: nextEvent.price,
          description: nextEvent.description || nextEvent.title,
          date: nextEvent.date,
          time: nextEvent.time,
          location: nextEvent.location,
          organizer: nextEvent.organizer,
          currentIndex: currentIndex + 1
        };
        onClose();
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('navigateToEvent', {
            detail: newEvent
          }));
        }, 100);
      }
    }
  }, [currentIndex, allEvents, event, onClose]);

  // Vertical touch event handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEndY(0);
    setTouchStartY(e.targetTouches[0].clientY);
    setIsDragging(false);
    setScrollOffset(0);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const currentTouch = e.targetTouches[0].clientY;
    const diff = touchStartY - currentTouch;
    if (Math.abs(diff) > 10) {
      setIsDragging(true);
      const maxOffset = 100;
      const limitedOffset = Math.max(-maxOffset, Math.min(maxOffset, diff));
      setScrollOffset(limitedOffset);
    }
  }, [touchStartY]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartY || touchEndY) return;
    setTouchEndY(e.changedTouches[0].clientY);
    const distance = touchStartY - e.changedTouches[0].clientY;
    const isUpSwipe = distance > minScrollDistance;
    const isDownSwipe = distance < -minScrollDistance;
    setIsDragging(false);
    setScrollOffset(0);

    // Handle vertical navigation
    if (isUpSwipe && currentIndex < allEvents.length - 1) {
      handleNext();
    } else if (isDownSwipe && currentIndex > 0) {
      handlePrevious();
    }
  }, [touchStartY, touchEndY, currentIndex, allEvents.length, minScrollDistance, handleNext, handlePrevious]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowUp' && currentIndex > 0) {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'ArrowDown' && currentIndex < allEvents.length - 1) {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, allEvents.length, handlePrevious, handleNext]);

  const defaultEvent = {
    id: "1",
    title: "Community Event",
    image: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&h=300&fit=crop",
    price: "Free",
    description: "Join us for an amazing community event with great people.",
    date: "2024-01-15",
    time: "19:00",
    location: "Tel Aviv",
    organizer: {
      id: "default",
      name: "Event Organizer",
      image: "https://images.unsplash.com/photo-1494790108755-2616b66dfd8d?w=100&h=100&fit=crop",
      location: "Tel Aviv"
    }
  };

  const displayEvent = event || defaultEvent;

  // Companion requests functionality  
  const {
    userRSVP,
    rsvpCount,
    isLoading: rsvpLoading,
    handleRSVP: handleRSVPToggle,
    isUpdating: rsvpUpdating
  } = useEventRSVP(displayEvent?.id || '');

  const handleMessageUser = (userId: string) => {
    navigate(`/messages?userId=${userId}`);
    onClose();
  };

  const handleRSVP = () => {
    handleRSVPToggle('going');
  };

  const handleShare = () => {
    toast({
      title: "Shared Successfully!",
      description: "Event shared on social networks"
    });
  };

  const handleViewProfile = () => {
    if (displayEvent.organizer?.id) {
      navigate(`/profile/${displayEvent.organizer.id}`);
      onClose();
    } else {
      // Fallback: try to extract ID from the event or use a default profile navigation
      const profileId = event?.id || displayEvent.id || 'default';
      navigate(`/profile/${profileId}`);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" ref={containerRef}>
      {/* Navigation Buttons */}
      {allEvents.length > 1 && currentIndex > 0 && 
        <Button 
          variant="ghost" 
          size="lg" 
          onClick={handlePrevious} 
          className="absolute top-8 left-1/2 -translate-x-1/2 z-10 bg-white/90 hover:bg-white text-foreground shadow-lg rounded-full p-3 h-12 w-12"
        >
          <ChevronUp className="h-6 w-6" />
        </Button>
      }
      
      {allEvents.length > 1 && currentIndex < allEvents.length - 1 && 
        <Button 
          variant="ghost" 
          size="lg" 
          onClick={handleNext} 
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 bg-white/90 hover:bg-white text-foreground shadow-lg rounded-full p-3 h-12 w-12"
        >
          <ChevronDown className="h-6 w-6" />
        </Button>
      }

      <div 
        ref={contentRef} 
        className={`bg-background rounded-3xl w-full max-w-sm ${isMobile ? 'max-h-[90vh]' : 'max-h-[80vh]'} overflow-hidden mx-4 relative shadow-2xl border-0 ${isDragging ? 'cursor-grabbing scale-[0.98]' : 'cursor-grab'} event-vertical-popup`} 
        style={{
          transform: isDragging ? `translateY(${-scrollOffset}px)` : 'translateY(0px)',
          scrollBehavior: 'smooth'
        }} 
        onTouchStart={onTouchStart} 
        onTouchMove={onTouchMove} 
        onTouchEnd={onTouchEnd}
      >
        {/* Large Hero Image */}
        <div className="relative h-80 w-full overflow-hidden">
          <img 
            src={displayEvent.image} 
            alt={displayEvent.title} 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
          
          {/* Header Controls */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            {allEvents.length > 1 && (
              <div className="bg-black/30 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-medium">
                {currentIndex + 1} / {allEvents.length}
              </div>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="bg-black/30 backdrop-blur-sm hover:bg-black/50 text-white h-9 w-9 rounded-full p-0"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Heart and Share Buttons */}
          <div className="absolute top-4 right-16 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="bg-black/30 backdrop-blur-sm hover:bg-black/50 text-white h-8 w-8 rounded-full p-0"
            >
              <Share className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="bg-black/30 backdrop-blur-sm hover:bg-black/50 text-white h-8 w-8 rounded-full p-0"
            >
              <Heart className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Organizer Info at Bottom of Image */}
          {displayEvent.organizer && (
            <div className="absolute bottom-4 left-4 right-4">
              <div className="flex items-center gap-3 rounded-full px-4 py-2">
                <img 
                  src={displayEvent.organizer.image} 
                  alt={displayEvent.organizer.name} 
                  className="w-8 h-8 rounded-full object-cover border-2 border-white/30"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">
                    {displayEvent.organizer.name}
                  </p>
                  <p className="text-xs text-white/80">Organizer</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Progress Indicators */}
        {allEvents.length > 1 && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-10">
            {allEvents.map((_, index) => (
              <div 
                key={index} 
                className={`w-1.5 h-6 rounded-full transition-all duration-300 ${
                  index === currentIndex ? 'bg-white shadow-lg scale-125' : 'bg-white/40'
                }`} 
              />
            ))}
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Title and Description */}
          <div className="text-center space-y-3">
            <h3 className="text-2xl font-bold text-foreground leading-tight">
              {displayEvent.title}
            </h3>
            {displayEvent.description && (
              <p className="text-foreground leading-relaxed">
                {displayEvent.description}
              </p>
            )}
          </div>

          {/* Event Details */}
          <div className="space-y-3 p-4 bg-muted/30 rounded-2xl">
            <div className="flex items-center gap-3 text-sm font-medium text-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              <span>{locationMapping[displayEvent.location] || displayEvent.location || 'Location TBD'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm font-medium text-foreground">
              <Calendar className="h-4 w-4 text-primary" />
              <span>
                {displayEvent.date ? new Date(displayEvent.date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : 'Date TBD'}
              </span>
            </div>
            {displayEvent.time && (
              <div className="flex items-center gap-3 text-sm font-medium text-foreground">
                <Clock className="h-4 w-4 text-primary" />
                <span>{displayEvent.time}</span>
              </div>
            )}
          </div>


          {/* RSVP */}
          <div className="space-y-4">
            {userRSVP?.status === 'going' ? (
              <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-semibold">You're Attending!</span>
                </div>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  Looking forward to seeing you there!
                </p>
              </div>
            ) : (
              <Button 
                onClick={handleRSVP} 
                disabled={rsvpUpdating}
                className="w-full h-12 bg-coral hover:bg-coral-hover text-coral-foreground rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                RSVP to Event
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventVerticalPopup;