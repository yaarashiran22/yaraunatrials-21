import { X, MessageCircle, Share, Bookmark, MapPin, Eye, Check, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useItemDetails } from "@/hooks/useItemDetails";
import { useEventRSVP } from "@/hooks/useEventRSVP";
import { getRelativeDay } from "@/utils/dateUtils";
import profile1 from "@/assets/profile-1.jpg";
import { useIsMobile } from "@/hooks/use-mobile";

interface EventPopupProps {
  isOpen: boolean;
  onClose: () => void;
  eventId?: string;
  event?: {
    id?: string;
    title: string;
    image: string;
    video?: string;
    price?: string;
    description: string;
    organizer?: {
      id?: string;
      name: string;
      image: string;
      location: string;
    };
    date?: string;
  };
}

const EventPopup = ({ isOpen, onClose, eventId, event }: EventPopupProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // Always show UI immediately with passed event data
  // Only fetch additional details if we need mobile_number or other specific data AND have a valid ID
  const needsAdditionalData = !event?.organizer?.id && eventId && eventId !== "1";
  const { item: eventData, loading } = useItemDetails(needsAdditionalData ? eventId : '');

  const defaultEvent = {
    id: undefined,
    title: "Event Party",
    image: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=400&h=600&fit=crop",
    price: "₪50",
    description: "Join us for an amazing event with great music, food, and friends!",
    organizer: {
      id: "default",
      name: "Event Organizer",
      image: profile1,
      location: "Tel Aviv"
    },
    date: new Date(Date.now() + 86400000).toISOString() // Tomorrow
  };

  // Use passed event data first, then fetched data, then defaults
  const displayEvent = event || (eventData ? {
    id: eventData.id,
    title: eventData.title,
    image: eventData.image_url || defaultEvent.image,
    price: eventData.price ? "₪" + eventData.price : undefined,
    description: eventData.description || defaultEvent.description,
    organizer: {
      id: eventData.uploader?.id || defaultEvent.organizer.id,
      name: eventData.uploader?.name || defaultEvent.organizer.name,
      image: eventData.uploader?.profile_image_url || defaultEvent.organizer.image,
      location: eventData.uploader?.location || defaultEvent.organizer.location
    },
    date: eventData.created_at || defaultEvent.date
  } : defaultEvent);

  // Only use event ID for RSVP/companion features if it's not the default
  const validEventId = eventId && eventId !== "1" ? eventId : displayEvent.id;
  
  // RSVP functionality - only if we have a valid event ID
  const { userRSVP, rsvpCount, handleRSVP, isUpdating } = useEventRSVP(validEventId || '');
  

  const handleMessageUser = (userId: string) => {
    navigate(`/messages?userId=${userId}`);
    onClose();
  };

  const handleContact = () => {
    if (eventData?.mobile_number) {
      window.open(`tel:${eventData.mobile_number}`, '_self');
    } else {
      toast({
        title: "No contact information",
        description: "This organizer hasn't provided contact details",
        variant: "destructive",
      });
    }
  };

  const handleShare = () => {
    toast({
      title: "Event Shared!",
      description: "Event shared on social networks",
    });
  };

  const handleViewDetails = () => {
    if (validEventId) {
      navigate(`/events/${validEventId}`);
      onClose();
    }
  };

  const handleViewProfile = () => {
    if (displayEvent.organizer?.id && displayEvent.organizer.id !== "default") {
      navigate(`/profile/${displayEvent.organizer.id}`);
      onClose();
    } else {
      // Fallback for when organizer ID is not available
      const profileId = eventData?.uploader?.id || eventId || 'default';
      if (profileId !== 'default') {
        navigate(`/profile/${profileId}`);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  // Show loading state only when we need additional data
  if (loading && needsAdditionalData) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-background rounded-3xl w-full max-w-sm p-8 mx-4">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-foreground">Loading event details...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`bg-background rounded-3xl w-full max-w-3xl ${isMobile ? 'max-h-[90vh]' : 'max-h-[85vh]'} overflow-hidden mx-4 relative shadow-2xl border-0 flex flex-col`}>
        {/* Large Hero Image */}
        <div className="relative h-64 w-full overflow-hidden flex-shrink-0">
          <img 
            src={displayEvent.image}
            alt={displayEvent.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
          
          {/* Header Controls */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="bg-black/30 backdrop-blur-sm hover:bg-black/50 text-white h-9 w-9 rounded-full p-0"
            >
              <X className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="bg-black/30 backdrop-blur-sm hover:bg-black/50 text-white h-9 w-9 rounded-full p-0"
            >
              <Bookmark className="h-4 w-4" />
            </Button>
          </div>

          {/* Price Badge */}
          {displayEvent.price && (
            <div className="absolute bottom-4 left-4">
              {displayEvent.price === 'Free' || displayEvent.price === '₪0' ? (
                <div className="bg-emerald-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-full font-bold">
                  Free Event
                </div>
              ) : (
                <div className="bg-white/90 backdrop-blur-sm text-foreground px-4 py-2 rounded-full font-bold">
                  {displayEvent.price}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Title and Description */}
          <div className="text-center space-y-3">
            <h3 className="text-2xl font-bold text-foreground leading-tight">
              {displayEvent.title}
            </h3>
            <p className="text-foreground leading-relaxed">
              {displayEvent.description}
            </p>
          </div>

          {/* Date Info */}
          {displayEvent.date && (
            <div className="text-center p-3 bg-muted/30 rounded-2xl">
              <p className="text-sm font-medium text-foreground">
                {getRelativeDay(displayEvent.date)}
              </p>
            </div>
          )}

          {/* RSVP Section */}
          {validEventId && (
            <div className="flex justify-center gap-2">
              <Button
                onClick={() => handleRSVP('going')}
                disabled={isUpdating}
                variant={userRSVP?.status === 'going' ? "default" : "outline"}
                className={`h-10 px-6 rounded-2xl font-semibold transition-all duration-200 ${
                  userRSVP?.status === 'going' 
                    ? 'bg-gradient-to-r from-primary to-secondary text-primary-foreground' 
                    : 'border-2 border-primary/30 hover:bg-primary/10 text-primary'
                }`}
              >
                <Check className="h-4 w-4 mr-2" />
                Going
              </Button>
              <Button
                onClick={() => handleRSVP('maybe')}
                disabled={isUpdating}
                variant={userRSVP?.status === 'maybe' ? "secondary" : "outline"}
                className={`h-10 px-6 rounded-2xl font-semibold transition-all duration-200 ${
                  userRSVP?.status === 'maybe' 
                    ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                    : 'border-2 border-amber-300 text-amber-700 hover:bg-amber-50'
                }`}
              >
                <UserCheck className="h-4 w-4 mr-2" />
                Maybe
              </Button>
            </div>
          )}

          {/* Attendee Count */}
          {validEventId && rsvpCount > 0 && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {rsvpCount} {rsvpCount === 1 ? 'person' : 'people'} attending
              </p>
            </div>
          )}

          
          {/* Compact Organizer Info */}
          {displayEvent.organizer && (
            <div 
              className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl cursor-pointer hover:bg-muted/30 transition-all duration-200 group border border-border/30 hover:border-primary/40" 
              onClick={handleViewProfile}
            >
              <img 
                src={displayEvent.organizer.image}
                alt={displayEvent.organizer.name}
                className="w-8 h-8 rounded-full object-cover border border-primary/20 group-hover:border-primary/40 transition-colors"
                onError={(e) => {
                  e.currentTarget.src = profile1;
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm group-hover:text-primary transition-colors truncate">
                  {displayEvent.organizer.name}
                </p>
                <p className="text-xs text-muted-foreground">Organizer</p>
              </div>
              <div className="p-1 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Eye className="h-3 w-3 text-primary" />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button 
              onClick={handleContact}
              variant={eventData?.mobile_number ? "default" : "outline"}
              disabled={!eventData?.mobile_number}
              className={`w-full h-12 rounded-2xl font-semibold transition-all duration-200 ${
                eventData?.mobile_number 
                  ? 'bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105' 
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              {eventData?.mobile_number ? 'Contact Organizer' : 'No contact info'}
            </Button>
            
            <div className="flex gap-3">
              <Button 
                onClick={handleViewDetails}
                className="flex-1 h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
              >
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Button>
              <Button 
                onClick={handleShare}
                variant="outline"
                className="h-12 w-12 border-2 border-primary/30 hover:bg-primary/10 rounded-2xl transition-all duration-200"
              >
                <Share className="h-4 w-4 text-primary" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventPopup;