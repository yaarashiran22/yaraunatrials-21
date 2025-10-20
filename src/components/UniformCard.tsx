
import React from "react";
import { Heart, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useEventRSVP } from "@/hooks/useEventRSVP";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface UniformCardProps {
  id?: string;
  image?: string;
  video?: string;
  title: string | React.ReactNode;
  subtitle?: string;
  price?: string;
  date?: string; // Add date field
  isLiked?: boolean;
  type: 'business' | 'marketplace' | 'event' | 'item' | 'artwork';
  onClick?: () => void;
  altText?: string; // For image alt text when title is ReactNode
  favoriteData?: any; // Complete data for favorites
  uploader?: {
    name: string;
    image: string;
    small_photo: string;
    location: string;
    user_id?: string;
  };
  showFavoriteButton?: boolean; // Control whether to show the favorite button
  onProfileClick?: (userId: string) => void; // Handler for profile navigation
  className?: string; // Custom className for styling
}

const UniformCard = ({ 
  id = Math.random().toString(), 
  image, 
  video,
  title, 
  subtitle, 
  price, 
  date,
  isLiked = false, 
  type, 
  onClick, 
  altText,
  favoriteData,
  uploader,
  showFavoriteButton = true,
  onProfileClick,
  className = ""
}: UniformCardProps) => {
  const { isFavorite, toggleFavorite } = useFavorites();
  const { user } = useAuth();
  
  // RSVP functionality for events
  const { userRSVP, handleRSVP: handleEventRSVP, isUpdating } = useEventRSVP(
    type === 'event' ? id : ''
  );
  
  // Check favorites context for all items
  const isCurrentlyFavorited = isFavorite(id, type);
  
  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Handle all items using favorites context
    if (favoriteData) {
      const favoriteItem = {
        id: id,
        type: type as 'business' | 'event',
        title: typeof title === 'string' ? title : 'Item',
        subtitle: subtitle,
        image: image,
        price: price,
        data: favoriteData
      };
      toggleFavorite(favoriteItem);
    }
  };

  const handleRSVPClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!user) {
      toast({
        title: "נדרשת התחברות",
        description: "יש להתחבר כדי להגיב לאירוע",
        variant: "destructive",
      });
      return;
    }

    handleEventRSVP('going');
  };

  // Extract string from title for alt text
  const getAltText = () => {
    if (altText) return altText;
    if (typeof title === 'string') return title;
    return 'Card image';
  };

  return (
    <div 
      className={`relative card-elevated rounded-3xl overflow-hidden group w-full cursor-pointer transition-all duration-500 hover:scale-[1.08] hover:shadow-2xl hover:shadow-primary/30 hover:z-10 ${className}`}
      onClick={onClick}
      style={{
        transform: 'perspective(1000px)',
        transformStyle: 'preserve-3d',
        minWidth: '320px',
        width: '320px'
      }}
    >
      <div className="aspect-[3/4] overflow-hidden relative rounded-3xl">
        {video ? (
          <video
            src={video} 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
            muted
            autoPlay
            loop
            playsInline
            preload="metadata"
            poster={image}
            onLoadedData={(e) => {
              e.currentTarget.play().catch(() => {
                console.log('Autoplay blocked, video will play on user interaction');
              });
            }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              console.log('Video failed to load:', video);
            }}
          />
        ) : (
          <img 
            src={image || '/placeholder.svg'} 
            alt={getAltText()}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
          />
        )}
        
        {/* Enhanced shimmer overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-all duration-1000 ease-out"></div>
        
        {/* Subtle glow border on hover */}
        <div className="absolute inset-0 rounded-3xl border-2 border-transparent group-hover:border-primary/30 transition-all duration-500"></div>
        
        {/* Enhanced text overlay - more compact to show more image */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 transform translate-y-0 group-hover:translate-y-[-2px] transition-transform duration-300">
          <div className="space-y-1.5">
            <h3 className="font-black text-white line-clamp-2 text-2xl leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] group-hover:drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] transition-all duration-300 font-display tracking-wide text-shadow-strong bg-gradient-to-r from-white to-white/95 bg-clip-text [text-shadow:_0_2px_4px_rgb(0_0_0_/_80%)]">{title}</h3>
            {subtitle && (
              <p className="text-sm text-white/90 line-clamp-1 drop-shadow-md transform translate-y-0 group-hover:translate-y-[-1px] transition-transform duration-300 font-medium">{subtitle}</p>
            )}
            
            {/* User profile section for events - more prominent */}
            {type === 'event' && uploader && (
              <div 
                className="flex items-center gap-2 cursor-pointer group/profile transition-all duration-300 hover:scale-105 mb-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/20 shadow-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onProfileClick && uploader.user_id) {
                    onProfileClick(uploader.user_id);
                  }
                }}
              >
                <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-white/60 shadow-lg group-hover/profile:border-white transition-all duration-300">
                  <img
                    src={uploader.image || uploader.small_photo} 
                    alt={uploader.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white drop-shadow-md group-hover/profile:text-white transition-colors duration-300">by {uploader.name}</span>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-start gap-2 flex-wrap">
              {date && (
                <span className="text-xs font-bold px-3 py-1 bg-gradient-to-r from-[#E91E63] to-[#9C27B0] backdrop-blur-md rounded-full text-white border border-pink-400/40 shadow-lg transition-all duration-300 group-hover:shadow-pink-400/50 group-hover:scale-105">{date}</span>
              )}
              {(price || (type === 'event')) && (
                <span className="text-xs font-bold px-3 py-1 bg-black backdrop-blur-md rounded-full text-white border border-white/40 shadow-lg transition-all duration-300 group-hover:bg-black/90 group-hover:scale-105">
                  {price ? `$${price}` : 'free'}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* RSVP button for events, heart for other types */}
        {showFavoriteButton && (
          <>
            {type === 'event' ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={isUpdating}
                className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-all duration-300 border shadow-lg hover:scale-110 active:scale-95 ${
                  userRSVP?.status === 'going'
                    ? 'text-green-600 bg-green-100/90 border-green-200 hover:bg-green-200'
                    : 'text-white bg-white/20 border-white/30 hover:bg-white/30 hover:text-primary'
                }`}
                onClick={handleRSVPClick}
              >
                <CalendarCheck className={`h-4 w-4 transition-all duration-300 ${
                  userRSVP?.status === 'going' ? 'fill-current' : ''
                }`} />
              </Button>
            ) : (type === 'marketplace' || type === 'artwork' || type === 'business') && (
              <Button
                variant="ghost"
                size="sm"
                className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-all duration-300 border shadow-lg hover:scale-110 active:scale-95 ${
                  isCurrentlyFavorited 
                    ? 'text-red-500 bg-white/90 border-red-200 hover:bg-white shadow-red-200/50' 
                    : 'text-white bg-white/20 border-white/30 hover:bg-white/30 hover:text-red-400'
                }`}
                onClick={handleFavoriteClick}
              >
                <Heart className={`h-4 w-4 transition-all duration-300 ${isCurrentlyFavorited ? 'fill-current animate-pulse' : ''}`} />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default UniformCard;
