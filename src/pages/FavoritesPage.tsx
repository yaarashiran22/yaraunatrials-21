import { Heart, Calendar, MapPin, Gift, ArrowLeft, Store, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useFavorites } from "@/contexts/FavoritesContext";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import { useState } from "react";
import EventPopup from "@/components/EventPopup";
import BusinessPopup from "@/components/BusinessPopup";
import MarketplacePopup from "@/components/MarketplacePopup";

const FavoritesPage = () => {
  const navigate = useNavigate();
  const { favorites, removeFromFavorites } = useFavorites();
  const [filter, setFilter] = useState<'all' | 'event'>('all');
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Filter favorites based on selected type
  const filteredFavorites = favorites.filter(item => {
    if (filter === 'all') return true;
    return item.type === filter;
  });

  const handleItemClick = (item: any) => {
    if (item.type === 'event') {
      setSelectedEvent(item.data);
    } else if (item.type === 'business') {
      setSelectedBusiness(item.data);
    } else if (item.type === 'item') {
      setSelectedItem(item.data);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'event':
        return <Calendar className="h-4 w-4" />;
      case 'business':
        return <Store className="h-4 w-4" />;
      case 'item':
        return <Gift className="h-4 w-4" />;
      default:
        return <Heart className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'event':
        return 'Event';
      case 'business':
        return 'Business';
      case 'item':
        return 'Item';
      default:
        return 'Unknown';
    }
  };

  const getItemCount = (type: string) => {
    return favorites.filter(item => item.type === type).length;
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Mobile Header */}
      <div className="lg:hidden">
        <Header />
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:block p-6 border-b">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            className="rounded-full"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-coral bg-clip-text text-transparent">
            My Favorites
          </h1>
        </div>
      </div>

      <div className="p-4 pb-20 lg:pb-4">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            className="rounded-full"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-coral bg-clip-text text-transparent">
            My Favorites
          </h1>
          <div className="w-8"></div>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className="rounded-full"
          >
            <Heart className="h-4 w-4 mr-2" />
            All ({favorites.length})
          </Button>
          <Button
            variant={filter === 'event' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('event')}
            className="rounded-full"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Events ({getItemCount('event')})
          </Button>
        </div>

        {/* Favorites Grid */}
        {filteredFavorites.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFavorites.map((item) => (
              <div key={`${item.type}-${item.id}`} className="group">
                <div 
                  className="bg-white rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer"
                  onClick={() => handleItemClick(item)}
                >
                  {/* Image */}
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {item.image ? (
                      <img 
                        src={item.image} 
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        {getTypeIcon(item.type)}
                      </div>
                    )}
                    
                    {/* Remove from favorites button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2 rounded-full p-2 h-8 w-8 bg-white/90 hover:bg-white border-red-200 text-red-500 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromFavorites(item.id, item.type);
                      }}
                    >
                      <Heart className="h-3 w-3 fill-current" />
                    </Button>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {getTypeIcon(item.type)}
                      <span className="text-xs px-2 py-1 rounded-full font-medium bg-primary/10 text-primary">
                        {getTypeLabel(item.type)}
                      </span>
                    </div>
                    
                    <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
                      {item.title}
                    </h3>
                    
                    {item.subtitle && (
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                        {item.subtitle}
                      </p>
                    )}
                    
                    {item.price && (
                      <div className="flex items-center gap-1 text-sm font-medium text-coral">
                        <span>{item.price}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="mb-4 p-4 rounded-full bg-muted w-fit mx-auto">
              <Heart className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">
              {filter === 'all' ? 'No favorites yet' : `No ${filter}s favorited`}
            </h2>
            <p className="text-muted-foreground mb-6">
              {filter === 'all' 
                ? 'Start exploring and add items to your favorites by tapping the heart icon'
                : `You haven't favorited any ${filter}s yet. Explore and find some you like!`
              }
            </p>
            <Button 
              onClick={() => navigate('/')}
              className="bg-gradient-to-r from-primary to-secondary hover:from-primary-600 hover:to-secondary-600 text-white"
            >
              Explore Now
            </Button>
          </div>
        )}
      </div>

      {/* Mobile Navigation */}
      <div className="lg:hidden">
        <BottomNavigation />
      </div>

      {/* Popups */}
      {selectedEvent && (
        <EventPopup
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          event={selectedEvent}
        />
      )}
      
      {selectedBusiness && (
        <BusinessPopup
          isOpen={!!selectedBusiness}
          onClose={() => setSelectedBusiness(null)}
          business={selectedBusiness}
        />
      )}
      
      {selectedItem && (
        <MarketplacePopup
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          item={selectedItem}
        />
      )}
    </div>
  );
};

export default FavoritesPage;