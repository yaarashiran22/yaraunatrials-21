import { X, MessageCircle, Share, Heart, MapPin, Calendar, ChevronUp, ChevronDown, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useItemDetails } from "@/hooks/useItemDetails";
import { useMeetupJoinRequests } from "@/hooks/useMeetupJoinRequests";
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
interface MeetupVerticalPopupProps {
  isOpen: boolean;
  onClose: () => void;
  item?: {
    id?: string;
    title: string;
    image: string;
    price: string;
    description?: string;
    neighborhood?: string;
    seller?: {
      id?: string;
      name: string;
      image: string;
      location: string;
    };
    condition?: string;
    type?: string;
    allItems?: any[];
    currentIndex?: number;
  };
}
const MeetupVerticalPopup = ({
  isOpen,
  onClose,
  item
}: MeetupVerticalPopupProps) => {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const {
    user
  } = useAuth();
  const isMobile = useIsMobile();
  const {
    submitJoinRequest,
    checkJoinStatus
  } = useMeetupJoinRequests();
  const [joinStatus, setJoinStatus] = useState<string | null>(null);

  // Navigation state
  const allItems = item?.allItems || [];
  const currentIndex = item?.currentIndex || 0;

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
    if (currentIndex > 0 && allItems.length > 0) {
      const prevItem = allItems[currentIndex - 1];
      if (prevItem) {
        const newItem = {
          ...item,
          id: prevItem.id,
          title: prevItem.title,
          image: prevItem.image_url || prevItem.image,
          price: prevItem.price ? `₪${prevItem.price}` : undefined,
          description: prevItem.description || `${prevItem.title} - Join this meetup!`,
          currentIndex: currentIndex - 1
        };
        onClose();
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('navigateToMeetup', {
            detail: newItem
          }));
        }, 100);
      }
    }
  }, [currentIndex, allItems, item, onClose]);
  const handleNext = useCallback(() => {
    if (currentIndex < allItems.length - 1 && allItems.length > 0) {
      const nextItem = allItems[currentIndex + 1];
      if (nextItem) {
        const newItem = {
          ...item,
          id: nextItem.id,
          title: nextItem.title,
          image: nextItem.image_url || nextItem.image,
          price: nextItem.price ? `₪${nextItem.price}` : undefined,
          description: nextItem.description || `${nextItem.title} - Join this meetup!`,
          currentIndex: currentIndex + 1
        };
        onClose();
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('navigateToMeetup', {
            detail: newItem
          }));
        }, 100);
      }
    }
  }, [currentIndex, allItems, item, onClose]);

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
    if (isUpSwipe && currentIndex < allItems.length - 1) {
      handleNext();
    } else if (isDownSwipe && currentIndex > 0) {
      handlePrevious();
    }
  }, [touchStartY, touchEndY, currentIndex, allItems.length, minScrollDistance, handleNext, handlePrevious]);

  // Check join status when item changes
  useEffect(() => {
    if (item?.id && user) {
      checkJoinStatus(item.id).then(status => {
        setJoinStatus(status);
      });
    }
  }, [item?.id, user, checkJoinStatus]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowUp' && currentIndex > 0) {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'ArrowDown' && currentIndex < allItems.length - 1) {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, allItems.length, handlePrevious, handleNext]);

  // Fetch item details
  const {
    item: itemDetails,
    loading: itemLoading
  } = useItemDetails(item?.id || "");
  const hasItemData = item && item.title && item.image;
  if (itemLoading && !hasItemData && item?.id) {
    return <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
        <div className="bg-background rounded-2xl w-full max-w-sm p-8 mx-4">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-foreground">Loading meetup details...</p>
          </div>
        </div>
      </div>;
  }
  const defaultItem = {
    id: "1",
    title: "Coffee Meetup",
    image: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=400&h=300&fit=crop",
    price: "Free",
    description: "Join us for a casual coffee meetup and networking session.",
    seller: {
      id: "default",
      name: "Community Organizer",
      image: "https://images.unsplash.com/photo-1494790108755-2616b66dfd8d?w=100&h=100&fit=crop",
      location: "Tel Aviv"
    },
    condition: "Active"
  };
  const displayItem = itemDetails ? {
    id: itemDetails.id,
    title: itemDetails.title,
    image: itemDetails.image_url || item?.image || defaultItem.image,
    price: itemDetails.price ? `₪${itemDetails.price}` : item?.price || defaultItem.price,
    description: itemDetails.description || item?.description || defaultItem.description,
    seller: {
      id: itemDetails.uploader.id,
      name: itemDetails.uploader.name || "Organizer",
      image: itemDetails.uploader.profile_image_url || defaultItem.seller.image,
      location: itemDetails.uploader.location || "Not specified"
    },
    condition: item?.condition || defaultItem.condition
  } : item || defaultItem;


  const handleMessageUser = (userId: string) => {
    navigate(`/messages?userId=${userId}`);
    onClose();
  };
  const handleContact = async () => {
    if (!item?.id) return;
    const success = await submitJoinRequest(item.id);
    if (success) {
      setJoinStatus('pending');
    }
  };
  const handleShare = () => {
    toast({
      title: "Shared Successfully!",
      description: "Meetup shared on social networks"
    });
  };
  const handleViewProfile = () => {
    if (displayItem.seller?.id) {
      navigate(`/profile/${displayItem.seller.id}`);
      onClose();
    } else {
      // Fallback: try to extract ID from the item or use a default profile navigation
      const profileId = item?.id || displayItem.id || 'default';
      navigate(`/profile/${profileId}`);
      onClose();
    }
  };
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" ref={containerRef}>
      {/* Navigation Buttons */}
      {allItems.length > 1 && currentIndex > 0 && 
        <Button 
          variant="ghost" 
          size="lg" 
          onClick={handlePrevious} 
          className="absolute top-8 left-1/2 -translate-x-1/2 z-10 bg-white/90 hover:bg-white text-foreground shadow-lg rounded-full p-3 h-12 w-12"
        >
          <ChevronUp className="h-6 w-6" />
        </Button>
      }
      
      {allItems.length > 1 && currentIndex < allItems.length - 1 && 
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
        className={`bg-background rounded-3xl w-full max-w-sm ${isMobile ? 'max-h-[90vh]' : 'max-h-[80vh]'} overflow-hidden mx-4 relative shadow-2xl border-0 ${isDragging ? 'cursor-grabbing scale-[0.98]' : 'cursor-grab'} meetup-vertical-popup`} 
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
            src={displayItem.image} 
            alt={displayItem.title} 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
          
          {/* Header Controls */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            {allItems.length > 1 && (
              <div className="bg-black/30 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-medium">
                {currentIndex + 1} / {allItems.length}
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
          {displayItem.seller && (
            <div className="absolute bottom-4 left-4 right-4">
              <div className="flex items-center gap-3 rounded-full px-4 py-2">
                <img 
                  src={displayItem.seller.image} 
                  alt={displayItem.seller.name} 
                  className="w-8 h-8 rounded-full object-cover border-2 border-white/30"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">
                    {displayItem.seller.name}
                  </p>
                  <p className="text-xs text-white/80">Organizer</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Progress Indicators */}
        {allItems.length > 1 && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-10">
            {allItems.map((_, index) => (
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
              {displayItem.title}
            </h3>
            {displayItem.description && (
              <p className="text-foreground leading-relaxed">
                {displayItem.description}
              </p>
            )}
          </div>

          {/* Meetup Details */}
          <div className="space-y-3 p-4 bg-muted/30 rounded-2xl">
            {displayItem.price && displayItem.price !== 'Free' && (
              <div className="flex items-center gap-3 text-sm font-medium text-foreground">
                <div className="h-4 w-4 rounded-full bg-coral flex items-center justify-center text-xs text-white font-bold">₪</div>
                <span>{displayItem.price}</span>
              </div>
            )}
            {(!displayItem.price || displayItem.price === 'Free') && (
              <div className="flex items-center gap-3 text-sm font-medium text-foreground">
                <div className="h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center text-xs text-white font-bold">!</div>
                <span>Free Meetup</span>
              </div>
            )}
            {itemDetails?.location && (
              <div className="flex items-center gap-3 text-sm font-medium text-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                <span>{locationMapping[itemDetails.location] || itemDetails.location}</span>
              </div>
            )}
            {itemDetails?.created_at && (
              <div className="flex items-center gap-3 text-sm font-medium text-foreground">
                <Calendar className="h-4 w-4 text-primary" />
                <span>
                  {itemDetails.meetup_date ? (
                    // Show actual meetup date if available
                    <>
                      {new Date(itemDetails.meetup_date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                      {itemDetails.meetup_time && (
                        <> at {itemDetails.meetup_time.slice(0, 5)}</>
                      )}
                    </>
                  ) : (
                    // Fallback to creation date
                    <>Created {new Date(itemDetails.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}</>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Location and Date */}
          {itemDetails && (
            <div className="space-y-3 p-4 bg-muted/30 rounded-2xl">
              <div className="flex items-center gap-3 text-sm font-medium text-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                <span>{locationMapping[itemDetails.location] || itemDetails.location || 'Location TBD'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-medium text-foreground">
                <Calendar className="h-4 w-4 text-primary" />
                <span>
                  {new Date(itemDetails.created_at).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          )}


          {/* Join Request */}
          <div className="space-y-4">
            {joinStatus === 'approved' ? (
              <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-semibold">You're Joined!</span>
                </div>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  Looking forward to seeing you there!
                </p>
              </div>
            ) : joinStatus === 'pending' ? (
              <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                  <Clock className="h-5 w-5 animate-pulse" />
                  <span className="font-semibold">Request Pending</span>
                </div>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Waiting for organizer approval...
                </p>
              </div>
            ) : (
              <Button 
                onClick={handleContact} 
                className="w-full h-12 bg-coral hover:bg-coral-hover text-coral-foreground rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Request to Join
              </Button>
            )}
           </div>
         </div>
       </div>
     </div>;
 };
 export default MeetupVerticalPopup;